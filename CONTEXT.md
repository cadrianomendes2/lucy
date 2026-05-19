# CONTEXT.md — Handoff de Sessão

## Estado Actual
**Data:** 2026-05-19
**Sessão:** #4
**Feature em progresso:** V0.3 concluído — Web Search + Autonomous Learner + UI improvements

---

## O que foi feito nesta sessão (V0.3)

### Web Search com Tool Use
- [x] `backend/tools/web_search.py` — chama Tavily API (timeout 5s, fallback gracioso)
- [x] `backend/main.py` — agentic loop no `/api/chat`: 1ª chamada non-streaming detecta tool_calls, executa search, 2ª chamada streaming sintetiza com resultados
- [x] `frontend/src/components/ChatView.jsx` — indicador "A pesquisar: ..." quando `{"searching": true}` chega via SSE
- [x] API key Tavily em `~/.personal-ai/.env` como `TAVILY_API_KEY`

**Bug crítico resolvido:** `TAVILY_API_KEY = os.getenv(...)` era lido na importação do módulo, antes de `load_dotenv()` em `main.py`. Corrigido: key lida lazily dentro da função.

**Bug de persona:** instrução "REGRA: chama web_search IMEDIATAMENTE" adicionada ao system prompt — sem ela o modelo com o persona completo pedia permissão antes de pesquisar.

### Autonomous Learner
- [x] `backend/services/learner.py` — ciclo autónomo: escolhe interesse aleatório → Tavily → Gemma extrai 2-3 insights → guarda em LanceDB com `source: "self|{interest}"`
- [x] Arranque como asyncio task no startup do FastAPI (espera 2 min, depois corre de 30 em 30 min)
- [x] `force_learn(interest)` — força ciclo para interesse específico (usado para popular dados iniciais)
- [x] `backend/persona/identity.json` — campo `interests`: filosofia, história, futuro da IA, comunismo, capitalismo

### Sistema de memória própria
- [x] Memórias da Lucy têm `source: "self|{interest}"` (vs `"conversation"` para memórias do utilizador)
- [x] `get_system_prompt` separa as duas em secções: "O que sabes sobre o utilizador" vs "O que aprendeste por conta própria"
- [x] `GET /api/interests` — devolve factos agrupados e ordenados por interesse
- [x] Filtros actualizados: `source.startswith("self")` em vez de `== "self"`

### UI — InterestsView
- [x] `frontend/src/components/InterestsView.jsx` — painel 📚 com interesses em cores próprias, factos com timestamp relativo, actualiza de 30 em 30s
- [x] Toggle 🖼️ no header para esconder/mostrar personagem (chat expande para 100%)
- [x] Toggle 📚 para abrir/fechar painel de aprendizagem

### Persona — comportamento conversacional
- [x] Corrigido: Lucy terminava TODAS as respostas com uma pergunta
- [x] Corrigido: voltava a assuntos anteriores (PC/benchmark) mesmo quando o tema tinha mudado
- [x] Regras novas no system prompt: perguntas são opcionais e genuínas; deixa a conversa respirar; não redireciona para assuntos velhos

---

## Decisões tomadas

| Decisão | Motivo | Alternativa rejeitada |
|---|---|---|
| Tavily em vez de Brave Search | Free tier melhor (1000/mês), API simples, snippets formatados para LLMs | Brave Search (2000/mês mas key mais burocrática) |
| Non-streaming 1ª chamada + streaming 2ª | Simplicidade — não precisar de parsear tool_calls de um stream | Streaming completo com reset |
| `source: "self\|interesse"` em vez de campo novo | Sem quebrar schema LanceDB existente | Novo campo `topic` (requeria migração) |
| asyncio.create_task para learner | Sem dependência de APScheduler | APScheduler |
| Key lida lazily em web_search.py | `os.getenv()` na importação é lido antes de `load_dotenv()` — bug subtil | Module-level constant |
| `temperature: 0` na chamada de tool detection | Determinismo — modelo ativava tools ~50% das vezes com temperatura default | Tool_choice: required (forçaria search sempre) |

---

## Estrutura actual de ficheiros

```
~/Projects/lucy/
├── backend/
│   ├── main.py                  ← FastAPI + agentic loop + /api/interests
│   ├── requirements.txt
│   ├── persona/
│   │   └── identity.json        ← system prompts + campo interests[]
│   ├── memory/
│   │   ├── lancedb_service.py   ← embeddings (source: "conversation" | "self|{interest}")
│   │   ├── sqlite_service.py    ← log estruturado
│   │   └── memory_extractor.py  ← extrai factos do utilizador após cada turno
│   ├── tools/
│   │   └── web_search.py        ← Tavily API, key lida lazily, timeout 5s
│   └── services/
│       └── learner.py           ← learn_cycle(), force_learn(), start_learner()
├── frontend/
│   ├── src/
│   │   ├── App.jsx              ← toggles: 🖼️ personagem, 📚 interesses, 🧠 memórias
│   │   └── components/
│   │       ├── ChatView.jsx     ← indicador "A pesquisar..."
│   │       ├── InterestsView.jsx ← painel de aprendizagem autónoma
│   │       ├── MemoryBrowserView.jsx
│   │       ├── CharacterView.jsx
│   │       └── [outros]
│   └── public/animations/

~/.personal-ai/.env              ← ANTHROPIC_API_KEY, TAVILY_API_KEY, LM_STUDIO_URL, ...
~/.personal-ai/lancedb/          ← embeddings locais (não versionado)
~/.personal-ai/memory.db         ← SQLite (não versionado)
```

---

## Comandos para arrancar

```bash
# Backend (Python 3.10 framework)
cd ~/Projects/lucy/backend
/Library/Frameworks/Python.framework/Versions/3.10/bin/uvicorn main:app --port 8000

# Frontend
cd ~/Projects/lucy/frontend
npm run dev
# Abre http://localhost:5173

# Forçar ciclo de aprendizagem manualmente
cd ~/Projects/lucy/backend
python3 -c "
import asyncio, os
from dotenv import load_dotenv
load_dotenv(os.path.expanduser('~/.personal-ai/.env'))
from services.learner import force_learn
asyncio.run(force_learn('filosofia'))
"
```

---

## Contexto crítico para não perder

- **LM Studio** deve estar aberto com `gemma-4-e4b-it-ultra-uncensored-heretic` carregado
- **Tavily** free tier: 1000 queries/mês — key em `~/.personal-ai/.env` como `TAVILY_API_KEY`
- **Tool detection:** `temperature: 0` + instrução explícita no system prompt são ambos necessários para o modelo ativar tools de forma consistente
- **Learner source format:** `"self|{interest}"` — split em `|` para agrupar no `/api/interests`; factos antigos com `source: "self"` ficam em grupo "geral"
- **Resemble token** em `~/.personal-ai/.env` — vozes Resemble: Vanessa `7a33e74f` (PT), restantes EN
- **LanceDB** em `~/.personal-ai/lancedb/` — schema fixo, sem campo `topic`; usar source para rastrear origem
- **Extracção de factos:** async task após cada resposta (não bloqueia streaming)
- **Python correcto:** `/Library/Frameworks/Python.framework/Versions/3.10/bin/` tem todas as deps instaladas

---

## V0.3 concluído — Pendente V0.4

- [x] Web search com Tavily (tool use nativo do Gemma)
- [x] Learner autónomo com interesses configuráveis
- [x] Painel de aprendizagem (InterestsView)
- [x] Toggle personagem + painel de interesses
- [x] Persona: Lucy para de terminar cada resposta com uma pergunta

### Pendente V0.4
- [ ] `IdentityPanelView.jsx` — edição da persona em tempo real
- [ ] Interesses da Lucy evoluem com base nas conversas (adicionar/remover automaticamente)
- [ ] Histórico de pesquisas (o que pesquisou, quando, resultado)
- [ ] Notificação quando o learner termina um ciclo (toast na UI)

---

## Compaction prompt sugerido
```
/compact Preserva: decisões de arquitectura, estrutura de ficheiros actual,
comandos para arrancar (incluindo Python path correcto), bugs críticos resolvidos
(TAVILY_API_KEY lazy loading, tool instruction no system prompt),
estado V0.3 concluído, pendentes V0.4. Resume: outputs de ferramentas e código.
```
