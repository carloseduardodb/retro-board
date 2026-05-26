import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { suggestion_id } = body

    if (!suggestion_id) {
      return NextResponse.json(
        { error: 'ID da sugestão é obrigatório' },
        { status: 400 }
      )
    }

    const { data: suggestion, error } = await supabase
      .from('suggestions')
      .update({ status: 'rejected' })
      .eq('id', suggestion_id)
      .select()
      .single()

    if (error) {
      console.error('Error rejecting suggestion:', error)
      return NextResponse.json(
        { error: 'Falha ao rejeitar sugestão' },
        { status: 500 }
      )
    }

    return NextResponse.json({ suggestion })
  } catch (error) {
    console.error('Error in POST /api/suggestions/reject:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
