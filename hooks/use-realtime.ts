'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { 
  Card, 
  ActionCard, 
  Session, 
  Suggestion, 
  PrevAction,
  Participant,
  RealtimeEvent 
} from '@/lib/types/database'

type RealtimeState = {
  cards: Card[]
  actionCards: ActionCard[]
  suggestions: Suggestion[]
  prevActions: PrevAction[]
  session: Session | null
  participants: Participant[]
  isConnected: boolean
}

type UseRealtimeReturn = RealtimeState & {
  broadcast: (event: RealtimeEvent) => void
}

export function useRealtime(
  sessionToken: string,
  participantId: string,
  participantName: string,
  initialData: {
    session: Session | null
    cards: Card[]
    actionCards: ActionCard[]
    suggestions: Suggestion[]
    prevActions: PrevAction[]
  }
): UseRealtimeReturn {
  const [state, setState] = useState<RealtimeState>({
    cards: initialData.cards,
    actionCards: initialData.actionCards,
    suggestions: initialData.suggestions,
    prevActions: initialData.prevActions,
    session: initialData.session,
    participants: [],
    isConnected: false,
  })

  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())

  // Ref for the event handler to avoid circular dependency
  const handleRealtimeEventRef = useRef<(event: RealtimeEvent) => void>(() => {})

  // Broadcast function for sending events AND updating local state
  const broadcast = useCallback((event: RealtimeEvent) => {
    // Update local state immediately
    handleRealtimeEventRef.current(event)
    // Send to other clients
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'retro_event',
        payload: event,
      })
    }
  }, [])

  // Handle incoming realtime events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    setState(prev => {
      switch (event.type) {
        case 'card_added':
          // Avoid duplicates
          if (prev.cards.some(c => c.id === event.payload.id)) return prev
          return { ...prev, cards: [...prev.cards, event.payload] }

        case 'card_updated':
          return {
            ...prev,
            cards: prev.cards.map(c => 
              c.id === event.payload.id ? event.payload : c
            ),
          }

        case 'card_deleted':
          return {
            ...prev,
            cards: prev.cards.filter(c => c.id !== event.payload.id),
          }

        case 'action_added':
          if (prev.actionCards.some(a => a.id === event.payload.id)) return prev
          return { ...prev, actionCards: [...prev.actionCards, event.payload] }

        case 'action_updated':
          return {
            ...prev,
            actionCards: prev.actionCards.map(a => 
              a.id === event.payload.id ? event.payload : a
            ),
          }

        case 'action_deleted':
          return {
            ...prev,
            actionCards: prev.actionCards.filter(a => a.id !== event.payload.id),
          }

        case 'timer_update':
          return {
            ...prev,
            session: prev.session 
              ? { ...prev.session, ...event.payload }
              : null,
          }

        case 'suggestion_added':
          if (prev.suggestions.some(s => s.id === event.payload.id)) return prev
          return { ...prev, suggestions: [...prev.suggestions, event.payload] }

        case 'suggestion_updated':
          return {
            ...prev,
            suggestions: prev.suggestions.map(s => 
              s.id === event.payload.id ? event.payload : s
            ),
          }

        case 'prev_action_updated':
          return {
            ...prev,
            prevActions: prev.prevActions.map(p => 
              p.id === event.payload.id ? event.payload : p
            ),
          }

        case 'retro_closed':
          return {
            ...prev,
            cards: [],
            actionCards: [],
            suggestions: [],
            prevActions: event.payload.prevActions,
            session: prev.session
              ? { ...prev.session, timer_status: 'configuring', timer_minutes: 5, timer_ends_at: null, timer_remaining_seconds: null }
              : null,
          }

        default:
          return prev
      }
    })
  }, [])

  // Keep the ref in sync with the latest handler
  useEffect(() => {
    handleRealtimeEventRef.current = handleRealtimeEvent
  }, [handleRealtimeEvent])

  useEffect(() => {
    if (!sessionToken || !participantId) return

    const supabase = supabaseRef.current
    const channelName = `retro:${sessionToken}`

    // Create channel with presence and broadcast
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: participantId },
      },
    })

    // Listen for broadcast events
    channel.on('broadcast', { event: 'retro_event' }, ({ payload }) => {
      handleRealtimeEvent(payload as RealtimeEvent)
    })

    // Listen for presence changes
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState()
      const participants: Participant[] = []
      
      Object.values(presenceState).forEach((presences) => {
        (presences as { id: string; name: string; online_at: string }[]).forEach(p => {
          participants.push({
            id: p.id,
            name: p.name,
            online_at: p.online_at,
          })
        })
      })
      
      setState(prev => ({ ...prev, participants }))
    })

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: participantId,
          name: participantName || 'Anônimo',
          online_at: new Date().toISOString(),
        })
        setState(prev => ({ ...prev, isConnected: true }))
      }
    })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
      setState(prev => ({ ...prev, isConnected: false }))
    }
  }, [sessionToken, participantId, participantName, handleRealtimeEvent])

  // Update presence when name changes
  useEffect(() => {
    if (channelRef.current && participantId && participantName) {
      channelRef.current.track({
        id: participantId,
        name: participantName,
        online_at: new Date().toISOString(),
      })
    }
  }, [participantId, participantName])

  return {
    ...state,
    broadcast,
  }
}
