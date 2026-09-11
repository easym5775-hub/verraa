-- ================================================================
-- 0026 — Coach to-do list per client.
--
-- Private coach tasks ("review Ahmed's plan", "send the new split"…).
-- Coach-only: unlike plans or photos the client never sees these,
-- so there is deliberately NO client RLS policy.
-- Safe to re-run.
-- ================================================================

create table if not exists public.client_todos (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on update cascade on delete cascade,
  text        text not null default '',
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_client_todos_client on public.client_todos (client_id);

alter table public.client_todos enable row level security;

-- coach: full access to their own rows
drop policy if exists client_todos_coach_all on public.client_todos;
create policy client_todos_coach_all on public.client_todos
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- owner: full access (support)
drop policy if exists client_todos_owner_all on public.client_todos;
create policy client_todos_owner_all on public.client_todos
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
