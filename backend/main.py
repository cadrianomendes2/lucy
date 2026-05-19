import asyncio
import os
import json
import base64
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from memory.sqlite_service import init_db, delete_fact, log_turn
from memory.lancedb_service import search_memories, get_all_memories, delete_memory
from memory.memory_extractor import extract_and_store

load_dotenv(os.path.expanduser("~/.personal-ai/.env"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234")
RESEMBLE_TOKEN = os.getenv("RESEMBLE_TOKEN")
RESEMBLE_SYNTH_URL_PT = os.getenv("RESEMBLE_SYNTH_URL_PT", "https://f.cluster.resemble.ai/synthesize")
RESEMBLE_SYNTH_URL_EN = os.getenv("RESEMBLE_SYNTH_URL_EN", "https://p.cluster.resemble.ai/synthesize")

VOICES = [
    {"uuid": "33eecc17", "label": "Primrose", "lang": "en-US", "tags": ["character", "vivid"]},
    {"uuid": "e6ec3ca4", "label": "Bentley",  "lang": "en-US", "tags": ["character", "teen", "vivid"]},
    {"uuid": "55f5b8dc", "label": "Linda",    "lang": "en-GB", "tags": ["assistant", "calm"]},
    {"uuid": "c49e1b04", "label": "Laura",    "lang": "en-US", "tags": ["assistant", "raspy"]},
    {"uuid": "7a33e74f", "label": "Vanessa",  "lang": "pt-BR", "tags": ["character", "young", "carioca"]},
    {"uuid": "e28236ee", "label": "Samantha", "lang": "en-US", "tags": ["female", "standard"]},
]

SYNTH_URL_BY_UUID = {
    "7a33e74f": RESEMBLE_SYNTH_URL_PT,
}

LM_STUDIO_MODEL_LITE = os.getenv("LM_STUDIO_MODEL_LITE", "gemma-4-e4b-it-ultra-uncensored-heretic")
LM_STUDIO_MODEL_HEAVY = os.getenv("LM_STUDIO_MODEL_HEAVY", "gemma-4-31b-it-uncensored-heretic")

MODELS = {
    "gemma-lite": LM_STUDIO_MODEL_LITE,
    "gemma-heavy": LM_STUDIO_MODEL_HEAVY,
}

PERSONA_PATH = os.path.join(os.path.dirname(__file__), "persona", "identity.json")
with open(PERSONA_PATH, encoding="utf-8") as f:
    PERSONA = json.load(f)

init_db()


def get_system_prompt(language: str, memories: list[dict] | None = None) -> str:
    base = PERSONA["system_prompts"].get(language, PERSONA["system_prompts"]["pt"])
    if not memories:
        return (
            f"{base}\n\n## Memória sobre o utilizador:\n"
            "Ainda não tens factos guardados sobre esta pessoa. "
            "Se te perguntarem o que sabes ou o que foi dito antes, admite honestamente que não tens memória disso. "
            "Nunca inventes ou suponhas factos sobre o utilizador."
        )
    facts_text = "\n".join(f"- {m['fact']}" for m in memories)
    return f"{base}\n\n## O que sabes sobre o utilizador:\n{facts_text}"


class ChatRequest(BaseModel):
    message: str
    model: str = "gemma-lite"
    language: str = "pt"
    history: list[dict] = []


async def stream_lm_studio(message: str, history: list[dict], model_id: str, system_prompt: str):
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
    payload = {
        "model": model_id,
        "messages": messages,
        "stream": True,
        "max_tokens": 2048,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{LM_STUDIO_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        ) as response:
            if response.status_code != 200:
                yield f"data: {json.dumps({'error': f'LM Studio respondeu com {response.status_code}'})}\n\n"
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:]
                if raw == "[DONE]":
                    break
                try:
                    chunk = json.loads(raw)
                    delta = chunk["choices"][0]["delta"].get("content", "")
                    if delta:
                        yield f"data: {json.dumps({'text': delta})}\n\n"
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    yield "data: [DONE]\n\n"


async def _stream_and_collect(base_gen, user_message: str, model: str, language: str):
    collected: list[str] = []

    async for chunk in base_gen:
        if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
            try:
                data = json.loads(chunk[6:])
                if text := data.get("text"):
                    collected.append(text)
            except (json.JSONDecodeError, KeyError):
                pass
        yield chunk

    full_response = "".join(collected)
    if full_response:
        log_turn("user", user_message, model, language)
        log_turn("assistant", full_response, model, language)
        asyncio.create_task(
            extract_and_store(user_message, full_response, LM_STUDIO_URL, LM_STUDIO_MODEL_LITE)
        )


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo desconhecido: {req.model}")

    relevant = search_memories(req.message, top_k=5)
    system_prompt = get_system_prompt(req.language, relevant)
    model_id = MODELS[req.model]
    base = stream_lm_studio(req.message, req.history, model_id, system_prompt)
    generator = _stream_and_collect(base, req.message, req.model, req.language)
    return StreamingResponse(generator, media_type="text/event-stream")


class TTSRequest(BaseModel):
    text: str
    voice_uuid: str


@app.get("/api/voices")
def get_voices():
    return VOICES


@app.post("/api/tts")
async def tts(req: TTSRequest):
    if not RESEMBLE_TOKEN:
        raise HTTPException(status_code=500, detail="RESEMBLE_TOKEN não configurado")

    synth_url = SYNTH_URL_BY_UUID.get(req.voice_uuid, RESEMBLE_SYNTH_URL_EN)

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            synth_url,
            json={"voice_uuid": req.voice_uuid, "data": req.text},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {RESEMBLE_TOKEN}",
            },
        )

    if not r.is_success:
        raise HTTPException(status_code=r.status_code, detail=r.text)

    body = r.json()
    b64 = body.get("audio_content") or body.get("audio")
    if not b64:
        raise HTTPException(status_code=500, detail="Resemble não retornou áudio")

    return Response(content=base64.b64decode(b64), media_type="audio/wav")


@app.get("/api/memories")
def list_memories():
    return get_all_memories()


@app.delete("/api/memories/{fact_id}")
def remove_memory(fact_id: str):
    delete_memory(fact_id)
    delete_fact(fact_id)
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"status": "ok"}
