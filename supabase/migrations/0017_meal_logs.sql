-- ================================================================
-- 0017 — VERRAA Meal compliance logs (client taps ✓ / ✕ per meal).
--
-- One row per meal per calendar date: the client marks EATEN (on track)
-- or SKIPPED (cheated). Tapping again switches or clears the mark.
--
-- meal_id is intentionally FK-free: if the coach deletes the meal, the
-- log survives on its snapshot. Uniqueness (client, meal, date) is
-- enforced so a meal has exactly one mark per day.
--
-- RLS mirrors the other client-scoped tables: coach = full access to
-- own rows, client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

create table if not exists public.meal_logs (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null references public.coaches (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,
  meal_id           uuid,
  date              date not null default current_date,
  day               integer not null default 1 check (day between 1 and 7),
  meal_type         text not null default 'Snack',
  meal_description  text not null default '',
  status            text not null default 'EATEN' check (status in ('EATEN', 'SKIPPED')),
  created_at        timestamptz not null default now()
);

-- One mark per meal per day.
create unique index if not exists idx_meal_logs_unique
  on public.meal_logs (client_id, meal_id, date)
  where meal_id is not null;

create index if not exists idx_meal_logs_client on public.meal_logs (client_id);
create index if not exists idx_meal_logs_date on public.meal_logs (date desc);

alter table public.meal_logs enable row level security;

-- coach: full access to their own rows
drop policy if exists meal_logs_coach_all on public.meal_logs;
create policy meal_logs_coach_all on public.meal_logs
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read own rows
drop policy if exists meal_logs_client_read on public.meal_logs;
create policy meal_logs_client_read on public.meal_logs
  for select using (client_id = auth.uid());

-- client: log their own meals
drop policy if exists meal_logs_client_insert on public.meal_logs;
create policy meal_logs_client_insert on public.meal_logs
  for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()));

-- client: change their own marks
drop policy if exists meal_logs_client_update on public.meal_logs;
create policy meal_logs_client_update on public.meal_logs
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

-- client: clear their own marks
drop policy if exists meal_logs_client_delete on public.meal_logs;
create policy meal_logs_client_delete on public.meal_logs
  for delete using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists meal_logs_owner_all on public.meal_logs;
create policy meal_logs_owner_all on public.meal_logs
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
