const REASONING_MODELS = new Set(['qwen-27b', 'qwen-40b', 'qwen-9b-auto', 'qwen-9b'])

const MODES = [
  { key: 'off',    label: 'Off' },
  { key: 'fast',   label: 'Fast' },
  { key: 'medium', label: 'Med' },
  { key: 'heavy',  label: 'Max' },
]

export default function ThinkingSelector({ model, mode, onChange }) {
  if (!REASONING_MODELS.has(model)) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 4px',
      borderRadius: 20,
      border: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, paddingLeft: 6, paddingRight: 2 }}>
        think
      </span>
      {MODES.map(m => {
        const active = mode === m.key
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            style={{
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              padding: '2px 8px',
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent, #00d4ff)' : 'none',
              color: active ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
