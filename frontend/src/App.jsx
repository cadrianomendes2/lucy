import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import ChatView from './components/ChatView.jsx'
import ModelSelector from './components/ModelSelector.jsx'
import LanguageSelector from './components/LanguageSelector.jsx'
import VoiceSelector from './components/VoiceSelector.jsx'
import SessionSidebar from './components/SessionSidebar.jsx'
import RightPanel from './components/RightPanel.jsx'

// Lazy: react-force-graph precisa de window.THREE (definido em main.jsx).
// Com lazy import, o módulo só é carregado quando MindGraph3D renderiza pela
// primeira vez — nessa altura window.THREE já está definido.
const MindGraph3D = lazy(() => import('./components/MindGraph3D.jsx'))

// ── Ícones ──────────────────────────────────────────────────────────────────

function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconNeural() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="19" cy="19" r="2" />
      <circle cx="12" cy="12" r="2" />
      <line x1="7" y1="12" x2="10" y2="12" />
      <line x1="14" y1="12" x2="17" y2="5.5" />
      <line x1="14" y1="12" x2="17" y2="18.5" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function IconLearn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  )
}

// ── Logo Lucy ────────────────────────────────────────────────────────────────

function LucyLogo({ onClick }) {
  return (
    <div
      onClick={onClick}
      title="Lucy"
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'linear-gradient(135deg, #4ade80, #00a884)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="6" cy="5" r="2.5" fill="#fff" fillOpacity="0.9" />
        <circle cx="6" cy="11" r="2.5" fill="#fff" fillOpacity="0.9" />
        <circle cx="6" cy="17" r="2.5" fill="#fff" fillOpacity="0.9" />
        <circle cx="12" cy="17" r="2.5" fill="#fff" fillOpacity="0.9" />
        <circle cx="16" cy="17" r="2.5" fill="#fff" fillOpacity="0.7" />
        <line x1="6" y1="5" x2="6" y2="11" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="6" y1="11" x2="6" y2="17" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="6" y1="17" x2="12" y2="17" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="12" y1="17" x2="16" y2="17" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.6" />
        <line x1="6" y1="11" x2="12" y2="17" stroke="#fff" strokeWidth="0.8" strokeOpacity="0.35" />
      </svg>
    </div>
  )
}

// ── Rail Icon ────────────────────────────────────────────────────────────────

function RailIcon({ active, disabled, title, onClick, children }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        background: active ? 'rgba(0,168,132,0.1)' : 'none',
        color: disabled ? '#d1d5db' : active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!disabled && !active) {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.color = 'var(--text-soft)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.background = active ? 'rgba(0,168,132,0.1)' : 'none'
          e.currentTarget.style.color = disabled ? '#d1d5db' : active ? 'var(--accent)' : 'var(--text-muted)'
        }
      }}
    >
      {active && (
        <span style={{
          position: 'absolute',
          left: -1,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 24,
          background: 'var(--accent)',
          borderRadius: '0 3px 3px 0',
        }} />
      )}
      {children}
    </button>
  )
}

// ── Header button (chat) ─────────────────────────────────────────────────────

function HeaderBtn({ title, onClick, active, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(0,168,132,0.08)' : 'none',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.12s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ── Placeholder genérico para páginas ainda sem design ───────────────────────

function PlaceholderPage({ title, description }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-muted)',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-soft)' }}>{title}</div>
      <div style={{ fontSize: 14, opacity: 0.6 }}>{description}</div>
    </div>
  )
}

// ── Componente de card de quadrante ─────────────────────────────────────────

function QuadrantCard({ stat, label, header, children, style }) {
  return (
    <div style={{
      flex: 1,
      borderRadius: 20,
      border: '1px solid var(--border)',
      background: 'var(--card-bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...style,
    }}>
      {/* Stat topo — só renderiza se tiver stat ou label */}
      {(stat !== undefined || label) && (
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {stat !== undefined && (
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stat}</div>
          )}
          {label && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: stat !== undefined ? 5 : 0 }}>{label}</div>
          )}
        </div>
      )}
      {/* Header alternativo (sem stat, só título + acções) */}
      {header && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {header}
        </div>
      )}
      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

// ── Modelos disponíveis (espelho do backend) ────────────────────────────────

// Tier por estVram: < 7 low | 7-15 medium | 15-21 high | 21-32 max | > 32 capped
function vramTier(gb) {
  if (gb < 7)  return 'low'
  if (gb < 15) return 'medium'
  if (gb < 21) return 'high'
  if (gb <= 32) return 'max'
  return 'capped'
}

const TIER_STYLE = {
  low:    { label: 'Low',    bg: 'rgba(34,197,94,0.12)',  color: '#16a34a' },
  medium: { label: 'Medium', bg: 'rgba(234,179,8,0.14)',  color: '#a16207' },
  high:   { label: 'High',   bg: 'rgba(234,88,12,0.12)',  color: '#c2410c' },
  max:    { label: 'Max',    bg: 'rgba(239,68,68,0.12)',  color: '#dc2626' },
  capped: { label: 'Capped', bg: 'rgba(15,23,42,0.10)',   color: '#0f172a' },
}

const ALL_MODELS = [
  { key: 'gemma-lite',   label: 'Gemma 4 E4B',  sub: '7.5B · PT',      category: 'chat',      estVram: 3  },
  { key: 'qwen-9b-auto', label: 'Qwen3.5',      sub: '9B · thinking',   category: 'reasoning', estVram: 6  },
  { key: 'nemo-12b',     label: 'Nemo Roleplay', sub: '12B · PT',        category: 'chat',      estVram: 8  },
  { key: 'gemma-26b',    label: 'Gemma 4 26B',  sub: '26B',              category: 'chat',      estVram: 16 },
  { key: 'qwen-40b',     label: 'Qwen3.6',      sub: '40B · thinking',   category: 'reasoning', estVram: 25 },
].map(m => ({ ...m, tier: vramTier(m.estVram) }))

const ALL_VOICES = [
  { uuid: '7a33e74f', label: 'Vanessa', lang: 'pt-BR' },
  { uuid: 'bd0f1157', label: 'Marvin',  lang: 'pt-BR' },
  { uuid: 'c49e1b04', label: 'Laura',   lang: 'en-US' },
  { uuid: 'ce1fdae4', label: 'GLaDOS',  lang: 'en-GB' },
  // { uuid: '55f5b8dc', label: 'Linda',    lang: 'en-GB' },
  // { uuid: 'e28236ee', label: 'Samantha', lang: 'en-US' },
  // { uuid: '33eecc17', label: 'Primrose', lang: 'en-US' },
]

// ── PROFILE page ─────────────────────────────────────────────────────────────

function ProfilePage() {
  const [personas, setPersonas] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [config, setConfig] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newInterest, setNewInterest] = useState('')
  const [editingUser, setEditingUser] = useState(false)
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || 'Adriano')
  const [userInterests, setUserInterests] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user_interests') || '[]') } catch { return [] }
  })
  const [newUserInterest, setNewUserInterest] = useState('')
  const [photoTs, setPhotoTs] = useState(Date.now())
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [loadedModels, setLoadedModels] = useState([])
  const [modelOps, setModelOps] = useState({})   // { alias: 'loading' | 'unloading' }
  const [sysStats, setSysStats] = useState(null)
  const [playingVoice, setPlayingVoice] = useState(null)
  const photoInputRef = useRef(null)
  const statsIntervalRef = useRef(null)

  const CONTROLLABLE = new Set(['gemma-lite', 'gemma-26b', 'qwen-9b-auto'])

  async function refreshLoadedModels() {
    const d = await fetch('/api/lm-models').then(r => r.json()).catch(() => ({ loaded: [] }))
    setLoadedModels(d.loaded || [])
  }

  async function handleModelLoad(alias) {
    setModelOps(o => ({ ...o, [alias]: 'loading' }))
    try {
      const r = await fetch(`/api/lm-models/${alias}/load`, { method: 'POST' })
      if (!r.ok) { const d = await r.json(); alert(d.detail || 'Erro ao carregar modelo') }
    } catch { alert('Erro ao conectar ao backend') }
    await refreshLoadedModels()
    setModelOps(o => { const n = { ...o }; delete n[alias]; return n })
  }

  async function handleModelUnload(alias) {
    setModelOps(o => ({ ...o, [alias]: 'unloading' }))
    try {
      const r = await fetch(`/api/lm-models/${alias}/unload`, { method: 'POST' })
      if (!r.ok) { const d = await r.json(); alert(d.detail || 'Erro ao descarregar modelo') }
    } catch { alert('Erro ao conectar ao backend') }
    await refreshLoadedModels()
    setModelOps(o => { const n = { ...o }; delete n[alias]; return n })
  }

  useEffect(() => {
    fetch('/api/personas').then(r => r.json()).then(d => setPersonas(Array.isArray(d) ? d : [])).catch(() => {})
    fetch('/api/lm-models').then(r => r.json()).then(d => setLoadedModels(d.loaded || [])).catch(() => {})
    fetch('/api/reasoning-models/init', { method: 'POST' }).catch(() => {})
    // refresca o avatar quando volta a este painel
    setPhotoTs(Date.now())
    const fetchStats = () => fetch('/api/system/stats').then(r => r.json()).then(setSysStats).catch(() => {})
    fetchStats()
    statsIntervalRef.current = setInterval(fetchStats, 3000)
    return () => clearInterval(statsIntervalRef.current)
    // carrega foto actual do servidor
    fetch('/avatars/user-photo.jpg?t=' + Date.now())
      .then(r => { if (r.ok) setUserPhoto('/avatars/user-photo.jpg?t=' + Date.now()) })
      .catch(() => {})
  }, [])

  async function sampleVoice(voice) {
    if (playingVoice) return
    setPlayingVoice(voice.uuid)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: voice.lang.startsWith('en') ? `Hi, I'm ${voice.label}. How can I help you today?` : `Olá, sou ${voice.label}. Como posso ajudar?`, voice_uuid: voice.uuid }),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => { URL.revokeObjectURL(url); setPlayingVoice(null) }
        audio.onerror = () => setPlayingVoice(null)
        audio.play().catch(() => setPlayingVoice(null))
      } else { setPlayingVoice(null) }
    } catch { setPlayingVoice(null) }
  }

  const selected = personas.find(p => p.id === selectedId)

  function selectPersona(p) {
    if (selectedId === p.id) { setSelectedId(null); return }
    setSelectedId(p.id)
    setConfig({
      ...(p.defaults || {}),
      interests: (p.interests || []).slice(0, 6),
      description: p.description || '',
      enabled: p.enabled !== false,
      pro: p.pro === true,
    })
    setSaved(false)
  }

  async function savePersona() {
    setSaving(true)
    try {
      const res = await fetch(`/api/personas/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaults: { model: config.model || null, language: config.language || 'pt', voice_uuid: config.voice_uuid || null },
          interests: config.interests || [],
          description: config.description || '',
          enabled: config.enabled === true,
          pro: config.pro === true,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPersonas(prev => prev.map(p => p.id === selectedId
        ? { ...p, defaults: { ...p.defaults, model: config.model, language: config.language, voice_uuid: config.voice_uuid }, interests: config.interests, description: config.description, enabled: config.enabled, pro: config.pro }
        : p
      ))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(`Erro ao guardar: ${e.message}`)
    }
    setSaving(false)
  }

  function removeInterest(i) {
    setConfig(c => ({ ...c, interests: c.interests.filter((_, idx) => idx !== i) }))
    setSaved(false)
  }

  function addInterest(e) {
    e.preventDefault()
    const v = newInterest.trim()
    if (!v || (config.interests || []).includes(v) || (config.interests || []).length >= 6) return
    setConfig(c => ({ ...c, interests: [...(c.interests || []), v] }))
    setNewInterest('')
    setSaved(false)
  }

  function saveUserInfo() {
    localStorage.setItem('user_name', userName)
    localStorage.setItem('user_interests', JSON.stringify(userInterests))
    setEditingUser(false)
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await fetch('/api/user/photo', { method: 'POST', body: form })
      const ts = Date.now()
      setPhotoTs(ts)
      window.dispatchEvent(new CustomEvent('user-photo-updated', { detail: ts }))
    } catch {}
    setUploadingPhoto(false)
  }

  const sLabel = (text) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{text}</div>
  )

  const chip = (text, onRemove, color = 'var(--accent)') => (
    <span key={text} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`, fontSize: 11, color, fontWeight: 500 }}>
      {text}
      {onRemove && <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 13, padding: 0, lineHeight: 1, display: 'flex' }}>×</button>}
    </span>
  )

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--surface2)' }}>

      {/* ── PAINEL 1: Utilizador ──────────────────────────────────────── */}
      <div style={{ flex: '0 0 200px', width: 200, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Utilizador</span>
          {!editingUser
            ? <button onClick={() => setEditingUser(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            : <button onClick={saveUserInfo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 700, padding: '2px 6px', borderRadius: 6 }}>Guardar</button>
          }
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => photoInputRef.current?.click()}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface2)', border: '2px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', position: 'relative' }}>
              <IconPerson />
              <img
                src={`/avatars/user-photo.jpg?t=${photoTs}`}
                alt="Foto"
                onError={e => { e.target.style.display = 'none' }}
                onLoad={e => { e.target.style.display = 'block' }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: uploadingPhoto ? 'var(--border)' : 'var(--accent)', border: '2px solid #fff', color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploadingPhoto ? '…' : '+'}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
          </div>

          {/* Nome */}
          <div style={{ width: '100%' }}>
            {sLabel('Nome')}
            {editingUser
              ? <input value={userName} onChange={e => setUserName(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--accent)', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', background: 'var(--surface2)', boxSizing: 'border-box' }} />
              : <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{userName}</div>
            }
          </div>

          {!editingUser && (
            <div style={{ width: '100%' }}>
              {sLabel('Conta')}
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Utilizador local</div>
            </div>
          )}

          {/* Interesses do utilizador */}
          <div style={{ width: '100%' }}>
            {sLabel('Interesses')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: editingUser && userInterests.length > 0 ? 8 : 0 }}>
              {userInterests.map((t, i) => chip(t, editingUser ? () => setUserInterests(prev => prev.filter((_, idx) => idx !== i)) : null, '#667781'))}
            </div>
            {!editingUser && userInterests.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum interesse</div>}
            {editingUser && (
              <form onSubmit={e => { e.preventDefault(); const v = newUserInterest.trim(); if (v && !userInterests.includes(v)) { setUserInterests(p => [...p, v]); setNewUserInterest('') } }} style={{ display: 'flex', gap: 5 }}>
                <input value={newUserInterest} onChange={e => setNewUserInterest(e.target.value)} placeholder="Adicionar…" style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 11, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                <button type="submit" style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>+</button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── PAINEL 2: Personas grid ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Personas · {personas.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {personas.map(p => {
              const isSel = p.id === selectedId
              const isEnabled = p.enabled !== false
              return (
                <div
                  key={p.id}
                  onClick={() => selectPersona(p)}
                  style={{
                    borderRadius: 12,
                    border: `1.5px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSel ? 'rgba(0,168,132,0.08)' : 'var(--card-bg)',
                    padding: '12px 10px 10px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                    position: 'relative',
                    opacity: isEnabled ? 1 : 0.5,
                    overflow: 'hidden',
                  }}
                >
                  {p.pro && (
                    <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 5, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', letterSpacing: '0.05em' }}>PRO</span>
                  )}
                  <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                    <img src={p.avatar_url || '/animations/idle.webp'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 6, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.defaults?.model || '—'}</div>
                  {(p.interests || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 3, width: '100%', overflow: 'hidden' }}>
                      {(p.interests || []).slice(0, 2).map(t => (
                        <span key={t} style={{ fontSize: 8, padding: '2px 5px', borderRadius: 8, background: 'rgba(0,168,132,0.08)', color: 'var(--accent)', border: '1px solid rgba(0,168,132,0.2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '45%' }}>{t}</span>
                      ))}
                      {(p.interests || []).length > 2 && (
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>+{(p.interests || []).length - 2}</span>
                      )}
                    </div>
                  )}
                  {!isEnabled && (
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}>desactivado</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── PAINEL 3: Contextual (editor de persona OU sistema) ──────── */}
      <div style={{ flex: '0 0 260px', width: 260, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {selected ? (
          /* ── Editor de persona ── */
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--border)' }}>
                  <img src={selected.avatar_url} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{selected.name}</span>
                {config.pro && <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 5, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff' }}>PRO</span>}
              </div>
              <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Activada + PRO */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setConfig(c => ({ ...c, enabled: !c.enabled })); setSaved(false) }} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${config.enabled ? 'var(--accent)' : 'var(--border)'}`, background: config.enabled ? 'rgba(0,168,132,0.08)' : 'var(--surface2)', color: config.enabled ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {config.enabled ? '● Activada' : '○ Desactivada'}
                </button>
                <button onClick={() => { setConfig(c => ({ ...c, pro: !c.pro })); setSaved(false) }} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${config.pro ? '#f59e0b' : 'var(--border)'}`, background: config.pro ? 'rgba(245,158,11,0.08)' : 'var(--surface2)', color: config.pro ? '#d97706' : 'var(--text-muted)', fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.15s' }}>
                  {config.pro ? '✦ PRO' : 'PRO'}
                </button>
              </div>
              {/* Descrição */}
              <div>
                {sLabel('Descrição')}
                <textarea value={config.description || ''} onChange={e => { setConfig(c => ({ ...c, description: e.target.value })); setSaved(false) }} placeholder="Personalidade desta persona…" rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              {/* Interesses */}
              <div>
                {sLabel(`Interesses (${(config.interests || []).length}/6)`)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: (config.interests || []).length > 0 ? 7 : 0 }}>
                  {(config.interests || []).map((t, i) => chip(t, () => removeInterest(i)))}
                </div>
                {(config.interests || []).length < 6 && (
                  <form onSubmit={addInterest} style={{ display: 'flex', gap: 5 }}>
                    <input value={newInterest} onChange={e => setNewInterest(e.target.value)} placeholder="Adicionar…" style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 11, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                    <button type="submit" style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>+</button>
                  </form>
                )}
              </div>
              {/* Modelo */}
              <div>
                {sLabel('Modelo')}
                <select value={config.model || ''} onChange={e => { setConfig(c => ({ ...c, model: e.target.value })); setSaved(false) }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                  {ALL_MODELS.map(m => <option key={m.key} value={m.key}>{m.label} — {m.sub}</option>)}
                </select>
              </div>
              {/* Voz */}
              <div>
                {sLabel('Voz')}
                <select value={config.voice_uuid || ''} onChange={e => { setConfig(c => ({ ...c, voice_uuid: e.target.value })); setSaved(false) }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                  <option value="">Sem voz</option>
                  {ALL_VOICES.map(v => <option key={v.uuid} value={v.uuid}>{v.label} · {v.lang}</option>)}
                </select>
              </div>
              {/* Língua */}
              <div>
                {sLabel('Língua')}
                <div style={{ display: 'flex', gap: 6 }}>
                  {['pt', 'en'].map(lang => (
                    <button key={lang} onClick={() => { setConfig(c => ({ ...c, language: lang })); setSaved(false) }} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1.5px solid ${config.language === lang ? 'var(--accent)' : 'var(--border)'}`, background: config.language === lang ? 'rgba(0,168,132,0.08)' : 'var(--surface2)', color: config.language === lang ? 'var(--accent)' : 'var(--text-muted)', fontWeight: config.language === lang ? 700 : 400, fontSize: 12, cursor: 'pointer' }}>
                      {lang === 'pt' ? 'PT' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Guardar */}
              <button onClick={savePersona} disabled={saving} style={{ padding: '10px 0', borderRadius: 10, border: 'none', background: saved ? '#25d366' : 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', transition: 'background 0.2s' }}>
                {saving ? 'A guardar…' : saved ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
          </>
        ) : (
          /* ── Painel de sistema ── */
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Sistema</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 20px' }}>

              {/* ── Modelos ── */}
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                {['chat', 'reasoning'].map(cat => {
                  const models = [...ALL_MODELS.filter(m => m.category === cat)].sort((a, b) => a.estVram - b.estVram)
                  return (
                    <div key={cat} style={{ marginBottom: cat === 'chat' ? 14 : 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {cat === 'chat' ? 'Chat' : 'Reasoning'}
                        {cat === 'reasoning' && <span style={{ fontSize: 9, color: '#7c3aed', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· Deep Mind</span>}
                      </div>
                      {models.map(m => {
                        const isLoaded = loadedModels.includes(m.key)
                        const tier = TIER_STYLE[m.tier]
                        const op = modelOps[m.key]
                        const canControl = CONTROLLABLE.has(m.key)
                        return (
                          <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)', opacity: m.tier === 'capped' ? 0.4 : 1 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: isLoaded ? '#25d366' : 'var(--border)', boxShadow: isLoaded ? '0 0 5px #25d36680' : 'none', transition: 'background 0.3s' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.sub}</div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>~{m.estVram}GB</span>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: tier.bg, color: tier.color, flexShrink: 0, minWidth: 42, textAlign: 'center' }}>
                              {tier.label}
                            </span>
                            {canControl && (
                              <button
                                onClick={() => op ? null : isLoaded ? handleModelUnload(m.key) : handleModelLoad(m.key)}
                                disabled={!!op}
                                title={op ? (op === 'loading' ? 'A carregar…' : 'A descarregar…') : isLoaded ? 'Descarregar modelo' : 'Carregar modelo'}
                                style={{
                                  width: 28, height: 28, borderRadius: 8, border: 'none', flexShrink: 0,
                                  background: op ? 'var(--surface2)' : isLoaded ? 'rgba(239,68,68,0.1)' : 'rgba(0,168,132,0.1)',
                                  color: op ? 'var(--text-muted)' : isLoaded ? '#ef4444' : 'var(--accent)',
                                  cursor: op ? 'wait' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {op === 'loading' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}/></svg>}
                                {op === 'unloading' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}/></svg>}
                                {!op && isLoaded && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>}
                                {!op && !isLoaded && <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* ── Vozes ── */}
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Vozes</div>
                {ALL_VOICES.map(v => (
                  <div key={v.uuid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{v.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v.lang}</div>
                    </div>
                    <button
                      onClick={() => sampleVoice(v)}
                      disabled={playingVoice !== null}
                      title="Ouvir amostra"
                      style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${playingVoice === v.uuid ? 'var(--accent)' : 'var(--border)'}`, background: playingVoice === v.uuid ? 'rgba(0,168,132,0.1)' : 'none', color: playingVoice === v.uuid ? 'var(--accent)' : 'var(--text-muted)', cursor: playingVoice ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}
                    >
                      {playingVoice === v.uuid
                        ? <span style={{ fontSize: 10, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                        : <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      }
                    </button>
                  </div>
                ))}
                <button style={{ width: '100%', marginTop: 10, padding: '7px 0', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'not-allowed', opacity: 0.6 }}>
                  + Adicionar voz (em breve)
                </button>
              </div>

              {/* ── Memória ── */}
              <div style={{ padding: '12px 16px 8px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Memória</div>
                {sysStats ? (() => {
                  const { ram, swap } = sysStats
                  const pct = ram.percent
                  const barColor = pct < 70 ? '#25d366' : pct < 85 ? '#f59e0b' : '#ef4444'
                  const swapPct = swap.percent
                  return (
                    <>
                      {/* RAM bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>RAM Unificada</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{ram.used_gb} / {ram.total_gb} GB</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{pct.toFixed(0)}% em uso</span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{ram.free_gb} GB livre</span>
                        </div>
                      </div>

                      {/* Swap bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>Swap</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: swapPct > 60 ? '#ef4444' : 'var(--text-muted)' }}>
                            {swap.used_gb} / {swap.total_gb} GB
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(swapPct, 100)}%`, background: swapPct > 60 ? '#ef4444' : '#94a3b8', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        {swap.used_gb > 2 && (
                          <div style={{ fontSize: 9, color: '#ef4444', marginTop: 3 }}>⚠ swap activo — memória sob pressão</div>
                        )}
                      </div>

                      {/* Modelos carregados e estimativa */}
                      {sysStats.loaded_models?.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                            Modelos em memória
                          </div>
                          {sysStats.loaded_models.map(lm => {
                            const meta = ALL_MODELS.find(m => Object.values({
                              'nemo-12b': 'nemo_roleplay_ptbr_new-i1',
                              'gemma-lite': 'gemma-4-e4b-it-ultra-uncensored-heretic',
                              'gemma-26b': 'gemma-4-26b-a4b-it-ultra-uncensored-heretic',
                              'qwen-9b-auto': 'qwen3.5-9b-claude-4.6-os-auto-variable-heretic-uncensored-thinking-max-neocode-imatrix',
                              'qwen-40b': 'qwen3.6-40b-claude-4.6-opus-deckard-heretic-uncensored-thinking-neo-code-di-imatrix-max',
                            })[m.key] === lm.id)
                            return (
                              <div key={lm.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#25d366', flexShrink: 0 }} />
                                <span style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>{meta?.label || lm.id.split('-')[0]}</span>
                                <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{lm.quantization}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>~{meta?.estVram || '?'}GB</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )
                })() : (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>A carregar…</div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Lista de contactos (personas) reutilizável ───────────────────────────────

function AvatarCircle({ src, size = 46, border, isPro }) {
  const gold = 'linear-gradient(135deg, #f59e0b, #d97706, #fbbf24)'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      padding: isPro ? 2 : 0,
      background: isPro ? gold : 'transparent',
      boxSizing: 'border-box',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: isPro ? '1.5px solid #fff' : `2px solid ${border || 'var(--border)'}` }}>
        <img src={src || '/animations/idle.webp'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
      </div>
    </div>
  )
}

function PersonaContactList({ personas, selectedId, onSelect, pro }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {personas.map(p => {
        const isSelected = p.id === selectedId || p.name === selectedId
        const isLucy = p.id === 'lucy'
        const showPro = isLucy && pro
        const isEnabled = p.enabled !== false
        const interests = p.interests || []
        return (
          <div
            key={p.id ?? p.name}
            onClick={() => onSelect(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', cursor: 'pointer',
              background: isSelected ? 'rgba(0,168,132,0.05)' : 'none',
              borderLeft: `3px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
              borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
              opacity: isEnabled ? 1 : 0.5,
            }}
          >
            <AvatarCircle src={p.avatar_url} size={46} border={isSelected ? 'var(--accent)' : 'var(--border)'} isPro={showPro} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                {showPro && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 5, background: 'linear-gradient(90deg,#f59e0b,#d97706)', color: '#fff', letterSpacing: '0.06em' }}>PRO</span>
                )}
                {!isEnabled && (
                  <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 5, background: '#fee2e2', color: '#dc2626' }}>desactivado</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {interests.slice(0, 2).join(' · ') || 'Sem interesses definidos'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Perfil de contacto (aparece ao clicar num contacto no chat) ───────────────

function ContactProfile({ persona, pro, onTogglePro, onStartChat, onBack, stats }) {
  const hasPro = persona.id === 'lucy' || persona.id === 'glados' // personas com modo Pro
  const showPro = hasPro && pro
  const gold = 'linear-gradient(135deg, #f59e0b, #d97706, #fbbf24)'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Perfil</span>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 16px 24px', gap: 12 }}>

        {/* Avatar animado */}
        <div style={{
          width: 140, height: 140, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          padding: showPro ? 3 : 0,
          background: showPro ? gold : 'var(--border)',
          boxSizing: 'border-box',
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
            {persona.video_url && persona.video_url.endsWith('.mp4') ? (
              <video
                src={persona.video_url}
                autoPlay muted loop playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            ) : (
              <img
                src={persona.video_url || persona.avatar_url || '/animations/idle.webp'}
                alt={persona.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
              />
            )}
          </div>
        </div>

        {/* Nome + Pro badge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{persona.name}</span>
            {showPro && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 7, background: gold, color: '#fff', letterSpacing: '0.06em' }}>PRO</span>
            )}
          </div>
          {persona.enabled !== false
            ? <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: 'rgba(0,168,132,0.1)', color: 'var(--accent)', fontWeight: 500 }}>● disponível</span>
            : <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: '#fee2e2', color: '#dc2626', fontWeight: 500 }}>○ desactivado</span>
          }
        </div>

        {/* Modelo */}
        <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          {persona.defaults?.model || 'modelo padrão'}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
          {[
            { val: stats.memorias, label: 'memórias' },
            { val: stats.interesses, label: 'interesses' },
            { val: stats.sessoes, label: 'sessões' },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Botão Ver conversas */}
        <button
          onClick={onStartChat}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', marginTop: 4,
          }}
        >
          Ver conversas
        </button>

        {/* PRO toggle — Lucy e GLaDOS */}
        {hasPro && (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={onTogglePro}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 800,
                fontSize: 12, letterSpacing: '0.08em', cursor: 'pointer',
                border: `1.5px solid ${showPro ? '#f59e0b' : 'var(--border)'}`,
                background: showPro ? 'rgba(245,158,11,0.1)' : 'var(--surface2)',
                color: showPro ? '#d97706' : 'var(--text-muted)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {showPro ? '✦ PRO · aba privada' : '🔒 Entrar em Pro'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Histórico de sessões dentro do painel esquerdo ───────────────────────────

function SessionHistoryPanel({ onSelect, onBack, personaId, isPro }) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    const params = new URLSearchParams()
    if (personaId) params.set('persona_id', personaId)
    // vanilla vê APENAS is_pro=0; pro vê tudo misturado (marca os pro a dourado)
    if (!isPro) params.set('is_pro', '0')
    fetch(`/api/sessions?${params}`).then(r => r.json()).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }, [personaId, isPro])

  function fmt(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 86400000) return d.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return d.toLocaleDateString('pt', { weekday: 'short' })
    return d.toLocaleDateString('pt', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Conversas</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 && (
          <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>Sem conversas ainda.</div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{ padding: '10px 16px', borderBottom: `1px solid ${s.is_pro ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: s.is_pro ? 'rgba(245,158,11,0.03)' : 'none' }}
            onMouseEnter={e => e.currentTarget.style.background = s.is_pro ? 'rgba(245,158,11,0.08)' : 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = s.is_pro ? 'rgba(245,158,11,0.03)' : 'none'}
          >
            {s.is_pro && (
              <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 5px', borderRadius: 5, background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', flexShrink: 0 }}>PRO</span>
            )}
            <span style={{ fontSize: 13, color: s.is_pro ? '#d97706' : 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.title || `Conversa ${s.id}`}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{fmt(s.updated_at || s.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sidebar de contactos do chat ─────────────────────────────────────────────

function ChatContactsSidebar({ personas, activePersona, pro, onTogglePro, onSelectSession, onSelectPersona }) {
  const [view, setView] = useState('contacts') // 'contacts' | 'profile' | 'history'
  const [viewing, setViewing] = useState(null)
  const [stats, setStats] = useState({ memorias: 0, interesses: 0, sessoes: 0 })

  const visiblePersonas = personas.filter(p => p.enabled !== false)

  useEffect(() => {
    if (view !== 'profile' || !viewing) return
    Promise.all([
      fetch('/api/memory/count').then(r => r.json()).catch(() => ({ count: 0 })),
      fetch('/api/interests').then(r => r.json()).catch(() => []),
      fetch('/api/sessions').then(r => r.json()).catch(() => []),
    ]).then(([mem, interests, sessions]) => {
      setStats({
        memorias: mem.count ?? 0,
        interesses: Array.isArray(interests) ? interests.length : 0,
        sessoes: Array.isArray(sessions) ? sessions.length : 0,
      })
    })
  }, [view, viewing])

  if (view === 'history') {
    return (
      <SessionHistoryPanel
        onSelect={id => { onSelectSession(id); setView('profile') }}
        onBack={() => setView('profile')}
        personaId={viewing?.id}
        isPro={pro}
      />
    )
  }

  if (view === 'contacts') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Contactos</span>
        </div>
        <PersonaContactList
          personas={visiblePersonas}
          selectedId={viewing?.id}
          onSelect={p => { setViewing(p); setView('profile'); onSelectPersona?.(p) }}
          pro={pro}
        />
      </div>
    )
  }

  // Profile view (default)
  if (!viewing) return null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top nav */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => setView('contacts')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
          ‹ Contactos
        </button>
        {visiblePersonas.length > 1 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {visiblePersonas.map(p => {
              const isLucy = p.id === 'lucy'
              const showPro = isLucy && pro
              const isActive = p.id === viewing.id
              return (
                <button
                  key={p.id}
                  onClick={() => { setViewing(p); onSelectPersona?.(p) }}
                  title={p.name}
                  style={{
                    width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', padding: 0, border: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    outline: showPro && isActive ? '2px solid #f59e0b' : 'none', outlineOffset: 1,
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <img src={p.avatar_url || '/animations/idle.webp'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ContactProfile
        persona={viewing}
        pro={pro}
        onTogglePro={onTogglePro}
        onStartChat={() => { onSelectPersona?.(viewing); setView('history') }}
        onBack={() => setView('contacts')}
        stats={stats}
      />
    </div>
  )
}

// ── HISTORY page ─────────────────────────────────────────────────────────────

function HistoryPage({ sessionId, onSelect, onNew, sidebarKey }) {
  const [personas, setPersonas] = useState([])
  const [selectedPersona, setSelectedPersona] = useState(null)

  useEffect(() => {
    fetch('/api/personas')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        setPersonas(list)
        if (list.length > 0) setSelectedPersona(list[0])
      })
      .catch(() => {})
  }, [])

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      gap: 12,
      padding: 16,
      background: 'var(--surface2)',
      overflow: 'hidden',
    }}>

      {/* ── Col 1 (2/6): Histórico de sessões ── */}
      <QuadrantCard
        header={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selectedPersona && (
                <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', flexShrink: 0 }}>
                  <img src={selectedPersona.avatar_url || '/animations/idle.webp'} alt={selectedPersona.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
              )}
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {selectedPersona?.name ?? 'Histórico'}
              </span>
            </div>
            <button onClick={onNew} style={{ padding: '4px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-soft)', fontSize: 12, cursor: 'pointer' }}>
              + Nova
            </button>
          </div>
        }
        style={{ flex: 2 }}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8, background: 'var(--surface2)', fontSize: 12, color: 'var(--text-muted)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <span style={{ opacity: 0.5 }}>Pesquisar…</span>
          </div>
        </div>
        <SessionSidebar
          key={`sidebar-${sidebarKey}-${selectedPersona?.id}`}
          sessionId={sessionId}
          onSelect={onSelect}
          onNew={onNew}
          embedded
        />
      </QuadrantCard>

      {/* ── Col 2 (2/6): Lista de personas — estilo WhatsApp ── */}
      <QuadrantCard stat={personas.length} label="personas" style={{ flex: 2 }}>
        <PersonaContactList
          personas={personas}
          selectedId={selectedPersona?.id}
          onSelect={p => setSelectedPersona(p)}
        />
      </QuadrantCard>

      {/* ── Col 3 (2/6): Perfil da persona — galeria + especialidades + interesses ── */}
      <QuadrantCard
        header={
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {selectedPersona ? `Perfil · ${selectedPersona.name}` : 'Perfil'}
          </div>
        }
        style={{ flex: 2 }}
      >
        {selectedPersona ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Foto principal */}
            <div style={{ position: 'relative', height: 160, background: 'var(--surface2)', flexShrink: 0 }}>
              <img
                src={selectedPersona.avatar_url || '/animations/idle.webp'}
                alt={selectedPersona.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)',
              }} />
              <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selectedPersona.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: selectedPersona.enabled !== false ? 'var(--accent)' : '#dc2626', display: 'inline-block' }} />
                  {selectedPersona.enabled !== false ? 'disponível' : 'desactivado'}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Galeria de fotos — placeholder */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Galeria
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{
                      aspectRatio: '1',
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {i === 1 ? (
                        <img src={selectedPersona.avatar_url || '/animations/idle.webp'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Especialidades — derivadas do modelo por defeito */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Especialidades
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    selectedPersona.defaults?.model ?? 'modelo desconhecido',
                    selectedPersona.defaults?.language === 'pt' ? 'Português' : 'English',
                    'Chat',
                  ].map(tag => (
                    <span key={tag} style={{
                      padding: '4px 10px',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      fontSize: 12,
                      color: 'var(--text-soft)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Interesses */}
              {(selectedPersona.interests?.length > 0) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Interesses
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedPersona.interests.map(interest => (
                      <span key={interest} style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: 'rgba(0,168,132,0.07)',
                        border: '1px solid rgba(0,168,132,0.2)',
                        fontSize: 12,
                        color: 'var(--accent)',
                      }}>
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Selecciona uma persona
          </div>
        )}
      </QuadrantCard>

    </div>
  )
}

// ── CHAT page ────────────────────────────────────────────────────────────────

function ChatPage({
  model, setModel,
  thinkingMode, setThinkingMode,
  language,
  voiceUuid, setVoiceUuid,
  persona,
  sessionId,
  chatKey,
  onAnimation,
  onSessionCreated,
  pro, onProClick,
  onGoToMessages,
  rightOpen, onToggleRight,
  contactSelected,
  onClearChat,
}) {
  const [availableVoices, setAvailableVoices] = useState([])

  useEffect(() => {
    fetch('/api/voices').then(r => r.json()).then(d => setAvailableVoices(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function toggleVoice() {
    if (voiceUuid) {
      setVoiceUuid(null)
    } else {
      setVoiceUuid(availableVoices[0]?.uuid ?? 'default')
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--surface2)' }}>
      {/* Header */}
      <div style={{
        padding: '9px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface)',
        flexShrink: 0,
        gap: 10,
      }}>
        {/* Esquerda: persona (clica → vai para mensagens) */}
        <button
          onClick={onGoToMessages}
          title="Ir para mensagens"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px 4px 0',
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {persona.avatar_url && (
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', flexShrink: 0 }}>
              <img src={persona.avatar_url} alt={persona.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{persona.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sessionId ? 'Sessão activa' : 'Nova conversa'}</div>
          </div>
        </button>

        {/* Direita: voz + modelo + Pro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Toggle voz — minimalista */}
          <button
            onClick={toggleVoice}
            title={voiceUuid ? 'Desligar voz' : 'Ligar voz'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${voiceUuid ? 'var(--accent)' : 'var(--border)'}`,
              background: voiceUuid ? 'rgba(0,168,132,0.08)' : 'none',
              color: voiceUuid ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
            </svg>
          </button>

          {/* Selector de modelo */}
          <ModelSelector
            model={model}
            onChange={setModel}
            thinkingMode={thinkingMode}
            onReasoningChange={setThinkingMode}
          />

          {/* Limpar chat */}
          <button
            onClick={onClearChat}
            title="Limpar conversa"
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.12s' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>

          {/* Toggle painel direito */}
          <button
            onClick={onToggleRight}
            title={rightOpen ? 'Fechar memórias' : 'Abrir memórias'}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${rightOpen ? 'var(--accent)' : 'var(--border)'}`,
              background: rightOpen ? 'rgba(0,168,132,0.08)' : 'none',
              color: rightOpen ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="16" y1="3" x2="16" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {contactSelected ? (
        <ChatView
          key={`chat-${chatKey}`}
          model={model}
          thinkingMode={thinkingMode}
          language={language}
          voiceUuid={voiceUuid}
          onAnimation={onAnimation}
          sessionId={sessionId}
          onSessionCreated={onSessionCreated}
          pro={pro}
          personaId={persona?.id}
          personaEnabled={persona?.enabled !== false}
          personaName={persona?.name}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--text-muted)', background: 'var(--surface2)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Selecciona um contacto</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Escolhe com quem queres conversar</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MIND page ────────────────────────────────────────────────────────────────

// Gera nós e ligações do grafo para uma persona
// Gera nós e links a partir de tópicos aprendidos (do LanceDB)
// Reordena tópicos para que os conectados fiquem adjacentes no anel (reduz cruzamentos)
function reorderByConnectivity(topics, edges) {
  if (topics.length < 3 || edges.length === 0) return topics
  const adj = {}
  topics.forEach(t => { adj[t] = {} })
  edges.forEach(e => {
    if (adj[e.topic_a] !== undefined && adj[e.topic_b] !== undefined) {
      adj[e.topic_a][e.topic_b] = e.weight
      adj[e.topic_b][e.topic_a] = e.weight
    }
  })
  const ordered = [topics[0]]
  const remaining = new Set(topics.slice(1))
  while (remaining.size > 0) {
    const last = ordered[ordered.length - 1]
    let bestNext = null, bestScore = -1
    for (const t of remaining) {
      const score = adj[last]?.[t] || 0
      if (score > bestScore) { bestScore = score; bestNext = t }
    }
    if (!bestNext) bestNext = remaining.values().next().value
    ordered.push(bestNext)
    remaining.delete(bestNext)
  }
  return ordered
}

function buildLiveGraph(persona, learnedTopics, topicEdges = []) {
  const cx = 50, cy = 50
  const COLORS_STRONG = ['#00a884', '#059669', '#16a34a', '#0d9488', '#0284c7', '#7c3aed', '#db2777', '#ea580c']
  const COLORS_WEAK   = ['#6ee7b7', '#a7f3d0', '#99f6e4', '#bae6fd', '#ddd6fe', '#fbcfe8', '#fed7aa', '#fde68a']

  const fixedInterests = persona?.interests || []
  const learnedMap = Object.fromEntries(learnedTopics.map(t => [t.interest, t]))
  const activeLearned = learnedTopics.filter(t => (t.strength || 1) >= 0.3)
  const allTopics = [...new Set([...fixedInterests, ...activeLearned.map(t => t.interest)])]

  if (allTopics.length === 0) {
    return { nodes: [{ id: '__persona__', label: persona?.name || '?', x: cx, y: cy, r: 16, color: '#00a884', central: true }], links: [] }
  }

  const maxStrength = Math.max(1, ...learnedTopics.map(t => t.strength || 1))

  // Separa tópicos fortes (anel interior) e fracos (anel exterior)
  const strong = allTopics.filter(t => {
    const s = learnedMap[t]?.strength || 0
    return fixedInterests.includes(t) || s >= 2.0
  })
  const weak = allTopics.filter(t => !strong.includes(t))

  // Reordena cada anel por conectividade
  const orderedStrong = reorderByConnectivity(strong, topicEdges)
  const orderedWeak   = reorderByConnectivity(weak,   topicEdges)

  const R_INNER = strong.length <= 6 ? 28 : 32
  const R_OUTER = weak.length <= 6 ? 40 : 44

  const nodes = [{ id: '__persona__', label: persona?.name || '?', x: cx, y: cy, r: 16, color: '#00a884', central: true }]

  orderedStrong.forEach((topic, i) => {
    const angle = (2 * Math.PI * i) / orderedStrong.length - Math.PI / 2
    const topicData = learnedMap[topic]
    const strength = topicData?.strength || 0
    const isFixed = fixedInterests.includes(topic)
    const r = strength > 0 ? Math.min(13, 7 + Math.round((strength / maxStrength) * 6)) : 9
    nodes.push({
      id: `s_${i}`, label: topic,
      x: cx + R_INNER * Math.cos(angle),
      y: cy + R_INNER * Math.sin(angle),
      r, color: COLORS_STRONG[i % COLORS_STRONG.length],
      strength, factCount: topicData?.count || 0,
      isFixed, isWeak: false, ring: 'inner',
    })
  })

  orderedWeak.forEach((topic, i) => {
    const angle = (2 * Math.PI * i) / orderedWeak.length - Math.PI / 2
    const topicData = learnedMap[topic]
    const strength = topicData?.strength || 0
    const isWeak = strength > 0 && strength < 1.5
    const r = strength > 0 ? Math.min(10, 5 + Math.round((strength / maxStrength) * 5)) : 6
    nodes.push({
      id: `w_${i}`, label: topic,
      x: cx + R_OUTER * Math.cos(angle),
      y: cy + R_OUTER * Math.sin(angle),
      r, color: COLORS_WEAK[i % COLORS_WEAK.length],
      strength, factCount: topicData?.count || 0,
      isFixed: fixedInterests.includes(topic), isWeak, ring: 'outer',
    })
  })

  // Linhas do centro apenas para nós do anel interno; externas ligam ao nó interno mais próximo
  const links = []
  nodes.filter(n => n.ring === 'inner').forEach(n => links.push(['__persona__', n.id]))
  nodes.filter(n => n.ring === 'outer').forEach(on => {
    // liga ao nó interno mais próximo (por ângulo)
    const innerNodes = nodes.filter(n => n.ring === 'inner')
    if (innerNodes.length > 0) {
      const closest = innerNodes.reduce((best, n) => {
        const d = Math.hypot(n.x - on.x, n.y - on.y)
        return d < best.d ? { n, d } : best
      }, { n: innerNodes[0], d: Infinity })
      links.push([closest.n.id, on.id])
    } else {
      links.push(['__persona__', on.id])
    }
  })

  return { nodes, links }
}

// Grafo SVG com dados reais do LanceDB
function PersonaGraph({ persona, selectedNode, onSelectNode }) {
  const svgRef = useRef(null)
  const [dims, setDims] = useState({ w: 400, h: 400 })
  const [learnedTopics, setLearnedTopics] = useState([])
  const [topicEdges, setTopicEdges] = useState([])
  const [zoom, setZoom] = useState({ x: 0, y: 0, scale: 1 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!persona?.id) return
    function fetchTopics() {
      fetch(`/api/topics/${persona.id}`)
        .then(r => r.json())
        .then(d => setLearnedTopics(Array.isArray(d) ? d.map(t => ({
          interest: t.topic, topic: t.topic,
          count: t.research_count || 1,
          strength: t.strength || 1,
          lastCycle: t.last_cycle || 0,
          parent_topic: t.parent_topic || null,
          origin_interest: t.origin_interest || null,
        })) : []))
        .catch(() => {})
    }
    function fetchEdges() {
      fetch(`/api/topic-edges/${persona.id}`)
        .then(r => r.json())
        .then(d => setTopicEdges(Array.isArray(d) ? d : []))
        .catch(() => {})
    }
    // computa arestas semanticamente quando a persona muda (sem LLM)
    function computeEdges() {
      fetch(`/api/topic-edges/${persona.id}/compute`, { method: 'POST' })
        .then(r => r.json())
        .then(d => setTopicEdges(Array.isArray(d) ? d : []))
        .catch(() => {})
    }
    fetchTopics()
    fetchEdges()
    // computa após pequeno delay (dá tempo aos tópicos de carregar)
    const computeTimer = setTimeout(computeEdges, 1500)
    const id = setInterval(fetchTopics, 10000)
    return () => { clearInterval(id); clearTimeout(computeTimer) }
  }, [persona?.id])

  useEffect(() => {
    function upd() { if (svgRef.current) { const r = svgRef.current.getBoundingClientRect(); setDims({ w: r.width || 400, h: r.height || 400 }) } }
    upd()
    const obs = new ResizeObserver(upd)
    if (svgRef.current) obs.observe(svgRef.current)
    return () => obs.disconnect()
  }, [])

  const { nodes, links } = buildLiveGraph(persona, learnedTopics, topicEdges)
  const px = (pct) => (pct / 100) * dims.w
  const py = (pct) => (pct / 100) * dims.h
  const totalFacts = learnedTopics.reduce((s, t) => s + t.count, 0)

  function handleWheel(e) {
    e.preventDefault()
    const rect = svgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    setZoom(z => {
      const newScale = Math.max(0.25, Math.min(6, z.scale * factor))
      return {
        scale: newScale,
        x: mx - (mx - z.x) * (newScale / z.scale),
        y: my - (my - z.y) * (newScale / z.scale),
      }
    })
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return
    isPanning.current = true
    panStart.current = { x: e.clientX - zoom.x, y: e.clientY - zoom.y }
  }

  function handleMouseMove(e) {
    if (!isPanning.current) return
    setZoom(z => ({ ...z, x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y }))
  }

  function handleMouseUp() { isPanning.current = false }

  return (
    <svg
      ref={svgRef} width="100%" height="100%" style={{ display: 'block', flex: 1, cursor: isPanning.current ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <text x={8} y={16} fontSize={9} fill="#9ca3af">
        ● anel interno = forte/fixo  ○ anel externo = descoberto  — linha roxa = relacionado ({totalFacts} factos) · scroll = zoom · arrastar = mover
      </text>

      <g transform={`translate(${zoom.x},${zoom.y}) scale(${zoom.scale})`}>

      {/* Linhas estruturais (centro→nó, nó→nó hierárquico) */}
      {links.map(([a, b], i) => {
        const na = nodes.find(n => n.id === a)
        const nb = nodes.find(n => n.id === b)
        if (!na || !nb) return null
        const isToCenter = a === '__persona__' || b === '__persona__'
        return <line key={i} x1={px(na.x)} y1={py(na.y)} x2={px(nb.x)} y2={py(nb.y)}
          stroke={isToCenter ? '#c8e6d8' : '#e5e7eb'} strokeWidth={isToCenter ? 1.5 : 0.8} strokeOpacity={isToCenter ? 0.7 : 0.5} />
      })}

      {/* Arestas semânticas (relações reais entre tópicos) */}
      {topicEdges.map((edge, i) => {
        const na = nodes.find(n => n.label === edge.topic_a)
        const nb = nodes.find(n => n.label === edge.topic_b)
        if (!na || !nb) return null
        const w = Math.max(0.3, Math.min(3, edge.weight * 4))
        const opacity = 0.15 + edge.weight * 0.45
        return <line key={`sem-${i}`} x1={px(na.x)} y1={py(na.y)} x2={px(nb.x)} y2={py(nb.y)}
          stroke="#7c3aed" strokeWidth={w} strokeOpacity={opacity} strokeLinecap="round" />
      })}

      {nodes.map(node => {
        const cx = px(node.x), cy = py(node.y)
        const isSel = selectedNode?.id === node.id
        const col = node.color.startsWith('var') ? '#00a884' : node.color
        const opacity = node.isWeak ? 0.4 : 1  // nós fracos quase transparentes
        return (
          <g key={node.id} onClick={() => onSelectNode(node)} style={{ cursor: 'pointer', opacity }}>
            {(node.central || isSel) && <circle cx={cx} cy={cy} r={node.r + 6} fill={col} fillOpacity={0.15} />}
            {/* Anel tracejado para nós fracos */}
            {node.isWeak && !node.central && (
              <circle cx={cx} cy={cy} r={node.r + 4} fill="none" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="3,3" />
            )}
            {/* Anel para nós com síntese/descoberta */}
            {!node.central && node.strength > 3 && !node.isFixed && (
              <circle cx={cx} cy={cy} r={node.r + 3} fill="none" stroke={col} strokeWidth={1} strokeOpacity={0.4} strokeDasharray="2,2" />
            )}
            <circle cx={cx} cy={cy} r={node.r} fill={isSel ? '#fff' : col} stroke={col} strokeWidth={isSel ? 2.5 : node.isFixed ? 1.5 : 0} />
            {node.central && (
              <image href={persona?.avatar_url || '/animations/idle.webp'} x={cx - node.r} y={cy - node.r} width={node.r * 2} height={node.r * 2} style={{ clipPath: `circle(${node.r}px at ${node.r}px ${node.r}px)` }} />
            )}
            <text x={cx} y={cy + node.r + 12} textAnchor="middle" fontSize={node.central ? 11 : 9} fontWeight={node.central ? 700 : (node.strength > 0 ? 600 : 400)} fill={node.isWeak ? '#ef4444' : '#374151'} style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {node.label}
            </text>
            {node.strength > 0 && (
              <text x={cx} y={cy + node.r + 22} textAnchor="middle" fontSize={8} fill={node.isWeak ? '#ef4444' : '#9ca3af'} style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {node.isWeak ? '⚠ fraco' : `força ${node.strength.toFixed(1)}`}
              </text>
            )}
          </g>
        )
      })}

      </g>{/* fim do grupo zoom/pan */}
    </svg>
  )
}

function MindPage({ model, language, darkMode }) {
  const [personas, setPersonas] = useState([])
  const [activePersona, setActivePersona] = useState(null)
  const [activeModel, setActiveModel] = useState(model)
  const [selectedNode, setSelectedNode] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [defragging, setDefragging] = useState(false)
  const [defragResult, setDefragResult] = useState(null)
  const [defragStatus, setDefragStatus] = useState(null)
  const [use3D, setUse3D] = useState(true)
  const [graphDims, setGraphDims] = useState({ w: 600, h: 500 })
  const [learnedTopics3D, setLearnedTopics3D] = useState([])
  const [topicEdges3D, setTopicEdges3D] = useState([])
  const graphContainerRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch('/api/personas').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.filter(p => p.enabled !== false) : []
      setPersonas(list)
      if (list.length > 0) selectPersona(list[0])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function selectPersona(p) {
    setActivePersona(p)
    setSelectedNode(null)
    setLearnedTopics3D([])
    setTopicEdges3D([])
    setMessages([
      { role: 'assistant', content: `Bem-vindo à minha mente. Este grafo mostra os meus interesses e o que aprendo.` },
      { role: 'assistant', content: `Clica num nó para explorar, ou faz-me uma pergunta sobre o meu conhecimento.` },
    ])
    fetch('/api/persona/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: p.id }),
    }).catch(() => {})
    try {
      const { loaded = [] } = await fetch('/api/lm-models').then(r => r.json())
      const wanted = p.defaults?.model
      setActiveModel(wanted && loaded.includes(wanted) ? wanted : (loaded[0] || model))
    } catch { setActiveModel(p.defaults?.model || model) }
    // carrega tópicos e arestas para o grafo 3D
    try {
      const topics = await fetch(`/api/topics/${p.id}`).then(r => r.json())
      setLearnedTopics3D(Array.isArray(topics) ? topics.map(t => ({
        interest: t.topic, topic: t.topic, count: t.research_count || 1, strength: t.strength || 1,
        parent_topic: t.parent_topic || null, origin_interest: t.origin_interest || null,
      })) : [])
    } catch {}
    try {
      const edges = await fetch(`/api/topic-edges/${p.id}`).then(r => r.json())
      setTopicEdges3D(Array.isArray(edges) ? edges : [])
      // se não há arestas, computa semanticamente
      if (!Array.isArray(edges) || edges.length === 0) {
        const computed = await fetch(`/api/topic-edges/${p.id}/compute`, { method: 'POST' }).then(r => r.json())
        setTopicEdges3D(Array.isArray(computed) ? computed : [])
      }
    } catch {}
    // estado do guard de defrag
    fetch(`/api/defrag/${p.id}/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.cooldown_remaining_h === 'number') setDefragStatus(d) })
      .catch(() => {})
  }

  async function handleSelectNode(node) {
    setSelectedNode(node)
    if (node.central) return

    // gera resumo automático no chat ao clicar num nó
    if (!activePersona?.id || node.factCount === 0) {
      setInputText(`O que sabes sobre "${node.label}"?`)
      return
    }

    setLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])
    try {
      const topic = encodeURIComponent(node.label)
      const d = await fetch(`/api/topics/${activePersona.id}/${topic}/summary`).then(r => r.json())
      setMessages(prev => {
        const u = [...prev]
        u[u.length - 1] = { ...u[u.length - 1], content: d.summary || 'Sem resumo disponível.', streaming: false }
        return u
      })
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: 'Erro ao gerar resumo.', streaming: false }; return u })
    }
    setLoading(false)
  }

  // mede o container do grafo para passar width/height exactos ao ForceGraph3D
  useEffect(() => {
    if (!graphContainerRef.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setGraphDims({ w: Math.floor(width), h: Math.floor(height) })
    })
    obs.observe(graphContainerRef.current)
    const r = graphContainerRef.current.getBoundingClientRect()
    setGraphDims({ w: Math.floor(r.width) || 600, h: Math.floor(r.height) || 500 })
    return () => obs.disconnect()
  }, [])

  async function handleDefrag(force = false) {
    if (!activePersona?.id || defragging) return
    setDefragging(true)
    setDefragResult(null)
    try {
      const url = `/api/defrag/${activePersona.id}${force ? '?force=true' : ''}`
      const r = await fetch(url, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) {
        setDefragResult({ error: d.detail || 'Erro ao desfragmentar' })
      } else {
        setDefragResult(d)
        // actualiza o status do guard após defrag
        fetch(`/api/defrag/${activePersona.id}/status`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d && typeof d.cooldown_remaining_h === 'number') setDefragStatus(d) })
          .catch(() => {})
      }
    } catch {
      setDefragResult({ error: 'Erro ao desfragmentar' })
    }
    setDefragging(false)
  }

  async function sendMessage() {
    const text = inputText.trim()
    if (!text || loading) return
    setInputText('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model: activeModel,
          language: activePersona?.defaults?.language || language,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          thinking_mode: 'off',
          persona_id: activePersona?.id || null,
        }),
      })
      if (!response.ok) throw new Error()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const chunk = JSON.parse(raw)
            if (chunk.text) setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: u[u.length - 1].content + chunk.text }; return u })
          } catch {}
        }
      }
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], content: 'Erro. Tenta novamente.' }; return u })
    } finally {
      setMessages(prev => { const u = [...prev]; if (u[u.length - 1]?.streaming) u[u.length - 1] = { ...u[u.length - 1], streaming: false }; return u })
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--surface2)' }}>

      {/* ── PAINEL 1: Lista de personas ── */}
      <div style={{ flex: 2, minWidth: 180, maxWidth: 280, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Personas</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {personas.map(p => {
            const isSel = p.id === activePersona?.id
            return (
              <div
                key={p.id}
                onClick={() => selectPersona(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isSel ? 'rgba(0,168,132,0.05)' : 'none', borderLeft: `3px solid ${isSel ? 'var(--accent)' : 'transparent'}`, borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${isSel ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                  <img src={p.avatar_url || '/animations/idle.webp'} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                    {(p.interests || []).slice(0, 2).join(' · ') || 'Sem interesses'}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(p.interests || []).length} nós</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PAINEL 2: Grafo por persona ── */}
      <div style={{ flex: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--mind-bg)' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
            Mente · {activePersona?.name || '—'}
          </span>
          {/* Feedback pós-defrag */}
          {defragResult && !defragResult.error && (
            <span style={{ fontSize: 10, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '2px 8px', borderRadius: 8 }}>
              ✓ {defragResult.topics_processed} tópicos · -{defragResult.contradictions_removed} factos
            </span>
          )}
          {defragResult?.error && (
            <span style={{ fontSize: 10, color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '2px 8px', borderRadius: 8 }}>
              ✗ {defragResult.error}
            </span>
          )}
          {/* Botão Defrag com guard */}
          {(() => {
            const blocked = defragStatus && !defragStatus.should_defrag
            const inCooldown = defragStatus && !defragStatus.cooldown_ok
            const lowScore = defragStatus && defragStatus.cooldown_ok && !defragStatus.score_ok
            const tooltip = inCooldown
              ? `Cooldown activo — último defrag há ${defragStatus.cooldown_remaining_h}h`
              : lowScore
              ? `Fragmentação baixa (${Math.round((defragStatus.frag_ratio || 0) * 100)}% dos tópicos). Conhecimento já consolidado.`
              : 'Consolida factos e recalcula arestas (requer Deep Mind)'
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleDefrag(false)}
                  disabled={defragging || !activePersona || blocked}
                  title={tooltip}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 8,
                    border: `1px solid ${blocked ? 'var(--border)' : '#7c3aed22'}`,
                    background: blocked ? 'var(--surface2)' : 'none',
                    color: defragging ? 'var(--text-muted)' : blocked ? 'var(--text-muted)' : '#7c3aed',
                    cursor: defragging || blocked ? 'default' : 'pointer',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {defragging ? '⏳' : blocked ? '🔒' : '⚙'}
                  {defragging ? 'A desfragmentar…'
                    : inCooldown ? `Defrag (${defragStatus.cooldown_remaining_h}h)`
                    : lowScore ? `Defrag (${Math.round((defragStatus?.frag_ratio || 0) * 100)}%)`
                    : 'Defrag'}
                </button>
                {/* Força o defrag mesmo com guard activo */}
                {blocked && !defragging && (
                  <button
                    onClick={() => handleDefrag(true)}
                    title="Forçar defrag ignorando guard"
                    style={{ fontSize: 9, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    forçar
                  </button>
                )}
              </div>
            )
          })()}

          {/* Toggle 2D / 3D */}
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {['2D', '3D'].map(mode => (
              <button
                key={mode}
                onClick={() => setUse3D(mode === '3D')}
                style={{
                  padding: '4px 10px', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: (use3D ? '3D' : '2D') === mode ? 'var(--accent)' : 'none',
                  color: (use3D ? '3D' : '2D') === mode ? '#fff' : 'var(--text-muted)',
                  transition: 'background 0.15s',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div ref={graphContainerRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
          {activePersona && use3D && (
            <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>A carregar grafo 3D…</div>}>
              <MindGraph3D
                persona={activePersona}
                learnedTopics={learnedTopics3D}
                topicEdges={topicEdges3D}
                selectedNode={selectedNode}
                onSelectNode={handleSelectNode}
                width={graphDims.w}
                height={graphDims.h}
                darkMode={darkMode}
              />
            </Suspense>
          )}
          {activePersona && !use3D && (
            <div style={{ flex: 1, padding: 8, display: 'flex' }}>
              <PersonaGraph persona={activePersona} selectedNode={selectedNode} onSelectNode={handleSelectNode} />
            </div>
          )}
        </div>
        {selectedNode && !selectedNode.central && (
          <div style={{ padding: '10px 16px', borderTop: `2px solid ${selectedNode.isEmergent ? '#f59e0b' : 'var(--border)'}`, background: selectedNode.isEmergent ? 'rgba(245,158,11,0.08)' : 'var(--panel-bg)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: selectedNode.color || '#00a884', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{selectedNode.label}</span>
              {selectedNode.isEmergent && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706', letterSpacing: '0.06em', textTransform: 'uppercase' }}>★ interesse emergente — pode tornar-se um novo root</span>
              )}
            </div>
            {selectedNode.factCount > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedNode.factCount} factos</span>
            )}
            <button
              onClick={async () => {
                if (!window.confirm(`Apagar o nó "${selectedNode.label}" e todos os seus ${selectedNode.factCount || 0} factos?`)) return
                const topic = encodeURIComponent(selectedNode.label)
                await fetch(`/api/memories/topic/${activePersona?.id}/${topic}`, { method: 'DELETE' })
                setSelectedNode(null)
              }}
              title="Apagar nó e todos os factos"
              style={{ marginLeft: 'auto', background: 'none', border: '1px solid #fee2e2', borderRadius: 6, cursor: 'pointer', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              apagar
            </button>
            <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>✕</button>
          </div>
        )}
      </div>

      {/* ── PAINEL 3: Chat com a persona ── */}
      <div style={{ flex: 2, minWidth: 220, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          {activePersona && (
            <div style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent)', flexShrink: 0 }}>
              <img src={activePersona.avatar_url} alt={activePersona.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{activePersona?.name || 'Mente'}</div>
            <div style={{ fontSize: 10, color: 'var(--accent)' }}>● a explorar</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '85%', padding: '8px 11px', borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px', background: isUser ? 'var(--user-bubble)' : 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                  {msg.streaming && <span style={{ display: 'inline-block', width: 5, height: 10, background: 'var(--accent)', marginLeft: 2, borderRadius: 1, animation: 'blink 1s step-end infinite' }} />}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 10px' }}>
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendMessage() } }}
              disabled={loading}
              placeholder="Pergunta sobre a minha mente…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit' }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || loading}
              style={{ width: 28, height: 28, borderRadius: '50%', background: inputText.trim() && !loading ? 'var(--accent)' : 'var(--border)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() && !loading ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}
            >
              {loading ? '…' : '↑'}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── PIN Modal (Pro) ──────────────────────────────────────────────────────────

const PRO_PIN = import.meta.env.VITE_PRO_PIN || '1213'

function PinModal({ onSuccess, onCancel }) {
  const [digits, setDigits] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState(false)

  function press(d) {
    if (digits.length >= 4) return
    const next = digits + d
    setDigits(next)
    if (next.length === 4) {
      if (next === PRO_PIN) {
        setTimeout(onSuccess, 200)
      } else {
        setShake(true)
        setError(true)
        setTimeout(() => {
          setDigits('')
          setShake(false)
          setError(false)
        }, 600)
      }
    }
  }

  function del() {
    setDigits(d => d.slice(0, -1))
  }

  const PAD = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    [null,'0','⌫'],
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: '#1c1c1e',
        borderRadius: 24,
        padding: '36px 32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
        minWidth: 280,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Título */}
        <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Modo Pro</div>
        <div style={{ fontSize: 13, color: '#8e8e93', marginTop: -20 }}>Introduz o PIN</div>

        {/* Dots */}
        <div style={{
          display: 'flex',
          gap: 18,
          animation: shake ? 'shake 0.5s ease' : 'none',
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: `2px solid ${error ? '#ff3b30' : '#636366'}`,
              background: i < digits.length ? (error ? '#ff3b30' : '#fff') : 'transparent',
              transition: 'background 0.12s',
            }} />
          ))}
        </div>

        {/* Pad numérico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {PAD.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              {row.map((key, ki) => key === null ? (
                <div key={ki} style={{ width: 72, height: 72 }} />
              ) : (
                <button
                  key={ki}
                  onClick={() => key === '⌫' ? del() : press(key)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    border: 'none',
                    background: key === '⌫' ? 'transparent' : '#2c2c2e',
                    color: '#fff',
                    fontSize: key === '⌫' ? 20 : 26,
                    fontWeight: 400,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseDown={e => e.currentTarget.style.background = key === '⌫' ? 'rgba(255,255,255,0.08)' : '#3a3a3c'}
                  onMouseUp={e => e.currentTarget.style.background = key === '⌫' ? 'transparent' : '#2c2c2e'}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Cancelar */}
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: '#636366', fontSize: 14, cursor: 'pointer', marginTop: -10 }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── SETTINGS page ────────────────────────────────────────────────────────────

// ── LEARN page ───────────────────────────────────────────────────────────────

function LearnPage() {
  const [personas, setPersonas] = useState([])
  const [enabled, setEnabled] = useState({})
  const [interval, setIntervalMin] = useState(2)
  const [maxCycles, setMaxCycles] = useState('')
  const [status, setStatus] = useState({ running: false, current: null, timeline: [] })
  const [tab, setTab] = useState('feed')
  const [history, setHistory] = useState([])
  const pollRef = useRef(null)

  // Deep Mind state
  const [deepMind, setDeepMind] = useState(false)
  const [anyReasoningLoaded, setAnyReasoningLoaded] = useState(false)
  const [autoSynth, setAutoSynth] = useState(false)
  const [autoSynthCycles, setAutoSynthCycles] = useState(10)
  const [synthesizing, setSynthesizing] = useState(false)

  useEffect(() => {
    fetch('/api/personas').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d.filter(p => p.enabled !== false) : []
      setPersonas(list)
      const init = {}
      list.forEach(p => { init[p.id] = true })
      setEnabled(init)
    }).catch(() => {})
    fetchStatus()
    checkLoadedIds()
  }, [])

  async function checkLoadedIds() {
    try {
      const d = await fetch('/api/reasoning-models').then(r => r.json())
      setAnyReasoningLoaded(Array.isArray(d) && d.some(m => m.loaded))
    } catch {}
  }

  async function saveDmConfig(overrides = {}) {
    const config = {
      enabled: overrides.enabled ?? deepMind,
      reasoning_models: [],  // geridos pelo sistema
      auto_synth: overrides.auto_synth ?? autoSynth,
      auto_synth_cycles: overrides.auto_synth_cycles ?? autoSynthCycles,
    }
    for (const p of personas) {
      await fetch(`/api/deep-mind/config/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).catch(() => {})
    }
  }

  async function handleSynthesize() {
    setSynthesizing(true)
    const active = personas.filter(p => enabled[p.id])
    for (const p of active) {
      await fetch(`/api/synthesize/${p.id}`, { method: 'POST' }).catch(() => {})
    }
    setSynthesizing(false)
    fetchStatus()
  }

  async function fetchStatus() {
    try {
      const d = await fetch('/api/autolearn/status').then(r => r.json())
      setStatus(d)
      if (d.enabled && Object.keys(d.enabled).length > 0) setEnabled(d.enabled)
      if (d.interval) setIntervalMin(Math.round(d.interval / 60))
    } catch {}
  }

  async function fetchHistory() {
    try {
      const d = await fetch('/api/autolearn/history').then(r => r.json())
      setHistory(Array.isArray(d) ? d : [])
    } catch {}
  }

  useEffect(() => {
    fetchHistory()
    pollRef.current = setInterval(() => { fetchStatus(); checkLoadedIds() }, 3000)
    // atualiza histórico quando tab muda para timeline
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (tab === 'timeline') fetchHistory()
  }, [tab])

  async function toggle() {
    if (status.running) {
      await fetch('/api/autolearn/stop', { method: 'POST' })
    } else {
      await fetch('/api/autolearn/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, interval: interval * 60, max_cycles: maxCycles ? Number(maxCycles) : null }),
      })
    }
    fetchStatus()
  }

  async function updateConfig() {
    await fetch('/api/autolearn/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, interval: interval * 60 }),
    })
  }

  const personaColor = (pid) => ({ lucy: '#00a884', samantha: '#e77', marvin: '#667', glados: '#c55' }[pid] || '#888')

  function fmtTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleTimeString('pt', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--surface2)' }}>

      {/* ── PAINEL 1: Controlo ── */}
      <div style={{ flex: 2, minWidth: 200, maxWidth: 280, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Auto-Aprendizagem</div>
          <div style={{ fontSize: 11, color: status.running ? 'var(--accent)' : 'var(--text-muted)', marginTop: 2 }}>
            {status.running ? '● a correr' : '○ parado'}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Personas */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Personas</div>
            {personas.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${enabled[p.id] ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                  <img src={p.avatar_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                </div>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</span>
                <button
                  onClick={() => setEnabled(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  style={{ width: 38, height: 22, borderRadius: 11, border: 'none', background: enabled[p.id] ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: 3, left: enabled[p.id] ? 18 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </button>
              </div>
            ))}
          </div>

          {/* Intervalo */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Intervalo por persona</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range" min={1} max={30} value={interval}
                onChange={e => setIntervalMin(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', minWidth: 50 }}>{interval} min</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Ciclo completo: ~{interval * Object.values(enabled).filter(Boolean).length} min
            </div>
          </div>

          {/* Limite de ciclos */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Limite de ciclos</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" min={1} placeholder="∞ ilimitado"
                value={maxCycles}
                onChange={e => setMaxCycles(e.target.value)}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 12, color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
              />
              {maxCycles && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  ~{Math.round(Number(maxCycles) * interval)} min
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Deixa vazio para correr indefinidamente
            </div>
          </div>

          {/* Botão principal */}
          <button
            onClick={toggle}
            style={{ padding: '12px 0', borderRadius: 12, border: 'none', background: status.running ? '#dc2626' : 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s', marginTop: 'auto' }}
          >
            {status.running ? '⏹ Parar' : '▶ Iniciar'}
          </button>
          {status.running && (
            <button onClick={updateConfig} style={{ padding: '8px 0', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              Actualizar configuração
            </button>
          )}

          {/* ── Deep Mind ── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: anyReasoningLoaded ? '#7c3aed' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
                Deep Mind
              </div>
              <button
                onClick={() => {
                  if (!anyReasoningLoaded && !deepMind) return
                  const next = !deepMind
                  setDeepMind(next)
                  saveDmConfig({ enabled: next })
                }}
                title={anyReasoningLoaded ? '' : 'Necessita de modelo reasoning ligado (Qwen3.5 ou Qwen3.6)'}
                style={{ width: 34, height: 20, borderRadius: 10, border: 'none', background: deepMind && anyReasoningLoaded ? '#7c3aed' : 'var(--border)', cursor: anyReasoningLoaded ? 'pointer' : 'not-allowed', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: anyReasoningLoaded ? 1 : 0.5 }}
              >
                <div style={{ position: 'absolute', top: 2, left: deepMind && anyReasoningLoaded ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
            </div>

            <div style={{ fontSize: 10, color: anyReasoningLoaded ? '#7c3aed' : 'var(--text-muted)', marginBottom: 6, lineHeight: 1.4 }}>
              {anyReasoningLoaded ? '● Qwen reasoning disponível' : 'Necessita de Qwen3.5 ou Qwen3.6 ligado'}
            </div>

            {/* Auto Síntese + Sintetizar (só quando Deep Mind ON) */}
            {deepMind && anyReasoningLoaded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text)', flex: 1 }}>Auto Síntese</span>
                  <button
                    onClick={() => { const next = !autoSynth; setAutoSynth(next); saveDmConfig({ auto_synth: next }) }}
                    style={{ width: 34, height: 20, borderRadius: 10, border: 'none', background: autoSynth ? '#7c3aed' : 'var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                  >
                    <div style={{ position: 'absolute', top: 2, left: autoSynth ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {autoSynth && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>a cada</span>
                    <input
                      type="number" min={1} max={100} value={autoSynthCycles}
                      onChange={e => { const v = Number(e.target.value); setAutoSynthCycles(v); saveDmConfig({ auto_synth_cycles: v }) }}
                      style={{ width: 48, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 11, textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>ciclos</span>
                  </div>
                )}
                <button
                  onClick={handleSynthesize}
                  disabled={synthesizing}
                  style={{ padding: '8px 0', borderRadius: 10, border: '1px solid #7c3aed', background: synthesizing ? 'var(--surface2)' : 'rgba(124,58,237,0.08)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: synthesizing ? 'wait' : 'pointer' }}
                >
                  {synthesizing ? '⏳ A sintetizar…' : '🧠 Sintetizar'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PAINEL 2: Feed ao vivo ── */}
      <div style={{ flex: 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Feed ao vivo</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['feed', 'timeline'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`, background: tab === t ? 'rgba(0,168,132,0.08)' : 'none', color: tab === t ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: tab === t ? 700 : 400, cursor: 'pointer' }}>
                {t === 'feed' ? 'Ao vivo' : 'Timeline'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'feed' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {/* Actividade actual */}
            {status.current && (
              <div style={{ background: 'var(--card-bg)', border: '1.5px solid var(--accent)', borderRadius: 14, padding: '16px 18px', marginBottom: 16, animation: 'pulse 2s ease-in-out infinite' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{status.current.persona}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{status.current.status}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {status.current.synthesis ? '🔗 A sintetizar' : status.current.discovery ? '🔭 A descobrir' : '🔍 A pesquisar'} sobre <strong>{status.current.interest}</strong>
                  {status.current.discovery && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontWeight: 600 }}>novo nó</span>}
                </div>
                <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--accent)', opacity: 0.3 + (i * 0.15), animation: `wave 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
                  ))}
                </div>
              </div>
            )}
            {!status.running && !status.current && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'var(--text-muted)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                <span style={{ fontSize: 13 }}>Clica em Iniciar para começar</span>
              </div>
            )}
            {/* Últimas aprendizagens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {status.timeline.slice(0, 8).map((entry, i) => {
                const isSynth = entry.synthesis_report
                return (
                  <div key={i} style={{ background: isSynth ? 'rgba(245,158,11,0.08)' : 'var(--card-bg)', border: `1px solid ${isSynth ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${isSynth ? 'rgba(245,158,11,0.5)' : 'var(--border)'}`, flexShrink: 0 }}>
                        <img src={entry.avatar || '/animations/idle.webp'} alt={entry.persona} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{entry.persona}</span>
                      <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 8, background: isSynth ? 'rgba(245,158,11,0.15)' : entry.synthesis ? 'rgba(59,130,246,0.12)' : entry.discovery ? 'rgba(139,92,246,0.12)' : 'rgba(0,168,132,0.1)', color: isSynth ? '#d97706' : entry.synthesis ? '#2563eb' : entry.discovery ? '#7c3aed' : 'var(--accent)' }}>
                        {isSynth ? '🧠 síntese' : entry.synthesis ? '🔗 ' : entry.discovery ? '🔭 ' : ''}{isSynth ? '' : entry.interest}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtTime(entry.timestamp)}</span>
                    </div>
                    {(entry.insights || []).map((ins, j) => (
                      <div key={j} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, padding: '4px 0 4px 10px', borderLeft: `2px solid ${isSynth ? '#f59e0b' : 'var(--accent)'}`, marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                        {ins}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* Timeline — histórico persistente por dia */
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {history.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 13 }}>
                Ainda sem histórico guardado.<br />As aprendizagens aparecem aqui após a próxima sessão.
              </div>
            )}
            {(() => {
              // agrupa por dia
              const byDay = {}
              history.forEach(e => {
                const day = e.timestamp ? e.timestamp.slice(0, 10) : 'desconhecido'
                byDay[day] = byDay[day] || []
                byDay[day].push(e)
              })
              const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a))

              function fmtDay(iso) {
                if (!iso || iso === 'desconhecido') return iso
                try {
                  const d = new Date(iso + 'T12:00:00')
                  const today = new Date()
                  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
                  if (iso === today.toISOString().slice(0, 10)) return 'Hoje'
                  if (iso === yesterday.toISOString().slice(0, 10)) return 'Ontem'
                  return d.toLocaleDateString('pt', { weekday: 'long', day: 'numeric', month: 'long' })
                } catch { return iso }
              }

              return days.map(day => (
                <div key={day} style={{ marginBottom: 28 }}>
                  {/* Separador de dia */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {fmtDay(day)} · {byDay[day].length} aprendizagens
                    </span>
                    <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  </div>

                  {/* Entradas do dia */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {byDay[day].map((entry, i) => {
                        const isSynth = entry.synthesis_report
                        return (
                          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${isSynth ? '#f59e0b' : 'var(--accent)'}`, flexShrink: 0, zIndex: 1, background: '#fff' }}>
                              <img src={entry.avatar || '/animations/idle.webp'} alt={entry.persona} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                            </div>
                            <div style={{ flex: 1, background: isSynth ? 'rgba(245,158,11,0.08)' : 'var(--card-bg)', border: `1px solid ${isSynth ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`, borderRadius: 10, padding: '9px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{entry.persona}</span>
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6,
                                  background: isSynth ? 'rgba(245,158,11,0.15)' : entry.synthesis ? 'rgba(59,130,246,0.12)' : entry.discovery ? 'rgba(139,92,246,0.12)' : 'rgba(0,168,132,0.1)',
                                  color: isSynth ? '#d97706' : entry.synthesis ? '#2563eb' : entry.discovery ? '#7c3aed' : 'var(--accent)' }}>
                                  {isSynth ? '🧠 síntese' : entry.synthesis ? '🔗 ' : entry.discovery ? '🔭 ' : ''}{isSynth ? '' : entry.interest}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{fmtTime(entry.timestamp)}</span>
                              </div>
                              {(entry.insights || []).map((ins, j) => (
                                <div key={j} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, borderLeft: `2px solid ${isSynth ? '#f59e0b' : 'rgba(0,168,132,0.4)'}`, paddingLeft: 8, marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                                  {ins}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

      {/* ── PAINEL 3: Estatísticas por persona ── */}
      <div style={{ flex: 2, minWidth: 200, maxWidth: 280, background: 'var(--panel-bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Por persona</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {personas.map(p => {
            const entries = status.timeline.filter(e => e.persona_id === p.id)
            const topics = [...new Set(entries.map(e => e.interest))]
            const isActive = status.current?.persona_id === p.id
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', opacity: enabled[p.id] ? 1 : 0.4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`, flexShrink: 0 }}>
                    <img src={p.avatar_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {p.name}
                      {isActive && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'var(--accent)', color: '#fff' }}>activo</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{entries.length} aprendizagens</div>
                  </div>
                </div>
                {topics.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {topics.slice(0, 5).map(t => (
                      <span key={t} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(0,168,132,0.08)', color: 'var(--accent)', border: '1px solid rgba(0,168,132,0.2)' }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Totais */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total esta sessão</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{status.timeline.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>aprendizagens registadas</div>
        </div>
      </div>

    </div>
  )
}

function SettingsPage() {
  return (
    <PlaceholderPage title="Settings" description="PIN modal · preferências · tema" />
  )
}

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState(() => localStorage.getItem('last_page') || 'chat')
  const [photoTs, setPhotoTs] = useState(Date.now())
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // aplica data-theme ao <html> para as CSS vars funcionarem
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const [model, setModel] = useState('gemma-lite')
  const [thinkingMode, setThinkingMode] = useState('off')
  const [language, setLanguage] = useState('pt')
  const [voiceUuid, setVoiceUuid] = useState(null)
  const [persona, setPersona] = useState({ name: 'Lucy', avatar_url: '' })
  const [sessionId, setSessionId] = useState(null)
  const [chatKey, setChatKey] = useState(0)
  const [sidebarKey, setSidebarKey] = useState(0)
  const [rightOpen, setRightOpen] = useState(window.innerWidth >= 1100)
  const [pro, setPro] = useState(false)
  const [pinModal, setPinModal] = useState(null)
  const [chatPersonas, setChatPersonas] = useState([])
  const [contactSelected, setContactSelected] = useState(false)

  function navigateTo(p) {
    setPage(p)
    localStorage.setItem('last_page', p)
  }

  useEffect(() => {
    fetch('/api/personas').then(r => r.json()).then(d => setChatPersonas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // fecha o painel direito automaticamente em janelas pequenas
  useEffect(() => {
    function onResize() {
      setRightOpen(window.innerWidth >= 1100)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    function onPhotoUpdated(e) { setPhotoTs(e.detail || Date.now()) }
    window.addEventListener('user-photo-updated', onPhotoUpdated)
    return () => window.removeEventListener('user-photo-updated', onPhotoUpdated)
  }, [])

  useEffect(() => {
    fetch('/api/persona').then(r => r.json()).then(d => setPersona(prev => ({ ...prev, ...d }))).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/lm-models')
      .then(r => r.json())
      .then(d => { if (d.loaded?.length > 0) setModel(d.loaded[0]) })
      .catch(() => {})
  }, [])

  function showPinFor(onSuccess) {
    setPinModal(() => onSuccess)
  }

  function handleSelectSession(id) {
    setSessionId(id)
    setPage('chat')
  }

  function handleNewChat() {
    setSessionId(null)
    setChatKey(k => k + 1)
    setPage('chat')
  }

  function handleSessionCreated(id) {
    setSessionId(id)
    setSidebarKey(k => k + 1)
  }

  async function handleSelectPersona(p) {
    setPersona({ name: p.name, avatar_url: p.avatar_url, id: p.id, defaults: p.defaults, enabled: p.enabled, interests: p.interests || [] })
    // resolve modelo: usa o da persona se estiver carregado, senão usa o primeiro carregado
    const wantedModel = p.defaults?.model
    if (wantedModel) {
      try {
        const { loaded = [] } = await fetch('/api/lm-models').then(r => r.json())
        if (loaded.includes(wantedModel)) {
          setModel(wantedModel)
        } else if (loaded.length > 0) {
          setModel(loaded[0])
          console.warn(`[PersonaSwitch] ${p.name}: modelo '${wantedModel}' não carregado, a usar '${loaded[0]}'`)
        }
      } catch {
        if (wantedModel) setModel(wantedModel)
      }
    }
    if (p.defaults?.language) setLanguage(p.defaults.language)
    if (p.defaults?.voice_uuid !== undefined) setVoiceUuid(p.defaults.voice_uuid || null)
    setContactSelected(true)
    // actualiza PERSONA global no backend
    fetch('/api/persona/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: p.id }),
    }).catch(() => {})
    // carrega a última sessão desta persona — NUNCA carrega sessão pro em modo vanilla
    try {
      const params = new URLSearchParams({ persona_id: p.id })
      if (!pro) params.set('is_pro', '0')  // segurança: vanilla não acede a sessões pro
      else params.set('is_pro', '1')        // pro carrega a última sessão pro desta persona
      const sessions = await fetch(`/api/sessions?${params}`).then(r => r.json())
      const lastId = Array.isArray(sessions) && sessions.length > 0 ? sessions[0].id : null
      setSessionId(lastId)
    } catch {
      setSessionId(null)
    }
    setChatKey(k => k + 1)
  }

  const NAV = [
    { id: 'profile',  title: 'Perfil',    icon: <IconPerson /> },
    { id: 'chat',     title: 'Chat',      icon: <IconChat /> },
    { id: 'mind',     title: 'Mente',     icon: <IconNeural /> },
    { id: 'learn',    title: 'Aprender',  icon: <IconLearn /> },
    { id: 'settings', title: 'Definições',icon: <IconSettings /> },
  ]

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      background: 'var(--surface)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 8px 48px var(--shadow)',
    }}>

      {/* ── RAIL ─────────────────────────────────────────────────────────── */}
      <div style={{
        width: 72,
        background: 'var(--rail-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
        gap: 4,
        flexShrink: 0,
        zIndex: 10,
      }}>
        <LucyLogo onClick={() => navigateTo('profile')} />

        {NAV.map(({ id, title, icon }) => (
          <RailIcon
            key={id}
            active={page === id}
            title={title}
            onClick={() => navigateTo(id)}
          >
            {icon}
          </RailIcon>
        ))}

        {/* ── Toggle dark mode (empurrado para o fundo) ── */}
        <button
          onClick={() => setDarkMode(d => !d)}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}
          style={{
            width: 44, height: 44, borderRadius: 12, border: 'none',
            background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s', marginTop: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-soft)'; e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
        >
          {darkMode
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>

        {/* ── Avatar do utilizador + mini menu ── */}
        <div style={{ marginTop: 4, position: 'relative' }}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            title="Menu utilizador"
            style={{
              width: 42, height: 42, borderRadius: '50%',
              border: `2px solid ${userMenuOpen || page === 'profile' ? 'var(--accent)' : 'var(--border)'}`,
              overflow: 'hidden', cursor: 'pointer', padding: 0, background: 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              position: 'relative', transition: 'border-color 0.15s', flexShrink: 0,
            }}
          >
            <IconPerson />
            <img
              src={`/avatars/user-photo.jpg?t=${photoTs}`}
              alt="Utilizador"
              onError={e => { e.target.style.display = 'none' }}
              onLoad={e => { e.target.style.display = 'block' }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
          {userMenuOpen && (
            <>
              <div onClick={() => setUserMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{
                position: 'absolute', bottom: 52, left: 8,
                background: 'var(--panel-bg)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: '0 4px 24px var(--shadow)',
                zIndex: 100, minWidth: 160, overflow: 'hidden',
              }}>
                <button onClick={() => { setUserMenuOpen(false); navigateTo('profile') }}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconPerson /> Ver perfil
                </button>
                <button onClick={() => { setUserMenuOpen(false); document.getElementById('rail-photo-input')?.click() }}
                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', textAlign: 'left', fontSize: 13, color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Alterar foto
                </button>
              </div>
            </>
          )}
          <input id="rail-photo-input" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData(); fd.append('file', file)
              await fetch('/api/user/photo', { method: 'POST', body: fd }).catch(() => {})
              setPhotoTs(Date.now())
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* ── PAINEL DE CONTACTOS (só no chat) ────────────────────────────── */}
      {page === 'chat' && (
        <div style={{
          flex: 2, minWidth: 180, maxWidth: 300,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <ChatContactsSidebar
            personas={chatPersonas}
            activePersona={persona}
            pro={pro}
            onTogglePro={() => {
              if (pro) { setPro(false); setSessionId(null); setChatKey(k => k + 1) }
              else showPinFor(() => { setPro(true); setSessionId(null); setChatKey(k => k + 1) })
            }}
            onSelectSession={id => { setSessionId(id); }}
            onSelectPersona={handleSelectPersona}
          />
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ flex: page === 'chat' ? 4 : 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>

        {page === 'profile' && (
          <ProfilePage />
        )}

        {page === 'history' && (
          <HistoryPage
            sessionId={sessionId}
            onSelect={handleSelectSession}
            onNew={handleNewChat}
            sidebarKey={sidebarKey}
          />
        )}

        {page === 'chat' && (
          <ChatPage
            model={model} setModel={setModel}
            thinkingMode={thinkingMode} setThinkingMode={setThinkingMode}
            language={language}
            voiceUuid={voiceUuid} setVoiceUuid={setVoiceUuid}
            persona={persona}
            sessionId={sessionId}
            chatKey={chatKey}
            onAnimation={() => {}}
            onSessionCreated={handleSessionCreated}
            pro={pro}
            onProClick={() => pro ? setPro(false) : showPinFor(() => setPro(true))}
            onGoToMessages={() => setPage('chat')}
            rightOpen={rightOpen}
            onToggleRight={() => setRightOpen(v => !v)}
            contactSelected={contactSelected}
            onClearChat={() => { setSessionId(null); setChatKey(k => k + 1) }}
          />
        )}

        {page === 'mind' && (
          <MindPage model={model} language={language} darkMode={darkMode} />
        )}

        {page === 'learn' && (
          <LearnPage />
        )}

        {page === 'settings' && (
          <SettingsPage />
        )}

      </div>

      {/* ── RIGHT PANEL (memórias — só no chat) ─────────────────────────── */}
      {page === 'chat' && (
        <RightPanel open={rightOpen} onClose={() => setRightOpen(false)} personaName={persona.name} personaInterests={persona.interests || []} personaId={persona.id} />
      )}

      {/* ── PIN Modal ── */}
      {pinModal !== null && (
        <PinModal
          onSuccess={() => { pinModal(); setPinModal(null) }}
          onCancel={() => setPinModal(null)}
        />
      )}

    </div>
  )
}
