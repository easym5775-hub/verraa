-- ================================================================
-- 0027 — VERRAA Client Mode plan gating (Starter = No Client Mode).
--
-- - STARTER is coach-managed only: progress is added manually by the
--   coach, and NEW client logins are blocked server-side.
-- - FREE / PROFESSIONAL / ENTERPRISE include Client Mode (auto tracking
--   via the client app).
-- - Downgrades TO Starter are ALLOWED: existing logins FREEZE (data is
--   kept, the client app shows a paused screen until the coach upgrades).
--   Only the creation of NEW logins is blocked — never retroactive deletes.
-- - Legacy / unknown plan names preserve existing behaviour (allow).
--
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Plan capability helper — STARTER is the only plan without Client Mode.
-- ----------------------------------------------------------------
create or replace function public.plan_allows_client_mode(p_plan_id text)
returns boolean
language sql
immutable
as $$
  select coalesce(upper(trim(p_plan_id)), '') <> 'STARTER';
$$;

-- ----------------------------------------------------------------
-- 2. Coach-level Client Mode status (used by triggers, RPCs and UI).
--    No subscription -> STARTER default (matches get_coach_plan_limit).
--    Legacy unknown plan names -> allow (preserve existing data).
-- ----------------------------------------------------------------
create or replace function public.coach_client_mode(p_coach_id uuid)
returns table (
  plan_id text,
  allows_client_mode boolean,
  progress_mode text,
  login_count integer,
  frozen_login_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_name text;
  v_plan_id text;
  v_allows boolean;
  v_mode text;
  v_logins integer;
begin
  select cs.plan_name into v_plan_name
  from public.coach_subscriptions cs
  where cs.coach_id = p_coach_id
  order by cs.end_date desc, cs.created_at desc
  limit 1;

  if v_plan_name is null then
    v_plan_id := 'STARTER';
  else
    v_plan_id := public.resolve_coach_plan_id(v_plan_name);
    -- Legacy / unknown plan names: preserve existing behaviour (allow).
    if v_plan_id is null then
      v_plan_id := '__LEGACY__';
    end if;
  end if;

  if v_plan_id = '__LEGACY__' then
    v_allows := true;
    v_mode := 'auto';
    v_plan_id := null;
  else
    v_allows := public.plan_allows_client_mode(v_plan_id);
    v_mode := case when v_plan_id = 'STARTER' then 'manual' else 'auto' end;
  end if;

  select count(*)::integer into v_logins
  from public.clients
  where coach_id = p_coach_id
    and coalesce(has_login, true) = true;

  return query select
    v_plan_id,
    v_allows,
    v_mode,
    v_logins,
    case when v_allows then 0 else v_logins end;
end;
$$;

revoke all on function public.coach_client_mode(uuid) from public;
grant execute on function public.coach_client_mode(uuid) to authenticated;

-- ----------------------------------------------------------------
-- 3. Signed-in client's own freeze status (the client app calls this on boot).
--    Returns zero rows when the caller is not a client (coaches/owners
--    don't need it) — the frontend treats "no row" as not frozen.
-- ----------------------------------------------------------------
create or replace function public.my_client_mode_status()
returns table (
  plan_id text,
  allows_client_mode boolean,
  progress_mode text,
  frozen boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_coach_id uuid;
  v_has_login boolean;
  v_plan_id text;
  v_allows boolean;
  v_mode_text text;
begin
  select c.coach_id, coalesce(c.has_login, true)
    into v_coach_id, v_has_login
  from public.clients c
  where c.id = v_client_id
  limit 1;

  -- Not a client row (coach / owner / unknown) -> no rows (not frozen).
  if v_coach_id is null then
    return;
  end if;

  select m.plan_id, m.allows_client_mode, m.progress_mode
    into v_plan_id, v_allows, v_mode_text
  from public.coach_client_mode(v_coach_id) as m;

  return query select
    v_plan_id,
    v_allows,
    v_mode_text,
    (v_has_login and not v_allows);
end;
$$;

revoke all on function public.my_client_mode_status() from public;
grant execute on function public.my_client_mode_status() to authenticated;

-- ----------------------------------------------------------------
-- 4. SERVER-SIDE enforcement: block NEW logins on No-Client-Mode plans.
--    - INSERT with has_login=true on STARTER -> rejected.
--    - UPDATE that turns a login ON (false -> true) on STARTER -> rejected.
--    - Updates to already-frozen rows (true -> true, e.g. coach edits the
--      name) are ALLOWED so downgrades never strand or delete data.
--    - Turning a login OFF (true -> false) is always allowed.
--    - Legacy / unknown plans: allow (preserve existing data).
-- ----------------------------------------------------------------
create or replace function public.enforce_client_mode_on_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_name text;
  v_plan_id text;
  v_old_login boolean;
  v_new_login boolean;
begin
  -- Deleting rows is always fine.
  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  v_new_login := coalesce(NEW.has_login, true);
  if TG_OP = 'INSERT' and not v_new_login then
    -- Coach-managed creation (no login) is always allowed, on every plan.
    return NEW;
  end if;
  if TG_OP = 'UPDATE' then
    v_old_login := coalesce(OLD.has_login, true);
    -- Leaving logins off, keeping a login on (frozen rows stay editable),
    -- or turning a login OFF is always allowed.
    if (not v_new_login) or (v_old_login and v_new_login) then
      return NEW;
    end if;
  end if;
  -- At this point the statement turns a login ON (insert-with-login or
  -- upgrade false -> true). Resolve the coach's plan.
  select cs.plan_name into v_plan_name
  from public.coach_subscriptions cs
  where cs.coach_id = NEW.coach_id
  order by cs.end_date desc, cs.created_at desc
  limit 1;

  if v_plan_name is null then
    v_plan_id := 'STARTER';
  else
    v_plan_id := public.resolve_coach_plan_id(v_plan_name);
    -- Unknown legacy plan -> preserve existing behaviour (allow).
    if v_plan_id is null then
      return NEW;
    end if;
  end if;

  if not public.plan_allows_client_mode(v_plan_id) then
    raise exception 'CLIENT_MODE_NOT_ALLOWED: The % plan has No Client Mode. Clients stay coach-managed (manual progress). Upgrade to Professional for Client Mode + auto tracking.', coalesce(v_plan_id, 'current')
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_client_mode_on_login on public.clients;
create trigger enforce_client_mode_on_login
  before insert or update on public.clients
  for each row
  execute function public.enforce_client_mode_on_login();

-- NOTE: downgrade guards (guard_coach_plan_change / change_coach_plan /
-- review_coach_plan_request) intentionally do NOT block moves to STARTER
-- with existing logins — those logins FREEZE (client app paused, data kept)
-- instead of forcing the coach to delete anything.
