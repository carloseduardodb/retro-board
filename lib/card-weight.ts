/**
 * Quanto um card pesou para o time.
 *
 * O joinha nunca foi o único sinal: reagir com 🚀 ou ❤️ também é dizer "isto
 * importa". Ordenar só por voto deixava para baixo o card que o time inteiro
 * reagiu e ninguém votou.
 *
 * Cada reação conta uma, e não cada pessoa que reagiu, porque é exatamente
 * isso que o card mostra em tela: os chips já exibem "🚀 2 ❤️ 1". Somar
 * pessoas distintas daria um número que ninguém consegue conferir olhando.
 */

import type { Reactions } from '@/lib/types/database'

export function reactionCount(reactions: Reactions | null | undefined): number {
  let total = 0
  for (const voters of Object.values(reactions ?? {})) {
    if (Array.isArray(voters)) total += voters.length
  }
  return total
}

export function cardWeight(card: {
  votes?: number | null
  reactions?: Reactions | null
}): number {
  return (card.votes ?? 0) + reactionCount(card.reactions)
}
