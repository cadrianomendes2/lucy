import { useState, useEffect, useCallback } from 'react'

export default function MemoryBrowserView({ visible }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchMemories = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/memories')
      if (res.ok) setMemories(await res.json())
    } catch {
      // backend offline
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    fetchMemories()
    const interval = setInterval(fetchMemories, 15000)
    return () => clearInterval(interval)
  }, [visible, fetchMemories])

  async function handleDelete(id) {
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' })
      setMemories(prev => prev.filter(m => m.id !== id))
    } catch {
      // falha silenciosa
    }
  }

  if (!visible) return null

  return (
    <div style={{
      width: 260,
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
        <span style={{ fontWeight: 600, fontSize: 13, opacity: 0.85 }}>Memórias</span>
        <button
          onClick={fetchMemories}
          title="Actualizar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            opacity: loading ? 0.4 : 0.7,
            fontSize: 14,
            padding: '2px 4px',
            color: 'inherit',
          }}
          disabled={loading}
        >
          ↻
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 20px' }}>
        {loading && memories.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.45, textAlign: 'center', marginTop: 20 }}>
            A carregar…
          </p>
        )}
        {!loading && memories.length === 0 && (
          <p style={{ fontSize: 12, opacity: 0.45, textAlign: 'center', marginTop: 20 }}>
            Ainda sem memórias.<br />Conversa com a Lucy!
          </p>
        )}
        {memories.map(m => (
          <div key={m.id} style={{
            background: 'var(--bg, #1a1a2e)',
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 8,
            fontSize: 12,
            lineHeight: 1.45,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}>
            <span style={{ flex: 1, opacity: 0.9 }}>{m.fact}</span>
            <button
              onClick={() => handleDelete(m.id)}
              title="Apagar"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.35,
                fontSize: 13,
                padding: 0,
                flexShrink: 0,
                color: 'inherit',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        opacity: 0.4,
        textAlign: 'center',
      }}>
        {memories.length} facto{memories.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
