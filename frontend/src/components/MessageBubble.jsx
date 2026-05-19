export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
      padding: '0 20px',
    }}>
      <div style={{
        maxWidth: '72%',
        padding: '10px 14px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isUser ? 'var(--user-bubble)' : 'var(--ai-bubble)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        fontSize: 15,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.content}
        {message.streaming && (
          <span style={{
            display: 'inline-block',
            width: 8,
            height: 14,
            background: 'var(--accent)',
            marginLeft: 2,
            borderRadius: 1,
            animation: 'blink 1s step-end infinite',
          }} />
        )}
      </div>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
