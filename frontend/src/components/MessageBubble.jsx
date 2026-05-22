import { useState } from 'react'

// Renderiza markdown inline simples: **bold**, *italic*, `code`, listas numeradas e com hífen
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []

  lines.forEach((line, li) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${li}`} />)
      return
    }
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
    elements.push(<span key={li} style={{ display: 'block' }}>{inlineMarkdown(line)}</span>)
  })

  return elements
}

function inlineMarkdown(text) {
  const parts = []
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

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, personaName, timestamp, onDelete, onRegenerate, onPlay }) {
  const [hovered, setHovered] = useState(false)
  const isUser = message.role === 'user'
  const isTyping = !isUser && message.streaming && !message.content
  const content = message.streaming ? message.content : message.content?.trim()
  const hasMarkdown = !isUser && content && /\*\*|^\d+\.\s|^[-*]\s/m.test(content)
  const showActions = hovered && !message.streaming && content
  const timeStr = formatTime(timestamp || message.timestamp)

  return (
    <div
      style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 4, padding: '0 16px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '66%', position: 'relative' }}>
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
              {/* Hora + confirmação (estilo WhatsApp) */}
              {!message.streaming && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  float: 'right', marginLeft: 8, marginTop: 2,
                  fontSize: 11, color: 'var(--text-muted)', opacity: 0.7,
                  verticalAlign: 'bottom', userSelect: 'none',
                }}>
                  {timeStr}
                  {isUser && <span style={{ color: '#53bdeb' }}>✓✓</span>}
                </span>
              )}
            </>
          )}
        </div>

        {/* Botões de acção — aparecem discretamente ao fazer hover */}
        {showActions && (
          <div style={{
            display: 'flex', gap: 4,
            marginTop: 3,
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            animation: 'fadeIn 0.15s ease',
          }}>
            {!isUser && onPlay && (
              <ActionBtn title="Ouvir" onClick={() => onPlay(content)}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </ActionBtn>
            )}
            {!isUser && onRegenerate && (
              <ActionBtn title="Regenerar" onClick={onRegenerate}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.78L1 10"/></svg>
              </ActionBtn>
            )}
            {onDelete && (
              <ActionBtn title="Apagar" onClick={onDelete} danger>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </ActionBtn>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 24, height: 24, borderRadius: 6,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        color: danger ? '#ef4444' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        transition: 'opacity 0.1s',
      }}
    >
      {children}
    </button>
  )
}
