import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { denyUnlessOwner } from '@/lib/ownership'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { session_token, text, responsible, author, author_id } = body

    if (!session_token || !text || !author_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('action_cards')
      .insert({
        session_token,
        text,
        responsible: typeof responsible === 'string' && responsible.trim()
          ? responsible.trim().slice(0, 60)
          : null,
        author,
        author_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating action:', error)
      return NextResponse.json(
        { error: 'Falha ao criar ação' },
        { status: 500 }
      )
    }

    return NextResponse.json({ action: data })
  } catch (error) {
    console.error('Error in POST /api/actions:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { id, text, responsible, author_id } = body

    if (!id) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (text !== undefined) {
      if (typeof text !== 'string' || !text.trim() || text.length > 500) {
        return NextResponse.json(
          { error: 'invalid_payload', message: 'Texto inválido (vazio ou acima de 500 caracteres)' },
          { status: 400 }
        )
      }
      updateData.text = text.trim()
    }

    // O responsável é quem vai tocar a ação, não quem a escreveu — pode ser
    // alguém que nem estava na retro, então é texto livre.
    if (responsible !== undefined) {
      if (responsible !== null && typeof responsible !== 'string') {
        return NextResponse.json(
          { error: 'invalid_payload', message: 'Responsável inválido' },
          { status: 400 }
        )
      }
      const name = typeof responsible === 'string' ? responsible.trim() : ''
      if (name.length > 60) {
        return NextResponse.json(
          { error: 'invalid_payload', message: 'Responsável acima de 60 caracteres' },
          { status: 400 }
        )
      }
      updateData.responsible = name || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Nenhum campo para atualizar' },
        { status: 400 }
      )
    }

    const denial = await denyUnlessOwner(supabase, 'action_cards', id, author_id)
    if (denial) {
      return NextResponse.json(
        { error: denial.error, message: denial.message },
        { status: denial.status },
      )
    }

    const { data, error } = await supabase
      .from('action_cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating action:', error)
      return NextResponse.json(
        { error: 'Falha ao atualizar ação' },
        { status: 500 }
      )
    }

    return NextResponse.json({ action: data })
  } catch (error) {
    console.error('Error in PATCH /api/actions:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'ID é obrigatório' },
      { status: 400 }
    )
  }

  const denial = await denyUnlessOwner(supabase, 'action_cards', id, searchParams.get('author_id'))
  if (denial) {
    return NextResponse.json({ error: denial.error, message: denial.message }, { status: denial.status })
  }

  const { error } = await supabase
    .from('action_cards')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting action:', error)
    return NextResponse.json(
      { error: 'Falha ao deletar ação' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
