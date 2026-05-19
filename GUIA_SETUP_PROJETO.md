# Guia de Setup de Projecto com Claude

> Segue este guia **antes de começar qualquer projecto** para garantir sessões eficientes, contexto preservado e tokens bem aproveitados.

---

## 1. Estrutura de Ficheiros Obrigatória

Cria estes três ficheiros na raiz do projecto:

```
/
├── CLAUDE.md          ← Contexto permanente (stack, regras, convenções)
├── CONTEXT.md         ← Estado actual + handoff entre sessões
├── app-map.json       ← Mapa de navegação/ecrãs da app
└── agentdocs/         ← (opcional) Specs e tasks por feature
    ├── feature-X.md
    └── feature-Y.md
```

---

## 2. Como Preencher o CLAUDE.md

O `CLAUDE.md` é lido **uma vez por sessão**. Deve conter apenas o que **nunca muda** (ou muda raramente). Não uses para estado de tarefas — isso vai no `CONTEXT.md`.

### Template a preencher:

```markdown
# CLAUDE.md

## Stack & Tecnologias
- App: [React Native 0.74 / Flutter 3.x / Next.js 14]
- Backend: [Node.js + Express / Python + FastAPI]
- Base de dados: [PostgreSQL 15 / Firebase / Supabase]
- Autenticação: [JWT / OAuth Google / Clerk]
- Testes: [Jest + Testing Library / Pytest / Vitest]
- CI/CD: [GitHub Actions / Vercel / Railway]

## Arquitectura
- [ex: Monorepo com apps/ e packages/]
- [ex: Serviços em src/services/, rotas em src/routes/]
- [ex: Rotas chamam serviços, nunca contêm lógica de negócio]
- [ex: Estado global com Zustand, estado local com useState]

## Convenções de Código
- Variáveis e funções: camelCase
- Componentes e classes: PascalCase
- Ficheiros de componentes: PascalCase.tsx
- Ficheiros de utilidades: kebab-case.ts
- Comentários: português
- Imports: absolutos via @/ (nunca relativos com ../../)
- Sempre escrever tipos TypeScript explícitos (nunca `any`)

## Comandos Principais
```bash
npm run dev        # Iniciar desenvolvimento
npm test           # Correr testes
npm run build      # Build de produção
npm run lint       # Verificar linting
npm run typecheck  # Verificar tipos
```

## Regras de Sessão (OBRIGATÓRIO)
1. Nunca assumir requisitos ambíguos — perguntar sempre antes
2. Listar assumptions no início de cada task complexa
3. Avisar quando contexto > 60%: "⚠️ Contexto em X%. Recomendo /compact."
4. Avisar se detectar context rot (contradições, re-perguntas)
5. Não tocar em ficheiros fora do scope da task actual
6. Preservar em compaction: regras deste ficheiro, ficheiros modificados, decisões arquitecturais

## O que NÃO fazer
- [ ] Não usar `any` em TypeScript
- [ ] Não fazer chamadas directas à DB nas rotas
- [ ] Não commitar sem testes a passar
- [ ] Não criar lógica de negócio em componentes UI
- [ ] Não misturar português e inglês no mesmo ficheiro

## Referências
- `app-map.json` — mapa de navegação da app
- `CONTEXT.md` — estado actual e handoff entre sessões
- `agentdocs/` — specs por feature
```

**Regra de ouro:** Se uma informação já vai estar no `CONTEXT.md`, não a repitas aqui.

---

## 3. Como Preencher o CONTEXT.md

Actualiza no **fim de cada sessão**. Começa a próxima com: `"Lê o CONTEXT.md e o app-map.json"`.

### Template a preencher:

```markdown
# CONTEXT.md — Handoff de Sessão

## Estado Actual
**Data:** 2025-01-15
**Sessão:** #3
**Feature em progresso:** Autenticação com Google OAuth

## O que foi feito nesta sessão
- [x] Criado AuthService com JWT refresh tokens
- [x] Endpoint POST /auth/google implementado e testado
- [ ] Ecrã de login no frontend (ficou para amanhã)

## Decisões tomadas
| Decisão | Motivo | Alternativa rejeitada |
|---|---|---|
| JWT com refresh 30 dias | App mobile sem cookies | Session cookies |
| Zustand para auth state | Simples, sem boilerplate | Redux Toolkit |

## Ficheiros modificados
```
src/
├── services/auth.service.ts     ← NOVO — lógica OAuth + JWT
├── routes/auth.routes.ts        ← NOVO — endpoints /auth/*
├── middleware/auth.middleware.ts ← ALTERADO — adicionado refresh
```

## Próximos passos
1. [ ] Criar ecrã de Login (src/screens/LoginScreen.tsx)
2. [ ] Integrar AuthService no frontend
3. [ ] Testes e2e do fluxo de autenticação

## Problemas conhecidos / Bugs
- O token refresh falha ocasionalmente em cold start — a investigar
- Validação do email não rejeita subdomínios inválidos

## Contexto crítico para não perder
- Refresh tokens armazenados em Redis com TTL de 30 dias
- O GoogleOAuthService usa variáveis de ambiente GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET
- NÃO alterar auth.middleware.ts sem actualizar os testes em __tests__/auth/

## Compaction prompt sugerido
/compact Preserva: decisões de arquitectura, ficheiros modificados,
bugs conhecidos, e o estado actual da feature Autenticação. Resume:
outputs de ferramentas e debugging que não levou a nada.
```

---

## 4. Como Preencher o app-map.json

Define todos os ecrãs/páginas da app com estado de implementação.

### Template a preencher:

```json
{
  "meta": {
    "version": "1.0",
    "lastUpdated": "2025-01-15",
    "description": "Mapa de navegação da app"
  },
  "screens": [
    {
      "id": "splash",
      "label": "Splash",
      "group": "Auth",
      "status": "done",
      "notes": "Redireciona para Login ou Home consoante token"
    },
    {
      "id": "login",
      "label": "Login",
      "group": "Auth",
      "status": "in-progress",
      "notes": "UI feita, falta integrar AuthService"
    },
    {
      "id": "home",
      "label": "Home",
      "group": "Main",
      "status": "todo",
      "notes": ""
    }
  ],
  "connections": [
    { "from": "splash", "to": "login", "condition": "sem token" },
    { "from": "splash", "to": "home", "condition": "token válido" },
    { "from": "login", "to": "home" }
  ],
  "statusLegend": {
    "done": "Implementado e testado",
    "in-progress": "Em desenvolvimento",
    "bug": "Tem bug conhecido",
    "todo": "Ainda não iniciado"
  }
}
```

**Actualiza o `status` de cada ecrã no fim de cada sessão.** É a forma mais rápida de ter uma visão do progresso.

---

## 5. Protocolo de Início de Sessão

**Mensagem de abertura padrão:**

```
Lê o CONTEXT.md e o app-map.json.
Task de hoje: [descreve a task em 1-2 frases]
```

O Claude irá:
1. Confirmar o que leu
2. Listar as assumptions que está a fazer
3. Perguntar se há ambiguidades antes de começar

---

## 6. Protocolo de Fecho de Sessão

Antes de terminar, pede sempre:

```
Actualiza o CONTEXT.md com o que fizemos hoje
e marca os ecrãs correspondentes no app-map.json.
```

O Claude gera o conteúdo actualizado para copiares para os ficheiros.

---

## 7. Boas Práticas para Eficiência de Tokens

### Reduzir consumo desnecessário

| Situação | Em vez de... | Faz isto |
|---|---|---|
| Task simples | Colar todos os ficheiros | Menciona só o ficheiro relevante |
| Debugging | Colar stack trace completo | Colar apenas a linha de erro + contexto |
| Revisão de código | Pedir revisão do projecto todo | Pedir revisão de um ficheiro específico |
| Contexto extenso | Deixar acumular | Fazer `/compact` quando atingires 60% |

### Prompts eficientes

**Evitar:**
> "Analisa o projecto e diz-me o que posso melhorar"

**Preferir:**
> "No ficheiro `src/services/auth.service.ts`, o método `refreshToken` pode ter um race condition quando dois pedidos chegam simultaneamente. Como resolves?"

### Quando usar agentdocs/

Para features complexas (>2 sessões), cria `agentdocs/feature-nome.md`:

```markdown
# Feature: [Nome]

## Objectivo
[1 parágrafo]

## Critérios de aceitação
- [ ] Critério 1
- [ ] Critério 2

## Ficheiros a criar/modificar
- `src/services/X.ts` — [o que faz]
- `src/routes/X.ts`   — [endpoints]

## Dependências
- Requer Feature Y estar concluída
- Usa biblioteca Z

## Decisões pré-tomadas
- [Decisão 1 já tomada para não repetir na sessão]
```

---

## 8. Checklist de Setup (faz isto antes da primeira sessão)

```
[ ] Criar CLAUDE.md com stack, arquitectura e convenções
[ ] Criar CONTEXT.md vazio com a estrutura do template
[ ] Criar app-map.json com todos os ecrãs conhecidos
[ ] Criar pasta agentdocs/ (mesmo que vazia por agora)
[ ] Definir comandos principais (dev, test, build)
[ ] Confirmar convenções de código com a equipa
[ ] Configurar .gitignore para não commitar ficheiros sensíveis
```

---

## 9. Sinais de Alerta Durante uma Sessão

| Sinal | O que fazer |
|---|---|
| ⚠️ "Contexto em X%..." | Executar `/compact` com o prompt sugerido no CONTEXT.md |
| ⚠️ "Possível context rot" | Parar, confirmar o estado actual, reiniciar sessão se necessário |
| Claude re-pergunta algo já respondido | Sinal de context rot — considera `/compact` ou nova sessão |
| Respostas ficam mais genéricas | Contexto a degradar — faz `/compact` |
| Task demora mais de 3 idas e vindas | Divide em sub-tasks mais pequenas |

---

## 10. Estrutura de Pastas Recomendada

```
projecto/
├── CLAUDE.md                  ← Contexto permanente
├── CONTEXT.md                 ← Estado da sessão actual
├── app-map.json               ← Mapa de ecrãs
├── agentdocs/                 ← Specs por feature
│   └── auth.md
├── src/
│   ├── components/            ← Componentes UI (PascalCase.tsx)
│   ├── screens/               ← Ecrãs completos
│   ├── services/              ← Lógica de negócio
│   ├── routes/                ← Endpoints da API
│   ├── middleware/            ← Middlewares
│   ├── utils/                 ← Funções utilitárias
│   └── types/                 ← Tipos TypeScript partilhados
├── __tests__/                 ← Testes (espelha src/)
└── .env.example               ← Variáveis de ambiente (sem valores reais)
```

---

*Mantém este guia na raiz do repositório como `SETUP_GUIDE.md` para referência futura.*
