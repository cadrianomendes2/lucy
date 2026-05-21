# CLAUDE.md — Personal AI (Lucy)

## Stack & Tecnologias

### V0.1 — App Mac (Chat Puro)
- App: SwiftUI (macOS 14+, Xcode)
- LLM principal: Claude Haiku 4.5 via Anthropic API (streaming)
- LLM local: Gemma 4 E4B Heretic via Ollama (conteúdo sem filtros)
- Hardware: Mac M3 32GB RAM

### V0.2+ — Backend
- Backend: Python + FastAPI
- Memória episódica: Qdrant (vector DB)
- Memória estruturada: SQLite
- Persona/identidade: ficheiros JSON em `backend/persona/`

### Ferramentas de Dev
- Testes Swift: XCTest
- Testes Python: Pytest
- CI/CD: local por agora (sem pipeline)

---

## Arquitectura

### V0.1
- App SwiftUI standalone no Mac
- Comunica directamente com Anthropic API (sem backend)
- Fallback para Ollama local quando pedido explicitamente
- Zero persistência — cada sessão começa do zero

### V0.2+
- SwiftUI faz chamadas ao FastAPI local (localhost)
- FastAPI gere memória, persona e routing entre modelos
- Qdrant para embeddings de memória de longo prazo
- SQLite para log estruturado de conversas e factos

### Routing de modelos
- Haiku → chat normal, trabalho, código
- Gemma local → conteúdo adulto, sem filtros, roleplay

---

## Convenções de Código

### Swift / SwiftUI
- Variáveis e funções: camelCase
- Tipos, structs, classes, views: PascalCase
- Ficheiros de Views: PascalCase.swift (ex: `ChatView.swift`)
- Ficheiros de serviços: PascalCase+Service.swift (ex: `AnthropicService.swift`)
- Comentários: português
- Nunca `!` force-unwrap — usar `guard let` ou `if let`
- Async/await nativo (sem Combine onde evitável)

### Python / FastAPI
- Variáveis e funções: snake_case
- Classes: PascalCase
- Ficheiros: snake_case.py
- Comentários: português
- Tipos explícitos com Pydantic nos modelos
- Nunca `Any` nos tipos de retorno de endpoints

---

## Comandos Principais

```bash
# App SwiftUI
open ~/Developer/personal-ai/PersonalAI.xcodeproj

# Backend FastAPI
cd ~/Projects/lucy/backend
uvicorn main:app --port 8000

# Frontend React
cd ~/Projects/lucy/frontend
npm run dev

# Ollama
ollama serve &
ollama run igorls/gemma-4-E4B-it-heretic-GGUF

# Testar API Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":100,"messages":[{"role":"user","content":"Olá!"}]}'
```

---

## Variáveis de Ambiente

Ficheiro: `~/.personal-ai/.env` (nunca commitar)
```
ANTHROPIC_API_KEY=sk-ant-XXXXXXXX
OLLAMA_BASE_URL=http://localhost:11434
QDRANT_URL=http://localhost:6333   # V0.2+
```

---

## Regras de Sessão (OBRIGATÓRIO)

1. Nunca assumir requisitos ambíguos — perguntar antes de implementar
2. Listar assumptions no início de cada task complexa
3. Avisar quando contexto > 60%: "⚠️ Contexto em X%. Recomendo /compact."
4. Não tocar em ficheiros fora do scope da task actual
5. Preservar em compaction: regras deste ficheiro, ficheiros modificados, decisões arquitecturais
6. Ao mudar de versão (V0.1 → V0.2), não quebrar funcionalidade existente

---

## O que NÃO fazer

- [ ] Não usar force-unwrap `!` em Swift
- [ ] Não fazer chamadas à Anthropic API directamente nas Views (só nos Services)
- [ ] Não commitar `.env` ou chaves de API
- [ ] Não misturar lógica de routing de modelos nas Views
- [ ] Não criar lógica de negócio em componentes UI
- [ ] Não usar `Any` em tipos Python

---

## Referências

- `NAV.txt` — navegação completa da app: páginas, painéis, fluxos, personas, modelos, vozes, sessões e modo Pro
- `agentdocs/architecture.md` — arquitectura de dados actual: SQLite, LanceDB, personas, Pro mode, AutoLearner, TTS, routing de modelos
- `app-map.json` — mapa de ecrãs e estado de implementação
- `CONTEXT.md` — estado actual e handoff entre sessões
- `agentdocs/` — specs por versão/feature
- `personal-ai.md` — documento de visão e roadmap original
