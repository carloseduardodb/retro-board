import type { SupabaseClient } from '@supabase/supabase-js'
import type { DraftCounts } from '@/lib/types/database'

export const DRAFT_COLUMNS = ['good', 'bad', 'ideas', 'actions'] as const
export type DraftColumn = (typeof DRAFT_COLUMNS)[number]

export const emptyDraftCounts = (): DraftCounts => ({ good: 0, bad: 0, ideas: 0, actions: 0 })

/**
 * Contagem da caixinha por coluna. Só lê `column_type`: o texto das anotações
 * dos outros nunca sai do servidor antes de ir para o board.
 */
export async function countDrafts(supabase: SupabaseClient, sessionToken: string): Promise<DraftCounts> {
  const counts = emptyDraftCounts()
  const { data } = await supabase
    .from('draft_cards')
    .select('column_type')
    .eq('session_token', sessionToken)
  for (const row of (data ?? []) as { column_type: DraftColumn }[]) {
    if (row.column_type in counts) counts[row.column_type]++
  }
  return counts
}
