/**
 * Contrato de entrada da composição `RetroRecap`.
 *
 * É deliberadamente independente das tabelas do Supabase: a landing alimenta
 * com dados fictícios (`remotion/data/demo.ts`) e o board alimenta com dados
 * reais (`remotion/build-recap.ts`). A composição não sabe a diferença.
 */

export type RecapCard = {
  id: string
  column: 'good' | 'bad' | 'ideas'
  text: string
  votes: number
  /** Emoji -> quantidade de reações. */
  reactions: Record<string, number>
  groupId: string | null
  groupLabel: string | null
  /** ISO. Usado só para desempate na ordenação, igual ao board. */
  createdAt: string
  /** Quando true, o card é tratado como "do próprio usuário" e não é ocultado na fase anti-viés. */
  own?: boolean
}

export type RecapAction = {
  id: string
  text: string
}

export type RecapData = {
  token: string
  /** Rótulo humano da sessão ("Sprint 42", "10 de agosto"). */
  label: string
  participants: string[]
  cards: RecapCard[]
  actions: RecapAction[]
  /** Minutos configurados no timer, exibidos na cena de escrita. */
  timerMinutes: number
}
