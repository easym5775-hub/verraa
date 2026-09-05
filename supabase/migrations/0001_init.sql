-- ================================================================
-- FORGE — initial schema: tables, RLS and the username-login bridge.
-- Apply on a fresh Supabase project (SQL editor or `supabase db push`).
--
-- Roles: both coaches and clients are Supabase Auth users sharing the
-- auth.users id space. Every table is scoped by coach_id; clients get
-- read-only access to their own rows and may INSERT their own check-ins.
-- ================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------
-- coaches: one row per coach auth user
-- ----------------------------------------------------------------
create table if not exists public.coaches (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default 'Coach',
  email       text,
  created_at  timestamptz not null default now()
);

alter table public.coaches enable row level security;

drop policy if exists coaches_all on public.coaches;
create policy coaches_all on public.coaches
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ----------------------------------------------------------------
-- clients: the row's id IS the client's auth user id
-- ----------------------------------------------------------------
create table if not exists public.clients (
  id                uuid primary key references auth.users (id) on delete cascade,
  coach_id          uuid not null references public.coaches (id) on delete cascade,
  username          text not null,
  name              text not null default '',
  email             text not null default '',
  phone             text not null default '',
  gender            text,
  age               integer,
  goal              text not null default 'General fitness',
  status            text not null default 'Active',
  start_date        date not null default current_date,
  notes             text not null default '',
  photo             text,
  follow_up_days    integer,
  last_follow_up    date,
  coach_notes       jsonb not null default '[]'::jsonb,
  nutrition_targets jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (coach_id, lower(username))
);

alter table public.clients enable row level security;

drop policy if exists clients_coach_all on public.clients;
create policy clients_coach_all on public.clients
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- A client may read (only) their own record.
drop policy if exists clients_self_read on public.clients;
create policy clients_self_read on public.clients
  for select using (id = auth.uid());

-- ----------------------------------------------------------------
-- exercises: coach-owned library (no client_id)
-- ----------------------------------------------------------------
create table if not exists public.exercises (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  name        text not null,
  category    text not null default 'Core',
  description text not null default '',
  video_url   text not null default '',
  image       text,
  created_at  timestamptz not null default now()
);

alter table public.exercises enable row level security;

drop policy if exists exercises_coach_all on public.exercises;
create policy exercises_coach_all on public.exercises
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- Clients can see their own coach's library (read-only).
drop policy if exists exercises_client_read on public.exercises;
create policy exercises_client_read on public.exercises
  for select using (
    coach_id = (select coach_id from public.clients where id = auth.uid())
  );

-- ----------------------------------------------------------------
-- helper: client-scoped tables share this shape
-- ----------------------------------------------------------------
create table if not exists public.plan_items (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  day         integer not null check (day between 1 and 7),
  exercise_id uuid not null,
  sets        integer not null default 3,
  reps        integer not null default 10,
  rest        integer not null default 60,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.coaches (id) on delete cascade,
  client_id     uuid not null references public.clients (id) on delete cascade,
  date          date not null default current_date,
  ts            bigint not null default (extract(epoch from now()) * 1000)::bigint,
  weight        numeric(5,1) not null,
  waist         numeric(5,1),
  mood          integer not null default 3 check (mood between 1 and 5),
  water         numeric(4,1) not null default 0,
  workout_done  boolean not null default false,
  notes         text,
  photo         text,
  created_at    timestamptz not null default now()
);

create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  type        text not null default 'Snack',
  description text not null default '',
  calories    integer not null default 0,
  protein     integer not null default 0,
  carbs       integer not null default 0,
  fats        integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references public.coaches (id) on delete cascade,
  client_id      uuid not null references public.clients (id) on delete cascade,
  plan_name      text not null default 'Monthly',
  start_date     date not null default current_date,
  end_date       date not null default current_date,
  price          numeric(10,2) not null default 0,
  payment_status text not null default 'Pending',
  created_at     timestamptz not null default now()
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references public.coaches (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount          numeric(10,2) not null default 0,
  date            date not null default current_date,
  method          text not null default 'Cash',
  status          text not null default 'Paid',
  notes           text not null default '',
  created_at      timestamptz not null default now()
);

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  date        date not null default current_date,
  time        time not null default '18:00',
  type        text not null default 'Training',
  status      text not null default 'Scheduled',
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- RLS for the client-scoped tables.
-- Coach: full access to their own rows. Client: read own rows;
-- check_ins additionally allows the client to INSERT their own.
-- ----------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['plan_items','meals','subscriptions','payments','sessions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %s_coach_all on public.%I', t, t);
    execute format(
      'create policy %s_coach_all on public.%I for all using (coach_id = auth.uid()) with check (coach_id = auth.uid())',
      t, t
    );
    execute format('drop policy if exists %s_client_read on public.%I', t, t);
    execute format(
      'create policy %s_client_read on public.%I for select using (client_id = auth.uid())',
      t, t
    );
  end loop;
end $$;

alter table public.check_ins enable row level security;

drop policy if exists check_ins_coach_all on public.check_ins;
create policy check_ins_coach_all on public.check_ins
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists check_ins_client_read on public.check_ins;
create policy check_ins_client_read on public.check_ins
  for select using (client_id = auth.uid());

drop policy if exists check_ins_client_insert on public.check_ins;
create policy check_ins_client_insert on public.check_ins
  for insert with check (
    client_id = auth.uid()
    and coach_id = (select coach_id from public.clients where id = auth.uid())
  );

-- ----------------------------------------------------------------
-- Username -> email bridge.
-- Clients log in with a username; Supabase Auth needs an email. The
-- edge function stores a synthetic email ({username}@clients.forge.internal).
-- This definer function returns ONLY the email string for a username.
-- ----------------------------------------------------------------
create or replace function public.client_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from public.clients
  where lower(username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.client_login_email(text) from public;
grant execute on function public.client_login_email(text) to anon, authenticated;

-- ----------------------------------------------------------------
-- Realtime (optional but nice): let coaches see live updates.
-- ----------------------------------------------------------------
alter publication supabase_realtime add table public.check_ins;
alter publication supabase_realtime add table public.sessions;
