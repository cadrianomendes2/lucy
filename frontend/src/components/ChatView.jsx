import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble.jsx'
import MessageInput from './MessageInput.jsx'
import ResearchStream from './ResearchStream.jsx'

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

export default function ChatView({ model, thinkingMode, language, voiceUuid, onAnimation, sessionId, onSessionCreated, pro, personaId, personaEnabled = true, personaName }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchingQuery, setSearchingQuery] = useState(null)
  const [researchTopic, setResearchTopic] = useState(null)
  const [researchType, setResearchType] = useState(null)
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
      .then(msgs => setMessages(msgs.map(m => ({ role: m.role, content: m.content }))))
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

    const userMsg = { role: 'user', content: text, image: image || null }
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

    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

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

                    // adiciona bolha vazia (typing indicator)
                    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

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
        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble message={msg} personaName={personaName} />
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
        ))}
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
      <MessageInput onSend={sendMessage} loading={loading} disabled={!personaEnabled} />
    </div>
  )
}
