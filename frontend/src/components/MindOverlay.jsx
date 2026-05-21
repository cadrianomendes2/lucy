import { useState, useRef, useEffect } from 'react'

// Nós e ligações estáticos do grafo de mente
export const STATIC_NODES = [
  { id: 'lucy',        label: 'Lucy',       x: 50,  y: 50,  r: 14, color: '#00a884', central: true },
  { id: 'projecto',    label: 'Projecto',   x: 25,  y: 28,  r: 9,  color: '#25d366' },
  { id: 'memorias',   label: 'Memórias',   x: 75,  y: 28,  r: 9,  color: '#25d366' },
  { id: 'preferencias', label: 'Preferências', x: 18, y: 58, r: 8, color: '#4ade80' },
  { id: 'fastapi',     label: 'FastAPI',    x: 28,  y: 76,  r: 7,  color: '#4ade80' },
  { id: 'design',      label: 'Design',     x: 45,  y: 80,  r: 7,  color: '#4ade80' },
  { id: 'cinema',      label: 'Cinema',     x: 62,  y: 76,  r: 7,  color: '#4ade80' },
  { id: 'musica',      label: 'Música',     x: 78,  y: 64,  r: 7,  color: '#4ade80' },
  { id: 'react',       label: 'React',      x: 82,  y: 46,  r: 7,  color: '#4ade80' },
  { id: 'ia',          label: 'IA local',   x: 72,  y: 20,  r: 8,  color: '#25d366' },
]

export const STATIC_LINKS = [
  ['lucy', 'projecto'],
  ['lucy', 'memorias'],
  ['lucy', 'preferencias'],
  ['lucy', 'design'],
  ['lucy', 'ia'],
  ['projecto', 'fastapi'],
  ['projecto', 'react'],
  ['memorias', 'preferencias'],
  ['memorias', 'projecto'],
  ['ia', 'memorias'],
  ['design', 'cinema'],
  ['design', 'react'],
  ['cinema', 'musica'],
]

// Mensagens estáticas da Lucy sobre o grafo
const LUCY_INTRO_MESSAGES = [
  {
    role: 'assistant',
    content: 'Olá! Bem-vindo à minha mente. 🌿 Este grafo mostra o que eu sei e o que me interessa.',
  },
  {
    role: 'assistant',
    content: 'Cada nó representa um conceito ou área de conhecimento. As ligações mostram como relaciono as coisas.',
  },
  {
    role: 'assistant',
    content: 'Podes clicar nos nós para explorar, ou perguntar-me qualquer coisa sobre o meu conhecimento!',
  },
]

// Componente SVG do grafo estático
export function StaticGraph({ selectedNode, onSelectNode }) {
  const svgRef = useRef(null)

  // Calcula posição em píxeis baseada em percentagem
  function pos(pct, dim) {
    return (pct / 100) * dim
  }

  const [dims, setDims] = useState({ w: 400, h: 400 })

  useEffect(() => {
    function updateDims() {
      if (svgRef.current) {
        const r = svgRef.current.getBoundingClientRect()
        setDims({ w: r.width || 400, h: r.height || 400 })
      }
    }
    updateDims()
    const obs = new ResizeObserver(updateDims)
    if (svgRef.current) obs.observe(svgRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ display: 'block', flex: 1 }}
    >
      {/* Ligações */}
      {STATIC_LINKS.map(([a, b], i) => {
        const na = STATIC_NODES.find(n => n.id === a)
        const nb = STATIC_NODES.find(n => n.id === b)
        if (!na || !nb) return null
        return (
          <line
            key={i}
            x1={pos(na.x, dims.w)}
            y1={pos(na.y, dims.h)}
            x2={pos(nb.x, dims.w)}
            y2={pos(nb.y, dims.h)}
            stroke="#c8e6d8"
            strokeWidth={1.2}
            strokeOpacity={0.7}
          />
        )
      })}

      {/* Nós */}
      {STATIC_NODES.map(node => {
        const cx = pos(node.x, dims.w)
        const cy = pos(node.y, dims.h)
        const isSelected = selectedNode?.id === node.id

        return (
          <g
            key={node.id}
            onClick={() => onSelectNode(node)}
            style={{ cursor: 'pointer' }}
          >
            {/* Glow para nós activos ou centrais */}
            {(node.central || isSelected) && (
              <circle
                cx={cx}
                cy={cy}
                r={node.r + 6}
                fill={node.color}
                fillOpacity={0.15}
              />
            )}

            {/* Círculo principal */}
            <circle
              cx={cx}
              cy={cy}
              r={node.r}
              fill={isSelected ? '#fff' : node.color}
              stroke={node.color}
              strokeWidth={isSelected ? 2 : 0}
            />

            {/* Label */}
            <text
              x={cx}
              y={cy + node.r + 12}
              textAnchor="middle"
              fontSize={node.central ? 11 : 9}
              fontWeight={node.central ? 700 : 400}
              fill={node.central ? '#111b21' : '#54656f'}
              fontFamily="Inter, sans-serif"
            >
              {node.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function MindOverlay({ model, language, onClose, embedded = false }) {
  const [messages, setMessages] = useState(LUCY_INTRO_MESSAGES)
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [searchText, setSearchText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = inputText.trim()
    if (!text || loading) return

    setInputText('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    // Adiciona mensagem de streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          model,
          language,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          thinking_mode: 'off',
          system_context: 'Estás a explorar o grafo de memórias da Lucy. Responde de forma curta e directa sobre o teu conhecimento e como relacionas os conceitos.',
        }),
      })

      if (!response.ok) throw new Error(`Erro ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break

          try {
            const chunk = JSON.parse(raw)
            if (chunk.text) {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + chunk.text,
                }
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Ocorreu um erro. Tenta novamente.',
          streaming: false,
        }
        return updated
      })
    } finally {
      setMessages(prev => {
        const updated = [...prev]
        if (updated[updated.length - 1]?.streaming) {
          updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false }
        }
        return updated
      })
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Selecção de nó → envia mensagem automática sobre o nó
  function handleSelectNode(node) {
    setSelectedNode(node)
    const question = `O que é o nó "${node.label}" no teu grafo de conhecimento?`
    setInputText(question)
  }

  // Filtra nós pela pesquisa
  const filteredNodes = searchText.trim()
    ? STATIC_NODES.filter(n => n.label.toLowerCase().includes(searchText.toLowerCase()))
    : STATIC_NODES

  return (
    <div style={{
      ...(embedded ? { flex: 1 } : { position: 'absolute', top: 0, left: 72, right: 0, bottom: 0, zIndex: 50 }),
      background: 'var(--surface)',
      display: 'flex',
    }}>
      {/* ── METADE ESQUERDA: Grafo ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: '#f8fff8',
        overflow: 'hidden',
      }}>
        {/* Header do grafo */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          {/* Botão fechar */}
          <button
            onClick={onClose}
            title="Fechar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              transition: 'background 0.12s',
            }}
          >
            ×
          </button>

          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Mente da Lucy</span>

          {/* Pesquisa de nós */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 9,
            background: 'var(--surface2)',
            flex: 1,
            maxWidth: 240,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Pesquisar conceitos…"
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text)',
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            {filteredNodes.length} conceitos
          </span>
        </div>

        {/* Grafo SVG */}
        <div style={{ flex: 1, padding: 16, display: 'flex', alignItems: 'stretch' }}>
          <StaticGraph
            selectedNode={selectedNode}
            onSelectNode={handleSelectNode}
          />
        </div>

        {/* Info do nó seleccionado */}
        {selectedNode && (
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: selectedNode.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{selectedNode.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
              {selectedNode.central ? 'Nó central' : 'Conceito relacionado'}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* ── METADE DIREITA: Chat ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#f5f6f8',
        overflow: 'hidden',
      }}>
        {/* Header do chat */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2px solid var(--accent)',
            flexShrink: 0,
          }}>
            <img src="/animations/idle.webp" alt="Lucy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Lucy</div>
            <div style={{ fontSize: 11, color: 'var(--accent)' }}>● a explorar o grafo</div>
          </div>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}>
                {!isUser && (
                  <div style={{ marginBottom: 'auto', marginRight: 6 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '1.5px solid var(--accent)',
                      flexShrink: 0,
                    }}>
                      <img src="/animations/idle.webp" alt="Lucy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    </div>
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  padding: '9px 13px',
                  borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                  background: isUser ? 'var(--user-bubble)' : 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                  {msg.streaming && (
                    <span style={{
                      display: 'inline-block',
                      width: 7,
                      height: 12,
                      background: 'var(--accent)',
                      marginLeft: 2,
                      borderRadius: 1,
                      animation: 'blink 1s step-end infinite',
                    }} />
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 24,
            padding: '8px 12px',
          }}>
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Pergunta sobre a minha mente…"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || loading}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: inputText.trim() && !loading ? 'var(--accent)' : 'var(--border)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() && !loading ? 'pointer' : 'default',
                flexShrink: 0,
                fontSize: 16,
                transition: 'background 0.15s',
              }}
            >
              {loading ? '…' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
