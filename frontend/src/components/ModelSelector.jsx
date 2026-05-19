export default function ModelSelector({ online }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: online ? '#4ade80' : '#555',
        boxShadow: online ? '0 0 6px #4ade80aa' : 'none',
        transition: 'all 0.4s',
      }} />
      <span style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--text-muted)',
        padding: '4px 10px',
        borderRadius: 20,
        border: '1px solid var(--border)',
      }}>
        Gemma E4B <span style={{ fontSize: 10, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Local</span>
      </span>
    </div>
  )
}
