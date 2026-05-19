# CONTEXT.md — Handoff de Sessão

## Estado Actual
**Data:** 2026-05-19
**Sessão:** #3
**Feature em progresso:** V0.2 sistema de memória implementado — a testar

---

## O que foi feito nesta sessão (V0.1 completo)

- [x] Estrutura de projecto criada em `~/Developer/personal-ai/`
- [x] Backend FastAPI com streaming para Haiku + LM Studio (`main.py`)
- [x] Frontend React + Vite com chat em streaming
- [x] Modelo configurado: `gemma-4-e4b-it-ultra-uncensored-heretic` via LM Studio
- [x] Persona da Lucy criada em `backend/persona/identity.json` (PT-BR e EN)
- [x] Selector de idioma com bandeiras 🇧🇷 / 🇬🇧 — muda idioma e reinicia conversa
- [x] TTS via Resemble AI — endpoint `/api/tts` no backend
- [x] Selector de vozes com dropdown (Primrose, Bentley, Linda, Laura, Vanessa, Samantha)
- [x] Emojis removidos do texto antes de enviar para TTS
- [x] Personagem 3D dividida com o chat (40% / 60%)
- [x] Animações WebP: `idle.webp` (padrão), `talking.webp` (durante TTS), `pleaseme.webp` (comando `/pleaseme`)
- [x] Comando `/pleaseme` — activa animação por 4 segundos sem chamar a API

---

## Decisões tomadas

| Decisão | Motivo | Alternativa rejeitada |
|---|---|---|
| React + Vite em vez de SwiftUI | Velocidade de desenvolvimento, fácil troca futura | SwiftUI |
| LM Studio em vez de Ollama | Utilizador já tem modelos configurados no LM Studio | Ollama |
| `gemma-4-e4b-it-ultra-uncensored-heretic` | Modelo abliterado, sem filtros, leve (~5GB) | Gemma 31B |
| Resemble AI para TTS | Já usado no npc-gen, vozes conhecidas | ElevenLabs / local |
| voiceUuid directo no TTS | Mais flexível que language-based | Switch por idioma |
| Persona em JSON separado | Antecipa sistema de identidade do V0.2 | Hardcoded no backend |

---

## Estrutura actual de ficheiros

```
~/Projects/lucy/                 ← repositório git principal
├── backend/
│   ├── main.py                  ← FastAPI: /api/chat, /api/tts, /api/voices, /api/health, /api/memories
│   ├── requirements.txt
│   ├── persona/
│   │   └── identity.json        ← system prompts PT-BR e EN da Lucy
│   └── memory/
│       ├── lancedb_service.py   ← embeddings (all-MiniLM-L6-v2, LanceDB)
│       ├── sqlite_service.py    ← log estruturado de conversas e factos
│       └── memory_extractor.py  ← extrai factos via Gemma após cada turno
├── frontend/
│   ├── vite.config.js           ← proxy /api → localhost:8000
│   ├── src/
│   │   ├── App.jsx              ← layout, estado global
│   │   └── components/
│   │       ├── ChatView.jsx
│   │       ├── CharacterView.jsx
│   │       ├── MemoryBrowserView.jsx ← painel 🧠 de memórias
│   │       ├── MessageBubble.jsx
│   │       ├── MessageInput.jsx
│   │       ├── ModelSelector.jsx
│   │       ├── LanguageSelector.jsx
│   │       └── VoiceSelector.jsx
│   └── public/
│       └── animations/
│           ├── idle.webp
│           ├── talking.webp
│           └── pleaseme.webp
├── CLAUDE.md / CONTEXT.md / app-map.json / agentdocs/

~/.personal-ai/.env              ← API keys (nunca commitar)
~/.personal-ai/lancedb/          ← base de embeddings (local, não versionado)
~/.personal-ai/memory.db         ← SQLite com factos (local, não versionado)
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
# Abre http://localhost:5173
```

---

## Próximos passos — V0.2 (Memória/Aprendizado)

1. [x] Substituiu Qdrant por LanceDB (sem Docker) — dados em `~/.personal-ai/lancedb/`
2. [x] `backend/memory/lancedb_service.py` — upsert/search de embeddings (all-MiniLM-L6-v2, 384d)
3. [x] `backend/memory/sqlite_service.py` — log de conversas + factos em `~/.personal-ai/memory.db`
4. [x] `backend/memory/memory_extractor.py` — extrai factos via Haiku após cada turno (async)
5. [x] `/api/chat` injecting top-5 memórias relevantes no system prompt
6. [x] `GET /api/memories` e `DELETE /api/memories/{id}` no backend
7. [x] `MemoryBrowserView.jsx` — painel lateral collapsível com botão 🧠 no header

### Pendente V0.2
- [ ] Testar ciclo completo (conversa → extracção → injecção na sessão seguinte)
- [ ] `IdentityPanelView.jsx` — edição da persona (ver app-map.json)

---

## Contexto crítico para não perder

- LM Studio deve estar aberto com `gemma-4-e4b-it-ultra-uncensored-heretic` carregado
- Resemble token em `~/.personal-ai/.env` — mesma chave do npc-gen
- Vozes Resemble: Vanessa `7a33e74f` (PT, cluster `f.`), restantes cluster `p.`
- Animações em `frontend/public/animations/` — copiar de `~/Projects/lucy/3d-model/` se necessário
- V0.2 usa LanceDB (sem Docker) — embeddings em `~/.personal-ai/lancedb/`, SQLite em `~/.personal-ai/memory.db`
- Modelo de embeddings: `all-MiniLM-L6-v2` via sentence-transformers (384 dimensões, ~80MB, local)
- Extracção de factos: Haiku dispara assíncronamente após cada resposta (asyncio.create_task)
- Injecção: top-5 memórias por similaridade coseno injectadas no system prompt

## Compaction prompt sugerido
```
/compact Preserva: decisões de arquitectura, estrutura de ficheiros actual,
comandos para arrancar backend e frontend, estado do V0.1 (concluído),
próximos passos do V0.2. Resume: outputs de ferramentas e código já implementado.
```
