# CLAUDE.md — Personal AI (Lucy)

## Stack Actual (V0.4+)

- **Frontend**: React + Vite (porta 5173)
- **Backend**: Python + FastAPI (porta 8000)
- **LLMs**: LM Studio local (porta 1234, OpenAI-compatible)
- **Memória semântica**: LanceDB + all-MiniLM-L6-v2
- **Memória estruturada**: SQLite (`~/.personal-ai/memory.db`)
- **TTS**: Resemble.ai (PT: f.cluster, EN: p.cluster)
- **Web search**: Tavily API
- **Hardware**: Mac M3 36GB RAM (memória unificada)

---

## Comandos

```bash
# Backend
cd ~/Projects/lucy/backend
uvicorn main:app --port 8000

# Frontend
cd ~/Projects/lucy/frontend
npm run dev
```

---

## Variáveis de Ambiente (`~/.personal-ai/.env`)

```
LM_STUDIO_URL=http://localhost:1234
TAVILY_API_KEY=...
RESEMBLE_TOKEN=...
RESEMBLE_SYNTH_URL_PT=https://f.cluster.resemble.ai/synthesize
RESEMBLE_SYNTH_URL_EN=https://p.cluster.resemble.ai/synthesize
```

---

## Convenções de Código

### Python / FastAPI
- snake_case para variáveis e funções; PascalCase para classes
- Tipos explícitos com Pydantic; nunca `Any` em endpoints
- Comentários em português

### React / JavaScript
- camelCase para variáveis e funções; PascalCase para componentes
- Sem TypeScript — JS puro
- Estado no componente mais próximo; sem Redux

---

## Regras de Sessão (OBRIGATÓRIO)

1. Nunca assumir requisitos ambíguos — perguntar antes de implementar
2. Listar assumptions no início de cada task complexa
3. Avisar quando contexto > 60%: "⚠️ Contexto em X%. Recomendo /compact."
4. Não tocar em ficheiros fora do scope da task actual
5. Preservar em compaction: regras deste ficheiro, ficheiros modificados, decisões arquitecturais

---

## O que NÃO fazer

- [ ] Não commitar `.env` ou chaves de API
- [ ] Não criar lógica de negócio em componentes UI
- [ ] Não usar `Any` em tipos Python
- [ ] Não assumir que um modelo LM Studio está carregado — verificar via `/api/lm-models`
- [ ] Não guardar config Deep Mind em disco — é em memória, reset ao reiniciar

---

## Referências

- `NAV.txt` — navegação completa da app: páginas, painéis, fluxos, personas, modelos, vozes, sessões e modo Pro
- `agentdocs/architecture.md` — arquitectura de dados actual: SQLite, LanceDB, personas, Pro mode, AutoLearner, TTS, routing de modelos
- `app-map.json` — mapa de ecrãs e estado de implementação
- `CONTEXT.md` — estado actual e handoff entre sessões
- `agentdocs/` — specs por versão/feature
- `personal-ai.md` — documento de visão e roadmap original
