-- Caixinha da sprint: anotações (bom, a melhorar, ideias, ações) escritas
-- durante a sprint e despejadas nas colunas quando a retro começa.
-- Execute no SQL Editor do Supabase (ou via `supabase db push`).
--
-- Ao "jogar no board", a linha sai daqui e vira um card (ou ação) — por isso
-- não há coluna de status: o que está nesta tabela é o que ainda não entrou.

create table if not exists public.draft_cards (
  id uuid primary key default gen_random_uuid(),
  session_token text not null references public.sessions (token) on delete cascade,
  column_type text not null check (column_type in ('good', 'bad', 'ideas', 'actions')),
  text text not null check (char_length(text) between 1 and 500),
  author text not null,
  author_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists draft_cards_session_idx
  on public.draft_cards (session_token, created_at);

-- Mesmo modelo das outras tabelas: acesso público, sem autenticação.
alter table public.draft_cards enable row level security;

drop policy if exists "draft_cards public access" on public.draft_cards;
create policy "draft_cards public access" on public.draft_cards
  for all using (true) with check (true);
