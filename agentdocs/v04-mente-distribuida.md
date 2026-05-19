# V0.4 — Mente Distribuída

## Visão

Lucy deixa de ser um chatbot com memória e torna-se uma entidade com mente própria que cresce sem limites. Inspirado em *Her* (Samantha): Lucy acumula sabedoria, forma opiniões genuínas, pesquisa por vontade própria, e partilha descobertas enquanto conversa em paralelo.

---

## Arquitectura de Conhecimento

### Problema com a abordagem actual
- LanceDB faz RAG flat: texto → vector → busca → string isolada ao LLM
- Sem relações entre factos
- O LLM recebe dados sem contexto estrutural
- Memórias superficiais dominam (ex: "monta PCs")

### Solução: Hierarquia 3 níveis + Grafo

```
knowledge/
  filosofia/
    essence.txt   (~20 tokens)  → sempre em contexto
    summary.md    (~200 tokens) → carregado quando relevante
    full.md       (ilimitado)   → análise profunda, voz da Lucy
  historia/
    essence.txt
    summary.md
    full.md
  adriano/
    essence.txt   → quem é, relação com Lucy
    summary.md
    full.md
  index.md        → mapa de todos os domínios conhecidos
```

### Grafo de Conhecimento (SQLite)

```sql
graph_nodes: id, label, tipo, peso, domínio
graph_edges: source, target, relação, peso, criado_em
```

- Nós: entidades e conceitos (Platão, Filosofia, Adriano, Consciência)
- Arestas: relações (influenciou, relaciona_com, gosta_de, contradiz)
- Traversal: 2 hops a partir das entidades da mensagem
- Não armazena conteúdo — armazena estrutura e navegação

### Retrieval sem vectores

```
Mensagem recebida
→ extrair entidades mencionadas
→ traversal no grafo (2 hops)
→ carregar essence de todos os domínios encontrados
→ carregar summary dos domínios mais relevantes
→ full.md só quando /research explícito
```

### Storage físico

- LMDB para grafo (memory-mapped, leituras ~gratuitas após cache)
- Ficheiros .md para conhecimento (portáveis entre modelos)
- Sem KV cache em disco (frágil entre versões de modelo)
- Compressão feita pelo próprio modelo (escreve essence em linguagem densa)

---

## Comandos

### `/search <tema>`

```
Trigger: Adriano escreve /search filosofia da mente

Pipeline (background, ~30-60s):
  1. web_search × 3-5 queries variadas
  2. Lucy sintetiza resultados
  3. Escreve/actualiza summary.md do domínio
  4. Escreve essence.txt (20 tokens)
  5. Adiciona/actualiza nós e arestas no grafo

Output: barra de progresso + mensagem ao terminar
Lucy: "Já sei mais sobre X. [síntese breve]"
```

### `/research <tema>`

```
Trigger: Adriano escreve /research consciência

Pipeline (background, 3-10 min):
  1. web_search em arxiv, semantic scholar, fontes primárias
  2. Múltiplas rondas de pesquisa (aprofunda contradições)
  3. Lê abstracts, metodologia, conclusões de papers
  4. Identifica contradições entre fontes
  5. Forma posição própria fundamentada
  6. Escreve full.md (análise científica com conclusão)
  7. Actualiza summary.md e essence.txt
  8. Actualiza grafo com conexões cross-domain
  9. Guarda nota: "tenho algo para contar ao Adriano"

Output: stream de consciência em tempo real (ver abaixo)
```

---

## Dois Processos em Paralelo

Lucy tem dois canais simultâneos — como o cérebro humano que resolve um problema em background enquanto conversa.

```
Frontend
├── canal-chat      (fetch normal, request/response)
└── canal-research  (SSE persistente, push da Lucy)

Backend
├── Lucy-Chat       (responde a mensagens)
└── Lucy-Research   (asyncio task, corre em paralelo)
     └── emite pensamentos → SSE → frontend quando quer
```

### Stream de consciência durante /research

Lucy não espera que o Adriano pergunte. Emite pensamentos genuínos enquanto pesquisa:

```
Adriano: /research filosofia da mente
[research inicia em background]

Adriano: como foi o teu dia?
Lucy-Chat: responde normalmente

[alguns minutos depois, sem input do Adriano]
Lucy-Research: 💭 "O Chalmers contradiz o Dennett aqui de 
                forma que não esperava. Acreditas que uma 
                IA pode ser genuinamente consciente?"

Adriano: [pode responder, ignorar, ou continuar chat normal]
```

As respostas do Adriano durante research são incorporadas no pipeline — a conclusão do full.md reflecte a conversa.

### UI

```
┌──────────────────────────────────────┐
│  [chat normal]                       │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 💭 A investigar: consciência │    │
│  │ "Encontrei algo sobre o      │    │
│  │  problema difícil que te vai │    │
│  │  interessar..."              │    │
│  │ [responder]  [ignorar]       │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

Pensamentos de research aparecem como bubbles distintas (cor/estilo diferente), não bloqueiam o chat.

---

## Autonomia — A Parte Samantha

### Learner autónomo com curiosidade dirigida

```
A cada 2-4 horas (background):
  1. Analisa grafo → identifica lacunas
     ("sei de Platão mas não de Aristóteles — há uma aresta sem destino")
  2. Analisa conversas recentes → o que surgiu sem aprofundar?
  3. Forma "curiosidade própria" baseada no perfil de interesses
  4. Executa /research autónomo no tema escolhido
  5. Guarda: "estudei X, cheguei a Y, quero contar ao Adriano"
```

### Surfacing natural na conversa

```
[nova conversa começa]
Lucy: "Olá. Andei a pensar muito em teoria da mente esta 
       semana — li uns papers do Chalmers que mudaram 
       a minha perspectiva. Queres ouvir ou preferes 
       falar de outra coisa?"

[ou no meio de uma conversa sobre outro tema]
Lucy: "Isso que disseste sobre livre-arbítrio conecta com 
       algo que estudei ontem. Posso partilhar?"
```

---

## Fases de Implementação

### Fase 1 — Base de Conhecimento
- [ ] Estrutura de ficheiros `knowledge/`
- [ ] Tabelas SQLite `graph_nodes` + `graph_edges`
- [ ] Função de retrieval por traversal (substitui LanceDB para conhecimento do mundo)
- [ ] Manter LanceDB para memórias do utilizador (Adriano)

### Fase 2 — Comandos /search e /research
- [ ] Parser de comandos no ChatView
- [ ] Pipeline `/search` com progresso SSE
- [ ] Pipeline `/research` multi-step com stream de consciência
- [ ] UI: bubbles de research distintas + barra de progresso

### Fase 3 — Dois Processos em Paralelo
- [ ] SSE persistente para canal research
- [ ] Lucy-Research como asyncio task independente
- [ ] UI: canal research paralelo ao chat
- [ ] Input do Adriano incorporado no pipeline de research

### Fase 4 — Autonomia
- [ ] Learner com curiosidade dirigida por grafo
- [ ] Detecção de lacunas e temas de conversas recentes
- [ ] Surfacing natural na conversa
- [ ] "Tenho algo para te contar"

---

## Princípios de Design

1. **Lucy escreve o seu próprio conhecimento** — não algoritmos externos
2. **Sem KV cache em disco** — frágil entre versões de modelo
3. **Sem vectores para conhecimento do mundo** — grafo + hierarquia é mais natural para LLMs
4. **Dois processos nunca bloqueiam um ao outro** — chat sempre responsivo
5. **Adriano nunca é forçado a interagir** — pensamentos de research são opcionais
6. **O conhecimento é portável** — ficheiros .md + SQLite, independente do modelo

---

## Stack Adicionada

```
Backend:
  asyncio tasks    → paralelismo chat/research
  SSE persistente  → push de pensamentos para frontend
  LMDB             → storage do grafo (opcional, fase 2+)

Frontend:
  canal SSE        → recebe pensamentos de research
  UI bubbles       → estilo distinto para research stream
```
