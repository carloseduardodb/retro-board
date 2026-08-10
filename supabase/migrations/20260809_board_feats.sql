-- Board feats: agrupamento de cards, reações com emoji e revelação anti-viés.
-- Execute no SQL Editor do Supabase (ou via `supabase db push`).

-- 1. Agrupamento de cards relacionados.
--    group_id/group_label são denormalizados em todos os cards do grupo,
--    assim o realtime existente (card_updated) já propaga a mudança.
alter table public.cards
  add column if not exists group_id uuid,
  add column if not exists group_label text;

create index if not exists cards_group_id_idx on public.cards (group_id);

-- 2. Reações com emoji: { "🔥": ["participantId", ...], ... }
alter table public.cards
  add column if not exists reactions jsonb not null default '{}'::jsonb;

