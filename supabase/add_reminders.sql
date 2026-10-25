-- Reminders feature. Safe to run more than once. (Also included at the end of schema.sql.)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  family_code text not null references public.families(family_code) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,   -- null = the whole family
  text text not null,
  remind_time text not null check (remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  repeat text not null default 'daily' check (repeat in ('daily','weekdays','once')),
  once_date date,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reminders_family_idx on public.reminders(family_code);
alter table public.reminders enable row level security;
grant all on public.reminders to service_role;
notify pgrst, 'reload schema';
