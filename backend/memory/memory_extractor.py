import json
import uuid
import httpx
from .lancedb_service import upsert_memory
from .sqlite_service import save_fact
from datetime import datetime, timezone

_PROMPT = """\
Analisa esta troca de conversa e extrai factos concretos e duradouros sobre o utilizador.
Retorna APENAS JSON válido com a chave "facts" contendo uma lista de strings.
Cada facto deve ser uma frase curta e factual. Ignora factos triviais ou já óbvios.
Se não houver factos relevantes, retorna {{"facts": []}}.

Exemplos de factos válidos:
- "O utilizador chama-se João"
- "O utilizador gosta de música jazz"
- "O utilizador trabalha como engenheiro de software"
- "O utilizador tem um cão chamado Rex"

Conversa:
Utilizador: {user_message}
Assistente: {assistant_message}

Responde APENAS com JSON, sem explicações."""


async def extract_and_store(
    user_message: str,
    assistant_message: str,
    lm_studio_url: str,
    model_id: str,
    pro: bool = False,
) -> list[str]:
    if not user_message.strip():
        return []

    payload = {
        "model": model_id,
        "messages": [
            {
                "role": "user",
                "content": _PROMPT.format(
                    user_message=user_message,
                    assistant_message=assistant_message,
                ),
            }
        ],
        "stream": False,
        "max_tokens": 256,
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{lm_studio_url}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        if not r.is_success:
            return []
        raw = r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return []

    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        facts: list[str] = json.loads(raw).get("facts", [])
    except (json.JSONDecodeError, AttributeError):
        return []

    source = "pro|conversation" if pro else "conversation"
    now = datetime.now(timezone.utc).isoformat()
    for fact in facts:
        fact_id = str(uuid.uuid4())
        upsert_memory(fact_id, fact, source=source, timestamp=now)
        save_fact(fact_id, fact, source=source)

    return facts
