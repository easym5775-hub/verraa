-- ================================================================
-- 0015 — VERRAA Strength tracker (client mode).
--
-- The client logs ONE top weight per exercise per session
-- (weight kg + reps + sets). Four tables, all scoped by coach_id
-- + client_id like the other client-scoped tables:
--
--   client_exercises  — the client's own custom exercises
--                       (coach library stays read-only for clients)
--   workout_templates — saved templates (items as jsonb)
--   workout_sessions  — one row per logged workout
--   workout_entries   — one row per exercise in a session
--
-- Exercise identity for history/PR is carried on the entry itself
-- (exercise_id / client_exercise_id + exercise_name snapshot), so
-- history survives library deletes. Only entries.session_id is a
-- real FK (cascade); exercise refs are intentionally FK-free.
--
-- RLS mirrors check_ins: coach = full access to own rows,
-- client = full CRUD on their own rows, owner = full access.
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

-- ----------------------------------------------------------------
-- tables
-- ----------------------------------------------------------------
create table if not exists public.client_exercises (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null,
  category    text not null default 'Core',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null default '',
  items       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  name        text not null default '',
  date        date not null default current_date,
  ts          bigint not null default (extract(epoch from now()) * 1000)::bigint,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.workout_entries (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references public.coaches (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete cascade,
  session_id          uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id         uuid,
  client_exercise_id  uuid references public.client_exercises (id) on delete set null,
  exercise_name       text not null default '',
  category            text,
  weight              numeric(6,1) not null default 0,
  reps                integer not null default 8,
  sets                integer not null default 3,
  is_pr               boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_client_exercises_client on public.client_exercises (client_id);
create index if not exists idx_workout_templates_client on public.workout_templates (client_id);
create index if not exists idx_workout_sessions_client on public.workout_sessions (client_id);
create index if not exists idx_workout_sessions_date on public.workout_sessions (date desc);
create index if not exists idx_workout_entries_client on public.workout_entries (client_id);
create index if not exists idx_workout_entries_session on public.workout_entries (session_id);

-- ----------------------------------------------------------------
-- RLS: coach full / client full-own / owner full
-- ----------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['client_exercises', 'workout_templates', 'workout_sessions', 'workout_entries'] loop
    execute format('alter table public.%I enable row level security', t);

    -- coach: full access to their own rows
    execute format('drop policy if exists %s_coach_all on public.%I', t, t);
    execute format(
      'create policy %s_coach_all on public.%I for all using (coach_id = auth.uid()) with check (coach_id = auth.uid())',
      t, t
    );

    -- client: read own rows
    execute format('drop policy if exists %s_client_read on public.%I', t, t);
    execute format(
      'create policy %s_client_read on public.%I for select using (client_id = auth.uid())',
      t, t
    );

    -- client: insert own rows (coach_id must match their own coach)
    execute format('drop policy if exists %s_client_insert on public.%I', t, t);
    execute format(
      'create policy %s_client_insert on public.%I for insert with check (client_id = auth.uid() and coach_id = (select coach_id from public.clients where id = auth.uid()))',
      t, t
    );

    -- client: update own rows
    execute format('drop policy if exists %s_client_update on public.%I', t, t);
    execute format(
      'create policy %s_client_update on public.%I for update using (client_id = auth.uid()) with check (client_id = auth.uid())',
      t, t
    );

    -- client: delete own rows
    execute format('drop policy if exists %s_client_delete on public.%I', t, t);
    execute format(
      'create policy %s_client_delete on public.%I for delete using (client_id = auth.uid())',
      t, t
    );

    -- owner: full access (support)
    execute format('drop policy if exists %s_owner_all on public.%I', t, t);
    execute format(
      'create policy %s_owner_all on public.%I for all using (exists (select 1 from public.owners where owners.id = auth.uid())) with check (exists (select 1 from public.owners where owners.id = auth.uid()))',
      t, t
    );
  end loop;
end $$;
