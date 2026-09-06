-- ================================================================
-- VERRAA — Single admin account enforcement.
--
-- The app has exactly ONE owner/admin login:
--   email: aacc5775@gmail.com
--
-- This migration:
--   1. Adds a trigger that rejects any owners row whose email is not
--      the fixed admin email, and rejects a second owner row.
--   2. Adds a SECURITY DEFINER bootstrap function so the one-time setup
--      (linking the Auth user to public.owners) works even though the
--      owners_insert RLS policy requires an existing owner.
--
-- HOW TO CREATE THE ADMIN LOGIN (one time, in order):
--   1. Supabase Dashboard -> Authentication -> Users -> Add user
--        Email:    aacc5775@gmail.com
--        Password: <your-admin-password>  (never commit the real password)
--        [x] Auto Confirm User = ON  (so no email-confirmation step)
--      Copy the new user's UUID.
--   2. Supabase Dashboard -> SQL editor -> run ONLY this (paste the UUID):
--
--        select public.bootstrap_single_owner(
--          'PASTE-AUTH-USER-UUID-HERE',
--          'aacc5775@gmail.com',
--          'Admin'
--        );
--
--   3. Sign in from the app: "Sign in as Admin" -> type your password.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Single-owner guard trigger
-- ----------------------------------------------------------------
create or replace function public.enforce_single_owner()
returns trigger as $$
declare
  v_count integer;
begin
  -- Only the fixed admin email may ever live in owners.
  if lower(new.email) <> lower('aacc5775@gmail.com') then
    raise exception 'Only the fixed admin account (aacc5775@gmail.com) may be an owner.';
  end if;

  -- At most one row may exist.
  select count(*) into v_count from public.owners where id <> new.id;
  if v_count > 0 then
    raise exception 'Only one admin account is allowed.';
  end if;

  -- Keep the stored email canonical.
  new.email := 'aacc5775@gmail.com';
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_single_owner on public.owners;
create trigger enforce_single_owner
  before insert or update on public.owners
  for each row
  execute function public.enforce_single_owner();

-- The fixed admin row must never be deleted through the API.
create or replace function public.prevent_single_owner_delete()
returns trigger as $$
begin
  raise exception 'The admin account cannot be deleted.';
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists prevent_single_owner_delete on public.owners;
create trigger prevent_single_owner_delete
  before delete on public.owners
  for each row
  execute function public.prevent_single_owner_delete();

-- ----------------------------------------------------------------
-- 2. One-time bootstrap (bypasses RLS by design — run once in SQL editor)
-- ----------------------------------------------------------------
create or replace function public.bootstrap_single_owner(p_id uuid, p_email text, p_name text default 'Admin')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(p_email)) <> lower('aacc5775@gmail.com') then
    raise exception 'bootstrap_single_owner only accepts aacc5775@gmail.com';
  end if;
  if exists (select 1 from public.owners where id <> p_id) then
    raise exception 'An admin account already exists — only one admin account is allowed.';
  end if;
  insert into public.owners (id, name, email)
  values (p_id, coalesce(nullif(trim(p_name), ''), 'Admin'), 'aacc5775@gmail.com')
  on conflict (id) do update set email = excluded.email, name = excluded.name;
end;
$$;

revoke all on function public.bootstrap_single_owner(uuid, text, text) from public, anon, authenticated;
