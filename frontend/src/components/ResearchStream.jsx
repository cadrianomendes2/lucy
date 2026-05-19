import { useState, useEffect, useRef } from 'react'

const STEP_LABELS = {
  search: '🔍 A pesquisar…',
  synthesize: '🧠 A sintetizar…',
  deep: '📚 A aprofundar…',
  conclude: '💡 A formar conclusão…',
  thought: null,
  ack: null,
  done: '✓ Concluído',
}

export default function ResearchStream({ topic, type = 'research', sessionId, onDone }) {
  const [events, setEvents] = useState([])
  const [active, setActive] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [waitingReply, setWaitingReply] = useState(false)
  const readerRef = useRef(null)

  useEffect(() => {
    if (!topic || !type) return
    setEvents([])
    setActive(true)
    startStream(type, topic)
  }, [topic, type])

  async function startStream(type, t) {
    const res = await fetch(`/api/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: t, session_id: String(sessionId ?? 'default') }),
    })
    if (!res.ok) return

    const reader = res.body.getReader()
    readerRef.current = reader
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
        if (raw === '[DONE]') {
          setActive(false)
          const doneEvent = events.find(e => e.step === 'done')
          onDone?.(doneEvent?.essence || '')
          return
        }
        try {
          const event = JSON.parse(raw)
          setEvents(prev => [...prev, event])
          if (event.step === 'thought') setWaitingReply(true)
          if (event.step === 'ack') setWaitingReply(false)
        } catch {}
      }
    }
    setActive(false)
  }

  async function sendReply() {
    if (!replyText.trim()) return
    await fetch('/api/research/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: String(sessionId ?? 'default'), message: replyText }),
    })
    setReplyText('')
    setWaitingReply(false)
    onReply?.(replyText)
  }

  if (!active && events.length === 0) return null

  const lastStep = [...events].reverse().find(e => e.step && e.step !== 'thought' && e.step !== 'ack')
  const thoughts = events.filter(e => e.step === 'thought')
  const lastThought = thoughts[thoughts.length - 1]

  return (
    <div style={{
      margin: '8px 16px',
      borderRadius: 12,
      border: '1px solid var(--border, #333)',
      background: 'rgba(124,92,191,0.08)',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid var(--border, #222)',
        background: 'rgba(124,92,191,0.12)',
      }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>
          {active ? '⟳' : '✓'}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent, #a78de0)' }}>
          {topic}
        </span>
        <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 'auto' }}>
          {lastStep ? STEP_LABELS[lastStep.step] ?? lastStep.step : ''}
        </span>
      </div>

      {/* progresso */}
      {active && (
        <div style={{ height: 2, background: 'var(--border, #333)', position: 'relative' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: '40%',
            background: 'var(--accent, #7c5cbf)',
            animation: 'progress-slide 1.5s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* último pensamento */}
      {lastThought && (
        <div style={{ padding: '10px 14px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted, #ccc)', margin: 0, lineHeight: 1.5 }}>
            💭 {lastThought.msg}
          </p>

          {waitingReply && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendReply()}
                placeholder="Responde à Lucy…"
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #444)',
                  background: 'var(--surface, #111)',
                  color: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={sendReply}
                style={{
                  fontSize: 12,
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent, #7c5cbf)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                ↩
              </button>
              <button
                onClick={() => setWaitingReply(false)}
                style={{
                  fontSize: 12,
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #444)',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ignorar
              </button>
            </div>
          )}
        </div>
      )}

      {/* conclusão */}
      {events.find(e => e.step === 'done') && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border, #222)',
          fontSize: 12,
          color: 'var(--text-muted)',
          opacity: 0.7,
        }}>
          {events.find(e => e.step === 'done')?.essence}
        </div>
      )}
    </div>
  )
}
