import { NextResponse } from 'next/server'

// O jogo em public/games é HTML estático e não enxerga as variáveis do Next;
// ele busca aqui a mesma config pública que o client do board já usa.
export function GET() {
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}
