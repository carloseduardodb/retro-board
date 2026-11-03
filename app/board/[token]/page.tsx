import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BoardClient } from './board-client'
import { countDrafts } from '@/lib/drafts'

type Params = Promise<{ token: string }>

export default async function BoardPage({ params }: { params: Params }) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token.toUpperCase())
    .single()

  if (sessionError || !session) {
    notFound()
  }

  // Fetch all related data
  const [cardsResult, actionCardsResult, suggestionsResult, prevActionsResult, kudosResult, draftCounts] = await Promise.all([
    supabase.from('cards').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('action_cards').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('suggestions').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('prev_actions').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('kudos').select('*').eq('session_token', token).is('archived_at', null).order('created_at', { ascending: true }),
    // Só a contagem: o texto da caixinha dos outros não vem para a página.
    countDrafts(supabase, token),
  ])

  return (
    <BoardClient
      session={session}
      initialCards={cardsResult.data || []}
      initialActionCards={actionCardsResult.data || []}
      initialSuggestions={suggestionsResult.data || []}
      initialPrevActions={prevActionsResult.data || []}
      initialKudos={kudosResult.data || []}
      initialDraftCounts={draftCounts}
    />
  )
}
