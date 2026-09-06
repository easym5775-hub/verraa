-- ================================================================
-- 0002 — Fix client login email + username uniqueness + plan_items FK
--
-- Bug 1 (critical): the synthetic auth email ({username}@clients.verraa.internal)
--   was used to create the auth.users row but never stored. clients.email held
--   the coach-typed *contact* email instead, so client_login_email() returned
--   the wrong value and no client could ever sign in. We add a dedicated
--   login_email column, point the RPC at it, and backfill existing rows.
--
-- Bug 2: username uniqueness was per-coach, but the synthetic email must be
--   globally unique (Supabase Auth requires it). Make the DB constraint global.
--
-- Bug 3: plan_items.exercise_id had no foreign key. Add it (cascade on delete).
-- ================================================================

-- ----------------------------------------------------------------
-- Bug 1: dedicated, retrievable synthetic login email
-- ----------------------------------------------------------------
alter table public.clients add column if not exists login_email text;

create unique index if not exists clients_login_email_key
  on public.clients (lower(login_email));

-- Backfill rows created before this column existed. The synthetic email is a
-- pure function of the username, so it can be reconstructed deterministically.
update public.clients
   set login_email = lower(username) || '@clients.verraa.internal'
 where login_email is null;
-- NOTE: rows created before the VERRAA rebrand keep their
-- clients.forge.internal login_email on purpose (their auth.users email
-- matches it). Sign-in reads the stored login_email, so both domains
-- coexist. See migration 0012.

-- The RPC now resolves a username to the *login* email, never the contact one.
create or replace function public.client_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select login_email
  from public.clients
  where lower(username) = lower(p_username)
  limit 1;
$$;

revoke all on function public.client_login_email(text) from public;
grant execute on function public.client_login_email(text) to anon, authenticated;

-- ----------------------------------------------------------------
-- Bug 2: usernames are globally unique (matches Supabase Auth's
-- global email uniqueness). The old per-coach constraint stays in
-- place harmlessly; this stricter index is the real guarantee.
-- ----------------------------------------------------------------
create unique index if not exists clients_username_key
  on public.clients (lower(username));

-- ----------------------------------------------------------------
-- Bug 3: plan_items must reference a real exercise.
-- Guarded so the migration stays safe to re-run.
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plan_items_exercise_id_fkey'
  ) then
    alter table public.plan_items
      add constraint plan_items_exercise_id_fkey
      foreign key (exercise_id) references public.exercises (id) on delete cascade;
  end if;
end
$$;
