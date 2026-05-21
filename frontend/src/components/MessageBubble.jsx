export default function MessageBubble({ message, personaName }) {
  const isUser = message.role === 'user'
  const isTyping = !isUser && message.streaming && !message.content

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 4,
      padding: '0 16px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '66%' }}>
        {!isUser && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 3, paddingLeft: 2 }}>
            {personaName || 'Lucy'}
          </span>
        )}

        <div style={{
          padding: isTyping ? '10px 14px' : '8px 12px',
          borderRadius: isUser ? '8px 8px 2px 8px' : '2px 8px 8px 8px',
          background: isUser ? 'var(--user-bubble)' : 'var(--ai-bubble)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}>
          {isTyping ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 14 }}>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : (
            <>
              {message.streaming ? message.content : message.content?.trim()}
              {message.streaming && message.content && (
                <span style={{ display: 'inline-block', width: 7, height: 12, background: 'var(--accent)', marginLeft: 2, borderRadius: 1, animation: 'blink 1s step-end infinite' }} />
              )}
              {isUser && !message.streaming && (
                <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 5, fontSize: 11, color: '#53bdeb', verticalAlign: 'bottom' }}>✓✓</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
