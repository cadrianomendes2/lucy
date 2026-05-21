# Arquitectura — Lucy (Personal AI) · V0.4

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
   ├── Grafo de conhecimento  → SQLite (tabela topics, mesmo DB)
   ├── AutoLearner            → asyncio background task
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
  "system_prompts": {
    "pt": "...",
    "en": "..."
  },
  "system_prompts_pro": {
    "pt": "...",
    "en": "..."
  }
}
```

### Personas actuais

| id        | Nome     | Modelo    | Voz     | Língua | Pro disponível |
|-----------|----------|-----------|---------|--------|----------------|
| lucy      | Lucy     | nemo-12b  | Vanessa | pt     | sim            |
| samantha  | Samantha | gemma-26b | Laura   | pt     | não            |
| marvin    | Marvin   | qwen-40b  | Marvin  | pt     | não            |
| glados    | GLaDOS   | qwen-9b   | GLaDOS  | en     | sim            |

**`system_prompts_pro`** — só Lucy e GLaDOS têm este campo. As outras personas entram em Pro mode (sessão separada) mas usam os mesmos `system_prompts`.

### PERSONA global (backend)

O backend mantém `PERSONA` em memória (o dict do JSON activo). É actualizado via:
```
POST /api/persona/switch  { "persona_id": "samantha" }
```
Obrigatório sempre que o utilizador muda de contacto no chat ou selecciona uma persona no MindPage. Sem isto, o backend usa sempre a última persona carregada.

---

## Pro Mode

Pro mode é **separação de sessão**, não uma persona diferente.

| | Vanilla | Pro |
|---|---|---|
| `is_pro` | `0` | `1` |
| System prompt | `system_prompts` | `system_prompts_pro` (se existir) |
| Histórico de sessões | Vê `is_pro=0` | Vê todas (`is_pro` 0 e 1) |
| Memória | Partilhada com vanilla | Partilhada com vanilla |
| AutoLearner | Corre | Não corre em pro |
| Activação | — | PIN 1213, via botão no ContactProfile |

**Segurança de sessões:**
- Vanilla: `GET /api/sessions?persona_id=X&is_pro=0` — nunca vê sessões pro
- Pro: `GET /api/sessions?persona_id=X` — vê tudo
- Pre-fill de última sessão: respeita o mesmo filtro `is_pro`

---

## Base de Dados SQLite (`~/.personal-ai/memory.db`)

### Tabela `sessions`

```sql
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    model       TEXT,
    persona_id  TEXT,
    is_pro      INTEGER DEFAULT 0,
    created_at  TEXT,
    updated_at  TEXT
)
```

### Tabela `conversations`

```sql
CREATE TABLE conversations (
    id          TEXT PRIMARY KEY,
    session_id  TEXT,
    timestamp   TEXT,
    role        TEXT,        -- 'user' | 'assistant'
    content     TEXT,
    model       TEXT,
    language    TEXT
)
```

### Tabela `facts`

```sql
CREATE TABLE facts (
    id          TEXT PRIMARY KEY,
    fact        TEXT,
    source      TEXT,
    created_at  TEXT
)
```

Espelho dos factos do utilizador que também estão no LanceDB. SQLite guarda texto puro; LanceDB guarda embeddings.

### Tabela `topics`

```sql
CREATE TABLE topics (
    persona_id      TEXT,
    topic           TEXT,
    strength        REAL DEFAULT 1.0,
    research_count  INTEGER DEFAULT 1,
    last_cycle      INTEGER DEFAULT 0,
    created_at      TEXT,
    PRIMARY KEY (persona_id, topic)
)
```

Grafo de conhecimento do AutoLearner. Um registo por (persona, tópico).

**Lifecycle de um nó:**
- Criado quando o AutoLearner faz a primeira pesquisa sobre o tópico
- `strength += 1.0` a cada pesquisa (max 20)
- A cada 5 ciclos → `decay_topics()` corre:
  - `last_cycle` idle ≥ 30 ciclos → `strength × 0.7`
  - `last_cycle` idle ≥ 50 ciclos → apagado (+ factos do LanceDB removidos)
- Apagar manualmente: `DELETE /api/memories/topic/{persona_id}/{topic}`

---

## LanceDB — Memória Semântica (`~/.personal-ai/lancedb/`)

### Schema da tabela `memories`

```
id        TEXT
fact      TEXT
source    TEXT   ← semântica importante (ver abaixo)
timestamp TEXT
vector    FLOAT[384]   ← all-MiniLM-L6-v2
```

### Campo `source` — convenção

| Formato | Significado |
|---|---|
| `"conversation"` | Facto extraído de conversa com o utilizador (partilhado por todas as personas) |
| `"self\|{tema}"` | Aprendizagem autónoma da Lucy (legacy, só Lucy vê) |
| `"self_lucy\|{tema}"` | Aprendizagem autónoma da Lucy (novo formato) |
| `"self_samantha\|{tema}"` | Aprendizagem autónoma da Samantha |
| `"self_marvin\|{tema}"` | Aprendizagem autónoma do Marvin |
| `"self_glados\|{tema}"` | Aprendizagem autónoma da GLaDOS |

**Regra de filtragem:**
- Factos do utilizador (sem prefixo `self`) → injectados para todas as personas
- `self|` → só Lucy (retrocompatibilidade)
- `self_{persona_id}|` → só a persona correspondente

### Deduplicação

Antes de inserir, `is_duplicate()` faz busca L2. Se `_distance < 0.24` (≈ cosine > 0.88), o facto é descartado.

### Wipe

`DELETE /api/memories` com PIN 1213 → `wipe_all_memories()` remove tudo da tabela.

---

## AutoLearner

Background task `asyncio` por persona. Cada persona tem a sua task independente.

### Configuração por persona

```python
AutoLearnConfig:
    enabled:    bool
    interval:   int          # minutos (1-30, padrão 2)
    max_cycles: int | None   # None = ilimitado
```

### Estratégia de pesquisa por ciclo

```
roll = random()

roll < 0.40  → 📌 tópico fixo (interests[] do persona.json)
roll < 0.65  → 🔭 descoberta (LLM sugere baseado na personalidade)
roll < 0.90  → 🔗 síntese cross-topic (combina 3+ tópicos existentes)
else         → 🌟 exploração nova absoluta (tabula rasa)

+ garantia: a cada 10 ciclos força 🌟 novo absoluto
```

### Fluxo de um ciclo

```
_learn_persona(persona_id, cycle)
    → escolhe tópico (estratégia acima)
    → web_search via Tavily
    → _extract() via LM Studio (gemma-lite)
    → upsert_memory(source="self_{persona_id}|{topic}") → LanceDB
    → upsert_topic(persona_id, topic, cycle) → SQLite topics
    → a cada 5 ciclos: decay_topics() → remove nós idle
```

### Endpoints

```
GET  /api/autolearn/status          → estado de todas as personas
POST /api/autolearn/start           → { persona_id, config }
POST /api/autolearn/stop            → { persona_id }
POST /api/autolearn/config          → actualiza config de uma persona
```

---

## Routing de Modelos

Todos os modelos correm via LM Studio (OpenAI-compatible, porta 1234).

### Modelos disponíveis

| alias       | uso principal               |
|-------------|-----------------------------|
| `gemma-lite` | pesquisa, extrações, learner |
| `nemo-12b`  | roleplay PT-BR (Lucy)       |
| `gemma-26b` | chat equilibrado             |
| `qwen-9b`   | instruct rápido (GLaDOS)    |
| `qwen-27b`  | raciocínio destilado        |
| `qwen-40b`  | raciocínio pesado (Marvin)  |

### Fallback automático

```
handleSelectPersona(persona)
    → GET /api/lm-models → { loaded: [...] }
    → se modelo da persona está em loaded → usa esse
    → senão → usa loaded[0]
```

O fallback corre no frontend antes de qualquer chamada de chat, e também no MindPage.

---

## Fluxo de um Turno de Chat

```
POST /api/chat  { message, session_id, model, language, persona_id }
    │
    ├── criar/retomar sessão SQLite
    ├── search_memories(message) → LanceDB (top 8 relevantes)
    │       filtra: factos globais + self_{persona_id}|
    ├── get_system_prompt()
    │       → system_prompts[language] (ou system_prompts_pro se is_pro)
    │       → + últimos 5 self-learnings com timestamp [hoje às HH:MM]
    │       → + factos do utilizador relevantes
    ├── buildHistory(msgs) → join de mensagens consecutivas do mesmo role
    │
    ├── POST LM Studio /v1/chat/completions (streaming)
    │
    └── _stream_and_collect()
            ├── SSE → frontend (texto chunk a chunk)
            ├── log_turn() → SQLite conversations
            └── extract_and_store() → background: LanceDB + SQLite facts
```

### Paragrafação no frontend

O `ChatView` divide a resposta em parágrafos (`\n\n`):
- Delay de ~900ms entre parágrafos (efeito WhatsApp)
- TTS enfileirado por parágrafo (`drainTTS()`) — o áudio começa no §1 enquanto §2 ainda está a ser gerado

---

## TTS (Resemble.ai)

```
POST /api/tts  { text, voice }
    → escolhe cluster: PT (f.cluster) ou EN (p.cluster)
    → Resemble Synthesis API → audio/wav
    → devolve stream ao frontend
```

| Voz    | Língua | Persona |
|--------|--------|---------|
| Vanessa | pt-BR | Lucy    |
| Marvin  | pt-BR | Marvin  |
| Laura   | en-US | Samantha |
| GLaDOS  | en-GB | GLaDOS  |

---

## Sessões e Pre-fill

Ao mudar de contacto no chat:
1. `POST /api/persona/switch` → actualiza PERSONA global no backend
2. Valida modelo carregado → fallback se necessário
3. `GET /api/sessions?persona_id=X[&is_pro=0]` → última sessão
4. `GET /api/conversations?session_id=Y` → histórico → preenche chat

---

## Variáveis de Ambiente (`~/.personal-ai/.env`)

| Variável | Descrição |
|---|---|
| `LM_STUDIO_URL` | URL do LM Studio (default: `http://localhost:1234`) |
| `TAVILY_API_KEY` | API key para web search |
| `RESEMBLE_TOKEN` | API key Resemble.ai |
| `RESEMBLE_SYNTH_URL_PT` | Endpoint PT-BR (Vanessa) |
| `RESEMBLE_SYNTH_URL_EN` | Endpoint EN-US (Laura) |

---

## O que NÃO está aqui

- Fluxos de UI e navegação → `NAV.txt`
- Regras de sessão e comandos → `CLAUDE.md`
- Estado de implementação → `CONTEXT.md` (se existir)
