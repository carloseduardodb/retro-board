import { NextResponse } from 'next/server'

// This endpoint is no longer used.
// Per spec, the system does not call any AI API directly.
// The prompt is generated client-side and copied to clipboard.
// The user pastes the AI response via /api/ai/parse.

export async function POST() {
  return NextResponse.json(
    { error: 'Este endpoint foi desativado. Use o fluxo de copiar prompt e colar retorno da IA.' },
    { status: 410 }
  )
}
