-- ================================================================
-- 0008 — VERRAA Coach signup hardening: auto-create coach profile.
--
-- Problem: when "Confirm email" is ON in Supabase Auth, signUp() returns
-- no session, so the frontend cannot insert into public.coaches (RLS
-- requires auth.uid()). The auth user then exists with no profile row and
-- resolveRole() returns null — the coach is stuck on the sign-in screen.
--
-- Fix: a SECURITY DEFINER trigger on auth.users creates the public.coaches
-- row + a STARTER coach_subscriptions row for every NON-client user.
-- Clients are created via the Edge Function with user_metadata.role =
-- 'client', so they are explicitly skipped here.
--
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Trigger function: new auth user -> coach profile (unless client)
-- ----------------------------------------------------------------
create or replace function public.handle_new_coach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
  v_email text;
  v_price numeric;
begin
  v_role := lower(coalesce(NEW.raw_user_meta_data ->> 'role', ''));
  -- Clients get their rows from the Edge Function, never here.
  if v_role = 'client' then
    return NEW;
  end if;

  -- Never steal owner accounts (created manually + row in public.owners).
  if exists (select 1 from public.owners where owners.id = NEW.id) then
    return NEW;
  end if;

  v_name := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'name', '')), '');
  if v_name is null then
    v_name := split_part(coalesce(NEW.email, 'Coach'), '@', 1);
  end if;
  v_name := left(v_name, 80);
  v_email := NEW.email;

  -- Idempotent: a coach row may already exist (confirmation OFF path
  -- inserts from the frontend). ON CONFLICT keeps the frontend's name.
  insert into public.coaches (id, name, email)
  values (NEW.id, v_name, v_email)
  on conflict (id) do nothing;

  -- Ensure a STARTER subscription exists (backfill-safe, idempotent).
  if not exists (select 1 from public.coach_subscriptions where coach_id = NEW.id) then
    select price into v_price from public.coach_plans where id = 'STARTER';
    v_price := coalesce(v_price, 1999);
    insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
    values (NEW.id, 'STARTER', 'ACTIVE', current_date, current_date + interval '30 days', v_price, false);
  end if;

  return NEW;
end;
$$;

-- ----------------------------------------------------------------
-- 2. Attach to auth.users (guarded so the migration is re-runnable)
-- ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'on_auth_user_created_coach'
  ) then
    create trigger on_auth_user_created_coach
      after insert on auth.users
      for each row
      execute function public.handle_new_coach();
  end if;
end
$$;

-- ----------------------------------------------------------------
-- 3. One-time backfill: coaches missing a subscription get STARTER.
--    (Orphaned auth users with no coaches row are healed at sign-in
--    by the frontend self-heal in backend.ts — RLS permits id=auth.uid().)
-- ----------------------------------------------------------------
insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
select
  c.id,
  'STARTER',
  'ACTIVE',
  current_date,
  current_date + interval '30 days',
  coalesce((select price from public.coach_plans where id = 'STARTER'), 1999),
  false
from public.coaches c
where not exists (select 1 from public.coach_subscriptions cs where cs.coach_id = c.id)
on conflict do nothing;
