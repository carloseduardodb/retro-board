import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BoardClient } from './board-client'

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
  const [cardsResult, actionCardsResult, suggestionsResult, prevActionsResult] = await Promise.all([
    supabase.from('cards').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('action_cards').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('suggestions').select('*').eq('session_token', token).order('created_at', { ascending: true }),
    supabase.from('prev_actions').select('*').eq('session_token', token).order('created_at', { ascending: true }),
  ])

  return (
    <BoardClient
      session={session}
      initialCards={cardsResult.data || []}
      initialActionCards={actionCardsResult.data || []}
      initialSuggestions={suggestionsResult.data || []}
      initialPrevActions={prevActionsResult.data || []}
    />
  )
}
