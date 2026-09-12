-- ================================================================
-- 0020 — VERRAA Diet check-ins (one answer per day).
--
-- Each day the client answers: were they on track with the diet?
-- ON_TRACK, PARTIAL (missed N of M meals) or OFF_TRACK for the whole
-- day — plus a free-text note explaining how the diet broke.
-- One row per client per date; resubmitting the same day updates it.
--
-- RLS mirrors the other client-scoped tables: coach = full access to
-- own rows, client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

create table if not exists public.diet_checkins (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  date        date not null default current_date,
  status      text not null default 'ON_TRACK' check (status in ('ON_TRACK', 'PARTIAL', 'OFF_TRACK')),
  missed      integer not null default 0,
  total       integer not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

-- One answer per client per day.
create unique index if not exists idx_diet_checkins_unique
  on public.diet_checkins (client_id, date);

create index if not exists idx_diet_checkins_client on public.diet_checkins (client_id);
create index if not exists idx_diet_checkins_date on public.diet_checkins (date desc);

alter table public.diet_checkins enable row level security;

-- coach: full access to their own rows
drop policy if exists diet_checkins_coach_all on public.diet_checkins;
create policy diet_checkins_coach_all on public.diet_checkins
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read own rows
drop policy if exists diet_checkins_client_read on public.diet_checkins;
create policy diet_checkins_client_read on public.diet_checkins
  for select using (client_id = auth.uid());

-- client: answer their own check-in
drop policy if exists diet_checkins_client_insert on public.diet_checkins;
create policy diet_checkins_client_insert on public.diet_checkins
  for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()));

-- client: update their own answer
drop policy if exists diet_checkins_client_update on public.diet_checkins;
create policy diet_checkins_client_update on public.diet_checkins
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

-- client: clear their own answer
drop policy if exists diet_checkins_client_delete on public.diet_checkins;
create policy diet_checkins_client_delete on public.diet_checkins
  for delete using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists diet_checkins_owner_all on public.diet_checkins;
create policy diet_checkins_owner_all on public.diet_checkins
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
