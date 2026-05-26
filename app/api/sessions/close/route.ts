import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { session_token } = body

    if (!session_token) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Token da sessão é obrigatório' },
        { status: 400 }
      )
    }

    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('token')
      .eq('token', session_token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'session_not_found', message: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    // 1. Get current action cards to copy to prev_actions
    const { data: actionCards } = await supabase
      .from('action_cards')
      .select('*')
      .eq('session_token', session_token)

    // 2. Delete existing prev_actions (only keep last sprint)
    await supabase
      .from('prev_actions')
      .delete()
      .eq('session_token', session_token)

    // 3. Copy action cards to prev_actions
    const newPrevActions = []
    if (actionCards && actionCards.length > 0) {
      for (const action of actionCards) {
        const { data, error } = await supabase
          .from('prev_actions')
          .insert({
            session_token,
            text: action.text,
            responsible: action.responsible,
            done: false,
          })
          .select()
          .single()

        if (!error && data) {
          newPrevActions.push(data)
        }
      }
    }

    // 4. Delete all cards from the four columns
    await supabase
      .from('cards')
      .delete()
      .eq('session_token', session_token)

    await supabase
      .from('action_cards')
      .delete()
      .eq('session_token', session_token)

    // 5. Discard pending suggestions
    await supabase
      .from('suggestions')
      .delete()
      .eq('session_token', session_token)

    // 6. Reset timer to configuring state
    await supabase
      .from('sessions')
      .update({
        timer_status: 'configuring',
        timer_minutes: 5,
        timer_ends_at: null,
        timer_remaining_seconds: null,
        updated_at: new Date().toISOString(),
      })
      .eq('token', session_token)

    return NextResponse.json({ prevActions: newPrevActions })
  } catch (error) {
    console.error('Error in POST /api/sessions/close:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
