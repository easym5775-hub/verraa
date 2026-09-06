-- ================================================================
-- VERRAA — messages and notifications tables with RLS.
-- Follows the same conventions as check_ins and sessions:
--   - RLS enabled
--   - Rows scoped by coach_id and client_id via auth.uid()
--   - Added to supabase_realtime publication
-- ================================================================

-- ----------------------------------------------------------------
-- messages: chat messages between coach and client
-- ----------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  sender_role text not null check (sender_role in ('coach', 'client')),
  text        text not null default '',
  created_at  bigint not null default (extract(epoch from now()) * 1000)::bigint,
  created_ts  timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists messages_coach_all on public.messages;
create policy messages_coach_all on public.messages
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists messages_client_read on public.messages;
create policy messages_client_read on public.messages
  for select using (client_id = auth.uid());

drop policy if exists messages_client_insert on public.messages;
create policy messages_client_insert on public.messages
  for insert with check (
    client_id = auth.uid()
    and coach_id = (select coach_id from public.clients where id = auth.uid())
    and sender_role = 'client'
  );

-- ----------------------------------------------------------------
-- notifications: app notifications for clients
-- ----------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references public.coaches (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete cascade,
  kind       text not null check (kind in ('message', 'plan_updated', 'meal_updated', 'reminder', 'subscription')),
  text       text not null default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  read       boolean not null default false,
  created_ts timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists notifications_coach_all on public.notifications;
create policy notifications_coach_all on public.notifications
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists notifications_client_read on public.notifications;
create policy notifications_client_read on public.notifications
  for select using (client_id = auth.uid());

drop policy if exists notifications_client_update on public.notifications;
create policy notifications_client_update on public.notifications
  for update using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- ----------------------------------------------------------------
-- Realtime: add both tables to supabase_realtime publication
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

