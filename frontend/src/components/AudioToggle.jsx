export default function AudioToggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Desativar áudio' : 'Ativar áudio'}
      style={{
        background: 'transparent',
        border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 16,
        lineHeight: 1,
        opacity: enabled ? 1 : 0.4,
        transition: 'all 0.15s',
        color: 'var(--text)',
      }}
    >
      {enabled ? '🔊' : '🔇'}
    </button>
  )
}
