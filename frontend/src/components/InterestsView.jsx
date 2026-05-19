import { useState, useEffect, useCallback } from 'react'

const COLORS = {
  'filosofia':                         '#8b5cf6',
  'história':                          '#3b82f6',
  'futuro da inteligência artificial': '#ec4899',
  'comunismo':                         '#ef4444',
  'capitalismo':                       '#f59e0b',
  'geral':                             '#6b7280',
}

function color(interest) {
  return COLORS[interest] || '#6b7280'
}

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function InterestsView({ visible }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/interests')
      if (res.ok) setData(await res.json())
    } catch {
      // backend offline
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [visible, fetchData])

  if (!visible) return null

  const totalFacts = data.reduce((s, d) => s + d.facts.length, 0)

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, opacity: 0.85 }}>O que a Lucy aprende</span>
        <button
          onClick={fetchData}
          title="Actualizar"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            opacity: loading ? 0.3 : 0.6, fontSize: 14, padding: '2px 4px', color: 'inherit',
          }}
          disabled={loading}
        >↻</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 20px' }}>
        {!loading && data.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.4, textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Nenhum facto aprendido ainda.<br />O learner corre em breve.
          </p>
        )}

        {data.map(({ interest, facts }) => (
          <div key={interest} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color(interest), flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                color: color(interest), textTransform: 'uppercase',
              }}>
                {interest}
              </span>
              <span style={{ fontSize: 10, opacity: 0.35, marginLeft: 'auto' }}>
                {facts.length} facto{facts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {facts.slice(0, 4).map((f, i) => (
              <div key={i} style={{
                fontSize: 12, lineHeight: 1.5,
                padding: '7px 9px',
                marginBottom: 5,
                borderRadius: 6,
                background: 'var(--bg, #1a1a2e)',
                borderLeft: `2px solid ${color(interest)}`,
                position: 'relative',
              }}>
                <span style={{ opacity: 0.88 }}>{f.fact}</span>
                <span style={{
                  display: 'block', fontSize: 10, opacity: 0.3, marginTop: 3,
                }}>
                  {timeAgo(f.timestamp)} atrás
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        fontSize: 11, opacity: 0.35, textAlign: 'center',
      }}>
        {totalFacts} facto{totalFacts !== 1 ? 's' : ''} aprendidos
      </div>
    </div>
  )
}
