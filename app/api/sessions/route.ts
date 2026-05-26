import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding similar chars
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export async function POST() {
  const supabase = await createClient()
  
  // Generate unique token
  let token = generateToken()
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('sessions')
      .select('token')
      .eq('token', token)
      .single()
    
    if (!existing) break
    token = generateToken()
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    return NextResponse.json(
      { error: 'Falha ao gerar código único' },
      { status: 500 }
    )
  }
  
  // Create session
  const { data, error } = await supabase
    .from('sessions')
    .insert({ token })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Falha ao criar sessão' },
      { status: 500 }
    )
  }
  
  return NextResponse.json({ session: data })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  
  if (!token) {
    return NextResponse.json(
      { error: 'Token é obrigatório' },
      { status: 400 }
    )
  }
  
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token.toUpperCase())
    .single()
  
  if (error || !data) {
    return NextResponse.json(
      { error: 'Sessão não encontrada' },
      { status: 404 }
    )
  }
  
  return NextResponse.json({ session: data })
}
