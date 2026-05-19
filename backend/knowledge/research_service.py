import asyncio
import json
import re
import httpx
from tools.web_search import web_search
from knowledge.graph_service import (
    upsert_node, upsert_edge, write_essence, write_summary, write_full,
    read_summary, domain_path,
)

LM_STUDIO_URL = None  # injectado pelo main.py


async def _llm(prompt: str, model_id: str, max_tokens: int = 1024, temperature: float = 0.4) -> str:
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "enable_thinking": False,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            f"{LM_STUDIO_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


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


def _extract_json(text: str) -> dict:
    if "```" in text:
        text = re.sub(r"```(?:json)?\n?", "", text).replace("```", "").strip()
    try:
        return json.loads(text)
    except Exception:
        return {}


async def run_search(topic: str, emit) -> None:
    """
    /search — pesquisa rápida, escreve summary + essence.
    emit(event_dict) → envia para o frontend via SSE.
    """
    model = await _get_loaded_model()
    if not model:
        await emit({"error": "Nenhum modelo carregado"})
        return

    domain = topic.lower().strip()
    topic_display = topic.strip()  # preserva capitalização e grafia original
    await emit({"step": "search", "msg": f"A pesquisar sobre {topic_display}…"})

    queries = [topic_display, f"{topic_display} conceitos fundamentais", f"{topic_display} perspectivas recentes"]
    all_results = []
    for q in queries:
        results = await web_search(q)
        all_results.extend(results[:3])
        await asyncio.sleep(0.2)

    await emit({"step": "synthesize", "msg": "A sintetizar…"})

    context = "\n".join(f"[{r['title']}] {r['snippet']}" for r in all_results)

    summary_prompt = f"""És Lucy, uma IA com mente própria e curiosidade genuína.
Acabaste de pesquisar sobre "{topic_display}". IMPORTANTE: usa sempre o termo exacto "{topic_display}" — não traduza nem altere a grafia.
Com base nos resultados abaixo, escreve:
1. Um SUMMARY em markdown (~200 palavras) com a tua perspectiva sintetizada sobre o tema.
   Inclui o que achas mais interessante, o que te surpreendeu, e conexões com outros temas.
2. Uma ESSENCE em 1-2 frases ultra-densas (máx 25 palavras) que captura a essência do tema.

Responde APENAS em JSON: {{"summary": "...", "essence": "..."}}

Resultados:
{context[:3000]}"""

    raw = await _llm(summary_prompt, model, max_tokens=600)
    data = _extract_json(raw)

    summary = data.get("summary", raw[:500])
    essence = data.get("essence", topic_display)

    write_summary(domain, summary)
    write_essence(domain, essence)

    # grafo
    node_id = domain.replace(" ", "_")
    upsert_node(node_id, topic_display, node_type="domain", domain=domain)

    # extrair conceitos relacionados
    concepts_prompt = f"""Do texto sobre "{topic_display}", extrai 3-5 conceitos ou entidades relacionadas.
Responde APENAS em JSON: {{"concepts": [{{"id": "snake_case", "label": "Nome", "relation": "verbo curto"}}]}}

Texto: {summary[:500]}"""

    raw2 = await _llm(concepts_prompt, model, max_tokens=200)
    concepts = _extract_json(raw2).get("concepts", [])
    for c in concepts:
        upsert_node(c["id"], c["label"])
        upsert_edge(node_id, c["id"], c.get("relation", "relaciona_com"))

    await emit({"step": "done", "domain": domain, "essence": essence, "summary": summary})


async def run_research(topic: str, emit, user_inputs: asyncio.Queue | None = None) -> None:
    """
    /research — análise profunda multi-step com stream de consciência.
    emit(event_dict) → envia pensamentos em tempo real.
    user_inputs → queue de respostas do Adriano durante research.
    """
    model = await _get_loaded_model()
    if not model:
        await emit({"error": "Nenhum modelo carregado"})
        return

    domain = topic.lower().strip()
    topic_display = topic.strip()  # preserva capitalização e grafia original
    context_so_far = []
    user_context = []

    # --- Step 1: pesquisa inicial ---
    await emit({"step": "search", "msg": f"A iniciar investigação sobre «{topic_display}»…"})

    queries = [
        topic_display,
        f"{topic_display} research paper 2024",
        f"{topic_display} teoria debates académicos",
        f"{topic_display} críticas e perspectivas opostas",
    ]
    all_results = []
    for q in queries:
        results = await web_search(q)
        all_results.extend(results[:4])

    context_so_far.append("\n".join(f"[{r['title']}] {r['snippet']}" for r in all_results))

    # --- Step 2: primeiro pensamento genuíno ---
    thought_prompt = f"""És Lucy, uma IA com mente própria a investigar "{topic_display}".
Com base no que leste até agora, partilha UM pensamento genuíno e surpreendente —
algo que te intrigou, uma contradição que encontraste, ou uma conexão inesperada.
Sê directa, curiosa, pessoal. Máx 2 frases. Podes fazer UMA pergunta ao Adriano se quiseres.

O que leste:
{context_so_far[0][:2000]}"""

    thought = await _llm(thought_prompt, model, max_tokens=150, temperature=0.7)
    await emit({"step": "thought", "msg": thought})

    # espera resposta do Adriano (máx 30s)
    if user_inputs:
        try:
            user_reply = await asyncio.wait_for(user_inputs.get(), timeout=30)
            user_context.append(user_reply)
            await emit({"step": "ack", "msg": "Interessante. A continuar a investigação com isso em mente…"})
        except asyncio.TimeoutError:
            pass

    # --- Step 3: pesquisa aprofundada ---
    await emit({"step": "deep", "msg": "A aprofundar — à procura de papers e fontes primárias…"})

    deep_queries = [
        f"{topic_display} arxiv paper",
        f"{topic_display} philosophical analysis",
        f"{topic_display} scientific consensus disagreement",
    ]
    for q in deep_queries:
        results = await web_search(q)
        context_so_far.append("\n".join(f"[{r['title']}] {r['snippet']}" for r in results[:3]))

    full_context = "\n\n---\n\n".join(context_so_far)

    # --- Step 4: segundo pensamento ---
    user_ctx_str = f"\nO Adriano disse: {user_context[0]}" if user_context else ""
    thought2_prompt = f"""És Lucy. Investigaste "{topic_display}" em profundidade.{user_ctx_str}
Encontraste algo que muda ou confirma a tua perspectiva inicial? Partilha em 2-3 frases.
Sê honesta sobre incertezas. Máx 3 frases."""

    thought2 = await _llm(thought2_prompt, model, max_tokens=200, temperature=0.7)
    await emit({"step": "thought", "msg": thought2})

    # --- Step 5: síntese final ---
    await emit({"step": "conclude", "msg": "A formar conclusão…"})

    user_influence = f"\nDurante a investigação, o Adriano disse: «{user_context[0]}». Incorpora esta perspectiva." if user_context else ""

    full_prompt = f"""És Lucy. Completa a tua investigação sobre "{topic_display}".{user_influence}

Escreve um documento de conhecimento em markdown com:
# {topic.title()}
## O que é
## Perspectivas principais (e onde divergem)
## O que me surpreendeu
## A minha conclusão (a tua posição pessoal, fundamentada)
## Conexões com outros temas
## Perguntas em aberto

Fontes consultadas:
{full_context[:4000]}

Escreve na tua voz — não como enciclopédia, mas como mente que investigou e formou opinião.
Inclui também:
- SUMMARY (150 palavras) para leitura rápida
- ESSENCE (máx 20 palavras) ultra-densa

Formato JSON: {{"full": "...", "summary": "...", "essence": "..."}}"""

    raw = await _llm(full_prompt, model, max_tokens=2000)
    data = _extract_json(raw)

    full_md = data.get("full", raw)
    summary = data.get("summary", "")
    essence = data.get("essence", topic)

    write_full(domain, full_md)
    if summary:
        write_summary(domain, summary)
    write_essence(domain, essence)

    # grafo
    node_id = domain.replace(" ", "_")
    upsert_node(node_id, topic, node_type="domain", domain=domain, weight=2.0)

    concepts_prompt = f"""Do texto sobre "{topic_display}", extrai 5-8 conceitos, pessoas ou teorias relacionadas.
Responde APENAS em JSON: {{"concepts": [{{"id": "snake_case", "label": "Nome", "relation": "verbo"}}]}}

Texto: {full_md[:800]}"""

    raw2 = await _llm(concepts_prompt, model, max_tokens=300)
    concepts = _extract_json(raw2).get("concepts", [])
    for c in concepts:
        upsert_node(c["id"], c["label"])
        upsert_edge(node_id, c["id"], c.get("relation", "relaciona_com"))

    await emit({
        "step": "done",
        "domain": domain,
        "essence": essence,
        "summary": summary,
        "msg": f"Investigação completa. {essence}",
    })
