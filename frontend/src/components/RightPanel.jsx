import { useState, useEffect, useCallback } from 'react'

const INTEREST_COLORS = {
  'filosofia': '#8b5cf6', 'história': '#3b82f6',
  'futuro da inteligência artificial': '#ec4899', 'comunismo': '#ef4444',
  'capitalismo': '#f59e0b', 'cinema': '#06b6d4', 'música': '#f97316',
  'design': '#a855f7', 'desenvolvimento': '#00a884', 'geral': '#6b7280',
}
function icolor(name) { return INTEREST_COLORS[name?.toLowerCase()] || '#6b7280' }

const PERSONA_GALLERY = {
  'Lucy':     ['/avatars/lucy-vanilla.jpg', '/avatars/lucy-vanilla.mp4'],
  'Samantha': ['/avatars/samantha-vanilla.jpg'],
  'Marvin':   ['/avatars/marvin-vanilla.jpg'],
  'GLaDOS':   ['/avatars/glados-vanilla.png', '/avatars/glados-vanilla.mp4'],
}

export default function RightPanel({ open, onClose, personaName = 'Lucy', personaInterests = [], personaId }) {
  const [interests, setInterests] = useState([])
  const [memoriesUser, setMemoriesUser] = useState([])
  const [memoriesSelf, setMemoriesSelf] = useState([])
  const [wiping, setWiping] = useState(false)

  // null | 'memoria' | 'pesquisas' | { photo: src }
  const [expanded, setExpanded] = useState(null)

  async function wipeMemories() {
    if (!window.confirm('Apagar TODAS as memórias? Esta acção não pode ser desfeita.')) return
    const pin = window.prompt('Confirma com o teu PIN:')
    if (pin !== (import.meta.env.VITE_PRO_PIN || '1213')) { if (pin !== null) window.alert('PIN incorrecto.'); return }
    setWiping(true)
    await fetch('/api/memories', { method: 'DELETE' }).catch(() => {})
    setMemoriesUser([])
    setMemoriesSelf([])
    setWiping(false)
  }

  const fetchAll = useCallback(async () => {
    try {
      const qs = personaId ? `?persona_id=${personaId}` : ''
      const [intRes, memRes] = await Promise.all([
        fetch(`/api/interests${qs}`).then(r => r.json()).catch(() => []),
        fetch(`/api/memories${qs}`).then(r => r.json()).catch(() => []),
      ])
      setInterests(Array.isArray(intRes) ? intRes : [])
      const mems = Array.isArray(memRes) ? memRes : []
      setMemoriesUser(mems.filter(m => !m.source?.startsWith('self')))
      setMemoriesSelf(mems.filter(m => m.source?.startsWith('self')))
    } catch {}
  }, [personaId])

  // limpa ao trocar de persona para não mostrar dados antigos
  useEffect(() => {
    setInterests([])
    setMemoriesUser([])
    setMemoriesSelf([])
  }, [personaId])

  useEffect(() => {
    if (!open) return
    fetchAll()
    const id = setInterval(fetchAll, 20000)
    return () => clearInterval(id)
  }, [open, fetchAll, personaId])

  if (!open) return null

  // top 6 interesses dinâmicos por número de factos (API já devolve ordenado)
  const interestKeys = interests.map(i => i.interest || i).filter(Boolean).slice(0, 6)

  // ── Expanded views ────────────────────────────────────────────────────────

  function ExpandedHeader({ title }) {
    return (
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setExpanded(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '0 2px' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</span>
      </div>
    )
  }

  if (expanded === 'memoria') {
    return (
      <div style={panelStyle}>
        <ExpandedHeader title="Memória" />
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {memoriesUser.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>Ainda sem memórias.</p>
            : memoriesUser.map(m => (
              <div key={m.id} style={memRowStyle}>{m.fact}</div>
            ))}
        </div>
      </div>
    )
  }

  if (expanded === 'pesquisas') {
    return (
      <div style={panelStyle}>
        <ExpandedHeader title="Pesquisas" />
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {memoriesSelf.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>Ainda sem pesquisas.</p>
            : memoriesSelf.map(m => (
              <div key={m.id} style={memRowStyle}>{m.fact}</div>
            ))}
        </div>
      </div>
    )
  }

  if (expanded?.photo) {
    return (
      <div style={panelStyle}>
        <ExpandedHeader title="Galeria" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <img src={expanded.photo} alt="" style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: '80%' }} />
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
          {(PERSONA_GALLERY[personaName] || []).filter(s => s.endsWith('.jpg') || s.endsWith('.png')).map((src, i) => (
            <div
              key={i}
              onClick={() => setExpanded({ photo: src })}
              style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: `2px solid ${expanded.photo === src ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', flexShrink: 0 }}
            >
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Normal view ───────────────────────────────────────────────────────────

  return (
    <div style={panelStyle}>
      {/* Header mínimo — só fechar */}
      <div style={{ padding: '10px 14px 6px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>‹</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── Interesses ── */}
        <div style={{ padding: '0 14px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...sectionLabel, marginBottom: 8 }}>Interesses · {personaInterests.length + interestKeys.length}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {/* Fixos — verde */}
            {personaInterests.map(name => (
              <span key={`fixed-${name}`} style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: 'rgba(0,168,132,0.12)', color: 'var(--accent)', border: '1px solid rgba(0,168,132,0.35)' }}>
                {name}
              </span>
            ))}
            {/* Pesquisados — coloridos */}
            {interestKeys.filter(n => !personaInterests.includes(n)).map(name => {
              const col = icolor(name)
              return (
                <span key={name} style={{ padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: `${col}18`, color: col, border: `1px solid ${col}30` }}>
                  {name}
                </span>
              )
            })}
          </div>
        </div>

        {/* ── Memória (últimas guardadas) ── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...sectionLabel, padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Memória · {memoriesUser.length}</span>
            <button onClick={wipeMemories} disabled={wiping} title="Apagar todas as memórias" style={{ background: 'none', border: '1px solid #fee2e2', borderRadius: 6, color: '#dc2626', fontSize: 10, fontWeight: 700, padding: '2px 7px', cursor: wiping ? 'default' : 'pointer', opacity: wiping ? 0.5 : 1 }}>
              {wiping ? '…' : 'wipe'}
            </button>
            <button onClick={() => setExpanded('memoria')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: 0 }}>›</button>
          </div>
          <div style={{ padding: '0 14px 12px' }}>
            {memoriesUser.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ainda sem memórias.</p>
              : memoriesUser.slice(0, 3).map(m => (
                <div key={m.id} style={memRowStyle}>{m.fact}</div>
              ))}
          </div>
        </div>

        {/* ── Pesquisas (self knowledge) ── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ ...sectionLabel, padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Pesquisas · {memoriesSelf.length}</span>
            <button onClick={() => setExpanded('pesquisas')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: 0 }}>›</button>
          </div>
          <div style={{ padding: '0 14px 12px' }}>
            {memoriesSelf.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ainda sem pesquisas.</p>
              : memoriesSelf.slice(0, 3).map(m => (
                <div key={m.id} style={memRowStyle}>{m.fact}</div>
              ))}
          </div>
        </div>

        {/* ── Galeria ── */}
        {(PERSONA_GALLERY[personaName] || []).filter(s => s.endsWith('.jpg') || s.endsWith('.png')).length > 0 && (
          <div style={{ padding: '10px 14px 16px' }}>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>Galeria</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {(PERSONA_GALLERY[personaName] || []).filter(s => s.endsWith('.jpg') || s.endsWith('.png')).map((src, i) => (
                <div
                  key={i}
                  onClick={() => setExpanded({ photo: src })}
                  style={{ aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const panelStyle = {
  flex: 2, minWidth: 200, maxWidth: 320,
  borderLeft: '1px solid var(--border)',
  background: 'var(--surface)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8,
}

const memRowStyle = {
  fontSize: 12, color: 'var(--text)', lineHeight: 1.45,
  padding: '5px 0', borderBottom: '1px solid var(--border)',
}
