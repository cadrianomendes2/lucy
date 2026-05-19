import asyncio
import os
import re
import json
import base64
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from memory.sqlite_service import (
    init_db, delete_fact, log_turn,
    create_session, update_session_title, touch_session,
    get_sessions, get_session_messages, delete_session, count_session_turns,
)
from memory.lancedb_service import search_memories, get_all_memories, delete_memory
from memory.memory_extractor import extract_and_store
from tools.web_search import web_search
from services.learner import start_learner
from knowledge.graph_service import (
    init_graph, traverse, get_all_nodes, get_all_edges,
    upsert_node, upsert_edge, get_knowledge_context, get_domains,
    read_essence,
)
import knowledge.research_service as research_svc

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

MODELS = {
    "nemo-12b":     os.getenv("LM_STUDIO_MODEL_NEMO",       "nemo_roleplay_ptbr_new-i1"),
    "qwen-40b":     os.getenv("LM_STUDIO_MODEL_QWEN40B",    "qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max"),
    "qwen-9b-auto": os.getenv("LM_STUDIO_MODEL_QWEN9BAUTO", "qwen3.5-9b-claude-4.6-os-auto-variable-heretic-uncensored-thinking-max-neocode-imatrix"),
    "gemma-lite":   os.getenv("LM_STUDIO_MODEL_LITE",       "gemma-4-e4b-it-ultra-uncensored-heretic"),
    "qwen-27b":     os.getenv("LM_STUDIO_MODEL_QWEN27B",    "qwen3.5-27b-claude-4.6-opus-reasoning-distilled-i1"),
    "gemma-26b":    os.getenv("LM_STUDIO_MODEL_GEMMA26B",   "gemma-4-26b-a4b-it"),
    "gpt-20b":      os.getenv("LM_STUDIO_MODEL_GPT20B",     "openai-gpt-oss-20b-heretic-uncensored-neo-imatrix"),
    "qwen-9b":      os.getenv("LM_STUDIO_MODEL_QWEN9B",     "qwen3.5-9b-claude-4.6-os-heretic-uncensored-instruct-i1"),
}

REASONING_MODELS = {"qwen-27b", "qwen-40b", "qwen-9b-auto", "qwen-9b"}
THINKING_BUDGETS = {"fast": 512, "medium": 2048, "heavy": 8192}

LM_STUDIO_MODEL_LITE = MODELS["gemma-lite"]

PERSONA_PATH = os.path.join(os.path.dirname(__file__), "persona", "identity.json")
with open(PERSONA_PATH, encoding="utf-8") as f:
    PERSONA = json.load(f)

init_db()
init_graph()

research_svc.LM_STUDIO_URL = None  # preenchido após load das envs


@app.on_event("startup")
async def _startup():
    research_svc.LM_STUDIO_URL = LM_STUDIO_URL
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


def get_system_prompt(language: str, memories: list[dict] | None = None, knowledge_context: str = "") -> str:
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

    if knowledge_context:
        sections.append("## O teu conhecimento sobre os temas desta conversa:\n" + knowledge_context)

    sections.append(
        "## Ferramenta de pesquisa:\n"
        "Tens acesso à ferramenta web_search. "
        "REGRA: quando a pergunta envolve eventos recentes, notícias, preços, resultados ou qualquer facto que possa ter mudado — chama web_search IMEDIATAMENTE, sem pedir permissão. "
        "Nunca digas 'precisaria pesquisar' ou 'quer que eu pesquise'. Pesquisa e responde."
    )

    return base + "\n\n" + "\n\n".join(sections)


def _extract_entity_ids(message: str) -> list[str]:
    """Só injecta conhecimento de domínios cujo nome aparece explicitamente na mensagem."""
    nodes = get_all_nodes()
    msg_lower = message.lower()
    matched = []
    for n in nodes:
        if n.get("type") != "domain":
            continue
        label = n["label"].lower()
        if re.search(r'\b' + re.escape(label) + r'\b', msg_lower):
            matched.append(n["id"])
    return matched[:4]


class ChatRequest(BaseModel):
    message: str
    model: str = "gemma-lite"
    language: str = "pt"
    history: list[dict] = []
    thinking_mode: str = "off"  # off | fast | medium | heavy
    session_id: int | None = None


def _extra_params(model_key: str, thinking_mode: str = "off") -> dict:
    if model_key not in REASONING_MODELS:
        return {}
    if thinking_mode == "off":
        return {"enable_thinking": False}
    return {"enable_thinking": True, "thinking_budget": THINKING_BUDGETS.get(thinking_mode, 512)}


async def _call_once(messages: list[dict], model_id: str, model_key: str = "", thinking_mode: str = "off", tools: list | None = None) -> dict:
    payload: dict = {"model": model_id, "messages": messages, "stream": False, "max_tokens": 2048, "temperature": 0, **_extra_params(model_key, thinking_mode)}
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


async def _stream_messages(messages: list[dict], model_id: str, model_key: str = "", thinking_mode: str = "off"):
    payload = {"model": model_id, "messages": messages, "stream": True, "max_tokens": 2048, **_extra_params(model_key, thinking_mode)}
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


async def chat_with_search(message: str, history: list[dict], model_id: str, model_key: str, thinking_mode: str, system_prompt: str):
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
    try:
        first = await _call_once(messages, model_id, model_key=model_key, thinking_mode=thinking_mode, tools=[WEB_SEARCH_TOOL])
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
            async for chunk in _stream_messages(messages + [choice["message"], tool_msg], model_id, model_key=model_key, thinking_mode=thinking_mode):
                yield chunk
        else:
            text = choice["message"].get("content", "")
            if text:
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"


async def stream_lm_studio(message: str, history: list[dict], model_id: str, model_key: str, thinking_mode: str, system_prompt: str):
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]
    payload = {
        "model": model_id,
        "messages": messages,
        "stream": True,
        "max_tokens": 2048,
        **_extra_params(model_key, thinking_mode),
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


async def _stream_and_collect(base_gen, user_message: str, model: str, model_id: str, language: str, session_id: int):
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
        log_turn("user", user_message, model, language, session_id)
        log_turn("assistant", full_response, model, language, session_id)
        touch_session(session_id)
        asyncio.create_task(
            extract_and_store(user_message, full_response, LM_STUDIO_URL, model_id)
        )


async def _chat_generator(req: ChatRequest):
    session_id = req.session_id
    is_new = session_id is None
    if is_new:
        title = req.message[:60].strip()
        session_id = create_session(title, req.model)
        yield f"data: {json.dumps({'session_id': session_id, 'session_title': title})}\n\n"
    elif count_session_turns(session_id) == 0:
        update_session_title(session_id, req.message[:60].strip())

    relevant = search_memories(req.message, top_k=8)
    entity_ids = _extract_entity_ids(req.message)
    knowledge_nodes = traverse(entity_ids, hops=2) if entity_ids else []
    knowledge_domains = list({n["domain"] for n in knowledge_nodes if n.get("domain")})
    knowledge_context = get_knowledge_context(knowledge_domains, level="summary") if knowledge_domains else ""
    system_prompt = get_system_prompt(req.language, relevant, knowledge_context)
    model_id = MODELS[req.model]
    base = chat_with_search(req.message, req.history, model_id, req.model, req.thinking_mode, system_prompt)
    async for chunk in _stream_and_collect(base, req.message, req.model, model_id, req.language, session_id):
        yield chunk


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo desconhecido: {req.model}")
    return StreamingResponse(_chat_generator(req), media_type="text/event-stream")


@app.get("/api/sessions")
def list_sessions():
    return get_sessions()


@app.get("/api/sessions/{session_id}/messages")
def session_messages(session_id: int):
    return get_session_messages(session_id)


@app.delete("/api/sessions/{session_id}")
def remove_session(session_id: int):
    delete_session(session_id)
    return {"ok": True}


class SessionUpdateRequest(BaseModel):
    title: str


@app.patch("/api/sessions/{session_id}")
def rename_session(session_id: int, body: SessionUpdateRequest):
    update_session_title(session_id, body.title)
    return {"ok": True}


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


@app.get("/api/lm-models")
async def lm_models():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            loaded_ids = {m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded"}
            loaded_keys = [key for key, model_id in MODELS.items() if model_id in loaded_ids]
            return {"loaded": loaded_keys}
    except Exception:
        return {"loaded": []}


# --- Research channels: uma queue por session_id activo ---
_research_queues: dict[str, asyncio.Queue] = {}


class ResearchRequest(BaseModel):
    topic: str
    session_id: str | None = None


@app.post("/api/search")
async def api_search(req: ResearchRequest):
    async def generator():
        async def emit(event: dict):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        # workaround: emit é gerador, precisamos de wrapper
        pass

    async def stream():
        events = []
        lock = asyncio.Event()

        async def emit(event: dict):
            events.append(event)
            lock.set()

        task = asyncio.create_task(research_svc.run_search(req.topic, emit))

        sent = 0
        while not task.done() or sent < len(events):
            if sent < len(events):
                yield f"data: {json.dumps(events[sent], ensure_ascii=False)}\n\n"
                sent += 1
            else:
                await asyncio.sleep(0.2)

        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/api/research")
async def api_research(req: ResearchRequest):
    user_queue: asyncio.Queue = asyncio.Queue()
    channel_id = req.session_id or "default"
    _research_queues[channel_id] = user_queue

    async def stream():
        events = []

        async def emit(event: dict):
            events.append(event)

        task = asyncio.create_task(research_svc.run_research(req.topic, emit, user_queue))

        sent = 0
        while not task.done() or sent < len(events):
            if sent < len(events):
                yield f"data: {json.dumps(events[sent], ensure_ascii=False)}\n\n"
                sent += 1
            else:
                await asyncio.sleep(0.3)

        _research_queues.pop(channel_id, None)
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


class ResearchReplyRequest(BaseModel):
    session_id: str
    message: str


@app.post("/api/research/reply")
async def research_reply(req: ResearchReplyRequest):
    queue = _research_queues.get(req.session_id)
    if queue:
        await queue.put(req.message)
    return {"ok": True}


@app.get("/api/knowledge/graph")
def knowledge_graph():
    return {"nodes": get_all_nodes(), "edges": get_all_edges()}


@app.get("/api/knowledge/domains")
def knowledge_domains():
    return get_domains()


@app.get("/api/knowledge/summary/{domain}")
def knowledge_summary(domain: str):
    from knowledge.graph_service import read_summary, read_essence
    text = read_summary(domain) or read_essence(domain)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(text or "Sem resumo ainda.")


@app.get("/api/health")
def health():
    return {"status": "ok"}
