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

async function playTTS(text, voiceUuid, onStart, onEnd) {
  text = stripEmojis(text)
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_uuid: voiceUuid }),
    })
    if (!res.ok) return

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => {
      URL.revokeObjectURL(url)
      onEnd?.()
    }
    onStart?.()
    await audio.play().catch(() => onEnd?.())
  } catch {
    onEnd?.()
  }
}

const PLEASEME_DURATION = 4000

export default function ChatView({ model, thinkingMode, language, voiceUuid, onAnimation, sessionId, onSessionCreated }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchingQuery, setSearchingQuery] = useState(null)
  const [researchTopic, setResearchTopic] = useState(null)
  const [researchType, setResearchType] = useState(null)
  const currentSessionId = useRef(sessionId)
  const sessionCreatedHere = useRef(false)
  const bottomRef = useRef(null)
  const pleasemeTimer = useRef(null)

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

  async function sendMessage(text) {
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

    const userMsg = { role: 'user', content: text }
    const history = messages.map(m => ({ role: m.role, content: m.content }))

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    onAnimation?.('idle')

    const assistantMsg = { role: 'assistant', content: '', streaming: true }
    setMessages(prev => [...prev, assistantMsg])

    let finalText = ''

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
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || `Erro ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

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
            if (chunk.searching) {
              setSearchingQuery(chunk.query || '...')
            }
            if (chunk.text) {
              setSearchingQuery(null)
              finalText += chunk.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + chunk.text,
                }
                return updated
              })
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
      setMessages(prev => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.streaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false }
        }
        return updated
      })
      setSearchingQuery(null)
      setLoading(false)

      if (voiceUuid && finalText) {
        playTTS(
          finalText,
          voiceUuid,
          () => onAnimation?.('talking'),
          () => onAnimation?.('idle'),
        )
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
          <MessageBubble key={i} message={msg} />
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
      <MessageInput onSend={sendMessage} loading={loading} />
    </div>
  )
}
