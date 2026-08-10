import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Card } from '@/lib/types/database'

// Agrupa um card em outro. O grupo do card alvo é reaproveitado quando existir;
// caso contrário um novo group_id é criado para os dois.
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { card_id, target_card_id } = body

    if (!card_id || !target_card_id || card_id === target_card_id) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Cards inválidos para agrupamento' },
        { status: 400 }
      )
    }

    const { data: cards, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .in('id', [card_id, target_card_id])

    if (fetchError || !cards || cards.length !== 2) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Card não encontrado' },
        { status: 404 }
      )
    }

    const source = cards.find((c: Card) => c.id === card_id)!
    const target = cards.find((c: Card) => c.id === target_card_id)!

    if (source.session_token !== target.session_token) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Cards de sessões diferentes' },
        { status: 400 }
      )
    }

    const groupId = target.group_id ?? crypto.randomUUID()
    const groupLabel = target.group_label ?? source.group_label ?? null

    // Todos os cards que entram no grupo: o card arrastado (mais seu grupo
    // anterior, se tinha um), o card alvo e o grupo dele.
    const idsToUpdate = new Set<string>([source.id, target.id])
    const previousGroupIds = [source.group_id, target.group_id].filter(
      (id): id is string => Boolean(id) && id !== groupId
    )

    if (previousGroupIds.length > 0) {
      const { data: siblings } = await supabase
        .from('cards')
        .select('id')
        .eq('session_token', source.session_token)
        .in('group_id', previousGroupIds)

      siblings?.forEach((c: { id: string }) => idsToUpdate.add(c.id))
    }

    const { data: updated, error: updateError } = await supabase
      .from('cards')
      .update({
        group_id: groupId,
        group_label: groupLabel,
        column_type: target.column_type,
      })
      .in('id', Array.from(idsToUpdate))
      .select()

    if (updateError) {
      console.error('Error grouping cards:', updateError)
      return NextResponse.json(
        { error: 'Falha ao agrupar cards' },
        { status: 500 }
      )
    }

    return NextResponse.json({ cards: updated, group_id: groupId })
  } catch (error) {
    console.error('Error in POST /api/cards/group:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Renomeia o grupo (label opcional, até 60 caracteres).
export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { group_id, session_token, label } = body

    if (!group_id || !session_token) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    if (label !== null && (typeof label !== 'string' || label.length > 60)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Título inválido (máximo 60 caracteres)' },
        { status: 400 }
      )
    }

    const { data: updated, error } = await supabase
      .from('cards')
      .update({ group_label: label ? label.trim() : null })
      .eq('group_id', group_id)
      .eq('session_token', session_token)
      .select()

    if (error) {
      console.error('Error renaming group:', error)
      return NextResponse.json({ error: 'Falha ao renomear grupo' }, { status: 500 })
    }

    return NextResponse.json({ cards: updated })
  } catch (error) {
    console.error('Error in PATCH /api/cards/group:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Desagrupa: `card_id` remove um card do grupo, `group_id` desfaz o grupo todo.
// Um grupo com um único card restante é desfeito automaticamente.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('card_id')
  const groupId = searchParams.get('group_id')
  const sessionToken = searchParams.get('session_token')

  try {
    if (groupId && sessionToken) {
      const { data: updated, error } = await supabase
        .from('cards')
        .update({ group_id: null, group_label: null })
        .eq('group_id', groupId)
        .eq('session_token', sessionToken)
        .select()

      if (error) {
        console.error('Error ungrouping:', error)
        return NextResponse.json({ error: 'Falha ao desagrupar' }, { status: 500 })
      }

      return NextResponse.json({ cards: updated })
    }

    if (!cardId) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'card_id ou group_id é obrigatório' },
        { status: 400 }
      )
    }

    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single()

    if (fetchError || !card) {
      return NextResponse.json({ error: 'Card não encontrado' }, { status: 404 })
    }

    if (!card.group_id) {
      return NextResponse.json({ cards: [card] })
    }

    const idsToClear = [card.id]

    const { data: siblings } = await supabase
      .from('cards')
      .select('id')
      .eq('group_id', card.group_id)
      .eq('session_token', card.session_token)
      .neq('id', card.id)

    // Grupo de um card só não faz sentido — desfaz junto.
    if (siblings && siblings.length === 1) {
      idsToClear.push(siblings[0].id)
    }

    const { data: updated, error } = await supabase
      .from('cards')
      .update({ group_id: null, group_label: null })
      .in('id', idsToClear)
      .select()

    if (error) {
      console.error('Error ungrouping card:', error)
      return NextResponse.json({ error: 'Falha ao desagrupar' }, { status: 500 })
    }

    return NextResponse.json({ cards: updated })
  } catch (error) {
    console.error('Error in DELETE /api/cards/group:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
