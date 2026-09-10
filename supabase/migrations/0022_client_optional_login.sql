-- ================================================================
-- 0022 — Optional client login (coach-managed clients).
--
-- A coach may now register a client WITHOUT creating a Client-mode
-- login for them: the client lives only in coach mode and the coach
-- logs everything (check-ins, plans, payments…) on their behalf.
--
-- What changes:
--   1. clients.id no longer references auth.users — login-less rows
--      use a random UUID that has no auth user behind it.
--      (The create-client-account Edge Function still deletes the
--      client row BEFORE the auth user, so login clients keep working.)
--   2. clients.username becomes nullable — login-less rows store NULL
--      (NULLs never conflict in the global lower(username) index).
--   3. New clients.has_login flag (default true) so the app can tell
--      the two kinds apart without guessing from NULLs.
-- ================================================================

-- 1. Allow client ids that have no auth.users row.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'clients_id_fkey') then
    alter table public.clients drop constraint clients_id_fkey;
  end if;
end
$$;

-- 2. Usernames only exist for clients that can sign in.
alter table public.clients alter column username drop not null;

-- 3. Explicit login flag.
alter table public.clients add column if not exists has_login boolean not null default true;

-- Backfill: every existing row was created with a synthetic login_email,
-- so all of them keep working logins.
update public.clients set has_login = (login_email is not null);

-- 4. Guard: a login client must always carry its credentials.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_login_consistency') then
    alter table public.clients add constraint clients_login_consistency
      check (not has_login or (username is not null and login_email is not null));
  end if;
end
$$;
