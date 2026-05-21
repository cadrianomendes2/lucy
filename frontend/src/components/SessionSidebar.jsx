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

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays < 1) return d.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' })
  if (diffDays < 7) return d.toLocaleDateString('pt', { weekday: 'short' })
  return d.toLocaleDateString('pt', { day: '2-digit', month: '2-digit' })
}

// embedded=true → renderiza como lista plana sem o wrapper do painel (para uso no HistoryView do App)
export default function SessionSidebar({ sessionId, onSelect, onNew, embedded = false, personaId, isPro = false }) {
  const [sessions, setSessions] = useState([])
  const [hoveredId, setHoveredId] = useState(null)

  useEffect(() => {
    fetchSessions()
  }, [sessionId, personaId, isPro])

  async function fetchSessions() {
    try {
      const params = new URLSearchParams()
      if (personaId) params.set('persona_id', personaId)
      // vanilla vê só is_pro=0; pro vê tudo (0 e 1 misturados, com marcador)
      if (!isPro) params.set('is_pro', '0')
      const res = await fetch(`/api/sessions?${params}`)
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

  // Lista de sessões — partilhada entre modos
  const listContent = (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 12px' }}>
      {Object.entries(groups).map(([label, items]) => {
        if (!items.length) return null
        return (
          <div key={label}>
            {/* Separador de grupo de data */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              padding: '10px 16px 4px',
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
                  gap: 12,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${s.id === sessionId ? 'var(--accent)' : 'transparent'}`,
                  background: s.id === sessionId
                    ? 'rgba(0,168,132,0.05)'
                    : hoveredId === s.id ? 'var(--surface2)' : 'none',
                  transition: 'background 0.1s',
                }}
              >
                {/* Avatar de sessão com marcador dourado se Pro */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: s.is_pro ? 'rgba(245,158,11,0.12)' : 'rgba(0,168,132,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: s.is_pro ? '#d97706' : 'var(--accent)', fontSize: 18,
                    border: s.is_pro ? '1.5px solid rgba(245,158,11,0.4)' : 'none',
                  }}>
                    {s.is_pro ? '✦' : '💬'}
                  </div>
                  {s.is_pro && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#d97706)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 7, color: '#fff', fontWeight: 800 }}>P</span>
                    </div>
                  )}
                </div>

                {/* Info da sessão */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: s.id === sessionId ? 600 : 500,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      marginRight: 6,
                    }}>
                      {s.title || 'Nova conversa'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {formatTime(s.updated_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {s.preview || '…'}
                    </span>
                    {/* Botão apagar (aparece no hover) */}
                    {hoveredId === s.id && (
                      <button
                        onClick={e => handleDelete(e, s.id)}
                        title="Apagar"
                        style={{
                          flexShrink: 0,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          fontSize: 14,
                          padding: '0 2px',
                          lineHeight: 1,
                          marginLeft: 4,
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {sessions.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 16px', textAlign: 'center', lineHeight: 1.6 }}>
          Sem conversas ainda.<br />Começa a falar com a Lucy!
        </div>
      )}
    </div>
  )

  // Modo embedded — apenas a lista, sem wrapper
  if (embedded) {
    return listContent
  }

  // Modo standalone (não usado na nova UI, mas mantido por compatibilidade)
  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
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
            border: '1px solid var(--border)',
            background: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Nova conversa
        </button>
      </div>
      {listContent}
    </div>
  )
}
