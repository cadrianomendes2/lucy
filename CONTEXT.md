# CONTEXT.md — Handoff de Sessão

## Estado Actual
**Data:** 2026-05-19
**Sessão:** #5
**Feature em progresso:** V0.4 Fase 1 concluída — Mente Distribuída (base de grafos + research)

---

## O que foi feito nesta sessão

### Multi-modelo com LM Studio
- [x] `MODELS` dict com 8 modelos: nemo-12b, qwen-40b, qwen-9b-auto, gemma-lite, qwen-27b, gemma-26b, gpt-20b, qwen-9b
- [x] IDs exactos verificados via `/api/v0/models` do LM Studio
- [x] `ModelSelector.jsx` — dropdown custom com bolinha verde por modelo (polling `/api/lm-models` cada 10s)
- [x] `/api/lm-models` usa `/api/v0/models` (com campo `state: "loaded"`) em vez de `/v1/models` (que lista tudo)
- [x] Auto-select do modelo carregado ao carregar a página
- [x] `FAST_MODELS` → `REASONING_MODELS` com `enable_thinking: false` por defeito para modelos Qwen

### ThinkingSelector — controlo de reasoning
- [x] `ThinkingSelector.jsx` — só aparece para modelos Qwen (arch qwen35)
- [x] Modos: Off / Fast (512 tokens) / Med (2048) / Max (8192)
- [x] Backend: `thinking_mode` no `ChatRequest`, `_extra_params(model_key, thinking_mode)` → `enable_thinking` + `thinking_budget`

### Fix: modelos carregando Gemma indevidamente
- [x] `services/learner.py` — estava hardcoded em `LM_STUDIO_MODEL_LITE`. Agora chama `/api/v0/models` e usa o primeiro modelo com `state: "loaded"`
- [x] `memory_extractor.py` — já usava o `model_id` passado (corrigido numa sessão anterior)
- [x] `_stream_and_collect` — passa `model_id` do chat actual para `extract_and_store` (não o model_lite)

### Histórico de sessões (estilo ChatGPT)
- [x] `sqlite_service.py` — tabela `sessions` (id, title, created_at, updated_at) + `session_id` em `conversations`
- [x] `SessionSidebar.jsx` — painel esquerdo com sessões agrupadas por Hoje/Ontem/7 dias/Anterior, botão `+`, delete on hover
- [x] Auto-título a partir da primeira mensagem (60 chars)
- [x] `GET /api/sessions`, `GET /api/sessions/{id}/messages`, `DELETE /api/sessions/{id}`, `PATCH /api/sessions/{id}`
- [x] `_chat_generator` emite `{session_id, session_title}` como primeiro evento SSE
- [x] Bug fix crítico: `sessionCreatedHere` ref — impede fetch de mensagens durante streaming ativo (causava crash `undefined.content`)

### Bugs de UI corrigidos
- [x] **Página preta ao clicar Nova Conversa** — React confundia `SessionSidebar` e `ChatView` com `key={0}` idêntico → corrigido para `key="sidebar-N"` e `key="chat-N"`
- [x] **Espaço extra nas mensagens** — `whiteSpace: pre-wrap` + LLM começa com `\n` → `message.content?.trim()` (só quando não está em streaming)
- [x] **Resposta duplicada** — ChatView remontava quando `setSessionId` mudava a key → key do ChatView agora só usa `chatKey` (não inclui `sessionId`)
- [x] **Contexto de pesquisa a contaminar conversas** — entity matching agora usa word boundary (`\b`) e só para nós `type === 'domain'`

### V0.4 Fase 1 — Mente Distribuída

#### Backend: Knowledge Graph Service
- [x] `backend/knowledge/graph_service.py`
  - Grafo SQLite em `~/.personal-ai/knowledge_graph.db` (nodes + edges)
  - Hierarquia 3 níveis por domínio: `essence.txt` (~20 tokens), `summary.md` (~200 tokens), `full.md` (ilimitado)
  - Domínios em `backend/knowledge/domains/{nome}/`
  - `traverse(start_ids, hops=2)` — BFS para retrieval
  - `get_knowledge_context(domains, level)` — agrega contexto para system prompt
- [x] `init_graph()` chamado no startup do FastAPI

#### Backend: Research Service
- [x] `backend/knowledge/research_service.py`
  - `run_search(topic, emit)` — pesquisa rápida, escreve summary + essence, adiciona nós ao grafo
  - `run_research(topic, emit, user_inputs)` — análise profunda multi-step com stream de consciência, aceita respostas do utilizador via `asyncio.Queue`
  - Ambos usam `_get_loaded_model()` dinamicamente
  - `topic_display` preserva grafia original (não traduz "amoeba" para "ameba")
  - Instrução explícita ao LLM para não alterar o termo pesquisado

#### Backend: Endpoints
- [x] `POST /api/search` — SSE streaming de `/search <tema>`
- [x] `POST /api/research` — SSE streaming de `/research <tema>` com queue de respostas
- [x] `POST /api/research/reply` — envia resposta do utilizador durante research em curso
- [x] `GET /api/knowledge/graph` — todos os nós e arestas
- [x] `GET /api/knowledge/domains` — lista de domínios
- [x] `GET /api/knowledge/summary/{domain}` — summary ou essence do domínio

#### Backend: Retrieval integrado no chat
- [x] `_extract_entity_ids(message)` — word boundary matching, só domínios
- [x] `traverse()` + `get_knowledge_context()` injectados no system prompt quando relevante
- [x] Zero vectors para conhecimento do mundo — só grafo + ficheiros

#### Frontend: ResearchStream
- [x] `ResearchStream.jsx` — painel paralelo ao chat, aparece durante `/search` ou `/research`
- [x] Barra de progresso animada (`@keyframes progress-slide`)
- [x] Pensamentos da Lucy em tempo real (step `thought`)
- [x] Input para responder durante research + botão "ignorar"
- [x] Quando termina: `"Terminei a pesquisa. Quer ouvir o que achei sobre **X**?"`
- [x] Detecta `/search <tema>` e `/research <tema>` no `ChatView` antes de enviar para API

#### Frontend: KnowledgeGraph
- [x] `KnowledgeGraph.jsx` — painel "Mente da Lucy" com `react-force-graph-2d`
- [x] Nós azuis (domínios, maiores) e roxos (conceitos, menores)
- [x] Arestas com setas e label da relação
- [x] Auto-zoom após simulação estabilizar
- [x] Click num nó → mostra summary no painel de baixo
- [x] Estado vazio com mensagem orientativa
- [x] Botão no header (ícone de rede)

### UI / Design
- [x] `showCharacter` começa `false` (foto desativada por defeito)
- [x] Logo Lucy: SVG de olho + fonte Orbitron + gradiente cyan
- [x] Accent color alterado para `#00d4ff` (cyan)
- [x] `HeaderIconButton` component reutilizável
- [x] `@keyframes spin` e `@keyframes progress-slide` em `index.css`

---

## Arquitectura actual

```
~/Projects/lucy/
├── backend/
│   ├── main.py                     ← FastAPI, todos os endpoints, _chat_generator com SSE
│   ├── knowledge/
│   │   ├── __init__.py
│   │   ├── graph_service.py        ← SQLite graph + hierarquia 3 níveis
│   │   ├── research_service.py     ← run_search(), run_research()
│   │   └── domains/                ← ficheiros de conhecimento (não versionado)
│   │       └── {dominio}/
│   │           ├── essence.txt
│   │           ├── summary.md
│   │           └── full.md
│   ├── memory/
│   │   ├── lancedb_service.py      ← embeddings memórias do utilizador
│   │   ├── sqlite_service.py       ← sessions + conversations + facts
│   │   └── memory_extractor.py     ← extrai factos após cada turno
│   ├── persona/
│   │   └── identity.json           ← system prompts + interests[]
│   ├── services/
│   │   └── learner.py              ← learner autónomo (usa modelo loaded dinamicamente)
│   └── tools/
│       └── web_search.py           ← Tavily API
├── frontend/
│   └── src/
│       ├── App.jsx                 ← estado global, layout, toggles
│       └── components/
│           ├── ChatView.jsx        ← chat + /search /research commands
│           ├── SessionSidebar.jsx  ← histórico de conversas
│           ├── ModelSelector.jsx   ← dropdown com bolinhas loaded
│           ├── ThinkingSelector.jsx ← Off/Fast/Med/Max (só Qwen)
│           ├── ResearchStream.jsx  ← canal paralelo de research
│           ├── KnowledgeGraph.jsx  ← grafo force-directed
│           ├── MemoryBrowserView.jsx
│           ├── InterestsView.jsx
│           └── CharacterView.jsx

~/.personal-ai/
├── .env                            ← TAVILY_API_KEY, LM_STUDIO_URL, RESEMBLE_TOKEN, ...
├── memory.db                       ← SQLite: sessions + conversations + facts
├── knowledge_graph.db              ← SQLite: graph nodes + edges
└── lancedb/                        ← embeddings do utilizador
```

---

## Comandos para arrancar

```bash
# Backend
cd ~/Projects/lucy/backend
uvicorn main:app --port 8000

# Frontend
cd ~/Projects/lucy/frontend
npm run dev
# http://localhost:5173

# Ver modelos carregados no LM Studio
curl -s http://localhost:1234/api/v0/models | python3 -m json.tool

# Ver grafo de conhecimento
curl -s http://localhost:8000/api/knowledge/graph | python3 -m json.tool
```

---

## Contexto crítico para não perder

- **LM Studio**: usar `/api/v0/models` (não `/v1/models`) para `state: "loaded"` — é a única forma de saber o que está realmente em memória
- **Reasoning models**: `enable_thinking: false` enviado automaticamente para modelos Qwen. Com thinking ligado, passar `thinking_budget` (512/2048/8192)
- **Session crash pattern**: `sessionCreatedHere.current = true` antes de `onSessionCreated()` — impede o useEffect de fazer fetch durante streaming ativo
- **Knowledge retrieval**: só injeta contexto quando o nome exacto do domínio aparece na mensagem (word boundary). Evita contaminação entre tópicos
- **Learner**: chama `/api/v0/models` a cada ciclo para usar o modelo loaded — nunca hardcoded
- **topic_display vs domain**: `domain = topic.lower()` para paths de ficheiros; `topic_display = topic.strip()` para prompts LLM (preserva grafia)
- **Python path**: `/Library/Frameworks/Python.framework/Versions/3.10/bin/uvicorn`
- **Resemble**: Vanessa `7a33e74f` (PT-BR), restantes EN

---

## V0.4 Fase 1 concluída — Próximas fases

### Fase 2 (próxima sessão)
- [ ] Learner autónomo com curiosidade dirigida por grafo (identifica lacunas)
- [ ] Surfacing natural: "Andei a estudar X, queres ouvir?"
- [ ] Canal SSE persistente para Lucy falar durante research em background real
- [ ] Novo layout (Adriano vai implementar)

### Fase 3
- [ ] Compressão autónoma de `full.md` quando fica grande demais
- [ ] Cross-domain synthesis: Lucy conecta domínios sem pedido explícito
- [ ] Visualização de grafo com search/filter e histórico de crescimento

### Pendente de sessões anteriores
- [ ] `IdentityPanelView.jsx` — edição da persona em tempo real
- [ ] Interesses evoluem com base nas conversas
- [ ] Notificação toast quando learner termina ciclo

---

## Compaction prompt sugerido
```
/compact Preserva: arquitectura V0.4 (knowledge graph + research service + 3-tier files),
bugs críticos resolvidos (sessionCreatedHere ref, duplicate key, word boundary matching),
IDs exactos dos modelos LM Studio, comandos de arranque, contexto crítico.
Resume: outputs de ferramentas e código intermédio.
```
