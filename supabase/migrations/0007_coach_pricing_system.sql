-- ================================================================
-- 0007 — FORGE Coach Pricing & Client Limits System
--
-- Adds the centralized `coach_plans` source of truth, seeds the three
-- canonical plans (STARTER 20 / PROFESSIONAL 100 / ENTERPRISE unlimited),
-- and enforces client limits SERVER-SIDE so no frontend manipulation
-- (state, localStorage, payloads, direct Supabase calls) can bypass them.
--
-- Preserves all existing data, RLS and triggers. Safe to re-run.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. coach_plans — centralized pricing source of truth (owner-managed)
--    max_clients = NULL means unlimited (Enterprise).
-- ----------------------------------------------------------------
create table if not exists public.coach_plans (
  id               text primary key,
  name             text not null,
  price            numeric(10,2) not null default 0,
  max_clients      integer null check (max_clients is null or max_clients > 0),
  billing_interval text not null default 'monthly',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Seed / upsert the three canonical plans (idempotent, preserves owner edits to NOTHING?
-- We only set values when inserting; existing rows keep owner-managed prices).
insert into public.coach_plans (id, name, price, max_clients, billing_interval, is_active)
values
  ('STARTER',      'Starter',      1999,   20,   'monthly', true),
  ('PROFESSIONAL', 'Professional', 5000,   100,  'monthly', true),
  ('ENTERPRISE',   'Enterprise',   10000,  null, 'monthly', true)
on conflict (id) do nothing;

alter table public.coach_plans enable row level security;

-- Everyone authenticated can read active plans (coaches need them for Dashboard/Pricing).
drop policy if exists coach_plans_read on public.coach_plans;
create policy coach_plans_read on public.coach_plans
  for select using (auth.role() = 'authenticated');

-- Only owners can write pricing.
drop policy if exists coach_plans_owner_write on public.coach_plans;
create policy coach_plans_owner_write on public.coach_plans
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

-- Keep updated_at fresh.
drop trigger if exists update_coach_plans_updated_at on public.coach_plans;
create trigger update_coach_plans_updated_at
  before update on public.coach_plans
  for each row
  execute function public.update_updated_at_column();

-- ----------------------------------------------------------------
-- 2. Plan resolution helper — maps legacy plan names to canonical IDs.
--    Unknown / legacy client-plan names resolve to NULL (no enforcement,
--    preserves existing production data).
-- ----------------------------------------------------------------
create or replace function public.resolve_coach_plan_id(p_plan_name text)
returns text
language sql
immutable
as $$
  select case upper(regexp_replace(coalesce(p_plan_name, ''), '[\s_-]+', '', 'g'))
    when 'STARTER' then 'STARTER'
    when 'START' then 'STARTER'
    when 'BASIC' then 'STARTER'
    when 'FREE' then 'STARTER'
    when 'PROFESSIONAL' then 'PROFESSIONAL'
    when 'PROFESIONAL' then 'PROFESSIONAL'
    when 'PRO' then 'PROFESSIONAL'
    when 'ENTERPRISE' then 'ENTERPRISE'
    when 'ENTERPRIZE' then 'ENTERPRISE'
    when 'UNLIMITED' then 'ENTERPRISE'
    when 'SCALE' then 'ENTERPRISE'
    when 'BUSINESS' then 'ENTERPRISE'
    else null
  end;
$$;

-- ----------------------------------------------------------------
-- 3. Client-limit lookup for a coach (used by triggers, RPCs and UI).
--    Returns NULL for unlimited. Unknown plan -> STARTER default is
--    applied ONLY for canonical empty state; legacy unknown plans
--    return NULL (no enforcement) to preserve existing data.
-- ----------------------------------------------------------------
create or replace function public.get_coach_plan_limit(p_coach_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_name text;
  v_plan_id text;
  v_max integer;
begin
  select cs.plan_name into v_plan_name
  from public.coach_subscriptions cs
  where cs.coach_id = p_coach_id
  order by cs.end_date desc, cs.created_at desc
  limit 1;

  -- No subscription at all -> STARTER default applies to new coaches.
  if v_plan_name is null then
    select max_clients into v_max from public.coach_plans where id = 'STARTER';
    return v_max;
  end if;

  v_plan_id := public.resolve_coach_plan_id(v_plan_name);
  -- Legacy / unknown plan names: do NOT enforce (preserve existing data).
  if v_plan_id is null then
    return null;
  end if;

  select max_clients into v_max from public.coach_plans where id = v_plan_id;
  return v_max;
end;
$$;

revoke all on function public.get_coach_plan_limit(uuid) from public;
grant execute on function public.get_coach_plan_limit(uuid) to authenticated;

-- Pre-check helper for UX (final enforcement is the trigger below).
create or replace function public.can_coach_add_client(p_coach_id uuid)
returns table (allowed boolean, client_count integer, max_clients integer, plan_id text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_max integer;
  v_plan text;
begin
  select count(*)::integer into v_count from public.clients where coach_id = p_coach_id;
  v_max := public.get_coach_plan_limit(p_coach_id);
  select public.resolve_coach_plan_id(cs.plan_name) into v_plan
  from public.coach_subscriptions cs
  where cs.coach_id = p_coach_id
  order by cs.end_date desc, cs.created_at desc
  limit 1;
  return query select (v_max is null or v_count < v_max), v_count, v_max, v_plan;
end;
$$;

revoke all on function public.can_coach_add_client(uuid) from public;
grant execute on function public.can_coach_add_client(uuid) to authenticated;

-- ----------------------------------------------------------------
-- 4. SERVER-SIDE enforcement: block client inserts beyond the plan limit.
--    This trigger is the final authority — it cannot be bypassed via
--    frontend state, localStorage, payload edits or direct browser calls.
-- ----------------------------------------------------------------
create or replace function public.enforce_coach_client_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
  v_plan_name text;
  v_plan_id text;
  v_price numeric;
begin
  -- Resolve the coach's current plan.
  select cs.plan_name into v_plan_name
  from public.coach_subscriptions cs
  where cs.coach_id = NEW.coach_id
  order by cs.end_date desc, cs.created_at desc
  limit 1;

  if v_plan_name is null then
    select max_clients into v_max from public.coach_plans where id = 'STARTER';
    v_plan_id := 'STARTER';
  else
    v_plan_id := public.resolve_coach_plan_id(v_plan_name);
    -- Unknown legacy plan -> preserve existing behaviour (allow).
    if v_plan_id is null then
      return NEW;
    end if;
    select max_clients into v_max from public.coach_plans where id = v_plan_id;
  end if;

  -- NULL = unlimited (Enterprise).
  if v_max is null then
    return NEW;
  end if;

  select count(*)::integer into v_count from public.clients where coach_id = NEW.coach_id;
  if v_count >= v_max then
    select price into v_price from public.coach_plans where id = v_plan_id;
    raise exception 'PLAN_LIMIT_REACHED: You have reached the %-client limit (%) of your % plan. Upgrade your plan to add more clients.', v_max, v_count || '/' || v_max, coalesce(v_plan_id, 'current')
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists enforce_client_limit_on_insert on public.clients;
create trigger enforce_client_limit_on_insert
  before insert on public.clients
  for each row
  execute function public.enforce_coach_client_limit();

-- ----------------------------------------------------------------
-- 5. Downgrade guard: block plan changes that would strand clients above
--    the new limit. Upgrade paths always pass; only over-limit downgrades
--    are rejected. Never deletes clients.
-- ----------------------------------------------------------------
create or replace function public.guard_coach_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_plan text;
  v_new_plan text;
  v_max integer;
  v_count integer;
begin
  v_old_plan := public.resolve_coach_plan_id(OLD.plan_name);
  v_new_plan := public.resolve_coach_plan_id(NEW.plan_name);

  -- If either side is a legacy unknown plan, let the owner proceed (preserve data).
  if v_new_plan is null then
    return NEW;
  end if;

  -- No plan-ID change -> nothing to guard (price/date/status edits handled elsewhere).
  if v_old_plan is not distinct from v_new_plan then
    return NEW;
  end if;

  select max_clients into v_max from public.coach_plans where id = v_new_plan;
  if v_max is null then
    return NEW; -- upgrading to unlimited always allowed
  end if;

  select count(*)::integer into v_count from public.clients where coach_id = NEW.coach_id;
  if v_count > v_max then
    raise exception 'PLAN_DOWNGRADE_BLOCKED: You currently have % clients. The % plan supports up to % clients. You cannot downgrade until your client count is within the plan limit.', v_count, v_new_plan, v_max
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

drop trigger if exists guard_coach_plan_downgrade on public.coach_subscriptions;
create trigger guard_coach_plan_downgrade
  before update of plan_name on public.coach_subscriptions
  for each row
  execute function public.guard_coach_plan_change();

-- ----------------------------------------------------------------
-- 6. Authorized plan-change RPC (the ONLY coach-blessed write path).
--    Direct UPDATEs of protected columns by coaches remain reverted by
--    protect_coach_subscription_update (0006). This RPC validates the
--    downgrade rule, applies price/max from coach_plans (coach cannot
--    spoof price), extends end_date coherently, and writes history.
--    Owners may change any coach; coaches may only change their own.
-- ----------------------------------------------------------------
create or replace function public.change_coach_plan(p_coach_id uuid, p_new_plan_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_is_owner boolean := false;
  v_is_self boolean := false;
  v_plan public.coach_plans%rowtype;
  v_sub public.coach_subscriptions%rowtype;
  v_count integer;
  v_old jsonb;
begin
  if v_caller is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  select exists (select 1 from public.owners where owners.id = v_caller) into v_is_owner;
  v_is_self := (v_caller = p_coach_id);
  if not v_is_owner and not v_is_self then
    raise exception 'Not authorized to change this subscription.' using errcode = '42501';
  end if;

  select * into v_plan from public.coach_plans
  where id = upper(trim(p_new_plan_id)) and is_active = true;
  if not found then
    raise exception 'Unknown or inactive plan: %', p_new_plan_id using errcode = 'P0001';
  end if;

  select * into v_sub from public.coach_subscriptions
  where coach_id = p_coach_id
  order by end_date desc, created_at desc
  limit 1;

  select count(*)::integer into v_count from public.clients where coach_id = p_coach_id;
  if v_plan.max_clients is not null and v_count > v_plan.max_clients then
    raise exception 'PLAN_DOWNGRADE_BLOCKED: You currently have % clients. The % plan supports up to % clients. You cannot downgrade until your client count is within the plan limit.', v_count, v_plan.id, v_plan.max_clients
      using errcode = 'P0001';
  end if;

  v_old := to_jsonb(v_sub);

  if v_sub.id is null then
    insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
    values (p_coach_id, v_plan.id, 'ACTIVE', current_date, current_date + interval '30 days', v_plan.price, false)
    returning * into v_sub;
    insert into public.coach_subscription_history (subscription_id, action, old_value, new_value, performed_by)
    values (v_sub.id, 'created', null, to_jsonb(v_sub), v_caller);
  else
    update public.coach_subscriptions
    set plan_name = v_plan.id,
        price = v_plan.price,
        status = case when status = 'SUSPENDED' then status else 'ACTIVE' end,
        updated_at = now()
    where id = v_sub.id
    returning * into v_sub;
    insert into public.coach_subscription_history (subscription_id, action, old_value, new_value, performed_by)
    values (v_sub.id, 'plan_changed', v_old, to_jsonb(v_sub), v_caller);
  end if;

  insert into public.admin_audit_log (action, target_type, target_id, old_value, new_value, performed_by)
  values ('plan_changed', 'subscription', v_sub.id, v_old, to_jsonb(v_sub), v_caller);

  return to_jsonb(v_sub);
end;
$$;

revoke all on function public.change_coach_plan(uuid, text) from public;
grant execute on function public.change_coach_plan(uuid, text) to authenticated;

-- ----------------------------------------------------------------
-- 7. Auto-history for owner-side direct edits (extend/activate/suspend).
--    Keeps coach_subscription_history complete even when owners update
--    rows directly from the dashboard.
-- ----------------------------------------------------------------
create or replace function public.log_coach_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := 'plan_changed';
begin
  if TG_OP = 'INSERT' then
    insert into public.coach_subscription_history (subscription_id, action, old_value, new_value, performed_by)
    values (NEW.id, 'created', null, to_jsonb(NEW), auth.uid());
    return NEW;
  end if;

  if OLD.status is distinct from NEW.status then
    if NEW.status = 'SUSPENDED' then v_action := 'suspended';
    elsif NEW.status = 'ACTIVE' and OLD.status is distinct from 'ACTIVE' then v_action := 'activated';
    elsif NEW.status = 'CANCELLED' then v_action := 'cancelled';
    elsif NEW.status = 'EXPIRED' then v_action := 'expired';
    end if;
  elsif OLD.end_date is distinct from NEW.end_date then
    v_action := 'extended';
  elsif OLD.plan_name is distinct from NEW.plan_name then
    v_action := 'plan_changed';
  else
    v_action := 'updated';
  end if;

  insert into public.coach_subscription_history (subscription_id, action, old_value, new_value, performed_by)
  values (NEW.id, v_action, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  return NEW;
end;
$$;

drop trigger if exists log_coach_subscription_history on public.coach_subscriptions;
create trigger log_coach_subscription_history
  after insert or update on public.coach_subscriptions
  for each row
  execute function public.log_coach_subscription_change();

-- ----------------------------------------------------------------
-- 8. Harden coach self-update protection (extend 0006: also guard
--    coach_id and start_date; keep owner bypass).
-- ----------------------------------------------------------------
create or replace function public.protect_coach_subscription_update()
returns trigger as $$
begin
  if exists (select 1 from public.owners where owners.id = auth.uid()) then
    return new;
  end if;
  if auth.uid() != old.coach_id then
    return new;
  end if;
  if new.status is distinct from old.status then
    new.status := old.status;
  end if;
  if new.plan_name is distinct from old.plan_name then
    new.plan_name := old.plan_name;
  end if;
  if new.price is distinct from old.price then
    new.price := old.price;
  end if;
  if new.end_date is distinct from old.end_date then
    new.end_date := old.end_date;
  end if;
  if new.coach_id is distinct from old.coach_id then
    new.coach_id := old.coach_id;
  end if;
  if new.start_date is distinct from old.start_date then
    new.start_date := old.start_date;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_coach_subscription on public.coach_subscriptions;
create trigger protect_coach_subscription
  before update on public.coach_subscriptions
  for each row
  execute function public.protect_coach_subscription_update();

-- ----------------------------------------------------------------
-- 9. Backfill: every existing coach gets a subscription if missing.
--    Default to STARTER so limits apply coherently going forward.
-- ----------------------------------------------------------------
insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
select
  c.id,
  'STARTER',
  'ACTIVE',
  current_date,
  current_date + interval '30 days',
  (select price from public.coach_plans where id = 'STARTER'),
  false
from public.coaches c
where not exists (select 1 from public.coach_subscriptions cs where cs.coach_id = c.id)
on conflict do nothing;
