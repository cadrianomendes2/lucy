import { useState, useRef, useEffect } from 'react'

// Input de mensagem estilo WhatsApp: borda redonda, botão de envio circular verde
export default function MessageInput({ onSend, loading, disabled = false }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!loading && !disabled) textareaRef.current?.focus()
  }, [loading, disabled])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || loading || disabled) return
    onSend(trimmed)
    setText('')
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }, 0)
  }

  function handleInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const hasText = text.trim().length > 0

  return (
    <div style={{
      padding: '10px 16px 14px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface2)',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        background: disabled ? 'var(--surface2)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '8px 8px 8px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        opacity: disabled ? 0.6 : 1,
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Esta persona está desactivada' : 'Escreve uma mensagem… (Enter para enviar)'}
          rows={1}
          disabled={loading || disabled}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 160,
            overflow: 'auto',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        />

        {/* Botão de envio: círculo verde */}
        <button
          onClick={submit}
          disabled={!hasText || loading || disabled}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: hasText && !loading && !disabled ? 'var(--accent)' : 'var(--border)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
            fontSize: 18,
            border: 'none',
            cursor: hasText && !loading && !disabled ? 'pointer' : 'default',
          }}
        >
          {loading ? (
            <span style={{ fontSize: 18, lineHeight: 1, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
