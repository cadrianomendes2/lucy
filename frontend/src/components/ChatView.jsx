import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble.jsx'
import MessageInput from './MessageInput.jsx'
import ResearchStream from './ResearchStream.jsx'
import { useCompanionEngine } from '../hooks/useCompanionEngine.js'

function stripEmojis(text) {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Retorna o objecto Audio para controlo externo
async function fetchTTSAudio(text, voiceUuid) {
  text = stripEmojis(text)
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_uuid: voiceUuid }),
  })
  if (!res.ok) throw new Error('TTS failed')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  return { audio: new Audio(url), url }
}

const PLEASEME_DURATION = 4000

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

function formatDateSep(ts) {
  if (!ts) return null
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((today - msgDay) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  if (diff < 7) return d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return true
  return new Date(ts1).toDateString() === new Date(ts2).toDateString()
}

// junta mensagens consecutivas do mesmo role para o histórico
function buildHistory(msgs) {
  const result = []
  for (const m of msgs) {
    const last = result[result.length - 1]
    if (last && last.role === m.role) {
      result[result.length - 1] = { ...last, content: last.content + '\n\n' + m.content }
    } else {
      result.push({ role: m.role, content: m.content })
    }
  }
  return result
}

export default function ChatView({ model, thinkingMode, language, voiceUuid, onAnimation, sessionId, onSessionCreated, pro, personaId, personaEnabled = true, personaName, roleplayMode, onRoleplayClose, companionMode, companionSubMode, onCompanionClose, onSetCompanionSubMode, persona }) {
  const [messages, setMessages] = useState([])
  const [scenario, setScenario] = useState('')
  const [rpMode, setRpMode] = useState(null) // 'aventura' | 'desafio' | 'diversao'
  const [improving, setImproving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchingQuery, setSearchingQuery] = useState(null)
  const [researchTopic, setResearchTopic] = useState(null)
  const [researchType, setResearchType] = useState(null)
  const [workContext, setWorkContext] = useState('')

  // companion: injeta mensagem espontânea no chat
  function injectCompanionMessage(text) {
    setMessages(prev => [...prev, { role: 'assistant', content: text, timestamp: new Date().toISOString(), companion: true }])
  }

  useCompanionEngine({
    active: companionMode && pro,
    subMode: companionSubMode,
    persona: persona || { id: personaId, name: personaName },
    sessionId,
    model,
    workContext: companionSubMode === 'trabalho' ? workContext : null,
    onMessage: injectCompanionMessage,
  })

  // TTS: { msgIdx, paused, text }
  const [ttsState, setTtsState] = useState(null)
  const audioRef = useRef(null)
  const audioUrlRef = useRef(null)
  const ttsQueueRef = useRef([])   // [{text, msgIdx}]
  const ttsPlayingRef = useRef(false)
  const currentSessionId = useRef(sessionId)
  const sessionCreatedHere = useRef(false)
  const bottomRef = useRef(null)
  const pleasemeTimer = useRef(null)

  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null }
    ttsQueueRef.current = []
    ttsPlayingRef.current = false
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => () => clearTimeout(pleasemeTimer.current), [])

  useEffect(() => {
    currentSessionId.current = sessionId

    // sessão criada neste ChatView — não recarregar (stream ainda em curso)
    if (sessionCreatedHere.current) return

    if (sessionId == null) {
      setMessages([])
      return
    }
    fetch(`/api/sessions/${sessionId}/messages`)
      .then(r => r.json())
      .then(msgs => {
        const expanded = []
        for (const m of msgs) {
          const ts = m.timestamp || null
          if (m.role === 'assistant' && m.content.includes('\n\n')) {
            m.content.split('\n\n').filter(p => p.trim()).forEach(p =>
              expanded.push({ role: m.role, content: p.trim(), timestamp: ts })
            )
          } else {
            expanded.push({ role: m.role, content: m.content, timestamp: ts })
          }
        }
        setMessages(expanded)
      })
      .catch(() => {})
  }, [sessionId])

  // ── Fila de TTS: toca parágrafos em sequência ─────────────────────────────
  function drainTTS() {
    if (ttsQueueRef.current.length === 0) {
      ttsPlayingRef.current = false
      setTtsState(null)
      onAnimation?.('idle')
      return
    }
    ttsPlayingRef.current = true
    const { text, msgIdx } = ttsQueueRef.current.shift()
    fetchTTSAudio(text, voiceUuid).then(({ audio, url }) => {
      if (audioRef.current) audioRef.current.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioRef.current = audio
      audioUrlRef.current = url
      setTtsState({ msgIdx, paused: false, text })
      onAnimation?.('talking')
      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; audioUrlRef.current = null; drainTTS() }
      audio.onerror = () => { setTtsState(null); drainTTS() }
      audio.play().catch(() => { setTtsState(null); drainTTS() })
    }).catch(() => drainTTS())
  }

  function enqueueTTS(text, msgIdx) {
    if (!voiceUuid || !text.trim()) return
    ttsQueueRef.current.push({ text, msgIdx })
    if (!ttsPlayingRef.current) drainTTS()
  }

  // ── Envia mensagem ─────────────────────────────────────────────────────────
  async function sendMessage(text, image = null) {
    if (!text.trim() || loading) return
    setError(null)

    if (text.trim().toLowerCase() === '/pleaseme') {
      onAnimation?.('pleaseme')
      clearTimeout(pleasemeTimer.current)
      pleasemeTimer.current = setTimeout(() => onAnimation?.('idle'), PLEASEME_DURATION)
      return
    }

    const searchMatch = text.match(/^\/search\s+(.+)/i)
    if (searchMatch) {
      setResearchTopic(searchMatch[1].trim())
      setResearchType('search')
      setMessages(prev => [...prev, { role: 'user', content: text }])
      return
    }

    const researchMatch = text.match(/^\/research\s+(.+)/i)
    if (researchMatch) {
      setResearchTopic(researchMatch[1].trim())
      setResearchType('research')
      setMessages(prev => [...prev, { role: 'user', content: text }])
      return
    }

    const now = new Date().toISOString()
    const userMsg = { role: 'user', content: text, image: image || null, timestamp: now }
    const history = buildHistory(messages.map(m => ({ role: m.role, content: m.content })))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    onAnimation?.('idle')
    ttsQueueRef.current = []

    const INTER_PARA_MS = 900 // pausa entre parágrafos (ms)
    const baseIdx = messages.length + 1
    let paraCount = 0
    let paraBuffer = ''   // texto do parágrafo actual (visível)
    let nextBuffer = ''   // texto acumulado durante pausa inter-parágrafo
    let inDelay = false   // true = a mostrar "a digitar" antes do próximo parágrafo
    let finalText = ''

    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, timestamp: now }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model,
          language,
          history,
          thinking_mode: thinkingMode,
          session_id: currentSessionId.current ?? null,
          pro: pro ?? false,
          persona_id: personaId ?? null,
          ...(image ? { image } : {}),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || `Erro ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sseBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        sseBuffer += decoder.decode(value, { stream: true })
        const lines = sseBuffer.split('\n')
        sseBuffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break

          try {
            const chunk = JSON.parse(raw)
            if (chunk.error) throw new Error(chunk.error)
            if (chunk.session_id != null && currentSessionId.current == null) {
              currentSessionId.current = chunk.session_id
              sessionCreatedHere.current = true
              onSessionCreated?.(chunk.session_id, chunk.session_title)
            }
            if (chunk.searching) setSearchingQuery(chunk.query || '...')

            if (chunk.text) {
              setSearchingQuery(null)
              finalText += chunk.text

              if (inDelay) {
                // durante pausa: acumula texto sem mostrar
                nextBuffer += chunk.text
              } else {
                paraBuffer += chunk.text

                if (paraBuffer.includes('\n\n')) {
                  const parts = paraBuffer.split('\n\n')
                  const completed = parts.slice(0, -1)
                  paraBuffer = parts[parts.length - 1]

                  for (const para of completed) {
                    const trimmed = para.trim()
                    if (!trimmed) continue
                    const msgIdx = baseIdx + paraCount
                    paraCount++

                    // finaliza parágrafo actual
                    setMessages(prev => {
                      const updated = [...prev]
                      updated[updated.length - 1] = { ...updated[updated.length - 1], content: trimmed, streaming: false }
                      return updated
                    })
                    enqueueTTS(trimmed, msgIdx)

                    // adiciona bolha vazia (typing indicator) — preserva o timestamp da mensagem
                    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, timestamp: now }])

                    // inicia pausa — próximo parágrafo só aparece depois
                    inDelay = true
                    nextBuffer = paraBuffer // texto já acumulado após \n\n
                    paraBuffer = ''

                    setTimeout(() => {
                      inDelay = false
                      if (nextBuffer) {
                        paraBuffer = nextBuffer
                        nextBuffer = ''
                        setMessages(prev => {
                          const updated = [...prev]
                          const last = updated[updated.length - 1]
                          if (last?.streaming) {
                            updated[updated.length - 1] = { ...last, content: paraBuffer }
                          }
                          return updated
                        })
                      }
                    }, INTER_PARA_MS)

                    break // só processa um parágrafo de cada vez (para delay correcto)
                  }
                } else {
                  // actualiza bolha actual com texto em stream
                  setMessages(prev => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: paraBuffer }
                    return updated
                  })
                }
              }
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e
          }
        }
      }
    } catch (e) {
      setError(e.message)
      setMessages(prev => prev.slice(0, -1))
      finalText = ''
    } finally {
      // espera eventual delay em curso antes de finalizar
      const finalize = () => {
        const lastContent = (paraBuffer + nextBuffer).trim()
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.streaming) {
            updated[updated.length - 1] = { ...last, content: lastContent || last.content, streaming: false }
          }
          return updated
        })
        if (lastContent) enqueueTTS(lastContent, baseIdx + paraCount)
        setSearchingQuery(null)
        setLoading(false)
      }

      if (inDelay) {
        setTimeout(finalize, INTER_PARA_MS)
      } else {
        finalize()
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 20, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}>
            Começa uma conversa
          </div>
        )}
        {messages.map((msg, i) => {
          const prevMsg = messages[i - 1]
          const showSep = msg.timestamp && !isSameDay(msg.timestamp, prevMsg?.timestamp)
          const sepLabel = showSep ? formatDateSep(msg.timestamp) : null
          return (
          <div key={i}>
            {sepLabel && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0 8px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 12px', userSelect: 'none' }}>
                  {sepLabel}
                </span>
              </div>
            )}
            <MessageBubble
              message={msg}
              personaName={personaName}
              timestamp={msg.timestamp}
              onDelete={() => setMessages(prev => prev.filter((_, idx) => idx !== i))}
              onPlay={msg.role === 'assistant' ? (text) => enqueueTTS(text, i) : null}
              onRegenerate={msg.role === 'assistant' ? () => {
                const userMsg = [...messages].slice(0, i).reverse().find(m => m.role === 'user')
                if (!userMsg) return
                setMessages(prev => prev.slice(0, i))
                sendMessage(userMsg.content)
              } : null}
            />
            {/* Controlos TTS — estilo WhatsApp, só na mensagem activa */}
            {msg.role === 'assistant' && ttsState?.msgIdx === i && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-4px 20px 8px', paddingLeft: 4 }}>
                {/* Pause / Play */}
                <button
                  onClick={() => {
                    if (!audioRef.current) return
                    if (ttsState.paused) {
                      audioRef.current.play()
                      setTtsState(s => ({ ...s, paused: false }))
                    } else {
                      audioRef.current.pause()
                      setTtsState(s => ({ ...s, paused: true }))
                    }
                  }}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  {ttsState.paused
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  }
                </button>
                {/* Barra de onda animada */}
                {!ttsState.paused && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
                    {[1,2,3,4,3,2,1].map((h, j) => (
                      <div key={j} style={{ width: 3, height: h * 4, background: 'var(--accent)', borderRadius: 2, opacity: 0.7, animation: `wave 0.8s ease-in-out ${j * 0.1}s infinite alternate` }} />
                    ))}
                  </div>
                )}
                {/* Replay */}
                <button
                  onClick={async () => {
                    if (!ttsState.text) return
                    if (audioRef.current) { audioRef.current.pause() }
                    try {
                      const { audio, url } = await fetchTTSAudio(ttsState.text, voiceUuid)
                      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
                      audioRef.current = audio; audioUrlRef.current = url
                      setTtsState(s => ({ ...s, paused: false }))
                      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; audioUrlRef.current = null; setTtsState(null); onAnimation?.('idle') }
                      audio.play()
                    } catch {}
                  }}
                  title="Ouvir de novo"
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '50%', width: 26, height: 26, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.78L1 10"/></svg>
                </button>
              </div>
            )}
          </div>
          )
        })}

        {searchingQuery && (
          <div style={{
            margin: '4px 20px 8px',
            padding: '7px 12px',
            borderRadius: 8,
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border, #333)',
            color: 'var(--text-muted, #888)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            A pesquisar: "{searchingQuery}"
          </div>
        )}
        {error && (
          <div style={{
            margin: '8px 20px',
            padding: '10px 14px',
            borderRadius: 8,
            background: '#1a0000',
            border: '1px solid #400',
            color: '#f66',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {researchTopic && researchType && (
        <ResearchStream
          key={`${researchType}-${researchTopic}`}
          topic={researchTopic}
          type={researchType}
          sessionId={currentSessionId.current}
          onDone={() => {
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `Terminei a ${researchType === 'search' ? 'pesquisa' : 'investigação'}. Quer ouvir o que achei sobre **${researchTopic}**?`,
            }])
            setResearchTopic(null)
            setResearchType(null)
          }}
        />
      )}
      {/* ── Painel Roleplay ── */}
      {roleplayMode && pro && (
        <div style={{
          padding: '12px 16px 10px',
          borderTop: '2px solid #d4a01033',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#d4a010', letterSpacing: '0.08em' }}>ROLEPLAY</span>
            <button onClick={onRoleplayClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
          </div>

          {/* Modos */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[
              { key: 'aventura', label: 'Aventura', desc: 'Passa tempo divertido',  color: '#0ea5e9', template: 'Cria uma aventura divertida e envolvente. Pode ser fantasia, mistério, viagem — algo que traga diversão e entretenimento. Entra em personagem e puxa a história com energia.' },
              { key: 'desafio',  label: 'Desafio',  desc: 'Conhecer e conquistar', color: '#f97316', template: 'Estamos num cenário de conquista e sedução. O objetivo é criar tensão, flerte e aproximação. Joga com o charme, a conversa e os olhares. Deixa a situação fluir naturalmente para algo mais intenso.' },
              { key: 'diversao', label: 'Diversão', desc: 'Erotismo e sedução',    color: '#ec4899', template: 'Cenário sensual e erótico. A atmosfera é de desejo, sedução e prazer. Joga com a tensão, as palavras, o toque e a entrega. Sem filtros, deixa a fantasia tomar conta.' },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => { setRpMode(m.key); setScenario(m.template) }}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 9, cursor: 'pointer',
                  border: `1.5px solid ${rpMode === m.key ? m.color : m.color + '33'}`,
                  background: rpMode === m.key ? m.color + '18' : 'none',
                  color: rpMode === m.key ? m.color : 'var(--text-muted)',
                  textAlign: 'center', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: 9, opacity: 0.75, marginTop: 1 }}>{m.desc}</div>
              </button>
            ))}
          </div>

          <textarea
            value={scenario}
            onChange={e => setScenario(e.target.value)}
            placeholder="Descreve o cenário… (personagens, contexto, tom, o que queres explorar)"
            rows={3}
            style={{
              width: '100%', resize: 'vertical', minHeight: 64, maxHeight: 180,
              background: 'var(--surface2)', color: 'var(--text)',
              border: '1px solid #d4a01033', borderRadius: 10,
              padding: '8px 10px', fontSize: 13, lineHeight: 1.5,
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
            {/* Varinha — melhora o cenário */}
            <button
              onClick={async () => {
                if (!scenario.trim() || improving) return
                setImproving(true)
                try {
                  const r = await fetch('/api/roleplay/improve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scenario: scenario.trim(), persona_id: personaId }),
                  })
                  const d = await r.json()
                  if (d.improved) setScenario(d.improved)
                } catch {}
                setImproving(false)
              }}
              disabled={!scenario.trim() || improving}
              title="Melhorar cenário com IA"
              style={{
                height: 32, padding: '0 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                border: '1px solid #d4a01033', background: 'none',
                color: improving ? 'var(--text-muted)' : '#d4a010',
                cursor: !scenario.trim() || improving ? 'default' : 'pointer',
                opacity: !scenario.trim() || improving ? 0.5 : 1,
                transition: 'all 0.12s',
              }}
            >
              {improving ? 'A melhorar…' : '✦ Melhorar'}
            </button>
            {/* Play — começa o roleplay */}
            <button
              onClick={() => {
                if (!scenario.trim() || loading) return
                const modeInstructions = {
                  aventura: 'Entra em personagem e começa a aventura com energia e criatividade. Sê descritiva, divertida e conduz a história com entusiasmo.',
                  desafio:  'Entra em personagem. Joga com o flerte, a tensão e a conquista. Sê provocadora, usa o olhar e as palavras para criar atração. Deixa a situação evoluir naturalmente.',
                  diversao: 'Entra em personagem. Sem filtros — explora o desejo, a sedução e o prazer abertamente. Sê sensual, ousada e deixa a fantasia fluir sem restrições.',
                }
                const instrucao = modeInstructions[rpMode] || 'Entra em personagem e escreve a primeira cena.'
                const tag = rpMode ? `[Roleplay · ${rpMode.charAt(0).toUpperCase() + rpMode.slice(1)}]\n` : ''
                const msg = `${tag}Cenário:\n${scenario.trim()}\n\n${instrucao}`
                sendMessage(msg)
              }}
              disabled={!scenario.trim() || loading}
              style={{
                height: 32, padding: '0 16px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                letterSpacing: '0.04em',
                border: 'none',
                background: !scenario.trim() || loading ? 'var(--border)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                cursor: !scenario.trim() || loading ? 'default' : 'pointer',
                boxShadow: !scenario.trim() || loading ? 'none' : '0 2px 10px rgba(245,158,11,0.45)',
                transition: 'all 0.15s',
              }}
            >
              Começar
            </button>
          </div>
        </div>
      )}

      {/* ── Companion Mode indicator + painel de trabalho ── */}
      {companionMode && pro && (
        <div style={{
          padding: '8px 16px 10px',
          borderTop: `2px solid ${companionSubMode === 'stroke' ? '#ec489933' : companionSubMode === 'trabalho' ? '#10b98133' : '#3b82f633'}`,
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {/* Header da chamada */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: companionSubMode === 'trabalho' ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: companionSubMode === 'stroke' ? '#ec4899' : companionSubMode === 'trabalho' ? '#10b981' : '#3b82f6',
                boxShadow: `0 0 6px ${companionSubMode === 'stroke' ? '#ec4899' : companionSubMode === 'trabalho' ? '#10b981' : '#3b82f6'}`,
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: companionSubMode === 'stroke' ? '#ec4899' : companionSubMode === 'trabalho' ? '#10b981' : '#3b82f6' }}>
                COMPANION · {companionSubMode === 'passatempo' ? 'PASSA TEMPO' : companionSubMode === 'trabalho' ? 'TRABALHO' : 'STROKE'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['passatempo', 'trabalho', 'stroke'].map(sm => {
                const colors = { passatempo: '#3b82f6', trabalho: '#10b981', stroke: '#ec4899' }
                const labels = { passatempo: 'Tempo', trabalho: 'Trabalho', stroke: 'Stroke' }
                return (
                  <button
                    key={sm}
                    onClick={() => onSetCompanionSubMode?.(sm)}
                    style={{
                      padding: '2px 7px', borderRadius: 5, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                      border: `1px solid ${companionSubMode === sm ? colors[sm] : 'var(--border)'}`,
                      background: companionSubMode === sm ? `${colors[sm]}18` : 'none',
                      color: companionSubMode === sm ? colors[sm] : 'var(--text-muted)',
                    }}
                  >
                    {labels[sm]}
                  </button>
                )
              })}
              <button
                onClick={onCompanionClose}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
              >✕</button>
            </div>
          </div>

          {/* Painel de código (só sub-modo trabalho) */}
          {companionSubMode === 'trabalho' && (
            <textarea
              value={workContext}
              onChange={e => setWorkContext(e.target.value)}
              placeholder="Cola o teu código ou contexto aqui — ela vai comentar e opinar…"
              rows={3}
              style={{
                width: '100%', resize: 'vertical', minHeight: 60, maxHeight: 160,
                background: 'var(--surface2)', color: 'var(--text)',
                border: '1px solid #10b98133', borderRadius: 8,
                padding: '7px 10px', fontSize: 12, lineHeight: 1.5,
                fontFamily: 'monospace', boxSizing: 'border-box',
              }}
            />
          )}
        </div>
      )}

      <MessageInput onSend={sendMessage} loading={loading} disabled={!personaEnabled} />
    </div>
  )
}
