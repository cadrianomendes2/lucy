# Personal AI — Guia de Início

## Visão Geral

```
V0.1  Chat puro          → app Mac, Haiku API, zero persistência
V0.2  Consciência        → memória, identidade, dois BDs
V0.3  Voz (saída)        → Resemble API, liga/desliga
V0.4  Auto-evolução LLM  → busca, testa, decide

── próximos ──────────────────────────────────────
V0.5  Voz (entrada)      → Whisper, wake word
V0.6  Avatar 3D
V0.7  Acesso externo     → Tailscale, robô, mobile
```

---

## Pré-requisitos

- Mac M3 com 32GB RAM
- macOS 14+ (Sonoma ou superior)
- Xcode instalado (para o app SwiftUI)
- Conta na [Anthropic Console](https://console.anthropic.com) com créditos API

---

## Passo 1 — Instalar o Homebrew (se não tiveres)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## Passo 2 — Instalar o Ollama

```bash
brew install ollama
```

Confirmar que está instalado:

```bash
ollama --version
```

Iniciar o serviço em background:

```bash
ollama serve &
```

> Para que o Ollama inicie automaticamente no login:
> `brew services start ollama`

---

## Passo 3 — Descarregar o modelo local uncensored

O modelo escolhido é o **Gemma 4 E4B Heretic** — abliterado com a técnica mais refinada,
quase zero recusas, ~5GB de RAM, rápido no M3.

```bash
ollama pull igorls/gemma-4-E4B-it-heretic-GGUF
```

> **Alternativa** (huihui abliterated, mais simples):
> ```bash
> ollama pull huihui_ai/gemma-4-abliterated:e4b
> ```

Testar se está a funcionar:

```bash
ollama run igorls/gemma-4-E4B-it-heretic-GGUF "Olá, apresenta-te"
```

---

## Passo 4 — Configurar a API do Anthropic (para o V0.1)

1. Vai a [console.anthropic.com](https://console.anthropic.com)
2. Cria uma conta e adiciona créditos (€5-10 chega para meses de uso)
3. Vai a **API Keys** → **Create Key**
4. Copia a chave e guarda num local seguro

Criar o ficheiro de ambiente:

```bash
mkdir -p ~/.personal-ai
echo "ANTHROPIC_API_KEY=sk-ant-XXXXXXXXXXXXXXXX" > ~/.personal-ai/.env
chmod 600 ~/.personal-ai/.env
```

---

## Passo 5 — Verificar RAM disponível

Com os dois modelos configurados, o consumo esperado em idle:

```
Ollama (serviço)              ~200MB
Gemma 4 E4B (quando ativo)   ~4-5GB
Sistema macOS                 ~4GB
────────────────────────────────────
Total em uso leve             ~9GB
Livre para o resto            ~23GB  ✅
```

Confirmar com:

```bash
# Ver RAM livre
vm_stat | grep "Pages free"

# Ver modelos descarregados
ollama list
```

---

## Passo 6 — Testar os dois modelos

**Modelo de API (Haiku — para chat normal):**

```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-haiku-4-5",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Olá!"}]
  }'
```

**Modelo local (Gemma 4 E4B — para conteúdo sem filtros):**

```bash
ollama run igorls/gemma-4-E4B-it-heretic-GGUF "Olá!"
```

---

## Estrutura de pastas do projeto

```
~/.personal-ai/
├── .env                  # chaves de API (nunca commitar)
├── models.json           # config dos modelos usados
└── logs/                 # logs futuros (V0.2+)

~/Developer/personal-ai/
├── PersonalAI.xcodeproj  # app SwiftUI (V0.1)
├── backend/              # FastAPI Python (V0.2+)
│   ├── main.py
│   ├── memory/           # Qdrant + SQLite (V0.2)
│   └── persona/          # identidade da IA (V0.2)
└── README.md
```

---

## Resumo dos modelos

| Modelo | Uso | RAM | Comando Ollama |
|--------|-----|-----|----------------|
| `claude-haiku-4-5` | Chat normal, trabalho | API | via SDK |
| `igorls/gemma-4-E4B-it-heretic-GGUF` | Conteúdo adulto / sem filtros | ~5GB | `ollama run` |

---

## Próximo passo

Com tudo instalado, o próximo ficheiro é o **V0.1** — o app SwiftUI clicável no Mac,
com chat em streaming via Haiku e troca para Gemma local quando necessário.

---

## Referências

- [Anthropic Console](https://console.anthropic.com)
- [Ollama](https://ollama.com)
- [Gemma 4 E4B Heretic (Ollama)](https://ollama.com/igorls/gemma-4-E4B-it-heretic-GGUF)
- [huihui Gemma 4 abliterated (alternativa)](https://ollama.com/huihui_ai/gemma-4-abliterated)
- [Claude Haiku 4.5 — Anthropic](https://www.anthropic.com/claude/haiku)
