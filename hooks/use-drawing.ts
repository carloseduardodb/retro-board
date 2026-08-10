'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/** Ponto normalizado (0..1) em relação à área do board, para funcionar em telas diferentes. */
export type DrawPoint = { x: number; y: number }

export type Stroke = {
  id: string
  authorId: string
  color: string
  points: DrawPoint[]
  /** timestamp local de quando o traço foi concluído — null enquanto está sendo desenhado */
  finishedAt: number | null
}

/** Tempo que o traço fica cheio antes de começar a sumir, e duração do fade. */
export const STROKE_HOLD_MS = 4000
export const STROKE_FADE_MS = 1500

export const DRAW_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
] as const

/** Cor padrão estável por participante, para dar pra saber quem rabiscou. */
export function colorForParticipant(participantId: string): string {
  let hash = 0
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) >>> 0
  }
  return DRAW_COLORS[hash % DRAW_COLORS.length]
}

type StrokeMessage = {
  id: string
  authorId: string
  color: string
  points: DrawPoint[]
  done: boolean
}

const FLUSH_INTERVAL_MS = 60

export function useDrawing(sessionToken: string, participantId: string) {
  // Os traços vivem em ref: são de alta frequência e o canvas os lê no rAF,
  // então não faz sentido passar por estado do React.
  const strokesRef = useRef<Map<string, Stroke>>(new Map())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  const activeIdRef = useRef<string | null>(null)
  const pendingRef = useRef<DrawPoint[]>([])
  const colorRef = useRef<string>(colorForParticipant(participantId))

  const send = useCallback((payload: StrokeMessage | { clear: true }) => {
    channelRef.current?.send({ type: 'broadcast', event: 'draw', payload })
  }, [])

  const applyRemote = useCallback((msg: StrokeMessage) => {
    const existing = strokesRef.current.get(msg.id)
    if (existing) {
      existing.points.push(...msg.points)
      if (msg.done) existing.finishedAt = Date.now()
      return
    }
    strokesRef.current.set(msg.id, {
      id: msg.id,
      authorId: msg.authorId,
      color: msg.color,
      points: [...msg.points],
      finishedAt: msg.done ? Date.now() : null,
    })
  }, [])

  useEffect(() => {
    if (!sessionToken || !participantId) return

    const channel = supabaseRef.current.channel(`draw:${sessionToken}`, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: 'draw' }, ({ payload }) => {
      if (payload && 'clear' in payload) {
        strokesRef.current.clear()
        return
      }
      applyRemote(payload as StrokeMessage)
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [sessionToken, participantId, applyRemote])

  // Envia os pontos acumulados em lotes, para não gerar uma mensagem por pixel.
  useEffect(() => {
    const timer = setInterval(() => {
      const id = activeIdRef.current
      if (!id || pendingRef.current.length === 0) return

      const points = pendingRef.current
      pendingRef.current = []
      send({ id, authorId: participantId, color: colorRef.current, points, done: false })
    }, FLUSH_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [participantId, send])

  const setColor = useCallback((color: string) => {
    colorRef.current = color
  }, [])

  const getColor = useCallback(() => colorRef.current, [])

  const startStroke = useCallback((point: DrawPoint) => {
    const id = `${participantId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    activeIdRef.current = id
    pendingRef.current = []
    strokesRef.current.set(id, {
      id,
      authorId: participantId,
      color: colorRef.current,
      points: [point],
      finishedAt: null,
    })
    send({ id, authorId: participantId, color: colorRef.current, points: [point], done: false })
  }, [participantId, send])

  const addPoint = useCallback((point: DrawPoint) => {
    const id = activeIdRef.current
    if (!id) return
    strokesRef.current.get(id)?.points.push(point)
    pendingRef.current.push(point)
  }, [])

  const endStroke = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return

    const points = pendingRef.current
    pendingRef.current = []
    activeIdRef.current = null

    const stroke = strokesRef.current.get(id)
    if (stroke) stroke.finishedAt = Date.now()

    send({ id, authorId: participantId, color: colorRef.current, points, done: true })
  }, [participantId, send])

  const clear = useCallback(() => {
    strokesRef.current.clear()
    activeIdRef.current = null
    pendingRef.current = []
    send({ clear: true })
  }, [send])

  return { strokesRef, startStroke, addPoint, endStroke, clear, setColor, getColor }
}
