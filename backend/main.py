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
from tools.web_search import web_search
from services.learner import start_learner

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


@app.on_event("startup")
async def _startup():
    asyncio.create_task(start_learner())


WEB_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": "Pesquisa na internet por informação actual, notícias, preços ou eventos recentes",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "termos de pesquisa"}
            },
            "required": ["query"],
        },
    },
}


def get_system_prompt(language: str, memories: list[dict] | None = None) -> str:
    base = PERSONA["system_prompts"].get(language, PERSONA["system_prompts"]["pt"])
    sections: list[str] = []

    user_facts = [m for m in (memories or []) if not m.get("source", "").startswith("self")]
    self_knowledge = [m for m in (memories or []) if m.get("source", "").startswith("self")]

    if user_facts:
        sections.append("## O que sabes sobre o utilizador:\n" + "\n".join(f"- {m['fact']}" for m in user_facts))
    else:
        sections.append(
            "## Memória sobre o utilizador:\n"
            "Ainda não tens factos guardados sobre esta pessoa. "
            "Se te perguntarem o que sabes ou o que foi dito antes, admite honestamente que não tens memória disso. "
            "Nunca inventes ou suponhas factos sobre o utilizador."
        )

    if self_knowledge:
        sections.append("## O que aprendeste por conta própria:\n" + "\n".join(f"- {m['fact']}" for m in self_knowledge))

    sections.append(
        "## Ferramenta de pesquisa:\n"
        "Tens acesso à ferramenta web_search. "
        "REGRA: quando a pergunta envolve eventos recentes, notícias, preços, resultados ou qualquer facto que possa ter mudado — chama web_search IMEDIATAMENTE, sem pedir permissão. "
        "Nunca digas 'precisaria pesquisar' ou 'quer que eu pesquise'. Pesquisa e responde."
    )

    return base + "\n\n" + "\n\n".join(sections)


class ChatRequest(BaseModel):
    message: str
    model: str = "gemma-lite"
    language: str = "pt"
    history: list[dict] = []


async def _call_once(messages: list[dict], model_id: str, tools: list | None = None) -> dict:
    payload: dict = {"model": model_id, "messages": messages, "stream": False, "max_tokens": 2048, "temperature": 0}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{LM_STUDIO_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()


async def _stream_messages(messages: list[dict], model_id: str):
    payload = {"model": model_id, "messages": messages, "stream": True, "max_tokens": 2048}
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


async def chat_with_search(message: str, history: list[dict], model_id: str, system_prompt: str):
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
    try:
        first = await _call_once(messages, model_id, tools=[WEB_SEARCH_TOOL])
        choice = first["choices"][0]
        tool_calls = choice["message"].get("tool_calls")

        if tool_calls:
            tool_call = tool_calls[0]
            args = json.loads(tool_call["function"]["arguments"])
            query = args.get("query", "")
            yield f"data: {json.dumps({'searching': True, 'query': query})}\n\n"

            results = await web_search(query)

            tool_msg = {
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": json.dumps(results, ensure_ascii=False),
            }
            async for chunk in _stream_messages(messages + [choice["message"], tool_msg], model_id):
                yield chunk
        else:
            text = choice["message"].get("content", "")
            if text:
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


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

    relevant = search_memories(req.message, top_k=8)
    system_prompt = get_system_prompt(req.language, relevant)
    model_id = MODELS[req.model]
    base = chat_with_search(req.message, req.history, model_id, system_prompt)
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


@app.get("/api/interests")
def list_interests():
    all_mems = get_all_memories()
    grouped: dict[str, list[dict]] = {}
    for m in all_mems:
        source = m.get("source", "")
        if not source.startswith("self"):
            continue
        parts = source.split("|", 1)
        interest = parts[1] if len(parts) > 1 else "geral"
        grouped.setdefault(interest, []).append({
            "id": m["id"], "fact": m["fact"], "timestamp": m["timestamp"],
        })
    return sorted(
        [{"interest": k, "facts": sorted(v, key=lambda x: x["timestamp"], reverse=True)} for k, v in grouped.items()],
        key=lambda x: -len(x["facts"]),
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
