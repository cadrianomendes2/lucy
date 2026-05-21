import asyncio
import os
import re
import json
import base64
import random
import uuid
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from memory.sqlite_service import (
    init_db, delete_fact, log_turn,
    create_session, update_session_title, touch_session,
    get_sessions, get_session_messages, delete_session, count_session_turns,
    upsert_topic, get_topics, decay_topics,
    upsert_topic_edge, get_topic_edges, delete_topic_edges,
    save_learner_entry, get_learner_history,
    save_defrag_log, get_defrag_status,
)
from memory.lancedb_service import search_memories, get_all_memories, delete_memory, wipe_all_memories, get_topic_vectors, cosine_similarity
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
    {"uuid": "7a33e74f", "label": "Vanessa",  "lang": "pt-BR", "tags": ["character", "young", "carioca"]},
    {"uuid": "bd0f1157", "label": "Marvin",   "lang": "pt-BR", "tags": ["male", "deep"]},
    {"uuid": "c49e1b04", "label": "Laura",    "lang": "en-US", "tags": ["assistant", "raspy"]},
    {"uuid": "ce1fdae4", "label": "GLaDOS",   "lang": "en-GB", "tags": ["character", "robotic"]},
    # {"uuid": "55f5b8dc", "label": "Linda",    "lang": "en-GB", "tags": ["assistant", "calm"]},
    # {"uuid": "e28236ee", "label": "Samantha", "lang": "en-US", "tags": ["female", "standard"]},
    # {"uuid": "33eecc17", "label": "Primrose", "lang": "en-US", "tags": ["character", "vivid"]},
    # {"uuid": "e6ec3ca4", "label": "Bentley",  "lang": "en-US", "tags": ["character", "teen", "vivid"]},
]

SYNTH_URL_BY_UUID = {
    "7a33e74f": RESEMBLE_SYNTH_URL_PT,
    "bd0f1157": RESEMBLE_SYNTH_URL_PT,
    "ce1fdae4": RESEMBLE_SYNTH_URL_EN,
}

MODELS = {
    "nemo-12b":     os.getenv("LM_STUDIO_MODEL_NEMO",       "nemo_roleplay_ptbr_new-i1"),
    "qwen-40b":     os.getenv("LM_STUDIO_MODEL_QWEN40B",    "qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max"),
    "qwen-9b-auto": os.getenv("LM_STUDIO_MODEL_QWEN9BAUTO", "qwen3.5-9b-claude-4.6-os-auto-variable-heretic-uncensored-thinking-max-neocode-imatrix"),
    "gemma-lite":   os.getenv("LM_STUDIO_MODEL_LITE",       "gemma-4-e4b-it-ultra-uncensored-heretic"),
    "qwen-27b":     os.getenv("LM_STUDIO_MODEL_QWEN27B",    "qwen3.5-27b-claude-4.6-opus-reasoning-distilled-i1"),
    "gemma-26b":    os.getenv("LM_STUDIO_MODEL_GEMMA26B",   "gemma-4-26b-a4b-it-ultra-uncensored-heretic"),
    "gpt-20b":      os.getenv("LM_STUDIO_MODEL_GPT20B",     "openai-gpt-oss-20b-heretic-uncensored-neo-imatrix"),
    "qwen-9b":      os.getenv("LM_STUDIO_MODEL_QWEN9B",     "qwen3.5-9b-claude-4.6-os-heretic-uncensored-instruct-i1"),
}

REASONING_MODELS = {"qwen-27b", "qwen-40b", "qwen-9b-auto", "qwen-9b"}

# reasoning models pré-definidos para o Deep Mind (aliases e tiers)
DEEP_MIND_MODELS = [
    {"alias": "qwen-9b-auto", "label": "Qwen3.5", "tier": "medium"},
    {"alias": "qwen-40b",     "label": "Qwen3.6", "tier": "high"},
]
THINKING_BUDGETS = {"fast": 512, "medium": 2048, "heavy": 8192}

LM_STUDIO_MODEL_LITE = MODELS["gemma-lite"]

PERSONA_PATH = os.path.join(os.path.dirname(__file__), "persona", "identity.json")
with open(PERSONA_PATH, encoding="utf-8") as f:
    PERSONA = json.load(f)

init_db()
init_graph()

research_svc.LM_STUDIO_URL = None


# ── AutoLearner multi-persona ─────────────────────────────────────────────────

class AutoLearner:
    def __init__(self):
        self.running = False
        self.interval = 120  # segundos por persona
        self.enabled: dict[str, bool] = {}  # persona_id → bool
        self.max_cycles: int | None = None  # None = ilimitado
        self.timeline: list[dict] = []  # histórico
        self.current: dict | None = None  # actividade actual
        self._task: asyncio.Task | None = None
        self._cycles: dict[str, int] = {}  # persona_id → nº de ciclos
        self.deep_config: dict[str, dict] = {}  # persona_id → DeepMind config

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def _extract(self, interest: str, results: list[dict]) -> list[str]:
        context = "\n".join(f"[{r['title']}] {r['snippet']}" for r in results[:3])
        prompt = f'Sobre o tópico "{interest}", extrai 2 factos interessantes destes resultados:\n\n{context}\n\nResponde APENAS com JSON: {{"insights": ["facto 1", "facto 2"]}}'
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.post(
                    f"{LM_STUDIO_URL}/v1/chat/completions",
                    json={"model": MODELS["gemma-lite"], "messages": [{"role": "user", "content": prompt}], "stream": False, "max_tokens": 300, "temperature": 0.5},
                )
                raw = r.json()["choices"][0]["message"]["content"].strip()
            if raw.startswith("```"): raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw).get("insights", [])[:3]
        except Exception:
            return []

    async def _synthesize_topic(self, persona_name: str, known_topics: list[str]) -> str | None:
        """Combina 3+ tópicos → sugere um conceito síntese novo (cria nó emergente)."""
        if len(known_topics) < 2:
            return None
        sample = random.sample(known_topics, min(4, len(known_topics)))
        prompt = (
            f"És {persona_name}. Tens conhecimento sobre: {', '.join(sample)}.\n"
            f"Que conceito, questão ou fenómeno NOVO e específico conecta todos estes temas de forma surpreendente?\n"
            f"Responde APENAS com o nome do conceito emergente (máximo 5 palavras). Zero explicações."
        )
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{LM_STUDIO_URL}/v1/chat/completions",
                    json={"model": MODELS["gemma-lite"], "messages": [{"role": "user", "content": prompt}],
                          "stream": False, "max_tokens": 20, "temperature": 1.0},
                )
                topic = r.json()["choices"][0]["message"]["content"].strip().strip('"\'').split("\n")[0].strip()
            if topic and len(topic) < 60:
                return topic
        except Exception:
            pass
        return None

    async def _extract_subtopic(self, broad_interest: str, insights: list[str]) -> str | None:
        """Dado um interesse amplo e os factos extraídos, devolve o conceito específico explorado."""
        if not insights:
            return None
        facts_str = "\n".join(f"- {f}" for f in insights[:3])
        prompt = (
            f"Interesse amplo: '{broad_interest}'\n"
            f"Factos aprendidos:\n{facts_str}\n\n"
            f"Qual é o conceito ou tema ESPECÍFICO que estes factos exploram?\n"
            f"Responde APENAS com o nome do conceito (máximo 5 palavras, sem pontuação final). Zero explicações."
        )
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(
                    f"{LM_STUDIO_URL}/v1/chat/completions",
                    json={"model": MODELS["gemma-lite"], "messages": [{"role": "user", "content": prompt}],
                          "stream": False, "max_tokens": 15, "temperature": 0.3},
                )
                topic = r.json()["choices"][0]["message"]["content"].strip().strip('"\'.,').split("\n")[0].strip()
            if topic and 3 <= len(topic) <= 60:
                return topic
        except Exception:
            pass
        return None

    async def _suggest_topic(self, persona_name: str, persona_desc: str, interests: list[str], recent: list[str]) -> str:
        """Pede ao modelo que sugira um tópico novo com base na personalidade da persona."""
        recent_str = ", ".join(recent[-4:]) if recent else "nenhum ainda"
        prompt = (
            f"És {persona_name}. {persona_desc}\n"
            f"Os teus interesses habituais: {', '.join(interests)}.\n"
            f"Recentemente pesquisaste: {recent_str}.\n\n"
            f"Sugere UM ÚNICO tópico de pesquisa que te desperte curiosidade genuína agora. "
            f"Pode ser relacionado com os teus interesses ou algo completamente diferente que acharias fascinante. "
            f"Sê específico e criativo — não repitas o que já pesquisaste.\n"
            f"Responde APENAS com o nome do tópico (máximo 4 palavras). Zero explicações."
        )
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{LM_STUDIO_URL}/v1/chat/completions",
                    json={"model": MODELS["gemma-lite"], "messages": [{"role": "user", "content": prompt}], "stream": False, "max_tokens": 20, "temperature": 0.95},
                )
                topic = r.json()["choices"][0]["message"]["content"].strip().strip('"\'').split("\n")[0].strip()
            if topic and len(topic) < 60:
                return topic
        except Exception:
            pass
        return random.choice(interests)

    async def _learn_persona(self, persona_id: str):
        from memory.lancedb_service import upsert_memory
        data = _load_persona_file(persona_id)
        if not data:
            print(f"[AutoLearner] persona '{persona_id}' não encontrada")
            return
        interests = data.get("interests", [])
        if not interests:
            print(f"[AutoLearner] {persona_id} sem interesses")
            return
        name = data.get("name", persona_id)
        description = data.get("description", "")

        # ciclo desta persona
        cycle = self._cycles.get(persona_id, 0) + 1
        self._cycles[persona_id] = cycle

        # verifica limite de ciclos
        if self.max_cycles and cycle > self.max_cycles:
            print(f"[AutoLearner] {name} atingiu limite de {self.max_cycles} ciclos — parado")
            self.enabled[persona_id] = False
            if not any(self.enabled.values()):
                self.running = False
            return

        # decaimento a cada 5 ciclos
        if cycle % 5 == 0:
            pruned = decay_topics(persona_id, cycle)
            if pruned:
                print(f"[AutoLearner] {name} → 🍂 nós apagados por decaimento: {pruned}")
                # apaga os factos dos tópicos pruned
                all_mems = get_all_memories()
                for topic in pruned:
                    for m in all_mems:
                        if m.get("source", "").startswith(f"self_{persona_id}|{topic}"):
                            delete_memory(m["id"])
                            delete_fact(m["id"])

        # tópicos já conhecidos (interesses fixos + descobertos)
        known = list({t["topic"] for t in get_topics(persona_id)} | set(interests))
        recent_topics = [e["interest"] for e in self.timeline if e["persona_id"] == persona_id][-8:]

        # estratégia: 40% fixo | 20% descoberta | 20% síntese | 10% novo absoluto | 10% garantia N ciclos
        # a cada 10 ciclos desta persona → garante exploração nova
        force_new = (cycle % 10 == 0)
        roll = random.random()

        if force_new or roll < 0.10:
            # novo absoluto: fora de todos os tópicos conhecidos
            avoid = recent_topics + known[:20]
            interest = await self._suggest_topic(name, description, [], avoid)  # sem interesses = tabula rasa
            discovery = True
            synthesis = False
            if force_new:
                print(f"[AutoLearner] {name} [{cycle}] → 🌟 novo absoluto (ciclo garantido): '{interest}'")
            else:
                print(f"[AutoLearner] {name} [{cycle}] → 🌟 novo absoluto: '{interest}'")
        elif roll < 0.45:
            available = [i for i in interests if i not in recent_topics[-2:]] or interests
            interest = random.choice(available)
            discovery = False
            synthesis = False
            print(f"[AutoLearner] {name} [{cycle}] → 📌 fixo: '{interest}'")
        elif roll < 0.70:
            interest = await self._suggest_topic(name, description, interests, recent_topics)
            discovery = True
            synthesis = False
            print(f"[AutoLearner] {name} [{cycle}] → 🔭 descoberta: '{interest}'")
        else:
            synthesized = await self._synthesize_topic(name, known)
            if synthesized and synthesized not in known:
                interest = synthesized
                discovery = True
                synthesis = True
                print(f"[AutoLearner] {name} [{cycle}] → 🔗 síntese: '{interest}'")
            else:
                interest = await self._suggest_topic(name, description, interests, recent_topics)
                discovery = True
                synthesis = False
                print(f"[AutoLearner] {name} [{cycle}] → 🔭 descoberta: '{interest}'")
        self.current = {"persona": name, "persona_id": persona_id, "interest": interest, "status": "pesquisando", "discovery": discovery, "started": self._now()}
        results = await web_search(f"{interest} research news ideas 2025")
        print(f"[AutoLearner] {name} → {len(results)} resultados")
        if not results:
            self.current = None
            return
        self.current["status"] = "a sintetizar"
        insights = await self._extract(interest, results)

        # para interesses fixos: extrair o sub-tópico específico explorado
        # (transforma "comunismo" → "materialismo histórico de Marx")
        if not discovery and insights:
            specific = await self._extract_subtopic(interest, insights)
            if specific and specific.lower() != interest.lower():
                print(f"[AutoLearner] {name} → sub-tópico: '{specific}'")
                interest = specific
        print(f"[AutoLearner] {name} → {len(insights)} insights extraídos")
        ts = self._now()
        for insight in insights:
            upsert_memory(str(uuid.uuid4()), insight, source=f"self_{persona_id}|{interest}", timestamp=ts)
        # regista o tópico com o ciclo actual (para decaimento)
        upsert_topic(persona_id, interest, cycle)
        # actualiza o knowledge graph com o tópico aprendido
        try:
            domain_id = f"{persona_id}_{interest.lower().replace(' ', '_')}"
            upsert_node(domain_id, interest, node_type="domain", domain=interest, weight=float(len(insights)))
            persona_node_id = f"persona_{persona_id}"
            upsert_node(persona_node_id, name, node_type="persona", domain=persona_id, weight=1.0)
            upsert_edge(persona_node_id, domain_id, relation="aprendeu", weight=float(len(insights)))
        except Exception as e:
            print(f"[AutoLearner] graph update failed: {e}")
        entry = {"id": str(uuid.uuid4()), "persona": name, "persona_id": persona_id, "avatar": data.get("avatar_url", ""), "interest": interest, "insights": insights, "timestamp": ts, "discovery": discovery, "synthesis": synthesis}
        self.timeline.insert(0, entry)
        if len(self.timeline) > 200:
            self.timeline = self.timeline[:200]
        save_learner_entry(entry)
        self.current = None

        # auto-síntese Deep Mind
        deep = self.deep_config.get(persona_id, {})
        n = deep.get("auto_synth_cycles", 10)
        if deep.get("enabled") and deep.get("auto_synth") and n > 0 and cycle % n == 0:
            rm_id = await _get_loaded_reasoning_model(deep.get("reasoning_models", []))
            if rm_id:
                print(f"[AutoLearner] {name} [{cycle}] → 🧠 auto-síntese...")
                try:
                    summary = await _synthesize_for_persona(persona_id, rm_id)
                    if summary:
                        synth_entry = {
                            "id": str(uuid.uuid4()), "persona": name, "persona_id": persona_id,
                            "avatar": data.get("avatar_url", ""), "interest": "síntese",
                            "insights": [summary], "timestamp": self._now(),
                            "discovery": False, "synthesis": False, "synthesis_report": True,
                        }
                        self.timeline.insert(0, synth_entry)
                        save_learner_entry(synth_entry)
                except Exception as e:
                    print(f"[AutoLearner] {name} auto-síntese falhou: {e}")

    async def _loop(self):
        persona_order = ["lucy", "samantha", "marvin", "glados"]
        while self.running:
            ran = False
            for pid in persona_order:
                if not self.running:
                    break
                if not self.enabled.get(pid):
                    continue
                ran = True
                try:
                    await self._learn_persona(pid)
                except Exception:
                    self.current = None
                if self.running:
                    await asyncio.sleep(self.interval)
            if not ran:
                await asyncio.sleep(5)

    def start(self):
        if self.running:
            return
        self.running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._loop())
        except RuntimeError:
            self._task = None

    def stop(self):
        self.running = False
        self.current = None
        if self._task:
            self._task.cancel()
            self._task = None


auto_learner = AutoLearner()

# Deep Mind config por persona (em memória; reset ao reiniciar o backend)
DEEP_MIND_CONFIG: dict[str, dict] = {}


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


def get_system_prompt(language: str, memories: list[dict] | None = None, knowledge_context: str = "", pro: bool = False, persona_id: str | None = None) -> str:
    persona = PERSONA
    if persona_id:
        loaded = _load_persona_file(persona_id) if persona_id else None
        if loaded:
            persona = loaded
    if pro and "system_prompts_pro" in persona:
        base = persona["system_prompts_pro"].get(language, persona["system_prompts_pro"].get("pt", persona["system_prompts"].get(language, "")))
    else:
        base = persona["system_prompts"].get(language, persona["system_prompts"]["pt"])
    sections: list[str] = []

    def _fmt_ts(iso: str) -> str:
        """Formata timestamp ISO para algo legível: 'hoje às 14:32' ou '20 Jan às 09:15'."""
        try:
            from datetime import timezone as tz
            dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(tz.utc)
            now = datetime.now(tz.utc)
            diff = now - dt
            if diff.days == 0:
                return f"hoje às {dt.strftime('%H:%M')}"
            elif diff.days == 1:
                return f"ontem às {dt.strftime('%H:%M')}"
            elif diff.days < 7:
                return f"há {diff.days} dias às {dt.strftime('%H:%M')}"
            else:
                return dt.strftime("%d %b às %H:%M")
        except Exception:
            return iso[:16] if iso else ""

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
        lines = [f"- [{_fmt_ts(m.get('timestamp',''))}] {m['fact']}" for m in self_knowledge]
        sections.append("## O que aprendeste por conta própria (com data):\n" + "\n".join(lines))

    # injeta as 5 aprendizagens mais recentes desta persona (independente da pesquisa semântica)
    if persona_id:
        try:
            all_self = get_all_memories()
            prefix = f"self_{persona_id}|"
            legacy = f"self|"  # legacy só para lucy
            recent_self = sorted(
                [m for m in all_self if m.get("source", "").startswith(prefix) or
                 (persona_id == "lucy" and m.get("source", "").startswith(legacy) and not m.get("source", "").startswith("self_"))],
                key=lambda m: m.get("timestamp", ""),
                reverse=True
            )[:5]
            existing_ids = {m.get("id") for m in self_knowledge}
            new_recent = [m for m in recent_self if m.get("id") not in existing_ids]
            if new_recent:
                lines = [f"- [{_fmt_ts(m.get('timestamp',''))}] {m['fact']} (sobre: {m.get('source','').split('|',1)[-1]})" for m in new_recent]
                sections.append("## As tuas aprendizagens mais recentes:\n" + "\n".join(lines))
        except Exception:
            pass

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
    pro: bool = False
    persona_id: str | None = None
    image: str | None = None  # base64 JPEG do ecrã capturado


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


async def chat_with_search(message: str, history: list[dict], model_id: str, model_key: str, thinking_mode: str, system_prompt: str, image: str | None = None):
    user_content = [{"type": "text", "text": message}, {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image}"}}] if image else message
    messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_content}]
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


async def _stream_and_collect(base_gen, user_message: str, model: str, model_id: str, language: str, session_id: int, pro: bool = False):
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
            extract_and_store(user_message, full_response, LM_STUDIO_URL, model_id, pro=pro)
        )


async def _chat_generator(req: ChatRequest):
    session_id = req.session_id
    is_new = session_id is None
    if is_new:
        title = req.message[:60].strip()
        session_id = create_session(title, req.model, persona_id=req.persona_id, is_pro=req.pro)
        yield f"data: {json.dumps({'session_id': session_id, 'session_title': title})}\n\n"
    elif count_session_turns(session_id) == 0:
        update_session_title(session_id, req.message[:60].strip())

    relevant = search_memories(req.message, top_k=8, pro=req.pro)
    entity_ids = _extract_entity_ids(req.message)
    knowledge_nodes = traverse(entity_ids, hops=2) if entity_ids else []
    knowledge_domains = list({n["domain"] for n in knowledge_nodes if n.get("domain")})
    knowledge_context = get_knowledge_context(knowledge_domains, level="summary") if knowledge_domains else ""
    system_prompt = get_system_prompt(req.language, relevant, knowledge_context, pro=req.pro, persona_id=req.persona_id)
    model_id = MODELS[req.model]
    base = chat_with_search(req.message, req.history, model_id, req.model, req.thinking_mode, system_prompt, image=req.image)
    async for chunk in _stream_and_collect(base, req.message, req.model, model_id, req.language, session_id, pro=req.pro):
        yield chunk


@app.post("/api/chat")
async def chat(req: ChatRequest):
    if req.model not in MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo desconhecido: {req.model}")
    return StreamingResponse(_chat_generator(req), media_type="text/event-stream")


@app.get("/api/sessions")
def list_sessions(persona_id: str | None = None, is_pro: int | None = None):
    pro_filter = None if is_pro is None else bool(is_pro)
    return get_sessions(persona_id=persona_id, is_pro=pro_filter)


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
def list_memories(persona_id: str | None = None):
    all_mems = get_all_memories()
    if persona_id:
        def keep(m: dict) -> bool:
            src = m.get("source", "")
            if not src.startswith("self"):
                return True  # factos do utilizador são partilhados
            # self|xxx = dados antigos gerados pela Lucy (learner original)
            if src.startswith("self|") and not src.startswith("self_"):
                return persona_id == "lucy"
            # self_{persona_id}|xxx = dados do AutoLearner por persona
            return src.startswith(f"self_{persona_id}|")
        return [m for m in all_mems if keep(m)]
    return all_mems


@app.delete("/api/memories/{fact_id}")
def remove_memory(fact_id: str):
    delete_memory(fact_id)
    delete_fact(fact_id)
    return {"ok": True}


@app.delete("/api/memories/topic/{persona_id}/{topic}")
def delete_topic(persona_id: str, topic: str):
    """Apaga todos os factos de um tópico de uma persona."""
    all_mems = get_all_memories()
    source_prefix = f"self_{persona_id}|{topic}"
    legacy_prefix = f"self|{topic}"
    deleted = 0
    for m in all_mems:
        src = m.get("source", "")
        if src == source_prefix or src.startswith(source_prefix) or \
           (persona_id == "lucy" and (src == legacy_prefix or src.startswith(legacy_prefix))):
            delete_memory(m["id"])
            delete_fact(m["id"])
            deleted += 1
    return {"ok": True, "deleted": deleted}


@app.delete("/api/memories")
def wipe_memories():
    wipe_all_memories()
    conn = __import__('sqlite3').connect(os.path.expanduser("~/.personal-ai/memory.db"))
    conn.execute("DELETE FROM facts")
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/interests")
def list_interests(persona_id: str | None = None):
    all_mems = get_all_memories()
    grouped: dict[str, list[dict]] = {}
    for m in all_mems:
        source = m.get("source", "")
        if not source.startswith("self"):
            continue
        # filtrar por persona: self|xxx = Lucy (learner antigo); self_{pid}|xxx = persona específica
        if persona_id:
            is_legacy = source.startswith("self|") and not source.startswith("self_")
            is_persona = source.startswith(f"self_{persona_id}|")
            if not (is_persona or (is_legacy and persona_id == "lucy")):
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


@app.get("/api/reasoning-models")
async def get_reasoning_models():
    """Devolve os reasoning models pré-definidos e se estão carregados."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            loaded_ids = {m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded"}
    except Exception:
        loaded_ids = set()
    return [
        {**dm, "model_id": MODELS[dm["alias"]], "loaded": MODELS[dm["alias"]] in loaded_ids}
        for dm in DEEP_MIND_MODELS
    ]


@app.post("/api/reasoning-models/init")
async def init_reasoning_models():
    """Pré-configura os reasoning models em todos os DEEP_MIND_CONFIG de personas."""
    model_ids = [MODELS[dm["alias"]] for dm in DEEP_MIND_MODELS]
    persona_dir = os.path.join(os.path.dirname(__file__), "persona")
    for fname in os.listdir(persona_dir):
        if not fname.endswith(".json") or fname == "identity.json":
            continue
        pid = fname.replace(".json", "")
        existing = DEEP_MIND_CONFIG.get(pid, {})
        DEEP_MIND_CONFIG[pid] = {
            "enabled": existing.get("enabled", False),
            "reasoning_models": model_ids,
            "auto_synth": existing.get("auto_synth", False),
            "auto_synth_cycles": existing.get("auto_synth_cycles", 10),
        }
        auto_learner.deep_config[pid] = DEEP_MIND_CONFIG[pid]
    return {"ok": True}


LMS_CLI = os.path.expanduser("~/.lmstudio/bin/lms")

# Modelos com botão play/stop na UI
CONTROLLABLE_MODELS = {"gemma-lite", "gemma-26b", "qwen-9b-auto"}


@app.get("/api/lm-models")
async def lm_models():
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            loaded_ids = {m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded"}
            loaded_keys = [key for key, model_id in MODELS.items() if model_id in loaded_ids]
            return {"loaded": loaded_keys, "loaded_ids": list(loaded_ids)}
    except Exception:
        return {"loaded": [], "loaded_ids": []}


@app.get("/api/lm-models/available")
async def lm_models_available():
    """Lista modelos controláveis com o seu estado actual (loaded / not-loaded)."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            all_models = {m["id"]: m.get("state", "not-loaded") for m in r.json().get("data", [])}
    except Exception:
        all_models = {}

    result = []
    for alias in CONTROLLABLE_MODELS:
        raw_id = MODELS.get(alias)
        if not raw_id:
            continue
        state = all_models.get(raw_id, "not-loaded")
        result.append({"alias": alias, "model_id": raw_id, "state": state})
    return result


@app.post("/api/lm-models/{alias}/load")
async def load_model(alias: str):
    if alias not in CONTROLLABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo '{alias}' não é controlável.")
    raw_id = MODELS.get(alias)
    if not raw_id:
        raise HTTPException(status_code=404, detail="Alias não encontrado.")
    try:
        proc = await asyncio.create_subprocess_exec(
            LMS_CLI, "load", raw_id,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=stderr.decode()[:200])
        return {"ok": True, "alias": alias, "model_id": raw_id}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout ao carregar modelo.")


@app.post("/api/lm-models/{alias}/unload")
async def unload_model(alias: str):
    if alias not in CONTROLLABLE_MODELS:
        raise HTTPException(status_code=400, detail=f"Modelo '{alias}' não é controlável.")
    raw_id = MODELS.get(alias)
    if not raw_id:
        raise HTTPException(status_code=404, detail="Alias não encontrado.")
    try:
        proc = await asyncio.create_subprocess_exec(
            LMS_CLI, "unload", raw_id,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=stderr.decode()[:200])
        return {"ok": True, "alias": alias, "model_id": raw_id}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout ao descarregar modelo.")


# ── Deep Mind helpers ─────────────────────────────────────────────────────────

async def _get_loaded_reasoning_model(reasoning_models: list[str]) -> str | None:
    """Devolve o primeiro reasoning model configurado que esteja carregado no LM Studio."""
    if not reasoning_models:
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            loaded_ids = {m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded"}
        for rm in reasoning_models:
            if rm in loaded_ids:
                return rm
    except Exception:
        pass
    return None


async def _synthesize_for_persona(persona_id: str, reasoning_model_id: str, recent_count: int = 20) -> str | None:
    """Gera resumo das últimas N aprendizagens usando o reasoning model."""
    all_mems = get_all_memories()
    prefix = f"self_{persona_id}|"
    recent = sorted(
        [m for m in all_mems if m.get("source", "").startswith(prefix)],
        key=lambda m: m.get("timestamp", ""),
        reverse=True
    )[:recent_count]
    if not recent:
        return None
    persona_data = _load_persona_file(persona_id) or {}
    persona_name = persona_data.get("name", persona_id)
    facts_str = "\n".join(
        f"- [{m.get('source','').split('|',1)[-1]}] {m['fact']}" for m in recent
    )
    prompt = (
        f"És {persona_name}. Estas são as tuas últimas aprendizagens:\n\n{facts_str}\n\n"
        f"Faz uma síntese coerente em 3-5 frases do que aprendeste recentemente. "
        f"Identifica os temas principais, conexões entre eles e o mais fascinante. "
        f"Usa a tua voz e personalidade. Não listes factos — sintetiza com perspectiva."
    )
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{LM_STUDIO_URL}/v1/chat/completions",
            json={"model": reasoning_model_id, "messages": [{"role": "user", "content": prompt}],
                  "stream": False, "max_tokens": 400, "temperature": 0.7, "enable_thinking": False},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


async def _compute_topic_edges(persona_id: str, persona_name: str, topics: list[str], reasoning_model_id: str):
    """Usa o reasoning model para identificar relações entre tópicos e guarda em SQLite."""
    if len(topics) < 2:
        return
    sample = topics[:20]
    prompt = (
        f"Estes são os tópicos que {persona_name} conhece: {', '.join(sample)}.\n\n"
        f"Identifica os 6-8 pares de tópicos mais relacionados entre si (peso de 0.1 a 1.0).\n"
        f"Responde APENAS com JSON: {{\"edges\": [[\"topico_a\", \"topico_b\", peso], ...]}}"
    )
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{LM_STUDIO_URL}/v1/chat/completions",
                json={"model": reasoning_model_id, "messages": [{"role": "user", "content": prompt}],
                      "stream": False, "max_tokens": 300, "temperature": 0.3, "enable_thinking": False},
            )
            raw = r.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        edges = json.loads(raw).get("edges", [])
        delete_topic_edges(persona_id)
        for edge in edges[:10]:
            if len(edge) >= 2:
                weight = float(edge[2]) if len(edge) > 2 else 0.5
                upsert_topic_edge(persona_id, str(edge[0]), str(edge[1]), weight)
    except Exception as e:
        print(f"[DeepMind] compute_topic_edges falhou: {e}")


async def _defrag_persona_memory(persona_id: str, reasoning_model_id: str) -> dict:
    """Consolida factos por tópico e recalcula arestas com o reasoning model."""
    from memory.lancedb_service import upsert_memory
    persona_data = _load_persona_file(persona_id) or {}
    persona_name = persona_data.get("name", persona_id)
    all_mems = get_all_memories()
    prefix = f"self_{persona_id}|"

    by_topic: dict[str, list[dict]] = {}
    for m in all_mems:
        src = m.get("source", "")
        if not src.startswith(prefix):
            continue
        topic = src[len(prefix):]
        by_topic.setdefault(topic, []).append(m)

    stats: dict = {"topics_processed": 0, "facts_before": sum(len(v) for v in by_topic.values()),
                   "facts_after": 0, "contradictions_removed": 0, "topics": []}

    for topic, facts in by_topic.items():
        if len(facts) < 3:
            stats["facts_after"] += len(facts)
            continue
        facts_str = "\n".join(f"- {f['fact']}" for f in facts)
        prompt = (
            f"Tens estes factos sobre '{topic}':\n{facts_str}\n\n"
            f"1. Remove duplicados e factos muito semelhantes\n"
            f"2. Remove contradições (mantém o mais recente/específico)\n"
            f"3. Combina factos relacionados em afirmações densas\n"
            f"4. Retém no máximo 3 factos essenciais\n\n"
            f"Responde APENAS com JSON: {{\"facts\": [\"facto 1\", \"facto 2\", \"facto 3\"]}}"
        )
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(
                    f"{LM_STUDIO_URL}/v1/chat/completions",
                    json={"model": reasoning_model_id, "messages": [{"role": "user", "content": prompt}],
                          "stream": False, "max_tokens": 400, "temperature": 0.3, "enable_thinking": False},
                )
                raw = r.json()["choices"][0]["message"]["content"].strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            new_facts = json.loads(raw).get("facts", [])[:3]
        except Exception:
            stats["facts_after"] += len(facts)
            continue

        for m in facts:
            delete_memory(m["id"])
            delete_fact(m["id"])

        ts = datetime.now(timezone.utc).isoformat()
        for nf in new_facts:
            upsert_memory(str(uuid.uuid4()), nf, source=f"self_{persona_id}|{topic}", timestamp=ts)

        removed = len(facts) - len(new_facts)
        stats["contradictions_removed"] += max(0, removed)
        stats["facts_after"] += len(new_facts)
        stats["topics_processed"] += 1
        stats["topics"].append({"topic": topic, "before": len(facts), "after": len(new_facts)})

    # recalcula arestas semanticamente após consolidar os factos
    if len(by_topic) > 1:
        centroids = get_topic_vectors(persona_id)
        topics_list = list(centroids.keys())
        THRESHOLD, MAX_NEIGHBORS = 0.62, 4
        candidates = []
        for i in range(len(topics_list)):
            for j in range(i + 1, len(topics_list)):
                sim = cosine_similarity(centroids[topics_list[i]], centroids[topics_list[j]])
                if sim > THRESHOLD:
                    candidates.append((sim, topics_list[i], topics_list[j]))
        candidates.sort(reverse=True)
        degree = {t: 0 for t in topics_list}
        delete_topic_edges(persona_id)
        for sim, ta, tb in candidates:
            if degree[ta] < MAX_NEIGHBORS and degree[tb] < MAX_NEIGHBORS:
                upsert_topic_edge(persona_id, ta, tb, round(sim, 3))
                degree[ta] += 1
                degree[tb] += 1

    return stats


# ── Deep Mind endpoints ───────────────────────────────────────────────────────

class DeepMindConfigBody(BaseModel):
    enabled: bool = False
    reasoning_models: list[str] = []
    auto_synth: bool = False
    auto_synth_cycles: int = 10


@app.get("/api/deep-mind/config/{persona_id}")
async def get_deep_mind_config(persona_id: str):
    config = DEEP_MIND_CONFIG.get(persona_id, {
        "enabled": False, "reasoning_models": [], "auto_synth": False, "auto_synth_cycles": 10,
    })
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            loaded_ids = {m["id"] for m in r.json().get("data", []) if m.get("state") == "loaded"}
    except Exception:
        loaded_ids = set()
    configured = config.get("reasoning_models", [])
    loaded_reasoning = [m for m in configured if m in loaded_ids]
    return {**config, "loaded_reasoning_models": loaded_reasoning, "any_reasoning_loaded": len(loaded_reasoning) > 0}


@app.post("/api/deep-mind/config/{persona_id}")
async def set_deep_mind_config(persona_id: str, body: DeepMindConfigBody):
    DEEP_MIND_CONFIG[persona_id] = body.model_dump()
    auto_learner.deep_config[persona_id] = body.model_dump()
    return {"ok": True}


@app.post("/api/synthesize/{persona_id}")
async def force_synthesize(persona_id: str):
    config = DEEP_MIND_CONFIG.get(persona_id, {})
    rm_id = await _get_loaded_reasoning_model(config.get("reasoning_models", []))
    if not rm_id:
        raise HTTPException(status_code=400, detail="Nenhum modelo reasoning carregado")
    summary = await _synthesize_for_persona(persona_id, rm_id)
    if not summary:
        return {"ok": False, "detail": "Sem factos para sintetizar"}
    persona_data = _load_persona_file(persona_id) or {}
    auto_learner.timeline.insert(0, {
        "persona": persona_data.get("name", persona_id),
        "persona_id": persona_id,
        "avatar": persona_data.get("avatar_url", ""),
        "interest": "síntese",
        "insights": [summary],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "discovery": False, "synthesis": False, "synthesis_report": True,
    })
    return {"ok": True, "summary": summary}


@app.get("/api/defrag/{persona_id}/status")
def defrag_status(persona_id: str):
    return get_defrag_status(persona_id)


@app.post("/api/defrag/{persona_id}")
async def defrag_persona(persona_id: str, force: bool = False):
    # guard: cooldown + score
    if not force:
        status = get_defrag_status(persona_id)
        if not status["cooldown_ok"]:
            raise HTTPException(status_code=429, detail=f"Cooldown activo — último defrag há {status['cooldown_remaining_h']}h. Usa force=true para ignorar.")
        if not status["score_ok"]:
            raise HTTPException(status_code=400, detail=f"Fragmentação baixa ({status['frag_ratio']*100:.0f}% dos tópicos). Conhecimento já consolidado.")

    config = DEEP_MIND_CONFIG.get(persona_id, {})
    rm_id = await _get_loaded_reasoning_model(config.get("reasoning_models", []))
    if not rm_id:
        raise HTTPException(status_code=400, detail="Nenhum modelo reasoning carregado. Configura o Deep Mind primeiro.")
    stats = await _defrag_persona_memory(persona_id, rm_id)
    save_defrag_log(persona_id, stats.get("topics_processed", 0), stats.get("facts_before", 0), stats.get("facts_after", 0))
    return {"ok": True, **stats}


@app.get("/api/topic-edges/{persona_id}")
def list_topic_edges(persona_id: str):
    return get_topic_edges(persona_id)


@app.post("/api/topic-edges/{persona_id}/compute")
async def compute_topic_edges_semantic(persona_id: str):
    """Calcula arestas por similaridade semântica (centróides LanceDB). Sem LLM."""
    centroids = get_topic_vectors(persona_id)
    if len(centroids) < 2:
        return []
    topics = list(centroids.keys())
    THRESHOLD = 0.62   # só relações genuínas (all-MiniLM satura cedo em textos temáticos)
    MAX_NEIGHBORS = 4  # max ligações por nó → evita teia densa

    # calcula todos os pares acima do threshold
    candidates: list[tuple[float, str, str]] = []
    for i in range(len(topics)):
        for j in range(i + 1, len(topics)):
            sim = cosine_similarity(centroids[topics[i]], centroids[topics[j]])
            if sim > THRESHOLD:
                candidates.append((sim, topics[i], topics[j]))
    candidates.sort(reverse=True)

    # greedy: adiciona aresta só se nenhum dos dois nós já atingiu MAX_NEIGHBORS
    degree: dict[str, int] = {t: 0 for t in topics}
    edges = []
    delete_topic_edges(persona_id)
    for sim, ta, tb in candidates:
        if degree[ta] < MAX_NEIGHBORS and degree[tb] < MAX_NEIGHBORS:
            w = round(sim, 3)
            upsert_topic_edge(persona_id, ta, tb, w)
            edges.append({"topic_a": ta, "topic_b": tb, "weight": w})
            degree[ta] += 1
            degree[tb] += 1

    return edges


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


@app.get("/api/persona")
def get_persona():
    name = PERSONA.get("name", "Lucy")
    persona_dir = os.path.join(os.path.dirname(__file__), "persona")
    persona_id = "lucy"
    for fname in os.listdir(persona_dir):
        if not fname.endswith(".json") or fname == "identity.json":
            continue
        try:
            with open(os.path.join(persona_dir, fname), encoding="utf-8") as f:
                d = json.load(f)
            if d.get("name") == name:
                persona_id = fname.replace(".json", "")
                break
        except Exception:
            pass
    return {
        "id": persona_id,
        "name": name,
        "avatar_url": PERSONA.get("avatar_url", ""),
        "defaults": PERSONA.get("defaults", {}),
        "interests": PERSONA.get("interests", []),
        "enabled": PERSONA.get("enabled", True),
    }


class PersonaSwitchRequest(BaseModel):
    persona_id: str


@app.post("/api/persona/switch")
def switch_persona(body: PersonaSwitchRequest):
    global PERSONA
    data = _load_persona_file(body.persona_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Persona '{body.persona_id}' não encontrada")
    PERSONA = data
    return {"ok": True, "name": data.get("name", body.persona_id)}


PERSONA_ORDER = ["lucy", "samantha", "marvin", "glados"]

USER_PHOTO_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "avatars", "user-photo.jpg")


@app.post("/api/user/photo")
async def upload_user_photo(file: __import__('fastapi').UploadFile):
    os.makedirs(os.path.dirname(os.path.abspath(USER_PHOTO_PATH)), exist_ok=True)
    data = await file.read()
    with open(USER_PHOTO_PATH, "wb") as f:
        f.write(data)
    return {"url": "/avatars/user-photo.jpg"}


def _load_persona_file(persona_id: str) -> dict | None:
    persona_dir = os.path.join(os.path.dirname(__file__), "persona")
    path = os.path.join(persona_dir, f"{persona_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save_persona_file(persona_id: str, data: dict):
    persona_dir = os.path.join(os.path.dirname(__file__), "persona")
    path = os.path.join(persona_dir, f"{persona_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@app.get("/api/personas")
def list_personas():
    persona_dir = os.path.join(os.path.dirname(__file__), "persona")
    all_files = {
        fname.replace(".json", ""): fname
        for fname in os.listdir(persona_dir)
        if fname.endswith(".json") and fname != "identity.json"
    }
    ordered = [p for p in PERSONA_ORDER if p in all_files]
    ordered += sorted(k for k in all_files if k not in PERSONA_ORDER)
    result = []
    for pid in ordered:
        try:
            with open(os.path.join(persona_dir, all_files[pid]), encoding="utf-8") as f:
                data = json.load(f)
            result.append({
                "id": pid,
                "name": data.get("name", pid),
                "avatar_url": data.get("avatar_url", ""),
                "video_url": data.get("video_url", ""),
                "pro": data.get("pro", False),
                "enabled": data.get("enabled", True),
                "description": data.get("description", ""),
                "defaults": data.get("defaults", {}),
                "interests": data.get("interests", []),
            })
        except Exception:
            pass
    return result


class PersonaConfigUpdate(BaseModel):
    defaults: dict | None = None
    interests: list[str] | None = None
    avatar_url: str | None = None
    enabled: bool | None = None
    description: str | None = None
    pro: bool | None = None


@app.patch("/api/personas/{persona_id}")
def update_persona_config(persona_id: str, body: PersonaConfigUpdate):
    data = _load_persona_file(persona_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Persona não encontrada")
    # campos explicitamente enviados (funciona em Pydantic v1 e v2)
    sent = getattr(body, "model_fields_set", None) or getattr(body, "__fields_set__", set())
    if body.defaults is not None:
        clean = {k: v for k, v in body.defaults.items() if v is not None}
        data["defaults"] = {**data.get("defaults", {}), **clean}
    if body.interests is not None:
        data["interests"] = body.interests
    if body.avatar_url is not None:
        data["avatar_url"] = body.avatar_url
    if body.description is not None:
        data["description"] = body.description
    # booleans: usar model_fields_set para distinguir False de "não enviado"
    if "enabled" in sent:
        data["enabled"] = bool(body.enabled) if body.enabled is not None else True
    if "pro" in sent:
        data["pro"] = bool(body.pro) if body.pro is not None else False
    _save_persona_file(persona_id, data)
    return {"ok": True}


@app.get("/api/system/stats")
async def system_stats():
    import psutil, subprocess, re
    m = psutil.virtual_memory()
    s = psutil.swap_memory()

    # vm_stat para pressão real de memória (macOS)
    pressure_pct = m.percent
    try:
        vm = subprocess.check_output(["vm_stat"], timeout=2).decode()
        page = 16384
        def _pg(key):
            match = re.search(rf"{key}:\s+(\d+)", vm)
            return int(match.group(1)) * page if match else 0
        used_real = _pg("Pages wired down") + _pg("Pages active") + _pg("Pages occupied by compressor")
        if used_real > 0:
            pressure_pct = round(used_real / m.total * 100, 1)
    except Exception:
        pass

    # modelos carregados + info do LM Studio
    loaded_models = []
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            for mod in r.json().get("data", []):
                if mod.get("state") == "loaded":
                    loaded_models.append({
                        "id": mod["id"],
                        "quantization": mod.get("quantization", ""),
                        "context": mod.get("loaded_context_length", 0),
                    })
    except Exception:
        pass

    return {
        "ram": {
            "total_gb": round(m.total / 1024**3, 1),
            "used_gb":  round(m.used  / 1024**3, 1),
            "free_gb":  round(m.available / 1024**3, 1),
            "percent":  pressure_pct,
        },
        "swap": {
            "used_gb":  round(s.used  / 1024**3, 1),
            "total_gb": round(s.total / 1024**3, 1),
            "percent":  s.percent,
        },
        "loaded_models": loaded_models,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── AutoLearner endpoints ─────────────────────────────────────────────────────

class AutoLearnConfig(BaseModel):
    enabled: dict[str, bool]
    interval: int = 120
    max_cycles: int | None = None  # None = ilimitado


@app.post("/api/autolearn/start")
async def autolearn_start(body: AutoLearnConfig):
    auto_learner.enabled = body.enabled
    auto_learner.interval = max(30, body.interval)
    auto_learner.max_cycles = body.max_cycles
    auto_learner.start()
    return {"ok": True, "running": True}


@app.post("/api/autolearn/stop")
async def autolearn_stop():
    auto_learner.stop()
    return {"ok": True, "running": False}


@app.patch("/api/autolearn/config")
async def autolearn_config(body: AutoLearnConfig):
    auto_learner.enabled = body.enabled
    auto_learner.interval = max(30, body.interval)
    auto_learner.max_cycles = body.max_cycles
    return {"ok": True}


@app.get("/api/autolearn/history")
def autolearn_history(persona_id: str | None = None, limit: int = 300):
    return get_learner_history(persona_id=persona_id, limit=limit)


@app.get("/api/autolearn/status")
def autolearn_status():
    return {
        "running": auto_learner.running,
        "interval": auto_learner.interval,
        "enabled": auto_learner.enabled,
        "current": auto_learner.current,
        "timeline": auto_learner.timeline[:50],
        "cycles": auto_learner._cycles,
    }


@app.get("/api/topics/{persona_id}")
def list_topics(persona_id: str):
    """Devolve tópicos com força, contagem e ciclo — para o grafo."""
    return get_topics(persona_id)


@app.get("/api/topics/{persona_id}/{topic}/summary")
async def topic_summary(persona_id: str, topic: str):
    """Gera resumo do que a persona sabe sobre o tópico + lista os tópicos mais relevantes."""
    from urllib.parse import unquote
    topic = unquote(topic)

    # busca factos deste tópico
    all_mems = get_all_memories()
    prefix = f"self_{persona_id}|{topic}"
    facts = [m["fact"] for m in all_mems if m.get("source", "").startswith(prefix)]

    # todos os tópicos conhecidos da persona (para listar os mais relevantes)
    all_topics = [t["topic"] for t in get_topics(persona_id)]
    persona_data = _load_persona_file(persona_id) or {}
    persona_name = persona_data.get("name", persona_id)
    fixed_interests = persona_data.get("interests", [])
    all_known = list(dict.fromkeys(all_topics + fixed_interests))  # ordem: aprendidos + fixos

    if not facts:
        return {"summary": f"Ainda não tenho factos guardados sobre '{topic}'.", "related": all_known[:5]}

    facts_str = "\n".join(f"- {f}" for f in facts[:8])
    known_str = ", ".join(all_known[:15])

    prompt = (
        f"És {persona_name}. Sobre o tópico '{topic}', sabes o seguinte:\n{facts_str}\n\n"
        f"Outros temas que já exploraste: {known_str}.\n\n"
        f"Escreve uma mensagem curta (2-3 frases) sobre o que sabes sobre '{topic}', "
        f"usando a tua voz e personalidade. Depois lista até 5 tópicos dos que já exploraste "
        f"que são mais relevantes ou relacionados com '{topic}'.\n\n"
        f"Formato EXACTO (sem mais nada):\n"
        f"[resumo em 2-3 frases]\n\n"
        f"Acho que também pode interessar:\n"
        f"- tópico 1\n- tópico 2\n- tópico 3"
    )
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{LM_STUDIO_URL}/v1/chat/completions",
                json={"model": MODELS["gemma-lite"], "messages": [{"role": "user", "content": prompt}],
                      "stream": False, "max_tokens": 250, "temperature": 0.7},
            )
            text = r.json()["choices"][0]["message"]["content"].strip()
        return {"summary": text, "topic": topic, "fact_count": len(facts)}
    except Exception as e:
        return {"summary": f"Tenho {len(facts)} factos sobre '{topic}' mas não consegui sintetizá-los agora.", "topic": topic, "fact_count": len(facts)}
