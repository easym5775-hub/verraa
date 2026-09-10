-- ================================================================
-- 0019 — VERRAA Progress photos (Before / After galleries).
--
-- A dedicated gallery per client, separate from daily check-ins:
-- BEFORE and AFTER sections. Both coach and client can upload;
-- photos are compact JPEG data URLs (same convention as check-ins).
--
-- RLS mirrors the other client-scoped tables: coach = full access to
-- own rows, client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

create table if not exists public.progress_photos (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  kind        text not null default 'BEFORE' check (kind in ('BEFORE', 'AFTER')),
  photo       text not null default '',
  date        date not null default current_date,
  ts          bigint not null default (extract(epoch from now()) * 1000)::bigint,
  note        text,
  uploaded_by text not null default 'client',
  created_at  timestamptz not null default now()
);

create index if not exists idx_progress_photos_client on public.progress_photos (client_id);
create index if not exists idx_progress_photos_kind on public.progress_photos (client_id, kind);

alter table public.progress_photos enable row level security;

-- coach: full access to their own rows
drop policy if exists progress_photos_coach_all on public.progress_photos;
create policy progress_photos_coach_all on public.progress_photos
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read own rows
drop policy if exists progress_photos_client_read on public.progress_photos;
create policy progress_photos_client_read on public.progress_photos
  for select using (client_id = auth.uid());

-- client: upload to their own gallery
drop policy if exists progress_photos_client_insert on public.progress_photos;
create policy progress_photos_client_insert on public.progress_photos
  for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()));

-- client: edit their own rows (note fixes)
drop policy if exists progress_photos_client_update on public.progress_photos;
create policy progress_photos_client_update on public.progress_photos
  for update using (client_id = auth.uid()) with check (client_id = auth.uid());

-- client: delete their own rows
drop policy if exists progress_photos_client_delete on public.progress_photos;
create policy progress_photos_client_delete on public.progress_photos
  for delete using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists progress_photos_owner_all on public.progress_photos;
create policy progress_photos_owner_all on public.progress_photos
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
