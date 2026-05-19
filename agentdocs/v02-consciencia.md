# Feature: V0.2 — Consciência (Memória + Identidade)

## Objectivo
Adicionar memória persistente à IA (Qdrant para memória vectorial, SQLite para log estruturado) e um sistema de identidade/persona configurável. A app passa a lembrar factos sobre o utilizador e a ter uma personalidade consistente entre sessões.

## Dependências
- V0.1 concluído e estável
- Qdrant a correr localmente (`docker run -p 6333:6333 qdrant/qdrant`)
- Python 3.11+ instalado

---

## Critérios de aceitação

- [ ] FastAPI backend a correr em `localhost:8000`
- [ ] Ao iniciar uma conversa, o backend injeta memórias relevantes no system prompt
- [ ] No fim de cada turno, o backend extrai e guarda novos factos em Qdrant + SQLite
- [ ] SwiftUI mostra sidebar com memórias activas da sessão
- [ ] Persona tem nome, traços de personalidade, e tom de voz configuráveis
- [ ] System prompt é gerado dinamicamente a partir da persona + memórias relevantes
- [ ] Sem regressão no streaming do V0.1

---

## Ficheiros a criar/modificar

```
~/Developer/personal-ai/
├── backend/
│   ├── main.py                     ← FastAPI app, endpoints /chat, /memory
│   ├── requirements.txt            ← anthropic, fastapi, qdrant-client, etc.
│   ├── memory/
│   │   ├── qdrant_service.py       ← upsert/search de embeddings
│   │   ├── sqlite_service.py       ← log estruturado de conversas e factos
│   │   └── memory_extractor.py     ← usa Haiku para extrair factos de um turno
│   └── persona/
│       ├── identity.json           ← nome, traços, tom, instruções base
│       └── persona_service.py      ← lê identity.json, gera system prompt
├── PersonalAI/
│   ├── Services/
│   │   └── BackendService.swift    ← NOVO — substitui chamadas directas à API
│   └── Views/
│       ├── MemoryBrowserView.swift ← NOVO — lista de memórias activas
│       └── IdentityPanelView.swift ← NOVO — mostra persona actual
```

---

## Arquitectura do sistema de memória

```
Turno do utilizador
        ↓
[BackendService.swift] POST /chat
        ↓
[persona_service.py] gera system prompt (persona + memórias relevantes)
        ↓
[AnthropicService] streaming → resposta
        ↓
[memory_extractor.py] extrai factos do turno (via Haiku mini-call)
        ↓
[qdrant_service.py] upsert embeddings dos factos
[sqlite_service.py] log do turno completo
```

---

## Formato do identity.json

```json
{
  "name": "Lucy",
  "role": "assistente pessoal",
  "personality_traits": ["directa", "curiosa", "sem filtros"],
  "tone": "informal, próxima, sem rodeios",
  "base_instructions": "Lembra-te de detalhes sobre o utilizador. Não repitas informação já conhecida. Sê concisa.",
  "language": "português europeu"
}
```

---

## Endpoints FastAPI

| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/chat` | Envia mensagem, retorna stream SSE com contexto de memória |
| GET | `/memory` | Lista memórias guardadas (paginado) |
| DELETE | `/memory/{id}` | Remove uma memória específica |
| GET | `/persona` | Retorna a persona actual |
| PUT | `/persona` | Actualiza a persona |

---

## Dependências Python (requirements.txt)
```
anthropic>=0.40.0
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
qdrant-client>=1.12.0
sentence-transformers>=3.3.0
pydantic>=2.10.0
python-dotenv>=1.0.0
```

---

## Decisões pré-tomadas

- **Embeddings**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (corre local, suporta português)
- **Extracção de factos**: mini-call ao Haiku com prompt "extrai os factos importantes desta conversa em JSON"
- **Threshold de relevância**: cosine similarity > 0.75 para injectar memória no contexto
- **Máximo de memórias injectadas**: 5 por turno (para não inflar o context window)
- **SQLite schema**: tabela `turns` (id, timestamp, role, content) + tabela `facts` (id, timestamp, fact, source_turn_id)

---

## Estimativa de sessões
2-3 sessões para implementação completa do V0.2.
