import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { session_token, column_type, text, author, author_id } = body

    if (!session_token || !column_type || !text || !author_id) {
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

    // Check column limit (max 100 cards per column)
    const { count, error: countError } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('session_token', session_token)
      .eq('column_type', column_type)

    if (countError) {
      console.error('Error counting cards:', countError)
      return NextResponse.json(
        { error: 'Erro ao verificar limite de cards' },
        { status: 500 }
      )
    }

    if (count !== null && count >= 100) {
      return NextResponse.json(
        { error: 'column_full', message: 'Coluna atingiu o limite de 100 cards' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('cards')
      .insert({
        session_token,
        column_type,
        text: text.trim(),
        author,
        author_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating card:', error)
      return NextResponse.json(
        { error: 'Falha ao criar card' },
        { status: 500 }
      )
    }

    return NextResponse.json({ card: data })
  } catch (error) {
    console.error('Error in POST /api/cards:', error)
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
    .from('cards')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting card:', error)
    return NextResponse.json(
      { error: 'Falha ao deletar card' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
