import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  
  try {
    const body = await request.json()
    const { session_token, suggestions: rawSuggestions } = body

    if (!session_token || !rawSuggestions) {
      return NextResponse.json(
        { error: 'invalid_payload', message: 'Campos obrigatórios faltando' },
        { status: 400 }
      )
    }

    // Validate format
    if (!Array.isArray(rawSuggestions)) {
      return NextResponse.json(
        { error: 'invalid_ai_payload', message: 'JSON deve ser um array' },
        { status: 400 }
      )
    }

    for (const item of rawSuggestions) {
      if (!item || typeof item.text !== 'string' || !item.text.trim()) {
        return NextResponse.json(
          { error: 'invalid_ai_payload', message: 'Cada item deve ter um campo "text" válido' },
          { status: 400 }
        )
      }
    }

    // Insert suggestions
    const suggestions = []
    for (const item of rawSuggestions) {
      const { data, error } = await supabase
        .from('suggestions')
        .insert({
          session_token,
          text: item.text.trim(),
          responsible: item.responsible || null,
          status: 'pending',
        })
        .select()
        .single()

      if (!error && data) {
        suggestions.push(data)
      }
    }

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Error in POST /api/ai/parse:', error)
    return NextResponse.json(
      { error: 'invalid_ai_payload', message: 'Erro ao processar JSON' },
      { status: 400 }
    )
  }
}
