import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { card_id, participant_id, action } = body

    if (!card_id || !participant_id || !action) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Get current card
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', card_id)
      .single()

    if (fetchError || !card) {
      return NextResponse.json(
        { error: 'Card não encontrado' },
        { status: 404 }
      )
    }

    const voters = card.voters || []
    const hasVoted = voters.includes(participant_id)

    let newVoters: string[]
    let newVotes: number

    if (action === 'vote' && !hasVoted) {
      newVoters = [...voters, participant_id]
      newVotes = card.votes + 1
    } else if (action === 'unvote' && hasVoted) {
      newVoters = voters.filter((v: string) => v !== participant_id)
      newVotes = Math.max(0, card.votes - 1)
    } else {
      // No change needed
      return NextResponse.json({ card })
    }

    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({ voters: newVoters, votes: newVotes })
      .eq('id', card_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating vote:', updateError)
      return NextResponse.json(
        { error: 'Falha ao atualizar voto' },
        { status: 500 }
      )
    }

    return NextResponse.json({ card: updatedCard })
  } catch (error) {
    console.error('Error in POST /api/cards/vote:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
