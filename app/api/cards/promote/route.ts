import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Move um card para a coluna de Ações.
 *
 * Ações vivem noutra tabela — têm responsável e sobrevivem à retro, voltando
 * marcadas na sprint seguinte —, então "mover" aqui é criar a ação e apagar o
 * card. Sem isso o time duplica na mão o card que virou compromisso, e o board
 * fica dizendo duas vezes a mesma coisa.
 *
 * Fica aberto a quem não escreveu o card de propósito: transformar em ação é
 * gesto de facilitação, e quem facilita raramente é quem escreveu.
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  try {
    const { card_id, responsible } = await request.json()

    if (!card_id) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'card_id é obrigatório' },
        { status: 400 },
      )
    }

    const { data: card, error: findError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', card_id)
      .single()

    if (findError || !card) {
      return NextResponse.json({ error: 'not_found', message: 'Card não encontrado' }, { status: 404 })
    }

    const source = card as {
      id: string
      session_token: string
      text: string
      author: string
      author_id: string
    }

    // A autoria vai junto: quem escreveu o card continua dono da ação, então
    // continua sendo quem pode editá-la e excluí-la.
    const { data: action, error: insertError } = await supabase
      .from('action_cards')
      .insert({
        session_token: source.session_token,
        text: source.text,
        responsible: typeof responsible === 'string' && responsible.trim()
          ? responsible.trim().slice(0, 60)
          : null,
        author: source.author,
        author_id: source.author_id,
      })
      .select()
      .single()

    if (insertError || !action) {
      console.error('Error promoting card:', insertError)
      return NextResponse.json({ error: 'Falha ao criar a ação' }, { status: 500 })
    }

    // A ação já existe: se apagar o card falhar, o board mostra os dois e o
    // time resolve na mão. O contrário — apagar antes e falhar ao criar —
    // perderia o que a pessoa escreveu.
    const { error: deleteError } = await supabase.from('cards').delete().eq('id', source.id)
    if (deleteError) {
      console.error('Ação criada, mas o card original permaneceu:', deleteError)
    }

    return NextResponse.json({ action, removedCardId: source.id })
  } catch (error) {
    console.error('Error in POST /api/cards/promote:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
