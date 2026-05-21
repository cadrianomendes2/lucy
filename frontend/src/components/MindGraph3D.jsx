import { useRef, useEffect, useCallback, useMemo } from 'react'
import { ForceGraph3D } from 'react-force-graph'
import * as THREE from 'three'

// Paleta de ramos — cada interesse fixo herda uma cor; os descobertos herdam a do ramo mais próximo
const BRANCH_PALETTE = [
  '#00a884', // teal  (cor identidade)
  '#3b82f6', // azul
  '#8b5cf6', // violeta
  '#f97316', // laranja
  '#ec4899', // rosa
  '#06b6d4', // cyan
  '#ef4444', // vermelho
  '#84cc16', // lima
]

const EMERGENT_COLOR   = '#f59e0b'  // dourado — novo root emergente
const FALLBACK_COLOR   = '#94a3b8'  // cinzento — sem ramo semântico

const EMERGENT_STRENGTH    = 8   // força mínima para ser emergente
const EMERGENT_SEM_DEGREE  = 2   // arestas semânticas mínimas

function lighten(hex, t = 0.55) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * t)
  const g = Math.round(((n >> 8) & 255)  + (255 - ((n >> 8) & 255))  * t)
  const b = Math.round((n & 255)          + (255 - (n & 255))          * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function buildGraphData(persona, learnedTopics, topicEdges) {
  if (!persona) return { nodes: [], links: [] }

  const fixedInterests = persona.interests || []
  const learnedMap = Object.fromEntries(learnedTopics.map(t => [t.interest, t]))
  const activeLearned = learnedTopics.filter(t => (t.strength || 1) >= 0.3)
  const allTopics = [...new Set([...fixedInterests, ...activeLearned.map(t => t.interest)])]
  const maxStrength = Math.max(1, ...learnedTopics.map(t => t.strength || 1))

  // cor base por interesse fixo
  const fixedColorMap = {}
  fixedInterests.forEach((int, i) => { fixedColorMap[int] = BRANCH_PALETTE[i % BRANCH_PALETTE.length] })

  // adjacência semântica para BFS
  const semAdj = {}
  for (const t of allTopics) semAdj[t] = []
  for (const e of topicEdges) {
    if (allTopics.includes(e.topic_a) && allTopics.includes(e.topic_b)) {
      semAdj[e.topic_a].push(e.topic_b)
      semAdj[e.topic_b].push(e.topic_a)
    }
  }

  // BFS para encontrar o interesse fixo mais próximo de um tópico descoberto
  function nearestFixed(start) {
    if (fixedInterests.includes(start)) return start
    const visited = new Set([start])
    const queue = [start]
    while (queue.length) {
      const curr = queue.shift()
      for (const nb of semAdj[curr] || []) {
        if (fixedInterests.includes(nb)) return nb
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
      }
    }
    return null
  }

  const semDegree = {}
  for (const t of allTopics) semDegree[t] = (semAdj[t] || []).length

  const nodes = [
    {
      id: '__persona__',
      label: persona.name || '?',
      isPersona: true,
      avatarUrl: persona.avatar_url || '',
      val: 30,
      color: '#00a884',
      isFixed: false,
      isWeak: false,
      isEmergent: false,
      factCount: 0,
      strength: 99,
      fx: 0, fy: 0, fz: 0,  // ancora no origem para a rotação funcionar
    },
    ...allTopics.map((topic, i) => {
      const topicData = learnedMap[topic]
      const strength   = topicData?.strength || 0
      const isFixed    = fixedInterests.includes(topic)
      const isWeak     = !isFixed && strength > 0 && strength < 1.5
      const isEmergent = !isFixed && strength >= EMERGENT_STRENGTH && semDegree[topic] >= EMERGENT_SEM_DEGREE
      const val = strength > 0
        ? Math.max(5, 5 + (strength / maxStrength) * 14)
        : (isFixed ? 10 : 5)

      let color
      if (isEmergent) {
        color = EMERGENT_COLOR
      } else if (isFixed) {
        color = fixedColorMap[topic] || BRANCH_PALETTE[i % BRANCH_PALETTE.length]
      } else {
        const nf = nearestFixed(topic)
        color = nf ? lighten(fixedColorMap[nf], 0.45) : FALLBACK_COLOR
      }

      return {
        id: topic, label: topic,
        isPersona: false, isFixed, isWeak, isEmergent,
        strength, semDegree: semDegree[topic],
        factCount: topicData?.count || 0,
        val, color,
        branchRoot: nearestFixed(topic),
      }
    }),
  ]

  const semanticSet = new Set(
    topicEdges.flatMap(e => [e.topic_a, e.topic_b]).filter(t => allTopics.includes(t))
  )

  const links = [
    // persona → interesses fixos (âncoras da identidade)
    ...fixedInterests.filter(t => allTopics.includes(t)).map(topic => ({
      source: '__persona__', target: topic,
      isSemantic: false, isFallback: false, semWeight: 0,
      color: fixedColorMap[topic] || '#00a884',
    })),
    // tópicos descobertos sem arestas semânticas → ligação fantasma ao centro
    ...allTopics
      .filter(t => !fixedInterests.includes(t) && !semanticSet.has(t))
      .map(t => ({
        source: '__persona__', target: t,
        isSemantic: false, isFallback: true, semWeight: 0,
      })),
    // arestas semânticas entre tópicos
    ...topicEdges
      .filter(e => allTopics.includes(e.topic_a) && allTopics.includes(e.topic_b))
      .map(e => ({
        source: e.topic_a, target: e.topic_b,
        isSemantic: true, isFallback: false, semWeight: e.weight,
      })),
  ]

  return { nodes, links }
}

export default function MindGraph3D({ persona, learnedTopics, topicEdges, selectedNode, onSelectNode, width, height, darkMode }) {
  const fgRef      = useRef()
  const rotRef     = useRef(null)
  const isDragging = useRef(false)
  const angleRef   = useRef(0)

  const graphData = useMemo(
    () => buildGraphData(persona, learnedTopics, topicEdges),
    [persona, learnedTopics, topicEdges]
  )

  // Nó da persona: esfera texturada + anel verde
  const nodeThreeObject = useCallback(node => {
    if (!node.isPersona) return null

    const geometry = new THREE.SphereGeometry(12, 32, 32)
    const loader   = new THREE.TextureLoader()
    const material = node.avatarUrl
      ? new THREE.MeshLambertMaterial({ map: loader.load(node.avatarUrl) })
      : new THREE.MeshLambertMaterial({ color: 0x00a884 })

    const sphere = new THREE.Mesh(geometry, material)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(15, 1.2, 8, 32),
      new THREE.MeshLambertMaterial({ color: 0x00a884, transparent: true, opacity: 0.7 })
    )
    ring.rotation.x = Math.PI / 2
    sphere.add(ring)
    return sphere
  }, [])

  const nodeColor = useCallback(node => {
    if (node.isPersona) return '#00a884'
    if (selectedNode?.id === node.id) return '#ffffff'
    return node.color
  }, [selectedNode])

  const linkColor = useCallback(link => {
    if (link.isSemantic) return '#7c3aed'
    if (link.isFallback) return '#e2e8f0'
    return link.color || '#00a884'
  }, [])

  const linkWidth = useCallback(link => {
    if (link.isSemantic) return Math.max(0.5, link.semWeight * 3)
    if (link.isFallback) return 0.15
    return 1.0
  }, [])

  const nodeLabel = useCallback(node => {
    if (node.isPersona) return node.label
    const parts = [node.label]
    if (node.isEmergent) parts.push('★ interesse emergente')
    else if (node.strength > 0) parts.push(`força ${node.strength.toFixed(1)}`)
    if (node.factCount > 0) parts.push(`${node.factCount} factos`)
    if (node.isWeak) parts.push('⚠ fraco')
    return parts.join(' · ')
  }, [])

  const handleNodeClick = useCallback(node => {
    if (node.isPersona) return
    onSelectNode?.({
      id: node.id, label: node.label,
      factCount: node.factCount, strength: node.strength,
      color: node.color, isEmergent: node.isEmergent,
    })
  }, [onSelectNode])

  // Configura forças D3 (delay para a simulação estar pronta)
  useEffect(() => {
    const timer = setTimeout(() => {
      const fg = fgRef.current
      if (!fg) return
      fg.d3Force('charge')?.strength(-280)
      fg.d3Force('link')?.distance(link => {
        if (link.isSemantic) return 55 + (1 - (link.semWeight || 0.5)) * 45
        if (link.isFallback) return 130
        return 90
      })
    }, 150)
    return () => clearTimeout(timer)
  }, [graphData])

  // Auto-rotação à volta da origem (onde o nó persona está ancorado)
  useEffect(() => {
    const R = 240

    function tick() {
      if (fgRef.current && !isDragging.current) {
        angleRef.current += 0.003
        fgRef.current.cameraPosition(
          { x: R * Math.sin(angleRef.current), y: 60, z: R * Math.cos(angleRef.current) },
          { x: 0, y: 0, z: 0 },
          0
        )
      }
      rotRef.current = requestAnimationFrame(tick)
    }
    rotRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rotRef.current)
  }, [])

  // Sincroniza ângulo quando o utilizador larga o drag (para a rotação continuar de onde ficou)
  const syncAngle = useCallback(() => {
    isDragging.current = false
    const cam = fgRef.current?.camera()
    if (cam) {
      angleRef.current = Math.atan2(cam.position.x, cam.position.z)
    }
  }, [])

  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(800, 80)
  }, [])

  return (
    <div
      style={{ flex: 1, overflow: 'hidden', background: darkMode ? '#111b21' : '#f8fafc', position: 'relative' }}
      onMouseDown={() => { isDragging.current = true }}
      onMouseUp={syncAngle}
      onTouchStart={() => { isDragging.current = true }}
      onTouchEnd={syncAngle}
    >
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        width={width}
        height={height}
        backgroundColor={darkMode ? '#111b21' : '#f8fafc'}
        nodeLabel={nodeLabel}
        nodeColor={nodeColor}
        nodeVal={node => node.val}
        nodeResolution={12}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.4}
        linkDirectionalParticles={0}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => onSelectNode?.(null)}
        enableNodeDrag
        enableNavigationControls
        showNavInfo={false}
        onEngineStop={handleEngineStop}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Legenda */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        fontSize: 9, color: '#6b7280', lineHeight: 1.8,
        background: 'rgba(248,250,252,0.9)', padding: '6px 10px', borderRadius: 8,
        backdropFilter: 'blur(4px)', border: '1px solid #e2e8f0',
      }}>
        <span style={{ color: '#00a884' }}>●</span> interesses fixos &nbsp;
        <span style={{ color: '#f59e0b' }}>●</span> emergente &nbsp;
        <span style={{ color: '#7c3aed' }}>—</span> relação semântica<br />
        arrastar = orbitar · scroll = zoom · clique = explorar
      </div>
    </div>
  )
}
