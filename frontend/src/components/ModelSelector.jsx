import { useState, useEffect, useRef } from 'react'

const MODEL_INFO = {
  'nemo-12b':     { label: 'Nemo Roleplay', sub: '12B · PT' },
  'qwen-40b':     { label: 'Qwen3.6 40B', sub: '40B · Reasoning' },
  'qwen-9b-auto': { label: 'Qwen3.5 9B Auto', sub: '9B · Reasoning' },
  'gemma-lite':   { label: 'Gemma E4B', sub: '7.5B · Fast' },
  'qwen-27b':     { label: 'Qwen3.5 27B', sub: '27B · Reasoning' },
  'gemma-26b':    { label: 'Gemma 26B', sub: '26B' },
  'gpt-20b':      { label: 'GPT-OSS 20B', sub: '20B' },
  'qwen-9b':      { label: 'Qwen3.5 9B', sub: '9B · Reasoning' },
}

function Dot({ loaded }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: loaded ? '#4ade80' : '#444',
      boxShadow: loaded ? '0 0 5px #4ade80aa' : 'none',
      flexShrink: 0,
    }} />
  )
}

export default function ModelSelector({ model, onChange }) {
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
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-muted)',
          padding: '4px 10px',
          borderRadius: 20,
          border: '1px solid var(--border)',
          background: open ? 'var(--bg-secondary, #1a1a2e)' : 'var(--surface)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <Dot loaded={isLoaded} />
        {current.label}
        <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface, #111)',
          border: '1px solid var(--border, #333)',
          borderRadius: 10,
          padding: '4px 0',
          minWidth: 200,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {Object.entries(MODEL_INFO).map(([key, info]) => {
            const loaded = loadedKeys.includes(key)
            const selected = key === model
            return (
              <button
                key={key}
                onClick={() => { onChange(key); setOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '7px 14px',
                  background: selected ? 'var(--bg-secondary, #1a1a2e)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                <Dot loaded={loaded} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{info.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.45, marginLeft: 6 }}>{info.sub}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
