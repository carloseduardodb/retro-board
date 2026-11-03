import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { denyUnlessOwner } from '@/lib/ownership'

const MAX_TO_NAME = 20
const MAX_MESSAGE = 280
// Mural é um espaço de elogios, não um chat: um teto por ciclo evita abuso.
const MAX_OPEN_KUDOS = 300

function invalid(message: string) {
  return NextResponse.json({ error: 'invalid_payload', message }, { status: 400 })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { session_token, to_name, message, author, author_id, anonymous } = body

    if (!session_token || typeof author_id !== 'string' || !author_id.trim()) {
      return invalid('Campos obrigatórios faltando')
    }

    const toName = typeof to_name === 'string' ? to_name.trim() : ''
    const text = typeof message === 'string' ? message.trim() : ''

    if (!toName || toName.length > MAX_TO_NAME) {
      return invalid(`Destinatário inválido (vazio ou acima de ${MAX_TO_NAME} caracteres)`)
    }
    if (!text || text.length > MAX_MESSAGE) {
      return invalid(`Mensagem inválida (vazia ou acima de ${MAX_MESSAGE} caracteres)`)
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('token')
      .eq('token', session_token)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: 'session_not_found', message: 'Sessão não encontrada' },
        { status: 404 },
      )
    }

    const { count } = await supabase
      .from('kudos')
      .select('*', { count: 'exact', head: true })
      .eq('session_token', session_token)
      .is('archived_at', null)

    if (count !== null && count >= MAX_OPEN_KUDOS) {
      return NextResponse.json(
        { error: 'kudos_full', message: `O mural atingiu o limite de ${MAX_OPEN_KUDOS} kudos` },
        { status: 400 },
      )
    }

    const isAnonymous = anonymous === true

    const { data, error } = await supabase
      .from('kudos')
      .insert({
        session_token,
        to_name: toName,
        message: text,
        // Anônimo de verdade: o nome nem chega ao banco. O author_id fica só
        // para o próprio autor conseguir apagar o kudo.
        author: isAnonymous ? '' : String(author ?? '').trim().slice(0, 20),
        author_id,
        anonymous: isAnonymous,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating kudo:', error)
      return NextResponse.json({ error: 'Falha ao criar kudo' }, { status: 500 })
    }

    return NextResponse.json({ kudo: data })
  } catch (error) {
    console.error('Error in POST /api/kudos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Curtir / descurtir um kudo (+1 do time).
export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { id, participant_id, action } = body

    if (!id || typeof participant_id !== 'string' || !participant_id || !['like', 'unlike'].includes(action)) {
      return invalid('Campos obrigatórios faltando')
    }

    const { data: kudo, error: fetchError } = await supabase
      .from('kudos')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !kudo) {
      return NextResponse.json({ error: 'not_found', message: 'Kudo não encontrado' }, { status: 404 })
    }

    const likes = kudo.likes || []
    const hasLiked = likes.includes(participant_id)

    if ((action === 'like') === hasLiked) {
      return NextResponse.json({ kudo })
    }

    const newLikes = action === 'like'
      ? [...likes, participant_id]
      : likes.filter((p) => p !== participant_id)

    const { data: updated, error } = await supabase
      .from('kudos')
      .update({ likes: newLikes })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating kudo likes:', error)
      return NextResponse.json({ error: 'Falha ao curtir kudo' }, { status: 500 })
    }

    return NextResponse.json({ kudo: updated })
  } catch (error) {
    console.error('Error in PATCH /api/kudos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
  }

  const denial = await denyUnlessOwner(supabase, 'kudos', id, searchParams.get('author_id'))
  if (denial) {
    return NextResponse.json({ error: denial.error, message: denial.message }, { status: denial.status })
  }

  const { error } = await supabase.from('kudos').delete().eq('id', id)

  if (error) {
    console.error('Error deleting kudo:', error)
    return NextResponse.json({ error: 'Falha ao deletar kudo' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
