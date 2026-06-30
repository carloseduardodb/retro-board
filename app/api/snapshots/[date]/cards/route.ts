import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SnapshotData, SnapshotCard, SnapshotActionCard } from '@/lib/types/database'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST — Adicionar card ou action_card ao snapshot
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  try {
    const body = await request.json()
    const { session_token, type, column_type, text, author, author_id, responsible } = body

    // Validações básicas
    if (!session_token || !text || !author_id || !type) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Data inválida. Use formato YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (!text.trim() || text.length > 500) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Texto inválido (vazio ou acima de 500 caracteres)' },
        { status: 400 }
      )
    }

    if (type === 'card' && !column_type) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'column_type é obrigatório para cards' },
        { status: 400 }
      )
    }

    if (type === 'card' && !['good', 'bad', 'ideas'].includes(column_type)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'column_type inválido. Use: good, bad ou ideas' },
        { status: 400 }
      )
    }

    if (type !== 'card' && type !== 'action') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'type deve ser "card" ou "action"' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar snapshot atual
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

    if (type === 'card') {
      // Verificar limite de 100 cards por coluna
      const cardsInColumn = snapshotData.cards.filter(c => c.column_type === column_type)
      if (cardsInColumn.length >= 100) {
        return NextResponse.json(
          { error: 'column_full', message: 'Coluna atingiu o limite de 100 cards' },
          { status: 400 }
        )
      }

      const newCard: SnapshotCard = {
        id: crypto.randomUUID(),
        column_type,
        text: text.trim(),
        author: author || '',
        author_id,
        votes: 0,
        voters: [],
        created_at: new Date().toISOString(),
      }

      snapshotData.cards.push(newCard)
    } else {
      // type === 'action'
      // Verificar limite de 100 action cards
      if (snapshotData.actionCards.length >= 100) {
        return NextResponse.json(
          { error: 'column_full', message: 'Coluna de ações atingiu o limite de 100 cards' },
          { status: 400 }
        )
      }

      const newAction: SnapshotActionCard = {
        id: crypto.randomUUID(),
        text: text.trim(),
        responsible: responsible || null,
        author: author || '',
        author_id,
        created_at: new Date().toISOString(),
      }

      snapshotData.actionCards.push(newAction)
    }

    // Salvar snapshot atualizado
    const { error: updateError } = await supabase
      .from('board_snapshots')
      .update({ snapshot_data: snapshotData })
      .eq('id', snapshot.id)

    if (updateError) {
      console.error('Error updating snapshot:', updateError)
      return NextResponse.json(
        { error: 'Falha ao salvar alteração no snapshot' },
        { status: 500 }
      )
    }

    // Broadcast da alteração no canal de histórico
    const channel = supabase.channel(`retro-history:${session_token}:${date}`)
    await channel.send({
      type: 'broadcast',
      event: type === 'card' ? 'card_added' : 'action_added',
      payload: { snapshot_data: snapshotData },
    })
    supabase.removeChannel(channel)

    return NextResponse.json({ snapshot_data: snapshotData })
  } catch (error) {
    console.error('Error in POST /api/snapshots/[date]/cards:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * PATCH — Atualizar text e/ou column_type de card existente no snapshot
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  try {
    const body = await request.json()
    const { session_token, type, id, text, column_type, responsible } = body

    if (!session_token || !id || !type) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'session_token, type e id são obrigatórios' },
        { status: 400 }
      )
    }

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Data inválida. Use formato YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (type !== 'card' && type !== 'action') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'type deve ser "card" ou "action"' },
        { status: 400 }
      )
    }

    // Validar texto se fornecido
    if (text !== undefined) {
      if (!text.trim() || text.length > 500) {
        return NextResponse.json(
          { error: 'invalid_payload', message: 'Texto inválido (vazio ou acima de 500 caracteres)' },
          { status: 400 }
        )
      }
    }

    // Validar column_type se fornecido (apenas para cards)
    if (type === 'card' && column_type !== undefined) {
      if (!['good', 'bad', 'ideas'].includes(column_type)) {
        return NextResponse.json(
          { error: 'invalid_payload', message: 'column_type inválido. Use: good, bad ou ideas' },
          { status: 400 }
        )
      }
    }

    const supabase = await createClient()

    // Buscar snapshot atual
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

    if (type === 'card') {
      const cardIndex = snapshotData.cards.findIndex(c => c.id === id)
      if (cardIndex === -1) {
        return NextResponse.json(
          { error: 'not_found', message: 'Card não encontrado no snapshot' },
          { status: 404 }
        )
      }

      // Verificar limite de coluna se estiver mudando de coluna
      if (column_type !== undefined && column_type !== snapshotData.cards[cardIndex].column_type) {
        const cardsInTargetColumn = snapshotData.cards.filter(c => c.column_type === column_type && c.id !== id)
        if (cardsInTargetColumn.length >= 100) {
          return NextResponse.json(
            { error: 'column_full', message: 'Coluna destino atingiu o limite de 100 cards' },
            { status: 400 }
          )
        }
        snapshotData.cards[cardIndex].column_type = column_type
      }

      if (text !== undefined) {
        snapshotData.cards[cardIndex].text = text.trim()
      }
    } else {
      // type === 'action'
      const actionIndex = snapshotData.actionCards.findIndex(a => a.id === id)
      if (actionIndex === -1) {
        return NextResponse.json(
          { error: 'not_found', message: 'Action card não encontrado no snapshot' },
          { status: 404 }
        )
      }

      if (text !== undefined) {
        snapshotData.actionCards[actionIndex].text = text.trim()
      }

      if (responsible !== undefined) {
        snapshotData.actionCards[actionIndex].responsible = responsible || null
      }
    }

    // Salvar snapshot atualizado
    const { error: updateError } = await supabase
      .from('board_snapshots')
      .update({ snapshot_data: snapshotData })
      .eq('id', snapshot.id)

    if (updateError) {
      console.error('Error updating snapshot:', updateError)
      return NextResponse.json(
        { error: 'Falha ao salvar alteração no snapshot' },
        { status: 500 }
      )
    }

    // Broadcast da alteração no canal de histórico
    const channel = supabase.channel(`retro-history:${session_token}:${date}`)
    await channel.send({
      type: 'broadcast',
      event: type === 'card' ? 'card_updated' : 'action_updated',
      payload: { snapshot_data: snapshotData },
    })
    supabase.removeChannel(channel)

    return NextResponse.json({ snapshot_data: snapshotData })
  } catch (error) {
    console.error('Error in PATCH /api/snapshots/[date]/cards:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — Remover card do snapshot pelo id
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params

  try {
    const body = await request.json()
    const { session_token, type, id } = body

    if (!session_token || !id || !type) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'session_token, type e id são obrigatórios' },
        { status: 400 }
      )
    }

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Data inválida. Use formato YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (type !== 'card' && type !== 'action') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'type deve ser "card" ou "action"' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar snapshot atual
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

    if (type === 'card') {
      const cardIndex = snapshotData.cards.findIndex(c => c.id === id)
      if (cardIndex === -1) {
        return NextResponse.json(
          { error: 'not_found', message: 'Card não encontrado no snapshot' },
          { status: 404 }
        )
      }
      snapshotData.cards.splice(cardIndex, 1)
    } else {
      // type === 'action'
      const actionIndex = snapshotData.actionCards.findIndex(a => a.id === id)
      if (actionIndex === -1) {
        return NextResponse.json(
          { error: 'not_found', message: 'Action card não encontrado no snapshot' },
          { status: 404 }
        )
      }
      snapshotData.actionCards.splice(actionIndex, 1)
    }

    // Salvar snapshot atualizado
    const { error: updateError } = await supabase
      .from('board_snapshots')
      .update({ snapshot_data: snapshotData })
      .eq('id', snapshot.id)

    if (updateError) {
      console.error('Error updating snapshot:', updateError)
      return NextResponse.json(
        { error: 'Falha ao salvar alteração no snapshot' },
        { status: 500 }
      )
    }

    // Broadcast da alteração no canal de histórico
    const channel = supabase.channel(`retro-history:${session_token}:${date}`)
    await channel.send({
      type: 'broadcast',
      event: type === 'card' ? 'card_deleted' : 'action_deleted',
      payload: { snapshot_data: snapshotData },
    })
    supabase.removeChannel(channel)

    return NextResponse.json({ snapshot_data: snapshotData })
  } catch (error) {
    console.error('Error in DELETE /api/snapshots/[date]/cards:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
