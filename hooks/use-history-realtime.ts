'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SnapshotData, Card, ActionCard } from '@/lib/types/database'

interface UseHistoryRealtimeOptions {
  sessionToken: string
  date: string | null // YYYY-MM-DD format or null
  enabled: boolean
  onUpdate: (cards: Card[], actionCards: ActionCard[]) => void
}

/**
 * Hook that subscribes to the `retro-history:{token}:{date}` broadcast channel
 * when in history mode. Receives real-time updates from other participants
 * editing the same historical snapshot.
 *
 * When disabled or date changes, it automatically unsubscribes from the previous channel.
 */
export function useHistoryRealtime({
  sessionToken,
  date,
  enabled,
  onUpdate,
}: UseHistoryRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef(createClient())
  const onUpdateRef = useRef(onUpdate)

  // Keep onUpdate ref in sync to avoid effect re-runs
  useEffect(() => {
    onUpdateRef.current = onUpdate
  }, [onUpdate])

  useEffect(() => {
    if (!enabled || !date || !sessionToken) {
      // Cleanup existing channel when disabling or missing params
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
      return
    }

    const supabase = supabaseRef.current
    const channelName = `retro-history:${sessionToken}:${date}`

    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    channel.on('broadcast', { event: '*' }, ({ payload }) => {
      if (payload?.snapshot_data) {
        const snapshotData = payload.snapshot_data as SnapshotData
        onUpdateRef.current(
          snapshotData.cards.map((c) => ({
            ...c,
            session_token: sessionToken,
          })),
          snapshotData.actionCards.map((a) => ({
            ...a,
            session_token: sessionToken,
          }))
        )
      }
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [sessionToken, date, enabled])
}
