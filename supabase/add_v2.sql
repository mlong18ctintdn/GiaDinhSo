-- Version 2: shared live games + family owner. Safe to run more than once. (Also at the end of schema.sql.)
alter table public.families add column if not exists owner_id uuid references auth.users(id) on delete set null;

create table if not exists public.family_games (
  family_code text not null references public.families(family_code) on delete cascade,
  game text not null check (game in ('memory','wheel')),
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (family_code, game)
);
alter table public.family_games enable row level security;
grant all on public.family_games to service_role;
notify pgrst, 'reload schema';
