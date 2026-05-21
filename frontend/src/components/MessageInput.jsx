import { useState, useRef, useEffect } from 'react'

export default function MessageInput({ onSend, loading, disabled = false }) {
  const [text, setText] = useState('')
  const [screenActive, setScreenActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const textareaRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    if (!loading && !disabled) textareaRef.current?.focus()
  }, [loading, disabled])

  // limpa stream ao desmontar
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  async function toggleScreenShare() {
    if (screenActive) {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setScreenActive(false)
      setPreviewUrl(null)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920 }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScreenActive(true)
      refreshPreview()
      stream.getVideoTracks()[0].onended = () => {
        streamRef.current = null
        setScreenActive(false)
        setPreviewUrl(null)
      }
    } catch {
      // utilizador cancelou o picker — não faz nada
    }
  }

  function refreshPreview() {
    const v = videoRef.current
    if (!v || !streamRef.current) return
    const c = document.createElement('canvas')
    const scale = 220 / v.videoWidth
    c.width = 220
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    setPreviewUrl(c.toDataURL('image/jpeg', 0.5))
  }

  async function captureFrame() {
    const v = videoRef.current
    if (!v || !streamRef.current) return null
    const maxW = 1440
    const scale = Math.min(1, maxW / v.videoWidth)
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    const dataUrl = c.toDataURL('image/jpeg', 0.70)
    return dataUrl.split(',')[1] // só a parte base64
  }

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || loading || disabled) return
    const image = screenActive ? await captureFrame() : null
    onSend(trimmed, image)
    setText('')
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }, 0)
    if (screenActive) setTimeout(refreshPreview, 200)
  }

  function handleInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const hasText = text.trim().length > 0

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Barra de preview quando screen share ativo */}
      {screenActive && (
        <div style={{
          padding: '6px 16px 4px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderTop: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}>
          {previewUrl && (
            <img src={previewUrl} alt="ecrã" style={{ height: 38, borderRadius: 4, border: '1px solid var(--border)', objectFit: 'cover' }} />
          )}
          <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'blink 1s step-end infinite' }} />
            A capturar ecrã · imagem enviada com cada mensagem
          </span>
          <button onClick={toggleScreenShare} style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Parar</button>
        </div>
      )}

      <div style={{
        padding: '10px 16px 14px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}>
        {/* hidden video element para capturar o stream */}
        <video ref={videoRef} style={{ display: 'none' }} muted playsInline />

        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: disabled ? 'var(--surface2)' : 'var(--surface)',
          border: `1px solid ${screenActive ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 24,
          padding: '8px 8px 8px 12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.2s',
        }}>
          {/* Botão screen share */}
          <button
            onClick={toggleScreenShare}
            disabled={disabled}
            title={screenActive ? 'Parar partilha de ecrã' : 'Partilhar ecrã'}
            style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: screenActive ? 'rgba(239,68,68,0.12)' : 'none',
              border: `1px solid ${screenActive ? '#ef4444' : 'var(--border)'}`,
              color: screenActive ? '#ef4444' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.15s',
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </button>

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

          {/* Botão de envio */}
          <button
            onClick={submit}
            disabled={!hasText || loading || disabled}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: hasText && !loading && !disabled ? 'var(--accent)' : 'var(--border)',
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 0.15s',
              fontSize: 18, border: 'none',
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
    </div>
  )
}
