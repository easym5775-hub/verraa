-- ================================================================
-- 0016 — VERRAA Meal edit requests (client asks, coach decides).
--
-- The client cannot edit their own meals. They file a request carrying
-- a snapshot of the meal (day / type / description) plus their issue
-- and an optional suggested alternative. The coach edits the meal
-- manually, then APPROVES the request (or REJECTS it with a note).
--
-- meal_id is intentionally FK-free: if the coach deletes the meal, the
-- request survives on its snapshot. Multiple PENDING requests per meal
-- are allowed (no dedup constraint).
--
-- RLS mirrors the other client-scoped tables: coach = full access to
-- own rows, client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

create table if not exists public.meal_edit_requests (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null references public.coaches (id) on delete cascade,
  client_id         uuid not null references public.clients (id) on delete cascade,
  meal_id           uuid,
  day               integer not null default 1 check (day between 1 and 7),
  meal_type         text not null default 'Snack',
  meal_description  text not null default '',
  message           text not null default '',
  suggestion        text,
  status            text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  coach_note        text,
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz
);

create index if not exists idx_meal_edit_requests_client on public.meal_edit_requests (client_id);
create index if not exists idx_meal_edit_requests_status on public.meal_edit_requests (status);
create index if not exists idx_meal_edit_requests_created on public.meal_edit_requests (created_at desc);

alter table public.meal_edit_requests enable row level security;

-- coach: full access to their own rows
drop policy if exists meal_edit_requests_coach_all on public.meal_edit_requests;
create policy meal_edit_requests_coach_all on public.meal_edit_requests
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read own rows
drop policy if exists meal_edit_requests_client_read on public.meal_edit_requests;
create policy meal_edit_requests_client_read on public.meal_edit_requests
  for select using (client_id = auth.uid());

-- client: file requests for themselves only
drop policy if exists meal_edit_requests_client_insert on public.meal_edit_requests;
create policy meal_edit_requests_client_insert on public.meal_edit_requests
  for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()));

-- client: update own rows (lets future flows mark seen/cancelled states)
drop policy if exists meal_edit_requests_client_update on public.meal_edit_requests;
create policy meal_edit_requests_client_update on public.meal_edit_requests
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

-- client: cancel (delete) own rows
drop policy if exists meal_edit_requests_client_delete on public.meal_edit_requests;
create policy meal_edit_requests_client_delete on public.meal_edit_requests
  for delete using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists meal_edit_requests_owner_all on public.meal_edit_requests;
create policy meal_edit_requests_owner_all on public.meal_edit_requests
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
