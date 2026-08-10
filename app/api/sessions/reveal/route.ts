import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Revela (ou volta a ocultar) os cards dos outros participantes enquanto o
// timer está rodando. Fora do estado "rodando" os cards já são visíveis.
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { session_token, revealed } = body

    if (!session_token || typeof revealed !== 'boolean') {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('sessions')
      .update({ cards_revealed: revealed, updated_at: new Date().toISOString() })
      .eq('token', session_token)
      .select()
      .single()

    if (error || !data) {
      console.error('Error updating reveal state:', error)
      return NextResponse.json(
        { error: 'session_not_found', message: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({ session: data })
  } catch (error) {
    console.error('Error in POST /api/sessions/reveal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
