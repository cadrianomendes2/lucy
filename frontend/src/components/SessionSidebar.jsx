import { useState, useEffect } from 'react'

function groupByDate(sessions) {
  const now = new Date()
  const groups = { 'Hoje': [], 'Ontem': [], 'Últimos 7 dias': [], 'Anterior': [] }
  for (const s of sessions) {
    const d = new Date(s.updated_at)
    const diffDays = Math.floor((now - d) / 86400000)
    if (diffDays < 1) groups['Hoje'].push(s)
    else if (diffDays < 2) groups['Ontem'].push(s)
    else if (diffDays < 7) groups['Últimos 7 dias'].push(s)
    else groups['Anterior'].push(s)
  }
  return groups
}

export default function SessionSidebar({ sessionId, onSelect, onNew }) {
  const [sessions, setSessions] = useState([])
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    fetchSessions()
  }, [sessionId])

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions')
      setSessions(await res.json())
    } catch {}
  }

  async function handleDelete(e, id) {
    e.stopPropagation()
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    if (id === sessionId) onNew()
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const groups = groupByDate(sessions)

  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-secondary, #111)',
      borderRight: '1px solid var(--border, #222)',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 10px 8px' }}>
        <button
          onClick={onNew}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border, #333)',
            background: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Nova conversa
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 12px' }}>
        {Object.entries(groups).map(([label, items]) => {
          if (!items.length) return null
          return (
            <div key={label}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-muted)',
                opacity: 0.45,
                padding: '10px 8px 4px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {label}
              </div>
              {items.map(s => (
                <div
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  onMouseEnter={() => setHoveredId(s.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: s.id === sessionId
                      ? 'var(--accent-subtle, rgba(124,92,191,0.18))'
                      : hoveredId === s.id ? 'rgba(255,255,255,0.05)' : 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  <span style={{
                    flex: 1,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: s.id === sessionId ? 500 : 400,
                    color: s.id === sessionId ? 'var(--text, #eee)' : 'var(--text-muted, #aaa)',
                  }}>
                    {s.title || 'Nova conversa'}
                  </span>
                  {hoveredId === s.id && (
                    <button
                      onClick={e => handleDelete(e, s.id)}
                      style={{
                        flexShrink: 0,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#888',
                        fontSize: 13,
                        padding: '0 2px',
                        lineHeight: 1,
                      }}
                      title="Apagar"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
        {sessions.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.4, padding: '16px 8px' }}>
            Sem conversas ainda
          </div>
        )}
      </div>
    </div>
  )
}
