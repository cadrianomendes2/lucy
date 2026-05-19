import { useState, useEffect } from 'react'
import ChatView from './components/ChatView.jsx'
import CharacterView from './components/CharacterView.jsx'
import ModelSelector from './components/ModelSelector.jsx'
import LanguageSelector from './components/LanguageSelector.jsx'
import VoiceSelector from './components/VoiceSelector.jsx'
import MemoryBrowserView from './components/MemoryBrowserView.jsx'

const MODEL = 'gemma-lite'

export default function App() {
  const [online, setOnline] = useState(false)
  const [language, setLanguage] = useState('pt')
  const [voiceUuid, setVoiceUuid] = useState(null)
  const [animation, setAnimation] = useState('idle')
  const [resetKey, setResetKey] = useState(0)
  const [showMemory, setShowMemory] = useState(false)

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/health')
        setOnline(res.ok)
      } catch {
        setOnline(false)
      }
    }
    checkStatus()
    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  function handleLanguageChange(lang) {
    setLanguage(lang)
    setResetKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '0.02em' }}>Lucy</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceSelector voiceUuid={voiceUuid} onChange={setVoiceUuid} />
          <LanguageSelector language={language} onChange={handleLanguageChange} />
          <ModelSelector online={online} />
          <button
            onClick={() => setShowMemory(v => !v)}
            title="Memórias"
            style={{
              background: showMemory ? 'var(--accent, #7c5cbf)' : 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              padding: '4px 8px',
              color: 'inherit',
              opacity: showMemory ? 1 : 0.6,
            }}
          >
            🧠
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <CharacterView animation={animation} />
        <ChatView
          key={resetKey}
          model={MODEL}
          language={language}
          voiceUuid={voiceUuid}
          onAnimation={setAnimation}
        />
        <MemoryBrowserView visible={showMemory} />
      </div>
    </div>
  )
}
