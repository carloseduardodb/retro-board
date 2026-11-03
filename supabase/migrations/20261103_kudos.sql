-- Mural de kudos: elogios entre o time, escritos a qualquer momento entre uma
-- retro e a outra. Execute no SQL Editor do Supabase (ou via `supabase db push`).
--
-- Encerrar a retro NÃO apaga os kudos: marca o ciclo com `archived_at`, e o
-- mural volta a mostrar só os do ciclo aberto (archived_at is null).

create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  session_token text not null references public.sessions (token) on delete cascade,
  to_name text not null check (char_length(to_name) between 1 and 20),
  message text not null check (char_length(message) between 1 and 280),
  author text not null,
  author_id text not null,
  anonymous boolean not null default false,
  likes text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists kudos_open_idx
  on public.kudos (session_token, created_at)
  where archived_at is null;

-- Mesmo modelo das outras tabelas: acesso público, sem autenticação.
alter table public.kudos enable row level security;

drop policy if exists "kudos public access" on public.kudos;
create policy "kudos public access" on public.kudos
  for all using (true) with check (true);
