import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
        responsible: responsible || null,
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
    const { id, text } = body

    if (!id || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    if (!text.trim() || text.length > 500) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Texto inválido (vazio ou acima de 500 caracteres)' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('action_cards')
      .update({ text: text.trim() })
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
