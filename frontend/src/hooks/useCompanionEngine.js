import { useEffect, useRef } from 'react'

const INTERVALS = {
  passatempo: 20000,
  trabalho: 60000,
  stroke: 10000,
}

export function useCompanionEngine({ active, subMode, persona, sessionId, model, workContext, onMessage }) {
  const busyRef = useRef(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active || !persona?.id) return

    const fire = async () => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        const body = {
          persona_id: persona.id,
          sub_mode: subMode,
          model: model || 'gemma-26b',
          session_id: sessionId || null,
          work_context: subMode === 'trabalho' ? (workContext || null) : null,
          research_mode: subMode === 'passatempo',
          language: 'pt',
        }
        const res = await fetch('/api/companion/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.message) onMessage(data.message)
      } catch (_) {
        // silently ignore network errors
      } finally {
        busyRef.current = false
      }
    }

    const interval = INTERVALS[subMode] ?? INTERVALS.passatempo
    timerRef.current = setInterval(fire, interval)

    return () => {
      clearInterval(timerRef.current)
      timerRef.current = null
      busyRef.current = false
    }
  }, [active, subMode, persona?.id, sessionId, model, workContext])
}

export async function companionResearch({ persona, sessionId, model, topic, onMessage }) {
  try {
    const res = await fetch('/api/companion/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persona_id: persona.id,
        sub_mode: 'passatempo',
        model: model || 'gemma-26b',
        session_id: sessionId || null,
        research_mode: true,
        research_topic: topic,
        language: 'pt',
      }),
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.message) onMessage(data.message)
  } catch (_) {}
}
