import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

export default function KnowledgeGraph({ visible }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [selected, setSelected] = useState(null)
  const [summary, setSummary] = useState('')
  const fgRef = useRef()

  useEffect(() => {
    if (!visible) return
    fetch('/api/knowledge/graph')
      .then(r => r.json())
      .then(data => {
        const nodes = data.nodes.map(n => ({
          id: n.id,
          label: n.label,
          type: n.type,
          domain: n.domain,
          val: n.type === 'domain' ? 8 : 3,
        }))
        const links = data.edges.map(e => ({
          source: e.source_id,
          target: e.target_id,
          label: e.relation,
        }))
        setGraphData({ nodes, links })
      })
      .catch(() => {})
  }, [visible])

  const handleNodeClick = useCallback(async (node) => {
    setSelected(node)
    setSummary('')
    if (node.domain) {
      try {
        const res = await fetch(`/api/knowledge/summary/${node.domain}`)
        if (res.ok) setSummary(await res.text())
      } catch {}
    }
  }, [])

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isDomain = node.type === 'domain'
    const r = isDomain ? 7 : 4
    const isSelected = selected?.id === node.id

    // glow
    if (isDomain || isSelected) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI)
      ctx.fillStyle = isDomain ? 'rgba(0,212,255,0.12)' : 'rgba(124,92,191,0.12)'
      ctx.fill()
    }

    // node
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = isSelected
      ? '#fff'
      : isDomain
      ? '#00d4ff'
      : '#7c5cbf'
    ctx.fill()

    if (isSelected || isDomain) {
      ctx.strokeStyle = isDomain ? '#00d4ff' : '#a78de0'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // label
    const fontSize = isDomain ? 12 / globalScale : 9 / globalScale
    if (globalScale > 0.6 || isDomain) {
      ctx.font = `${isDomain ? 600 : 400} ${fontSize}px -apple-system, sans-serif`
      ctx.fillStyle = isDomain ? '#e8e8e8' : '#888'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(node.label, node.x, node.y + r + fontSize + 1)
    }
  }, [selected])

  if (!visible) return null

  const isEmpty = graphData.nodes.length === 0

  return (
    <div style={{
      width: 420,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderLeft: '1px solid var(--border)',
      background: '#080808',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Mente da Lucy
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.5, marginLeft: 'auto' }}>
          {graphData.nodes.length} nós · {graphData.links.length} ligações
        </span>
      </div>

      {/* graph */}
      <div style={{ flex: 1, position: 'relative' }}>
        {isEmpty ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', opacity: 0.35, fontSize: 13, gap: 8,
          }}>
            <span style={{ fontSize: 32 }}>◎</span>
            <span>Usa /search ou /research para<br/>começar a construir a mente</span>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => '#2a2a2a'}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkLabel="label"
            backgroundColor="#080808"
            onNodeClick={handleNodeClick}
            nodeRelSize={4}
            cooldownTicks={80}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 40)}
          />
        )}
      </div>

      {/* painel de detalhe */}
      {selected && (
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 16px',
          maxHeight: 180,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{
              fontSize: 11,
              padding: '2px 7px',
              borderRadius: 10,
              background: selected.type === 'domain' ? 'rgba(0,212,255,0.15)' : 'rgba(124,92,191,0.15)',
              color: selected.type === 'domain' ? 'var(--accent)' : '#a78de0',
            }}>
              {selected.type}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.label}</span>
            <button
              onClick={() => setSelected(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#666', fontSize: 14, cursor: 'pointer' }}
            >✕</button>
          </div>
          {summary ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              {summary}
            </p>
          ) : selected.domain ? (
            <p style={{ fontSize: 12, color: '#444', margin: 0 }}>A carregar…</p>
          ) : (
            <p style={{ fontSize: 12, color: '#444', margin: 0 }}>Conceito relacionado</p>
          )}
        </div>
      )}
    </div>
  )
}
