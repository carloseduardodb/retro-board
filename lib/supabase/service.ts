import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Cliente para trabalhos de fundo (cron), que rodam fora de um request.
 *
 * O cliente de `lib/supabase/server.ts` lê `cookies()` do Next, o que só existe
 * dentro de um request — chamá-lo a partir do agendador lança.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
