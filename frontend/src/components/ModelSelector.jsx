import { useState, useEffect, useRef } from 'react'

// Modelos agrupados por categoria
const MODEL_GROUPS = [
  {
    models: [
      { key: 'qwen-9b',     label: 'Qwen3.5 9B',   sub: '9B · Reasoning' },
      { key: 'qwen-27b',    label: 'Qwen3.5 27B',  sub: '27B · Reasoning' },
      { key: 'qwen-40b',    label: 'Qwen3.6 40B',  sub: '40B · Reasoning' },
    ],
  },
  {
    models: [
      { key: 'gemma-lite',  label: 'Gemma E4B',    sub: '7.5B · Fast' },
      { key: 'gemma-26b',   label: 'Gemma 26B',    sub: '26B' },
    ],
  },
  {
    models: [
      { key: 'nemo-12b',    label: 'Nemo Roleplay', sub: '12B · PT' },
    ],
  },
]

// Mapa plano para lookup rápido
const MODEL_INFO = {}
MODEL_GROUPS.forEach(g => g.models.forEach(m => { MODEL_INFO[m.key] = m }))

// Níveis de reasoning com cor da pill
const REASONING_LEVELS = [
  { key: 'off',  label: 'Off',  color: '#8696a0' },
  { key: 'fast', label: 'Fast', color: '#00a884' },
  { key: 'med',  label: 'Med',  color: '#25d366' },
  { key: 'max',  label: 'Max',  color: '#4ade80' },
]

function Dot({ loaded }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: loaded ? '#4ade80' : '#d1d5db',
      boxShadow: loaded ? '0 0 5px #4ade80aa' : 'none',
      flexShrink: 0,
    }} />
  )
}

// Pill colorida de reasoning
function ReasoningPill({ level }) {
  if (level === 'off') return null
  const info = REASONING_LEVELS.find(r => r.key === level) || REASONING_LEVELS[1]
  return (
    <span style={{
      padding: '1px 7px',
      borderRadius: 10,
      background: info.color,
      color: '#fff',
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.03em',
    }}>
      {info.label}
    </span>
  )
}

export default function ModelSelector({ model, onChange, thinkingMode = 'off', onReasoningChange }) {
  const [open, setOpen] = useState(false)
  const [loadedKeys, setLoadedKeys] = useState([])
  const ref = useRef(null)

  useEffect(() => {
    async function fetchLoaded() {
      try {
        const res = await fetch('/api/lm-models')
        const data = await res.json()
        setLoadedKeys(data.loaded || [])
      } catch {
        setLoadedKeys([])
      }
    }
    fetchLoaded()
    const interval = setInterval(fetchLoaded, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = MODEL_INFO[model] || { label: model, sub: '' }
  const isLoaded = loadedKeys.includes(model)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Botão principal */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-soft)',
          padding: '5px 11px',
          borderRadius: 20,
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          background: 'var(--surface)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.12s',
        }}
      >
        <Dot loaded={isLoaded} />
        <span>{current.label}</span>
        <ReasoningPill level={thinkingMode} />
        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 2 }}>▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '4px 0',
          minWidth: 220,
          zIndex: 200,
          boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        }}>
          {/* Grupos de modelos */}
          {MODEL_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && (
                <div style={{
                  height: 1,
                  background: 'var(--border)',
                  margin: '4px 0',
                }} />
              )}
              {group.models.map(info => {
                const loaded = loadedKeys.includes(info.key)
                const selected = info.key === model
                return (
                  <button
                    key={info.key}
                    onClick={() => { onChange(info.key); setOpen(false) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '9px 14px',
                      background: selected ? 'rgba(0,168,132,0.05)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text)',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected ? 'rgba(0,168,132,0.05)' : 'none' }}
                  >
                    <Dot loaded={loaded} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, display: 'block' }}>
                        {info.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, display: 'block' }}>
                        {info.sub}
                      </span>
                    </span>
                    {selected && (
                      <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Secção de Reasoning */}
          <div style={{
            height: 1,
            background: 'var(--border)',
            margin: '4px 0',
          }} />
          <div style={{ padding: '8px 14px 6px' }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Reasoning
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {REASONING_LEVELS.map(r => {
                const active = thinkingMode === r.key
                return (
                  <button
                    key={r.key}
                    onClick={() => onReasoningChange?.(r.key)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      border: 'none',
                      background: active ? r.color : 'var(--surface2)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
