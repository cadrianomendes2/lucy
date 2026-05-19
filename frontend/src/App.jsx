import { useState, useEffect } from 'react'
import ChatView from './components/ChatView.jsx'
import CharacterView from './components/CharacterView.jsx'
import ModelSelector from './components/ModelSelector.jsx'
import ThinkingSelector from './components/ThinkingSelector.jsx'
import LanguageSelector from './components/LanguageSelector.jsx'
import VoiceSelector from './components/VoiceSelector.jsx'
import MemoryBrowserView from './components/MemoryBrowserView.jsx'
import InterestsView from './components/InterestsView.jsx'
import SessionSidebar from './components/SessionSidebar.jsx'
import KnowledgeGraph from './components/KnowledgeGraph.jsx'

function HeaderIconButton({ active, title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

export default function App() {
  const [online, setOnline] = useState(false)
  const [model, setModel] = useState('gemma-lite')
  const [thinkingMode, setThinkingMode] = useState('off')
  const [language, setLanguage] = useState('pt')
  const [voiceUuid, setVoiceUuid] = useState(null)
  const [animation, setAnimation] = useState('idle')
  const [showMemory, setShowMemory] = useState(false)
  const [showCharacter, setShowCharacter] = useState(false)
  const [showInterests, setShowInterests] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [chatKey, setChatKey] = useState(0)
  // sidebarKey só serve para forçar re-render da sidebar quando sessão é criada
  const [sidebarKey, setSidebarKey] = useState(0)

  useEffect(() => {
    async function autoSelectModel() {
      try {
        const res = await fetch('/api/lm-models')
        const data = await res.json()
        if (data.loaded?.length > 0) setModel(data.loaded[0])
      } catch {}
    }
    autoSelectModel()
  }, [])

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
    setChatKey(k => k + 1)
  }

  function handleSelectSession(id) {
    setSessionId(id)
  }

  function handleNewChat() {
    setSessionId(null)
    setChatKey(k => k + 1)
  }

  function handleSessionCreated(id) {
    // NÃO muda o chatKey — evita remount do ChatView durante streaming
    setSessionId(id)
    setSidebarKey(k => k + 1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        {/* Logo Lucy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* glow aura */}
            <ellipse cx="15" cy="15" rx="12" ry="7" stroke="#00d4ff18" strokeWidth="7" fill="none" />
            {/* eye outline */}
            <path d="M3 15 C7 8, 23 8, 27 15 C23 22, 7 22, 3 15Z" stroke="#00d4ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            {/* iris ring */}
            <circle cx="15" cy="15" r="4.5" stroke="#00d4ff" strokeWidth="1.2" fill="none" />
            {/* inner iris detail */}
            <circle cx="15" cy="15" r="2.8" stroke="#00d4ff44" strokeWidth="0.8" fill="none" />
            {/* pupil */}
            <circle cx="15" cy="15" r="1.4" fill="#00d4ff" />
            {/* subtle shine */}
            <circle cx="13.5" cy="13.5" r="0.5" fill="#ffffff88" />
          </svg>
          <span style={{
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900,
            fontSize: 17,
            letterSpacing: '0.22em',
            background: 'linear-gradient(135deg, #7dd3fc 0%, #00d4ff 55%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textTransform: 'uppercase',
          }}>Lucy</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VoiceSelector voiceUuid={voiceUuid} onChange={setVoiceUuid} />
          <LanguageSelector language={language} onChange={handleLanguageChange} />
          <ThinkingSelector model={model} mode={thinkingMode} onChange={setThinkingMode} />
          <ModelSelector model={model} onChange={setModel} />

          {/* Botão Personagem */}
          <HeaderIconButton
            active={showCharacter}
            title={showCharacter ? 'Esconder personagem' : 'Mostrar personagem'}
            onClick={() => setShowCharacter(v => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="12" cy="10" r="3" />
              <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
            </svg>
          </HeaderIconButton>

          {/* Botão Interesses */}
          <HeaderIconButton
            active={showInterests}
            title="O que a Lucy aprende"
            onClick={() => setShowInterests(v => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 3.5-2 5.5-2 8H7c0-2.5-2-4.5-2-8a7 7 0 0 1 7-7z" />
              <path d="M9 17h6" />
              <path d="M10 20h4" />
            </svg>
          </HeaderIconButton>

          {/* Botão Memória */}
          <HeaderIconButton
            active={showMemory}
            title="Memórias"
            onClick={() => setShowMemory(v => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8 2 5 5 5 8.5c0 2 .8 3.5 2 4.5v2h2v1h6v-1h2v-2c1.2-1 2-2.5 2-4.5C19 5 16 2 12 2z" />
              <path d="M9 15v1" />
              <path d="M15 15v1" />
              <path d="M9 9c0-1.1.9-2 2-2" />
              <path d="M12 7v2" />
            </svg>
          </HeaderIconButton>

          {/* Botão Grafo */}
          <HeaderIconButton
            active={showGraph}
            title="Mente da Lucy"
            onClick={() => setShowGraph(v => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5" cy="12" r="2" />
              <circle cx="19" cy="5" r="2" />
              <circle cx="19" cy="19" r="2" />
              <circle cx="12" cy="12" r="2" />
              <line x1="7" y1="12" x2="10" y2="12" />
              <line x1="14" y1="12" x2="17" y2="5.5" />
              <line x1="14" y1="12" x2="17" y2="18.5" />
            </svg>
          </HeaderIconButton>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SessionSidebar
          key={`sidebar-${sidebarKey}`}
          sessionId={sessionId}
          onSelect={handleSelectSession}
          onNew={handleNewChat}
        />
        {showCharacter && <CharacterView animation={animation} />}
        <ChatView
          key={`chat-${chatKey}`}
          model={model}
          thinkingMode={thinkingMode}
          language={language}
          voiceUuid={voiceUuid}
          onAnimation={setAnimation}
          sessionId={sessionId}
          onSessionCreated={handleSessionCreated}
        />
        <InterestsView visible={showInterests} />
        <MemoryBrowserView visible={showMemory} />
        <KnowledgeGraph visible={showGraph} />
      </div>
    </div>
  )
}
