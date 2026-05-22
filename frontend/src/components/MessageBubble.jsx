// Renderiza markdown inline simples: **bold**, *italic*, `code`, listas numeradas e com hífen
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []

  lines.forEach((line, li) => {
    // linha vazia
    if (!line.trim()) {
      elements.push(<br key={`br-${li}`} />)
      return
    }

    // lista numerada: "1. texto" ou "1.  texto"
    const numMatch = line.match(/^(\d+)\.\s+(.*)/)
    if (numMatch) {
      elements.push(
        <div key={li} style={{ display: 'flex', gap: 6, marginTop: li > 0 ? 4 : 0 }}>
          <span style={{ fontWeight: 600, flexShrink: 0 }}>{numMatch[1]}.</span>
          <span>{inlineMarkdown(numMatch[2])}</span>
        </div>
      )
      return
    }

    // lista com hífen ou asterisco: "- texto" ou "* texto"
    const bulletMatch = line.match(/^[-*]\s+(.*)/)
    if (bulletMatch) {
      elements.push(
        <div key={li} style={{ display: 'flex', gap: 6, marginTop: li > 0 ? 2 : 0 }}>
          <span style={{ flexShrink: 0, opacity: 0.6 }}>·</span>
          <span>{inlineMarkdown(bulletMatch[1])}</span>
        </div>
      )
      return
    }

    // linha normal
    elements.push(<span key={li} style={{ display: 'block' }}>{inlineMarkdown(line)}</span>)
  })

  return elements
}

// Processa bold, italic e code dentro de uma linha
function inlineMarkdown(text) {
  const parts = []
  // tokeniza **bold**, *italic*, `code`
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} style={{ background: 'rgba(0,0,0,0.1)', borderRadius: 3, padding: '1px 4px', fontSize: 12, fontFamily: 'monospace' }}>{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts
}

export default function MessageBubble({ message, personaName }) {
  const isUser = message.role === 'user'
  const isTyping = !isUser && message.streaming && !message.content

  const content = message.streaming ? message.content : message.content?.trim()
  const hasMarkdown = !isUser && content && /\*\*|^\d+\.\s|^[-*]\s/m.test(content)

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

        {isUser && message.image && (
          <div style={{ marginBottom: 4, borderRadius: '8px 8px 0 0', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <img
              src={`data:image/jpeg;base64,${message.image}`}
              alt="ecrã"
              style={{ width: '100%', display: 'block', maxHeight: 120, objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>
        )}

        <div style={{
          padding: isTyping ? '10px 14px' : '8px 12px',
          borderRadius: isUser ? (message.image ? '0 0 2px 8px' : '8px 8px 2px 8px') : '2px 8px 8px 8px',
          background: isUser ? 'var(--user-bubble)' : 'var(--ai-bubble)',
          border: '1px solid var(--border)',
          borderTop: isUser && message.image ? 'none' : '1px solid var(--border)',
          color: 'var(--text)',
          fontSize: 14,
          lineHeight: 1.6,
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
              {hasMarkdown
                ? renderMarkdown(content)
                : <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
              }
              {message.streaming && content && (
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
