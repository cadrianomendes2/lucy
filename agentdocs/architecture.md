# Arquitectura — Lucy (Personal AI) · V0.4+

> Decisões arquitecturais e esquema de dados actual. Para navegação de UI ver `NAV.txt`. Para regras de sessão ver `CLAUDE.md`.

---

## Visão Geral

Lucy é uma AI com múltiplas personas, memória persistente por persona, e auto-aprendizagem autónoma. Tudo corre localmente: modelos via LM Studio, dados na máquina.

```
Frontend (React/Vite, porta 5173)
        │  REST + SSE
        ▼
Backend (FastAPI, porta 8000)
   ├── Routing de modelos     → LM Studio (porta 1234, OpenAI-compatible)
   ├── Memória semântica      → LanceDB (~/.personal-ai/lancedb/)
   ├── Sessões + Factos       → SQLite (~/.personal-ai/memory.db)
   ├── Grafo de conhecimento  → SQLite (tabelas topics + topic_edges)
   ├── Histórico de aprendizagem → SQLite (tabela learner_log)
   ├── AutoLearner            → asyncio background task por persona
   ├── Deep Mind              → reasoning opcional (Qwen3.5 / Qwen3.6)
   ├── TTS                    → Resemble.ai (PT: f.cluster, EN: p.cluster)
   └── Personas               → backend/persona/*.json
```

---

## Personas

Cada persona é um ficheiro JSON em `backend/persona/`.

### Estrutura do JSON

```json
{
  "id": "lucy",
  "name": "Lucy",
  "enabled": true,
  "pro": false,
  "language": "pt",
  "model": "nemo-12b",
  "voice": "Vanessa",
  "avatar": "lucy-pro.webp",
  "interests": ["filosofia", "história", "psicologia", "feminilidade"],
  "system_prompts": { "pt": "...", "en": "..." },
  "system_prompts_pro": { "pt": "...", "en": "..." }
}
```

### Personas actuais

| id       | Nome     | Modelo     | Voz     | Língua | Pro disponível |
|----------|----------|------------|---------|--------|----------------|
| lucy     | Lucy     | nemo-12b   | Vanessa | pt     | sim            |
| samantha | Samantha | gemma-26b  | Laura   | pt     | não            |
| marvin   | Marvin   | qwen-40b   | Marvin  | pt     | não            |
| glados   | GLaDOS   | qwen-9b    | GLaDOS  | en     | sim            |

**`system_prompts_pro`** — só Lucy e GLaDOS têm. As outras personas entram em Pro mode (sessão separada) mas usam os mesmos `system_prompts`.

### PERSONA global (backend)

O backend mantém `PERSONA` em memória. Actualizado via:
```
POST /api/persona/switch  { "persona_id": "samantha" }
```
Obrigatório ao mudar de contacto no chat ou seleccionar persona no MindPage.

---

## Pro Mode

Pro mode é **separação de sessão**, não uma persona diferente.

| | Vanilla | Pro |
|---|---|---|
| `is_pro` | `0` | `1` |
| System prompt | `system_prompts` | `system_prompts_pro` (se existir) |
| Histórico | Vê só `is_pro=0` | Vê tudo |
| Memória | Partilhada | Partilhada |
| AutoLearner | Corre | Não corre |
| Activação | — | PIN 1213 |

---

## Base de Dados SQLite (`~/.personal-ai/memory.db`)

### `sessions`
```sql
id INTEGER PK, title TEXT, model TEXT, persona_id TEXT, is_pro INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
```

### `conversations`
```sql
id INTEGER PK, session_id INTEGER → sessions, timestamp TEXT, role TEXT, content TEXT, model TEXT, language TEXT
```

### `facts`
```sql
id TEXT PK, fact TEXT, source TEXT, created_at TEXT
```
Espelho dos factos do utilizador que também estão no LanceDB.

### `topics`
```sql
persona_id TEXT, topic TEXT, strength REAL DEFAULT 1.0, research_count INTEGER, last_cycle INTEGER, created_at TEXT
PRIMARY KEY (persona_id, topic)
```

**Lifecycle:** `strength += 1.0` por pesquisa (max 20). A cada 5 ciclos: idle ≥ 30 → `× 0.7`; idle ≥ 50 → apagado.

**Nota:** o nome do tópico para interesses *fixos* é extraído dos factos pelo LLM (`_extract_subtopic`), não é o label bruto do interesse. Ex: pesquisa "comunismo" → nó "materialismo histórico de Marx".

### `topic_edges`
```sql
persona_id TEXT, topic_a TEXT, topic_b TEXT, weight REAL, updated_at TEXT
PRIMARY KEY (persona_id, topic_a, topic_b)
```
Arestas entre tópicos calculadas por similaridade semântica (cosine similarity dos centróides LanceDB). `topic_a` e `topic_b` guardados em ordem alfabética para evitar duplicados.

Threshold: **0.62** (só relações genuínas). Max **4 vizinhos por nó** para evitar grafo denso.

### `learner_log`
```sql
id TEXT PK, persona_id TEXT, persona_name TEXT, avatar_url TEXT, interest TEXT,
insights TEXT (JSON array), timestamp TEXT, discovery INTEGER, synthesis INTEGER, synthesis_report INTEGER
```
Histórico persistente de todas as aprendizagens. Cada ciclo do AutoLearner insere aqui. Sínteses Deep Mind também ficam com `synthesis_report=1`. Sobrevive a reinicios do backend.

---

## LanceDB — Memória Semântica (`~/.personal-ai/lancedb/`)

### Schema

```
id TEXT, fact TEXT, source TEXT, timestamp TEXT, vector FLOAT[384]  ← all-MiniLM-L6-v2
```

### Campo `source`

| Formato | Significado |
|---|---|
| `"conversation"` | Facto do utilizador (partilhado por todas as personas) |
| `"self\|{tema}"` | Lucy legacy (learner original) |
| `"self_{persona_id}\|{tema}"` | AutoLearner por persona |

### Funções relevantes

- `is_duplicate(fact)` — descarta se L2 distance < 0.24 (≈ cosine > 0.88)
- `get_topic_vectors(persona_id)` — centróide por tópico (média dos embeddings)
- `cosine_similarity(a, b)` — usada pelo compute de arestas semânticas

---

## AutoLearner

Background task `asyncio` por persona. Cada persona corre independentemente.

### Estratégia por ciclo

```
roll < 0.10 ou cycle%10==0  → 🌟 novo absoluto (tabula rasa)
roll < 0.45                 → 📌 tópico fixo (interests[])
roll < 0.70                 → 🔭 descoberta (LLM sugere)
else                        → 🔗 síntese cross-topic (combina 3+ tópicos)
```

### Fluxo de um ciclo

```
_learn_persona(persona_id, cycle)
    → escolhe tópico pela estratégia
    → se tópico fixo: web_search → _extract() → _extract_subtopic() → nó específico
    → upsert_memory(source="self_{persona_id}|{topic}") → LanceDB
    → save_learner_entry(entry) → SQLite learner_log
    → upsert_topic(persona_id, topic, cycle) → SQLite topics
    → a cada 5 ciclos: decay_topics() + apaga factos dos nós mortos
    → se Deep Mind auto_synth e cycle%N==0: _auto_synthesize()
```

### Sub-tópico específico (`_extract_subtopic`)

Para interesses fixos, após extrair os factos, pede ao `gemma-lite`:
> "Qual o conceito específico que estes factos exploram?"

Substitui o label genérico ("comunismo") por algo concreto ("materialismo histórico de Marx"), criando nós mais granulares no grafo.

### Endpoints

```
GET   /api/autolearn/status          → estado em memória (sessão actual)
GET   /api/autolearn/history         → histórico persistente (SQLite learner_log)
POST  /api/autolearn/start           → { enabled, interval, max_cycles }
POST  /api/autolearn/stop
PATCH /api/autolearn/config
```

---

## Grafo de Conhecimento (MindPage)

### Visualização (PersonaGraph)

- **Anel interior**: tópicos fixos + strength ≥ 2.0 (conhecimento consolidado)
- **Anel exterior**: tópicos descobertos, ainda fracos
- Nós do anel exterior ligam ao nó interno mais próximo (por distância euclidiana)
- Dentro de cada anel: ordem por conectividade (`reorderByConnectivity`) — tópicos relacionados ficam adjacentes

### Arestas semânticas

```
POST /api/topic-edges/{persona_id}/compute   → calcula pairwise cosine similarity dos centróides
GET  /api/topic-edges/{persona_id}           → devolve arestas guardadas
```

- Corre automaticamente 1.5s após mudar de persona no MindPage
- Threshold 0.62, max 4 vizinhos → linhas roxas no SVG, espessura ∝ similaridade
- O Desfragmentar também recalcula após consolidar factos

### Desfragmentar (`POST /api/defrag/{persona_id}`)

Requer reasoning model carregado (configurado no Deep Mind).
1. Agrupa factos por tópico (source prefix)
2. Para cada tópico com ≥ 3 factos: pede ao reasoning model para consolidar em ≤ 3 factos densos, remover contradições
3. Apaga factos antigos (LanceDB + SQLite facts), insere consolidados
4. Recalcula arestas semanticamente
5. Devolve: `{ topics_processed, facts_before, facts_after, contradictions_removed }`

---

## Deep Mind

Camada de reasoning sobre o conhecimento. Usa modelos pré-definidos, sem configuração manual.

### Reasoning models pré-definidos (`DEEP_MIND_MODELS`)

| alias | label | tier | estVram |
|---|---|---|---|
| `qwen-9b-auto` | Qwen3.5 | Medium | ~6GB |
| `qwen-40b` | Qwen3.6 | High | ~25GB |

`POST /api/reasoning-models/init` — chamado ao abrir o Perfil; pré-popula os model IDs em `DEEP_MIND_CONFIG` de todas as personas.

### Config em memória (`DEEP_MIND_CONFIG`)

```python
{
  "enabled": bool,
  "reasoning_models": [<raw LM Studio model IDs>],  # geridos pelo sistema
  "auto_synth": bool,
  "auto_synth_cycles": int   # default 10
}
```
Reset ao reiniciar o backend (não persiste em disco).

### Endpoints

```
GET  /api/reasoning-models              → lista pré-definida + loaded status
POST /api/reasoning-models/init         → pré-configura DEEP_MIND_CONFIG de todas as personas
GET  /api/deep-mind/config/{persona_id} → config + any_reasoning_loaded
POST /api/deep-mind/config/{persona_id} → { enabled, auto_synth, auto_synth_cycles }
POST /api/synthesize/{persona_id}       → síntese forçada → entra no timeline como synthesis_report
POST /api/defrag/{persona_id}           → desfragmenta factos + recalcula arestas
```

### Síntese (`POST /api/synthesize/{persona_id}`)

Lê últimos 20 factos `self_{persona_id}|*` → reasoning model → resumo 3-5 frases com voz da persona → inserido no `learner_log` com `synthesis_report=True` → aparece no feed como card dourado 🧠.

### Auto Síntese (AutoLearner)

Quando `deep_mind.auto_synth = true` e `cycle % N == 0`, corre `_auto_synthesize` no fim de `_learn_persona`.

---

## Modelos — Tiers

Baseado em VRAM estimada (memória unificada M3).

| alias | label | estVram | tier | categoria |
|---|---|---|---|---|
| `gemma-lite` | Gemma 4 E4B | ~3GB | Low | chat |
| `qwen-9b-auto` | Qwen3.5 | ~6GB | Low | reasoning |
| `nemo-12b` | Nemo Roleplay | ~8GB | Medium | chat |
| `gemma-26b` | Gemma 4 26B | ~16GB | High | chat |
| `qwen-40b` | Qwen3.6 | ~25GB | Max | reasoning |

**Regras de tier:**
- Low: < 7GB (verde)
- Medium: 7-15GB (âmbar)
- High: 15-21GB (laranja)
- Max: 21-32GB (vermelho)
- Capped: > 32GB (preto) — impossível carregar

`GET /api/lm-models` devolve `{ loaded: [aliases], loaded_ids: [raw LM Studio IDs] }`.

---

## Sistema — Monitorização

```
GET /api/system/stats   → { ram, swap, loaded_models }
```

```json
{
  "ram": { "total_gb": 36, "used_gb": 19, "free_gb": 5, "percent": 83.5 },
  "swap": { "used_gb": 8, "total_gb": 9, "percent": 87 },
  "loaded_models": [{ "id": "...", "quantization": "Q4_K_M", "context": 4096 }]
}
```

- RAM calculada via `psutil` + `vm_stat` (pressão real macOS)
- Swap alto (> 60%) indica memória sob pressão → aviso no UI
- Polled a cada 3s na página de Perfil

---

## Routing de Modelos e Fallback

```
handleSelectPersona(persona)
    → GET /api/lm-models → { loaded: [...], loaded_ids: [...] }
    → se modelo da persona está em loaded → usa esse
    → senão → usa loaded[0]
```

Corre no frontend antes de qualquer chamada de chat, e também no MindPage.

---

## Fluxo de um Turno de Chat

```
POST /api/chat  { message, session_id, model, language, persona_id }
    ├── criar/retomar sessão SQLite
    ├── search_memories(message) → LanceDB (top 8)
    ├── get_system_prompt()
    │       → system_prompts[language] (ou system_prompts_pro se is_pro)
    │       → + últimos 5 self-learnings com timestamp
    │       → + factos do utilizador relevantes
    ├── buildHistory(msgs) → join de msgs consecutivas do mesmo role
    ├── POST LM Studio (streaming)
    └── _stream_and_collect()
            ├── SSE → frontend
            ├── log_turn() → SQLite conversations
            └── extract_and_store() → background: LanceDB + SQLite facts
```

### Paragrafação

`ChatView` divide respostas em `\n\n`: delay ~900ms entre parágrafos + TTS queue por parágrafo.

---

## TTS (Resemble.ai)

| Voz | Língua | Persona |
|---|---|---|
| Vanessa | pt-BR | Lucy |
| Marvin | pt-BR | Marvin |
| Laura | en-US | Samantha |
| GLaDOS | en-GB | GLaDOS |

Cluster PT: `f.cluster` · Cluster EN: `p.cluster`

---

## Frontend — Persistência Local

| Item | Storage |
|---|---|
| Página activa | `localStorage.last_page` |
| Nome do utilizador | `localStorage.user_name` |
| Interesses do utilizador | `localStorage.user_interests` |
| Foto do utilizador | `frontend/public/avatars/user-photo.jpg` (servidor) |

**Avatar** — usa `<img onError>` em vez de `fetch` para detecção. O ícone genérico fica em baixo, a foto sobreposta com `position: absolute`. Se o ficheiro não existir, `onError` esconde a foto.

---

## Variáveis de Ambiente (`~/.personal-ai/.env`)

| Variável | Descrição |
|---|---|
| `LM_STUDIO_URL` | URL LM Studio (default: `http://localhost:1234`) |
| `TAVILY_API_KEY` | API key web search |
| `RESEMBLE_TOKEN` | API key Resemble.ai |
| `RESEMBLE_SYNTH_URL_PT` | Endpoint PT-BR |
| `RESEMBLE_SYNTH_URL_EN` | Endpoint EN-US |

---

## O que NÃO está aqui

- Fluxos de UI e navegação → `NAV.txt`
- Regras de sessão e comandos → `CLAUDE.md`
