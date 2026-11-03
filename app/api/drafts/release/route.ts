import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { countDrafts } from '@/lib/drafts'
import type { Card, ActionCard, DraftCard } from '@/lib/types/database'

// Mesmo limite do POST /api/cards.
const MAX_CARDS_PER_COLUMN = 100

/**
 * Joga a caixinha no board: cada anotação vira card na sua coluna (ou ação).
 *
 * A anotação é *reivindicada* com um delete que devolve as linhas apagadas,
 * antes de virar card. Assim, dois cliques simultâneos não duplicam nada: só
 * quem apagou a linha a insere no board.
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const { session_token } = await request.json()
    if (!session_token) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Token da sessão é obrigatório' },
        { status: 400 },
      )
    }

    const [{ data: drafts, error: draftsError }, { data: boardCards, error: cardsError }] = await Promise.all([
      supabase
        .from('draft_cards')
        .select('id, column_type')
        .eq('session_token', session_token)
        .order('created_at', { ascending: true }),
      supabase.from('cards').select('column_type').eq('session_token', session_token),
    ])

    if (draftsError || cardsError) {
      console.error('Error loading drafts to release:', draftsError ?? cardsError)
      return NextResponse.json({ error: 'Falha ao ler a caixinha' }, { status: 500 })
    }

    // Respeita o limite de cards por coluna: o que não couber fica na caixinha.
    const room: Record<string, number> = {
      good: MAX_CARDS_PER_COLUMN,
      bad: MAX_CARDS_PER_COLUMN,
      ideas: MAX_CARDS_PER_COLUMN,
    }
    for (const c of boardCards ?? []) room[c.column_type]--

    const ids: string[] = []
    for (const d of drafts ?? []) {
      if (d.column_type === 'actions') {
        ids.push(d.id)
      } else if (room[d.column_type] > 0) {
        room[d.column_type]--
        ids.push(d.id)
      }
    }

    if (ids.length === 0) {
      return NextResponse.json({
        cards: [],
        actionCards: [],
        counts: await countDrafts(supabase, session_token),
      })
    }

    const { data: claimed, error: claimError } = await supabase
      .from('draft_cards')
      .delete()
      .in('id', ids)
      .select()

    if (claimError) {
      console.error('Error claiming drafts:', claimError)
      return NextResponse.json({ error: 'Falha ao ler a caixinha' }, { status: 500 })
    }

    const rows = (claimed ?? []) as DraftCard[]
    rows.sort((a, b) => a.created_at.localeCompare(b.created_at))
    const toCards = rows.filter(r => r.column_type !== 'actions')
    const toActions = rows.filter(r => r.column_type === 'actions')

    let cards: Card[] = []
    let actionCards: ActionCard[] = []
    try {
      if (toCards.length > 0) {
        const { data, error } = await supabase
          .from('cards')
          .insert(toCards.map(r => ({
            session_token,
            column_type: r.column_type as Card['column_type'],
            text: r.text,
            author: r.author,
            author_id: r.author_id,
          })))
          .select()
        if (error) throw error
        cards = data ?? []
      }

      if (toActions.length > 0) {
        const { data, error } = await supabase
          .from('action_cards')
          .insert(toActions.map(r => ({
            session_token,
            text: r.text,
            author: r.author,
            author_id: r.author_id,
          })))
          .select()
        if (error) throw error
        actionCards = data ?? []
      }
    } catch (error) {
      // Devolve à caixinha o que não chegou ao board, para nada se perder.
      console.error('Error releasing drafts:', error)
      // Os cards entram primeiro: se já entraram, só as ações ficaram de fora.
      const lost = toCards.length > 0 && cards.length > 0 ? toActions : rows
      if (lost.length > 0) await supabase.from('draft_cards').insert(lost)
      return NextResponse.json(
        {
          error: 'Falha ao jogar a caixinha no board',
          cards,
          actionCards,
          counts: await countDrafts(supabase, session_token),
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      cards,
      actionCards,
      counts: await countDrafts(supabase, session_token),
    })
  } catch (error) {
    console.error('Error in POST /api/drafts/release:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
