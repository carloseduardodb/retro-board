import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { denyUnlessOwner } from '@/lib/ownership'
import { DRAFT_COLUMNS, countDrafts } from '@/lib/drafts'

const MAX_TEXT = 500
// Teto da caixinha inteira — cada coluna do board aceita 100 cards.
const MAX_DRAFTS = 400

function invalid(message: string) {
  return NextResponse.json({ error: 'invalid_payload', message }, { status: 400 })
}

function validText(text: unknown): text is string {
  return typeof text === 'string' && !!text.trim() && text.length <= MAX_TEXT
}

// As anotações de quem pergunta (com texto) + a contagem do time (sem texto).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const sessionToken = searchParams.get('session_token')
  const authorId = searchParams.get('author_id')

  if (!sessionToken || !authorId) return invalid('Campos obrigatórios faltando')

  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from('draft_cards')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('author_id', authorId)
      .order('created_at', { ascending: true }),
    countDrafts(supabase, sessionToken),
  ])

  if (error) {
    console.error('Error loading drafts:', error)
    return NextResponse.json({ error: 'Falha ao carregar a caixinha' }, { status: 500 })
  }

  return NextResponse.json({ drafts: data ?? [], counts })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const { session_token, column_type, text, author, author_id } = await request.json()

    if (!session_token || typeof author_id !== 'string' || !author_id.trim()) {
      return invalid('Campos obrigatórios faltando')
    }
    if (!DRAFT_COLUMNS.includes(column_type)) return invalid('Coluna inválida')
    if (!validText(text)) return invalid(`Texto inválido (vazio ou acima de ${MAX_TEXT} caracteres)`)

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
      .from('draft_cards')
      .select('*', { count: 'exact', head: true })
      .eq('session_token', session_token)

    if (count !== null && count >= MAX_DRAFTS) {
      return NextResponse.json(
        { error: 'drafts_full', message: `A caixinha atingiu o limite de ${MAX_DRAFTS} anotações` },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from('draft_cards')
      .insert({
        session_token,
        column_type,
        text: text.trim(),
        author: String(author ?? '').trim().slice(0, 20),
        author_id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating draft:', error)
      return NextResponse.json({ error: 'Falha ao salvar a anotação' }, { status: 500 })
    }

    return NextResponse.json({ draft: data, counts: await countDrafts(supabase, session_token) })
  } catch (error) {
    console.error('Error in POST /api/drafts:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// Editar texto ou trocar de coluna — só quem escreveu.
export async function PATCH(request: Request) {
  const supabase = await createClient()

  try {
    const { id, text, column_type, author_id } = await request.json()
    if (!id) return invalid('ID é obrigatório')

    const update: { text?: string; column_type?: (typeof DRAFT_COLUMNS)[number] } = {}
    if (text !== undefined) {
      if (!validText(text)) return invalid(`Texto inválido (vazio ou acima de ${MAX_TEXT} caracteres)`)
      update.text = text.trim()
    }
    if (column_type !== undefined) {
      if (!DRAFT_COLUMNS.includes(column_type)) return invalid('Coluna inválida')
      update.column_type = column_type
    }
    if (Object.keys(update).length === 0) return invalid('Nenhum campo para atualizar')

    const denial = await denyUnlessOwner(supabase, 'draft_cards', id, author_id)
    if (denial) {
      return NextResponse.json({ error: denial.error, message: denial.message }, { status: denial.status })
    }

    const { data, error } = await supabase
      .from('draft_cards')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      console.error('Error updating draft:', error)
      return NextResponse.json({ error: 'Falha ao atualizar a anotação' }, { status: 500 })
    }

    return NextResponse.json({ draft: data, counts: await countDrafts(supabase, data.session_token) })
  } catch (error) {
    console.error('Error in PATCH /api/drafts:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  const denial = await denyUnlessOwner(supabase, 'draft_cards', id, searchParams.get('author_id'))
  if (denial) {
    return NextResponse.json({ error: denial.error, message: denial.message }, { status: denial.status })
  }

  const { data, error } = await supabase
    .from('draft_cards')
    .delete()
    .eq('id', id)
    .select('session_token')
    .single()

  if (error || !data) {
    console.error('Error deleting draft:', error)
    return NextResponse.json({ error: 'Falha ao apagar a anotação' }, { status: 500 })
  }

  return NextResponse.json({ success: true, counts: await countDrafts(supabase, data.session_token) })
}
