-- Gym: one backup row per Google account (app/js/cloud.js, docs/SUPABASE.md).
-- Run once in Supabase -> SQL Editor -> New query -> Run. Safe to run again.
-- `data` = the same JSON as Me > Settings > Export (never tokens, never media).
-- `rev` = row version: the app writes only "where rev = the one it read", so two phones never overwrite each other
-- (a lost race reads the row again and merges).
create table if not exists public.gym_backups (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 5000000),
  rev        bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.gym_backups add column if not exists rev bigint not null default 1;
alter table public.gym_backups enable row level security;

drop policy if exists "own gym backup: select" on public.gym_backups;
drop policy if exists "own gym backup: insert" on public.gym_backups;
drop policy if exists "own gym backup: update" on public.gym_backups;
drop policy if exists "own gym backup: delete" on public.gym_backups;
create policy "own gym backup: select" on public.gym_backups for select to authenticated using (user_id = auth.uid());
create policy "own gym backup: insert" on public.gym_backups for insert to authenticated with check (user_id = auth.uid());
create policy "own gym backup: update" on public.gym_backups for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own gym backup: delete" on public.gym_backups for delete to authenticated using (user_id = auth.uid());

revoke all on public.gym_backups from anon;
grant select, insert, update, delete on public.gym_backups to authenticated;
