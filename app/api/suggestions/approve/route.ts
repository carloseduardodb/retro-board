import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { suggestion_id, session_token } = body

    if (!suggestion_id || !session_token) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Get suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('suggestions')
      .select('*')
      .eq('id', suggestion_id)
      .single()

    if (fetchError || !suggestion) {
      return NextResponse.json(
        { error: 'Sugestão não encontrada' },
        { status: 404 }
      )
    }

    // Update suggestion status
    const { data: updatedSuggestion, error: updateError } = await supabase
      .from('suggestions')
      .update({ status: 'approved' })
      .eq('id', suggestion_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating suggestion:', updateError)
      return NextResponse.json(
        { error: 'Falha ao aprovar sugestão' },
        { status: 500 }
      )
    }

    // Create action card from suggestion
    const { data: action, error: actionError } = await supabase
      .from('action_cards')
      .insert({
        session_token,
        text: suggestion.text,
        responsible: suggestion.responsible,
        author: 'IA',
        author_id: 'ai-system',
      })
      .select()
      .single()

    if (actionError) {
      console.error('Error creating action from suggestion:', actionError)
      return NextResponse.json(
        { error: 'Falha ao criar ação' },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestion: updatedSuggestion, action })
  } catch (error) {
    console.error('Error in POST /api/suggestions/approve:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
