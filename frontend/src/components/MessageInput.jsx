import { useState, useRef, useEffect } from 'react'

export default function MessageInput({ onSend, loading }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!loading) textareaRef.current?.focus()
  }, [loading])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || loading) return
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

  return (
    <div style={{
      padding: '12px 20px 16px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '8px 12px',
      }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Escreve aqui… (Enter para enviar, Shift+Enter para nova linha)"
          rows={1}
          disabled={loading}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 15,
            lineHeight: 1.5,
            minHeight: 24,
            maxHeight: 160,
            overflow: 'auto',
          }}
        />
        <button
          onClick={submit}
          disabled={!text.trim() || loading}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: text.trim() && !loading ? 'var(--accent)' : 'var(--border)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
            fontSize: 16,
          }}
        >
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}
