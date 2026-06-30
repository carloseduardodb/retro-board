import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sortSnapshotCards } from '@/lib/snapshot-utils'
import type { SnapshotData } from '@/lib/types/database'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(
  request: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params
  const { searchParams } = new URL(request.url)
  const sessionToken = searchParams.get('session_token')

  if (!sessionToken) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'session_token é obrigatório' },
      { status: 400 }
    )
  }

  if (!DATE_REGEX.test(date)) {
    return NextResponse.json(
      { error: 'invalid_payload', message: 'Data inválida. Use formato YYYY-MM-DD' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('board_snapshots')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('reference_date', date)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Snapshot não encontrado' },
      { status: 404 }
    )
  }

  // Sort cards before returning
  const snapshotData = data.snapshot_data as SnapshotData
  const sortedData: SnapshotData = {
    cards: sortSnapshotCards(snapshotData.cards),
    actionCards: snapshotData.actionCards,
  }

  return NextResponse.json({
    snapshot: {
      id: data.id,
      reference_date: data.reference_date,
      snapshot_data: sortedData,
      created_at: data.created_at,
    },
  })
}
