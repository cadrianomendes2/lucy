import { useState, useEffect, useRef } from 'react'

function langFlag(lang) {
  const map = { 'en-US': '🇺🇸', 'en-GB': '🇬🇧', 'pt-BR': '🇧🇷', 'pt-PT': '🇵🇹' }
  return map[lang] ?? '🌐'
}

export default function VoiceSelector({ voiceUuid, onChange }) {
  const [voices, setVoices] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    fetch('/api/voices').then(r => r.json()).then(setVoices).catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const active = voices.find(v => v.uuid === voiceUuid)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 8,
          background: voiceUuid ? 'var(--border)' : 'transparent',
          border: `1px solid ${voiceUuid ? 'var(--accent)' : 'var(--border)'}`,
          color: voiceUuid ? 'var(--text)' : 'var(--text-muted)',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 15 }}>🎙</span>
        <span>{active ? active.label : 'Voz off'}</span>
        <span style={{ fontSize: 10, opacity: 0.5 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 4,
          minWidth: 190,
          zIndex: 100,
          boxShadow: '0 8px 24px #0008',
        }}>
          {/* opção off */}
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '7px 12px',
              borderRadius: 7,
              background: !voiceUuid ? '#ffffff10' : 'transparent',
              color: 'var(--text-muted)',
              fontSize: 13,
              border: 'none',
            }}
          >
            🔇 Desativar voz
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />

          {voices.map(v => (
            <button
              key={v.uuid}
              onClick={() => { onChange(v.uuid); setOpen(false) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '7px 12px',
                borderRadius: 7,
                background: voiceUuid === v.uuid ? '#ffffff10' : 'transparent',
                color: voiceUuid === v.uuid ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 13,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{langFlag(v.lang)}</span>
              <span style={{ flex: 1 }}>{v.label}</span>
              <span style={{ fontSize: 11, opacity: 0.45 }}>{v.tags?.[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
