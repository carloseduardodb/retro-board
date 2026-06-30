import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SnapshotData } from '@/lib/types/database'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  try {
    const body = await request.json()
    const { session_token, card_id, voter_id } = body

    if (!session_token || !card_id || !voter_id) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'session_token, card_id e voter_id são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch the snapshot
    const { data: snapshot, error: fetchError } = await supabase
      .from('board_snapshots')
      .select('*')
      .eq('session_token', session_token)
      .eq('reference_date', date)
      .single()

    if (fetchError || !snapshot) {
      return NextResponse.json(
        { error: 'Snapshot não encontrado' },
        { status: 404 }
      )
    }

    const snapshotData = snapshot.snapshot_data as SnapshotData

    // Find the card
    const cardIndex = snapshotData.cards.findIndex(c => c.id === card_id)
    if (cardIndex === -1) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Card não encontrado no snapshot' },
        { status: 404 }
      )
    }

    const card = snapshotData.cards[cardIndex]
    const voters = card.voters ?? []
    const alreadyVoted = voters.includes(voter_id)

    // Toggle vote
    if (alreadyVoted) {
      card.voters = voters.filter(v => v !== voter_id)
      card.votes = card.voters.length
    } else {
      card.voters = [...voters, voter_id]
      card.votes = card.voters.length
    }

    snapshotData.cards[cardIndex] = card

    // Save back
    const { error: updateError } = await supabase
      .from('board_snapshots')
      .update({ snapshot_data: snapshotData })
      .eq('id', snapshot.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Falha ao salvar voto' },
        { status: 500 }
      )
    }

    return NextResponse.json({ card: snapshotData.cards[cardIndex] })
  } catch (error) {
    console.error('Error in POST /api/snapshots/[date]/cards/vote:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
