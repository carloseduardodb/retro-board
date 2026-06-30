import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateReferenceDate } from '@/lib/snapshot-utils'
import type { SnapshotData, SnapshotCard, SnapshotActionCard } from '@/lib/types/database'

export const maxDuration = 120

export async function POST(request: Request) {
  // Validate authorization
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Setup 120s timeout via AbortController
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  let captured = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const supabase = await createClient()
    const referenceDate = calculateReferenceDate()

    // Check if aborted before proceeding
    if (controller.signal.aborted) {
      throw new Error('Timeout: captura abortada após 120s')
    }

    // Fetch all sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('token')

    if (sessionsError) {
      throw new Error(`Erro ao buscar sessões: ${sessionsError.message}`)
    }

    if (!sessions || sessions.length === 0) {
      clearTimeout(timeout)
      return NextResponse.json({ captured: 0, skipped: 0, errors: [] })
    }

    // Process each session
    for (const session of sessions) {
      if (controller.signal.aborted) {
        throw new Error('Timeout: captura abortada após 120s')
      }

      try {
        // Fetch cards for this session
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('*')
          .eq('session_token', session.token)

        if (cardsError) {
          errors.push(`Erro ao buscar cards da sessão ${session.token}: ${cardsError.message}`)
          continue
        }

        // Fetch action_cards for this session
        const { data: actionCards, error: actionCardsError } = await supabase
          .from('action_cards')
          .select('*')
          .eq('session_token', session.token)

        if (actionCardsError) {
          errors.push(`Erro ao buscar action_cards da sessão ${session.token}: ${actionCardsError.message}`)
          continue
        }

        const totalCards = (cards?.length ?? 0) + (actionCards?.length ?? 0)

        // Skip sessions with no cards
        if (totalCards === 0) {
          skipped++
          continue
        }

        // Build snapshot data
        const snapshotCards: SnapshotCard[] = (cards ?? []).map((card) => ({
          id: card.id,
          column_type: card.column_type,
          text: card.text,
          author: card.author,
          author_id: card.author_id,
          votes: card.votes,
          voters: card.voters,
          created_at: card.created_at,
        }))

        const snapshotActionCards: SnapshotActionCard[] = (actionCards ?? []).map((action) => ({
          id: action.id,
          text: action.text,
          responsible: action.responsible,
          author: action.author,
          author_id: action.author_id,
          created_at: action.created_at,
        }))

        const snapshotData: SnapshotData = {
          cards: snapshotCards,
          actionCards: snapshotActionCards,
        }

        // Insert snapshot with ON CONFLICT DO NOTHING (idempotency)
        const { error: insertError } = await supabase
          .from('board_snapshots')
          .upsert(
            {
              session_token: session.token,
              reference_date: referenceDate,
              snapshot_data: snapshotData,
            },
            {
              onConflict: 'session_token,reference_date',
              ignoreDuplicates: true,
            }
          )

        if (insertError) {
          errors.push(`Erro ao inserir snapshot da sessão ${session.token}: ${insertError.message}`)
          continue
        }

        captured++
      } catch (sessionError) {
        const message = sessionError instanceof Error ? sessionError.message : 'Erro desconhecido'
        errors.push(`Erro na sessão ${session.token}: ${message}`)
      }
    }

    clearTimeout(timeout)

    return NextResponse.json({ captured, skipped, errors })
  } catch (error) {
    clearTimeout(timeout)

    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    console.error('Erro na captura de snapshots:', message)

    return NextResponse.json(
      { captured, skipped, errors: [...errors, message] },
      { status: 500 }
    )
  }
}
