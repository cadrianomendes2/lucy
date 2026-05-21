# Arquitectura — Lucy (Personal AI) · V0.6

> Decisões arquitecturais e esquema de dados actual. Para navegação de UI ver `NAV.txt`. Para regras de sessão ver `CLAUDE.md`.

---

## Visão Geral

Lucy é uma AI com múltiplas personas, memória persistente por persona, e auto-aprendizagem autónoma. Tudo corre localmente: modelos via LM Studio, dados na máquina.

```
Lucy.app (macOS)          ← duplo-clique arranca tudo
        │
        ├── Frontend (React/Vite, porta 5173)
        │       │  REST + SSE
        │       ▼
        └── Backend (FastAPI, porta 8000)
               ├── Routing de modelos     → LM Studio (porta 1234, OpenAI-compatible)
               ├── Controlo de modelos    → lms CLI (~/.lmstudio/bin/lms)
               ├── Memória semântica      → LanceDB (~/.personal-ai/lancedb/)
               ├── Sessões + Factos       → SQLite (~/.personal-ai/memory.db)
               ├── Grafo de conhecimento  → SQLite (tabelas topics + topic_edges)
               ├── Histórico de aprendizagem → SQLite (tabela learner_log)
               ├── Defrag guard           → SQLite (tabela defrag_log)
               ├── AutoLearner            → asyncio background task por persona
               ├── Deep Mind              → reasoning opcional (Qwen3.5 / Qwen3.6)
               ├── TTS                    → Resemble.ai (PT: f.cluster, EN: p.cluster)
               ├── Vision (screen share)  → getDisplayMedia → base64 JPEG → OpenAI vision format
               └── Personas               → backend/persona/*.json
```

---

## Lucy.app — Launcher macOS

App em `/Applications/Lucy.app` que inicia backend + frontend e abre o Safari.

- Verifica se os servidores já estão a correr (não duplica)
- Inicia `uvicorn` e `npm run dev` em background (logs em `/tmp/lucy-app/`)
- Aguarda até ambos estarem prontos (máx 30s)
- Abre `http://localhost:5173` no Safari
- Ícone: foto da Lucy (lucy-vanilla.jpg)

---

## Personas

Cada persona é um ficheiro JSON em `backend/persona/`.

### Estrutura do JSON

```json
{
  "name": "Lucy",
  "avatar_url": "/avatars/lucy-vanilla.jpg",
  "video_url": "/avatars/lucy-vanilla.mp4",
  "defaults": { "model": "gemma-lite", "language": "pt", "voice_uuid": "..." },
  "interests": ["conservedora", "família", "mulher virtuosa", "caridade", "regiliosidade", "feminilidade"],
  "system_prompts": { "pt": "...", "en": "..." },
  "system_prompts_pro": { "pt": "...", "en": "..." },
  "enabled": true,
  "pro": false
}
```

### Personas actuais

| id       | Nome     | Modelo     | Voz     | Língua | Pro disponível |
|----------|----------|------------|---------|--------|----------------|
| lucy     | Lucy     | gemma-lite | Vanessa | pt     | sim            |
| samantha | Samantha | gemma-lite | Laura   | en     | não            |
| marvin   | Marvin   | gemma-lite | Marvin  | pt     | não            |
| glados   | GLaDOS   | qwen-27b   | GLaDOS  | en     | sim            |

### Regra de opinião (system prompts)

Todos os prompts incluem uma secção **"Opinião — regra central"** que instrui a persona a:
- Dar a sua perspectiva **primeiro**, baseada na personalidade e interesses
- Usar as secções `## O que aprendeste` e `## O teu conhecimento sobre os temas` (injectadas pelo backend) para fundamentar as opiniões
- Nunca deflectir com "o que acha?" em vez de dar a própria visão

### PERSONA global (backend)

O backend mantém `PERSONA` em memória. Actualizado via:
```
POST /api/persona/switch  { "persona_id": "samantha" }
```

---

## Pro Mode

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

### `topics`
```sql
persona_id TEXT, topic TEXT, strength REAL DEFAULT 1.0, research_count INTEGER, last_cycle INTEGER, created_at TEXT
PRIMARY KEY (persona_id, topic)
```

**Lifecycle:** `strength += 1.0` por pesquisa (max 20). A cada 5 ciclos: idle ≥ 30 → `× 0.7`; idle ≥ 50 → apagado.

**Nota:** nome do tópico para interesses fixos extraído pelo LLM (`_extract_subtopic`). Ex: "comunismo" → "materialismo histórico de Marx".

### `topic_edges`
```sql
persona_id TEXT, topic_a TEXT, topic_b TEXT, weight REAL, updated_at TEXT
PRIMARY KEY (persona_id, topic_a, topic_b)
```
Threshold: **0.62**. Max **4 vizinhos por nó**.

### `learner_log`
```sql
id TEXT PK, persona_id TEXT, persona_name TEXT, avatar_url TEXT, interest TEXT,
insights TEXT (JSON array), timestamp TEXT, discovery INTEGER, synthesis INTEGER, synthesis_report INTEGER
```

### `defrag_log`
```sql
persona_id TEXT PK, last_defrag_at TEXT, topics_processed INTEGER, facts_before INTEGER, facts_after INTEGER
```
Usado pelo defrag guard. Um registo por persona (upsert).

---

## LanceDB — Memória Semântica (`~/.personal-ai/lancedb/`)

```
id TEXT, fact TEXT, source TEXT, timestamp TEXT, vector FLOAT[384]  ← all-MiniLM-L6-v2
```

| Formato source | Significado |
|---|---|
| `"conversation"` | Facto do utilizador |
| `"self\|{tema}"` | Lucy legacy |
| `"self_{persona_id}\|{tema}"` | AutoLearner por persona |

---

## AutoLearner

Background task `asyncio` por persona.

### Estratégia por ciclo

```
roll < 0.10 ou cycle%10==0  → 🌟 novo absoluto (tabula rasa)
roll < 0.45                 → 📌 tópico fixo (interests[])
roll < 0.70                 → 🔭 descoberta (LLM sugere)
else                        → 🔗 síntese cross-topic
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

### Endpoints

```
GET   /api/autolearn/status
GET   /api/autolearn/history
POST  /api/autolearn/start    { enabled, interval, max_cycles }
POST  /api/autolearn/stop
PATCH /api/autolearn/config
```

---

## Grafo de Conhecimento (MindPage)

### Visualização 3D (MindGraph3D)

Componente React com `ForceGraph3D` (react-force-graph + Three.js).

**Estrutura de nós:**
- **Persona** — esfera texturada com avatar + anel verde, ancorada na origem (`fx/fy/fz = 0`)
- **Interesses fixos** — cor única por ramo da paleta (teal, azul, violeta, laranja…)
- **Tópicos descobertos** — cor do interesse fixo mais próximo (BFS por arestas semânticas), mais clara
- **Nó emergente** ★ — dourado (`#f59e0b`): `strength ≥ 8` + `≥ 2 arestas semânticas` + não fixo. Indica novo root potencial da personalidade

**Estrutura de ligações:**
- `persona → interesses fixos` — âncoras da identidade (linha verde por ramo)
- `tópico_a ↔ tópico_b` — arestas semânticas (linha roxa, espessura ∝ similaridade)
- `persona → isolados` — fallback para tópicos sem arestas semânticas (linha muito fina)

**Câmara:**
- Auto-rotação à volta da origem (persona ancorada)
- Ao largar drag: ângulo sincronizado → rotação continua de onde o utilizador ficou
- Scroll = zoom; drag = orbitar

**Inicialização:**
- Lazy import de `react-force-graph` (carrega só ao renderizar MindPage)
- `window.THREE = { ...THREE }` definido em `main.jsx` antes de qualquer render
- `window.AFRAME` stub em `index.html` (aframe-extras do bundle VR)

### Visualização 2D (PersonaGraph)

SVG estático com dois anéis:
- **Anel interior**: fixos + strength ≥ 2.0
- **Anel exterior**: descobertos fracos
- Arestas semânticas: linhas roxas, espessura ∝ similaridade

### Arestas semânticas

```
POST /api/topic-edges/{persona_id}/compute   → cosine similarity dos centróides LanceDB
GET  /api/topic-edges/{persona_id}           → devolve arestas guardadas
```

### Desfragmentar

```
GET  /api/defrag/{persona_id}/status   → { should_defrag, cooldown_ok, cooldown_remaining_h,
                                           score_ok, frag_ratio, fragmented_topics, total_topics }
POST /api/defrag/{persona_id}          → desfragmenta (aceita ?force=true)
POST /api/defrag/{persona_id}?force=true → ignora guard
```

**Defrag guard:**
- Cooldown: 12h entre defrags
- Score mínimo: ≥ 20% dos tópicos com `research_count ≥ 5` (fragmentados)
- Botão mostra estado: `🔒 Defrag (11.5h)` ou `🔒 Defrag (8%)` com botão "forçar"
- Registo em `defrag_log` após execução bem-sucedida

---

## Deep Mind

| alias | label | tier | estVram |
|---|---|---|---|
| `qwen-9b-auto` | Qwen3.5 | Medium | ~6GB |
| `qwen-40b` | Qwen3.6 | High | ~25GB |

### Endpoints

```
GET  /api/reasoning-models
POST /api/reasoning-models/init
GET  /api/deep-mind/config/{persona_id}
POST /api/deep-mind/config/{persona_id}   { enabled, auto_synth, auto_synth_cycles }
POST /api/synthesize/{persona_id}
POST /api/defrag/{persona_id}
```

---

## Modelos — Tiers e Controlo

| alias | label | estVram | tier | categoria | controlável |
|---|---|---|---|---|---|
| `gemma-lite` | Gemma 4 E4B | ~3GB | Low | chat | ✓ |
| `qwen-9b-auto` | Qwen3.5 | ~6GB | Low | reasoning | ✓ |
| `nemo-12b` | Nemo Roleplay | ~8GB | Medium | chat | — |
| `gemma-26b` | Gemma 4 26B | ~16GB | High | chat | ✓ |
| `qwen-40b` | Qwen3.6 | ~25GB | Max | reasoning | — |

**Tiers:** Low < 7GB (verde) · Medium 7-15GB (âmbar) · High 15-21GB (laranja) · Max 21-32GB (vermelho) · Capped > 32GB (preto)

**IDs reais (LM Studio):**
```python
"gemma-lite":   "gemma-4-e4b-it-ultra-uncensored-heretic"
"gemma-26b":    "gemma-4-26b-a4b-it-ultra-uncensored-heretic"
"qwen-9b-auto": "qwen3.5-9b-claude-4.6-os-auto-variable-heretic-uncensored-thinking-max-neocode-imatrix"
"qwen-40b":     "qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max"
"nemo-12b":     "nemo_roleplay_ptbr_new-i1"
```

### Controlo de modelos (play/stop)

Os 3 modelos "controláveis" têm botão ▶/■ no Perfil. Usa o CLI `lms`:

```
GET  /api/lm-models/available              → lista com estado actual (loaded/not-loaded)
POST /api/lm-models/{alias}/load           → lms load {model_id} (timeout 120s)
POST /api/lm-models/{alias}/unload         → lms unload {model_id}
GET  /api/lm-models                        → { loaded: [aliases], loaded_ids: [raw_ids] }
```

CLI path: `~/.lmstudio/bin/lms`

---

## Sistema — Monitorização

```
GET /api/system/stats   → { ram, swap, loaded_models }
```

RAM via `psutil` + `vm_stat`. Swap > 60% → aviso no UI. Polled a cada 3s no Perfil.

---

## Fluxo de um Turno de Chat

```
POST /api/chat  { message, session_id, model, language, persona_id, image? }
    ├── criar/retomar sessão SQLite
    ├── search_memories(message) → LanceDB (top 8)
    ├── get_system_prompt()
    │       → system_prompts[language] (ou system_prompts_pro se is_pro)
    │       → + factos do utilizador relevantes
    │       → + últimos 5 self-learnings desta persona (sempre presentes)
    │       → + conhecimento relevante para os temas da mensagem
    ├── buildHistory(msgs) → join de msgs consecutivas do mesmo role
    ├── se image presente: content = [{ type: text }, { type: image_url, base64 }]
    ├── POST LM Studio (streaming)
    └── _stream_and_collect()
            ├── SSE → frontend
            ├── log_turn() → SQLite conversations
            └── extract_and_store() → background: LanceDB + SQLite facts
```

---

## Vision — Screen Share

Permite partilhar o ecrã ou uma janela com a persona durante o chat.

### Fluxo

```
Utilizador clica 🖥️ no MessageInput
    → navigator.mediaDevices.getDisplayMedia() → picker nativo do browser
    → MediaStream fica activo em background (<video> hidden)
    → indicador visual: borda vermelha + thumbnail + "A capturar ecrã"

Ao enviar mensagem (se screen share activo):
    → canvas.drawImage(video) → resize máx 1440px → JPEG q=0.70 → base64
    → POST /api/chat com campo image: base64
    → thumbnail visível na bolha do utilizador
    → backend formata content como array vision [text, image_url]
    → Gemma4 (multimodal) processa texto + imagem
```

### Detalhes técnicos

| Item | Valor |
|---|---|
| Resolução de captura | máx 1440px de largura |
| Formato | JPEG quality 0.70 |
| Tamanho típico | ~100–200 KB |
| Base64 típico | ~130–270 KB |
| Tempo de resposta (Gemma E4B) | ~1.5–3s |
| Modelo mínimo | Gemma4 E4B (multimodal) |

### Instrução nas personas

Todos os system prompts incluem secção **"Visão de ecrã"** que instrui a persona a:
- Ler o conteúdo visível (texto, código, história) quando o utilizador pergunta sobre ele
- Não descrever a interface à volta — ir directo ao conteúdo
- Manter a personalidade da persona na resposta

### Recomendação de uso

- **"Janela"** no picker → modelo vê só essa janela (melhor foco)
- **"Ecrã inteiro"** → modelo vê tudo incluindo o próprio Lucy (mais contexto, menos detalhe por área)

---

## TTS (Resemble.ai)

| Voz | Língua | Persona |
|---|---|---|
| Vanessa | pt-BR | Lucy |
| Marvin | pt-BR | Marvin |
| Laura | en-US | Samantha |
| GLaDOS | en-GB | GLaDOS |

---

## Frontend — Persistência Local

| Item | Storage |
|---|---|
| Página activa | `localStorage.last_page` |
| Tema dark/light | `localStorage.theme` |
| Nome do utilizador | `localStorage.user_name` |
| Interesses do utilizador | `localStorage.user_interests` |
| Foto do utilizador | `frontend/public/avatars/user-photo.jpg` (servidor) |

**Dark mode** — toggle lua/sol no fundo do rail. CSS variables em `[data-theme="dark"]` no `index.css`. Aplica `data-theme` ao `<html>` via `useEffect`. Componentes usam `var(--surface)`, `var(--card-bg)`, `var(--rail-bg)`, etc.

**Avatar do utilizador (rail)** — clique abre menu popover com "Ver perfil" e "Alterar foto" (upload directo).

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
