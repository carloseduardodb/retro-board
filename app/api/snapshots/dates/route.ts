import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionToken = searchParams.get('session_token')

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'session_token é obrigatório' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('reference_date')
    .eq('session_token', sessionToken)
    .order('reference_date', { ascending: false })

  if (error) {
    console.error('Error fetching snapshot dates:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar datas de snapshots' },
      { status: 500 }
    )
  }

  const dates = (data ?? []).map((row) => row.reference_date)

  return NextResponse.json({ dates })
}
