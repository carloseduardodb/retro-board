import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { session_token, text, responsible } = body

    if (!session_token || !text) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('prev_actions')
      .insert({
        session_token,
        text,
        responsible: responsible || null,
        done: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating prev action:', error)
      return NextResponse.json(
        { error: 'Falha ao criar ação anterior' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prevAction: data })
  } catch (error) {
    console.error('Error in POST /api/prev-actions:', error)
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
    const { id, done } = body

    if (!id || typeof done !== 'boolean') {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('prev_actions')
      .update({ done })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating prev action:', error)
      return NextResponse.json(
        { error: 'Falha ao atualizar ação anterior' },
        { status: 500 }
      )
    }

    return NextResponse.json({ prevAction: data })
  } catch (error) {
    console.error('Error in PATCH /api/prev-actions:', error)
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
    .from('prev_actions')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting prev action:', error)
    return NextResponse.json(
      { error: 'Falha ao deletar ação anterior' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
