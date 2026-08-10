import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Reactions } from '@/lib/types/database'
import { isEmoji } from '@/lib/emoji'

// Alterna a reação de um participante em um card.
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { card_id, participant_id, emoji } = body

    if (!card_id || !participant_id || !emoji) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    if (!isEmoji(emoji)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Emoji inválido' },
        { status: 400 }
      )
    }

    // Teto por card para o jsonb não crescer indefinidamente.
    const MAX_DISTINCT_REACTIONS = 30

    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', card_id)
      .single()

    if (fetchError || !card) {
      return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 })
    }

    const reactions: Reactions = { ...(card.reactions ?? {}) }
    const current = reactions[emoji] ?? []

    if (current.includes(participant_id)) {
      const remaining = current.filter((id) => id !== participant_id)
      if (remaining.length > 0) {
        reactions[emoji] = remaining
      } else {
        delete reactions[emoji]
      }
    } else {
      if (current.length === 0 && Object.keys(reactions).length >= MAX_DISTINCT_REACTIONS) {
        return NextResponse.json(
          {
            error: 'invalid_payload',
            message: `Limite de ${MAX_DISTINCT_REACTIONS} emojis diferentes por card atingido`,
          },
          { status: 400 }
        )
      }
      reactions[emoji] = [...current, participant_id]
    }

    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({ reactions })
      .eq('id', card_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating reactions:', updateError)
      return NextResponse.json({ error: 'Falha ao reagir ao card' }, { status: 500 })
    }

    return NextResponse.json({ card: updatedCard })
  } catch (error) {
    console.error('Error in POST /api/cards/react:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
