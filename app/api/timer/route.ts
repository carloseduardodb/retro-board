import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { session_token, action, minutes } = body

    if (!session_token || !action) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Get current session
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', session_token)
      .single()

    if (fetchError || !session) {
      return NextResponse.json(
        { error: 'session_not_found', message: 'Sessão não encontrada' },
        { status: 404 }
      )
    }

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'set': {
        // Propagate configured value to all participants (only in configuring state)
        if (session.timer_status !== 'configuring') {
          return NextResponse.json(
            { error: 'timer_not_running', message: 'Timer não está em modo de configuração' },
            { status: 400 }
          )
        }
        const setMinutes = Math.max(1, Math.min(60, minutes || 5))
        updateData = {
          timer_minutes: setMinutes,
        }
        break
      }

      case 'start': {
        if (session.timer_status === 'running') {
          return NextResponse.json(
            { error: 'timer_already_running', message: 'Timer já está em execução' },
            { status: 400 }
          )
        }

        if (session.timer_status === 'paused' && session.timer_remaining_seconds) {
          // Resume from paused state
          const resumeEndsAt = new Date(Date.now() + session.timer_remaining_seconds * 1000)
          updateData = {
            timer_status: 'running',
            timer_ends_at: resumeEndsAt.toISOString(),
            timer_remaining_seconds: null,
          }
        } else {
          // Start fresh
          const timerMinutes = minutes || session.timer_minutes || 5
          const endsAt = new Date(Date.now() + timerMinutes * 60 * 1000)
          updateData = {
            timer_status: 'running',
            timer_minutes: timerMinutes,
            timer_ends_at: endsAt.toISOString(),
            timer_remaining_seconds: null,
          }
        }
        break
      }

      case 'pause': {
        if (session.timer_status !== 'running' || !session.timer_ends_at) {
          return NextResponse.json(
            { error: 'timer_not_running', message: 'Timer não está em execução' },
            { status: 400 }
          )
        }

        const endsAt = new Date(session.timer_ends_at).getTime()
        const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))

        updateData = {
          timer_status: 'paused',
          timer_ends_at: null,
          timer_remaining_seconds: remaining,
        }
        break
      }

      case 'resume': {
        if (session.timer_status !== 'paused' || !session.timer_remaining_seconds) {
          return NextResponse.json(
            { error: 'timer_not_running', message: 'Timer não está pausado' },
            { status: 400 }
          )
        }

        const resumeEndsAt = new Date(Date.now() + session.timer_remaining_seconds * 1000)
        updateData = {
          timer_status: 'running',
          timer_ends_at: resumeEndsAt.toISOString(),
          timer_remaining_seconds: null,
        }
        break
      }

      case 'add': {
        // Add +1 minute — works when running or finished
        if (session.timer_status === 'running' && session.timer_ends_at) {
          const currentEndsAt = new Date(session.timer_ends_at).getTime()
          const newEndsAt = new Date(currentEndsAt + 60 * 1000)
          updateData = {
            timer_status: 'running',
            timer_ends_at: newEndsAt.toISOString(),
          }
        } else if (session.timer_status === 'finished') {
          // From expired state, start running from 1:00
          const newEndsAt = new Date(Date.now() + 60 * 1000)
          updateData = {
            timer_status: 'running',
            timer_ends_at: newEndsAt.toISOString(),
            timer_remaining_seconds: null,
          }
        } else if (session.timer_status === 'paused' && session.timer_remaining_seconds !== null) {
          updateData = {
            timer_remaining_seconds: session.timer_remaining_seconds + 60,
          }
        } else {
          return NextResponse.json(
            { error: 'timer_not_running', message: 'Timer não está em estado válido para adicionar tempo' },
            { status: 400 }
          )
        }
        break
      }

      case 'reset': {
        updateData = {
          timer_status: 'finished',
          timer_ends_at: null,
          timer_remaining_seconds: 0,
        }
        break
      }

      case 'finish': {
        updateData = {
          timer_status: 'finished',
          timer_ends_at: null,
          timer_remaining_seconds: 0,
        }
        break
      }

      default:
        return NextResponse.json(
          { error: 'timer_invalid_value', message: 'Ação inválida' },
          { status: 400 }
        )
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('token', session_token)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating timer:', updateError)
      return NextResponse.json(
        { error: 'Falha ao atualizar timer' },
        { status: 500 }
      )
    }

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Error in POST /api/timer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
