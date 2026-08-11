/**
 * Dono de card e de ação.
 *
 * O board é anônimo na exibição, mas cada item guarda o `author_id` de quem o
 * escreveu. Esconder o botão na interface não protege nada — a API é aberta e
 * aceita qualquer id —, então quem valida de verdade é o servidor.
 *
 * Vale só para editar o texto e excluir. Mover de coluna, agrupar e votar
 * continuam abertos: são organização do board, e a retro é colaborativa.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type OwnershipDenial = { error: string; message: string; status: number }

const MISSING: OwnershipDenial = {
  error: 'missing_author',
  message: 'Identificação do participante faltando',
  status: 400,
}
const NOT_FOUND: OwnershipDenial = { error: 'not_found', message: 'Item não encontrado', status: 404 }
const FORBIDDEN: OwnershipDenial = {
  error: 'not_owner',
  message: 'Só quem escreveu pode alterar este item',
  status: 403,
}

/**
 * Confere se `authorId` é dono da linha. Devolve `null` quando pode seguir, ou
 * a recusa a ser respondida.
 */
export async function denyUnlessOwner(
  supabase: SupabaseClient,
  table: 'cards' | 'action_cards',
  id: string,
  authorId: unknown,
): Promise<OwnershipDenial | null> {
  if (typeof authorId !== 'string' || !authorId.trim()) return MISSING

  const { data, error } = await supabase
    .from(table)
    .select('author_id')
    .eq('id', id)
    .single()

  if (error || !data) return NOT_FOUND
  return (data as { author_id: string }).author_id === authorId ? null : FORBIDDEN
}
