import asyncio
import json
import os
import random
import uuid
import httpx
from datetime import datetime, timezone

from tools.web_search import web_search

PERSONA_PATH = os.path.join(os.path.dirname(__file__), "..", "persona", "identity.json")
LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234")
LEARN_INTERVAL = int(os.getenv("LEARN_INTERVAL_SECONDS", "1800"))  # 30 min por defeito


async def _get_loaded_model() -> str | None:
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{LM_STUDIO_URL}/api/v0/models")
            r.raise_for_status()
            for m in r.json().get("data", []):
                if m.get("state") == "loaded" and m.get("type") in ("llm", "vlm"):
                    return m["id"]
    except Exception:
        pass
    return None

_EXTRACT_PROMPT = """\
Acabaste de ler estes resultados sobre o tópico "{interest}":

{context}

Extrai exactamente 2 ou 3 factos, ideias ou perspectivas que achaste genuinamente interessantes ou surpreendentes.
Responde APENAS com JSON válido: {{"insights": ["facto 1", "facto 2", "facto 3"]}}
Sem explicações. Sem texto fora do JSON."""


async def _extract_insights(interest: str, results: list[dict]) -> list[str]:
    context = "\n".join(f"[{r['title']}] {r['snippet']}" for r in results)
    model = await _get_loaded_model()
    if not model:
        return []
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": _EXTRACT_PROMPT.format(interest=interest, context=context)}],
        "stream": False,
        "max_tokens": 300,
        "temperature": 0.4,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{LM_STUDIO_URL}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            r.raise_for_status()
            raw = r.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(raw).get("insights", [])[:3]
    except Exception:
        return []


async def learn_cycle() -> tuple[str, list[str]]:
    """Executa um ciclo: escolhe interesse → pesquisa → extrai → guarda. Devolve (interesse, insights)."""
    from memory.lancedb_service import upsert_memory

    with open(PERSONA_PATH, encoding="utf-8") as f:
        persona = json.load(f)

    interests: list[str] = persona.get("interests", [])
    if not interests:
        return ("", [])

    interest = random.choice(interests)
    results = await web_search(f"{interest} ideias perspectivas recentes")
    if not results:
        return (interest, [])

    insights = await _extract_insights(interest, results)
    now = datetime.now(timezone.utc).isoformat()
    for insight in insights:
        upsert_memory(str(uuid.uuid4()), insight, source=f"self|{interest}", timestamp=now)

    return (interest, insights)


async def force_learn(interest: str) -> tuple[str, list[str]]:
    """Força um ciclo de aprendizagem para um interesse específico."""
    from memory.lancedb_service import upsert_memory
    results = await web_search(f"{interest} ideias perspectivas recentes")
    if not results:
        return (interest, [])
    insights = await _extract_insights(interest, results)
    now = datetime.now(timezone.utc).isoformat()
    for insight in insights:
        upsert_memory(str(uuid.uuid4()), insight, source=f"self|{interest}", timestamp=now)
    return (interest, insights)


async def start_learner():
    await asyncio.sleep(120)  # deixa o servidor arrancar antes do primeiro ciclo
    while True:
        try:
            await learn_cycle()
        except Exception:
            pass
        await asyncio.sleep(LEARN_INTERVAL)
