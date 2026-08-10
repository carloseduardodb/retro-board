import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { RecapClient } from './recap-client'

type Params = Promise<{ token: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params
  return { title: `Recap da retro ${token.toUpperCase()} — Retro Board` }
}

export default async function RecapPage({ params }: { params: Params }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('token', token.toUpperCase())
    .single()

  if (error || !session) {
    notFound()
  }

  const [cardsResult, actionCardsResult] = await Promise.all([
    supabase
      .from('cards')
      .select('*')
      .eq('session_token', token)
      .order('created_at', { ascending: true }),
    supabase
      .from('action_cards')
      .select('*')
      .eq('session_token', token)
      .order('created_at', { ascending: true }),
  ])

  return (
    <RecapClient
      session={session}
      cards={cardsResult.data || []}
      actionCards={actionCardsResult.data || []}
    />
  )
}
