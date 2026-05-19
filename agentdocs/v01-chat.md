# Feature: V0.1 — Chat Puro

## Objectivo
App Mac nativa em SwiftUI com chat em streaming via Claude Haiku 4.5, com fallback para Gemma 4 E4B local via Ollama. Zero persistência — cada sessão começa limpa.

---

## Critérios de aceitação

- [ ] App abre como janela macOS nativa
- [ ] Utilizador escreve mensagem e recebe resposta em streaming (tokens aparecem progressivamente)
- [ ] Toggle visível entre modelo Haiku (API) e Gemma (local)
- [ ] Indicador de loading durante streaming
- [ ] Ecrã de definições para configurar API key e URL do Ollama
- [ ] Sem crash quando Ollama não está a correr (mensagem de erro clara)
- [ ] Sem crash quando API key é inválida (mensagem de erro clara)

---

## Ficheiros a criar

```
~/Developer/personal-ai/
├── PersonalAI.xcodeproj
└── PersonalAI/
    ├── PersonalAIApp.swift          ← entry point, @main
    ├── Models/
    │   ├── Message.swift            ← struct Message (role, content, timestamp)
    │   └── ModelType.swift          ← enum ModelType { haiku, gemmaLocal }
    ├── Services/
    │   ├── AnthropicService.swift   ← streaming com URLSession + AsyncStream
    │   └── OllamaService.swift      ← chamadas ao Ollama local (localhost:11434)
    ├── ViewModels/
    │   └── ChatViewModel.swift      ← @Observable, gere mensagens e estado
    └── Views/
        ├── ChatView.swift           ← lista de mensagens + input
        ├── MessageBubbleView.swift  ← bubble individual (user / assistant)
        ├── MessageInputView.swift   ← campo de texto + botão
        ├── ModelSelectorView.swift  ← toggle Haiku / Gemma
        └── SettingsView.swift       ← API key + Ollama URL
```

---

## Dependências

- Nenhuma biblioteca externa — só Foundation, SwiftUI, URLSession nativo
- Anthropic API (requer `ANTHROPIC_API_KEY` em Settings)
- Ollama a correr localmente (`ollama serve`)

---

## Decisões pré-tomadas

- **Streaming via AsyncStream**: usar `URLSession.bytes(for:)` para ler SSE linha a linha
- **@Observable macro** (Swift 5.9+): evitar `@StateObject` / `ObservableObject` legado
- **Sem CoreData**: V0.1 tem zero persistência, tudo em memória
- **Formato SSE Anthropic**: prefixo `data: `, JSON com `type: content_block_delta`
- **Formato Ollama**: JSON por linha com campo `response` (não SSE)
- **Window style**: `.windowStyle(.titleBar)` com tamanho mínimo 600×400

---

## Fluxo de streaming Anthropic

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <key>
  anthropic-version: 2023-06-01
  content-type: application/json

Body:
{
  "model": "claude-haiku-4-5",
  "max_tokens": 2048,
  "stream": true,
  "messages": [{"role": "user", "content": "<texto>"}]
}

Response (SSE):
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Ol"}}
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"á"}}
data: [DONE]
```

---

## Fluxo de streaming Ollama

```
POST http://localhost:11434/api/generate
Body:
{
  "model": "igorls/gemma-4-E4B-it-heretic-GGUF",
  "prompt": "<texto>",
  "stream": true
}

Response (JSON lines):
{"model":"...","response":"Ol","done":false}
{"model":"...","response":"á","done":false}
{"model":"...","response":"","done":true}
```

---

## Estimativa de sessões
1 sessão (2-3 horas) para implementação completa do V0.1.
