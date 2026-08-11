/**
 * Traduz o estado real de uma sessão (tabelas do Supabase) para o contrato da
 * composição. É o que faz o vídeo da landing e o recap do time serem, de fato,
 * a mesma peça.
 */

import { cardWeight } from '@/lib/card-weight'
import type { ActionCard, Card, Session } from '@/lib/types/database'
import type { RecapCard, RecapData } from './types'

function countReactions(reactions: Card['reactions']): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const [emoji, voters] of Object.entries(reactions ?? {})) {
    if (Array.isArray(voters) && voters.length > 0) counts[emoji] = voters.length
  }
  // No vídeo cabem poucos chips por card; ficam os mais reagidos.
  return Object.fromEntries(
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3),
  )
}

export function buildRecapData({
  session,
  cards,
  actionCards,
  participantId,
}: {
  session: Session
  cards: Card[]
  actionCards: ActionCard[]
  /** Quando informado, os cards dessa pessoa não são ocultados na fase anti-viés. */
  participantId?: string
}): RecapData {
  const recapCards: RecapCard[] = cards.map((card) => ({
    id: card.id,
    column: card.column_type,
    text: card.text,
    votes: card.votes ?? 0,
    reactions: countReactions(card.reactions),
    // Calculado sobre as reações inteiras, não sobre os três chips que sobram
    // de `countReactions` — senão o peso mudaria conforme o que cabe em tela.
    weight: cardWeight(card),
    groupId: card.group_id,
    groupLabel: card.group_label,
    createdAt: card.created_at,
    own: participantId ? card.author_id === participantId : false,
  }))

  const date = new Date(session.updated_at ?? session.created_at)
  const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return {
    token: session.token,
    label: `Retro de ${label}`,
    timerMinutes: session.timer_minutes ?? 5,
    participants: uniqueAuthors(cards, actionCards),
    cards: recapCards,
    actions: actionCards.map((action) => ({ id: action.id, text: action.text })),
  }
}

/**
 * Presence é efêmera, então quem "participou" é derivado da autoria dos cards —
 * os nomes já são gravados neles, mesmo o board sendo anônimo na exibição.
 */
function uniqueAuthors(cards: Card[], actionCards: ActionCard[]): string[] {
  const names = new Set<string>()
  for (const item of [...cards, ...actionCards]) {
    const name = item.author?.trim()
    if (name) names.add(name)
  }
  // Sem corte: quem entrou conta para o número exibido. O cabeçalho é que
  // decide quantos avatares desenha (ver `BoardHeader`).
  return [...names]
}

export const hasEnoughForRecap = (cards: Card[], actionCards: ActionCard[]) =>
  cards.length + actionCards.length >= 3
