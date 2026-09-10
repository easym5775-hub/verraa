-- ================================================================
-- 0018 — VERRAA Flexible menus (client picks which day to eat).
--
-- The weekly nutrition plan is an open menu: each calendar day the
-- client picks which plan-day (1..7) they follow. One pick per client
-- per date. Switching days clears that date's compliance marks
-- (the app warns first — enforced in UI, not here).
--
-- RLS mirrors the other client-scoped tables: coach = full access to
-- own rows, client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

create table if not exists public.meal_day_picks (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  date        date not null default current_date,
  day         integer not null default 1 check (day between 1 and 7),
  created_at  timestamptz not null default now()
);

-- One menu pick per client per day.
create unique index if not exists idx_meal_day_picks_unique
  on public.meal_day_picks (client_id, date);

create index if not exists idx_meal_day_picks_client on public.meal_day_picks (client_id);
create index if not exists idx_meal_day_picks_date on public.meal_day_picks (date desc);

alter table public.meal_day_picks enable row level security;

-- coach: full access to their own rows
drop policy if exists meal_day_picks_coach_all on public.meal_day_picks;
create policy meal_day_picks_coach_all on public.meal_day_picks
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read own rows
drop policy if exists meal_day_picks_client_read on public.meal_day_picks;
create policy meal_day_picks_client_read on public.meal_day_picks
  for select using (client_id = auth.uid());

-- client: pick their own menu
drop policy if exists meal_day_picks_client_insert on public.meal_day_picks;
create policy meal_day_picks_client_insert on public.meal_day_picks
  for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()));

-- client: change their own pick
drop policy if exists meal_day_picks_client_update on public.meal_day_picks;
create policy meal_day_picks_client_update on public.meal_day_picks
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

-- client: clear their own pick
drop policy if exists meal_day_picks_client_delete on public.meal_day_picks;
create policy meal_day_picks_client_delete on public.meal_day_picks
  for delete using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists meal_day_picks_owner_all on public.meal_day_picks;
create policy meal_day_picks_owner_all on public.meal_day_picks
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
