-- ================================================================
-- 0014 — VERRAA Free trial plan + coach plan-request approval flow.
--
-- 1. New canonical FREE plan (price 0, 1 client): every NEW coach starts
--    on it as a trial. Existing subscriptions are untouched.
-- 2. resolve_coach_plan_id: FREE/TRIAL now resolve to FREE (were STARTER).
-- 3. handle_new_coach trigger: new signups get FREE instead of STARTER.
-- 4. New coach_plan_requests table: a coach REQUESTS a paid plan, the
--    owner APPROVES (plan activates) or REJECTS it. Coaches can only see
--    and insert their own rows; only one PENDING request per coach.
-- 5. review_coach_plan_request RPC (owner-only, atomic): approve applies
--    the plan via the same guarded rules as change_coach_plan (price from
--    coach_plans, downgrade guard, history + audit); reject just records.
--
-- Safe to re-run. Preserves all existing data, RLS and triggers.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. FREE plan seed (idempotent)
-- ----------------------------------------------------------------
insert into public.coach_plans (id, name, price, max_clients, billing_interval, is_active)
values ('FREE', 'Free', 0, 1, 'monthly', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 2. Plan-name resolution: FREE is now its own plan
-- ----------------------------------------------------------------
create or replace function public.resolve_coach_plan_id(p_plan_name text)
returns text
language sql
immutable
as $$
  select case upper(regexp_replace(coalesce(p_plan_name, ''), '[\s_-]+', '', 'g'))
    when 'FREE' then 'FREE'
    when 'TRIAL' then 'FREE'
    when 'TEST' then 'FREE'
    when 'STARTER' then 'STARTER'
    when 'START' then 'STARTER'
    when 'BASIC' then 'STARTER'
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
-- 3. New coaches start on FREE (trial: 1 client)
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

  -- Ensure a FREE trial subscription exists (backfill-safe, idempotent).
  if not exists (select 1 from public.coach_subscriptions where coach_id = NEW.id) then
    select price into v_price from public.coach_plans where id = 'FREE';
    v_price := coalesce(v_price, 0);
    insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
    values (NEW.id, 'FREE', 'ACTIVE', current_date, current_date + interval '30 days', v_price, false);
  end if;

  return NEW;
end;
$$;

-- ----------------------------------------------------------------
-- 4. coach_plan_requests table + RLS
-- ----------------------------------------------------------------
create table if not exists public.coach_plan_requests (
  id             uuid primary key default gen_random_uuid(),
  coach_id       uuid not null references public.coaches (id) on delete cascade,
  requested_plan text not null,
  status         text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  note           text not null default '',
  review_note    text,
  reviewed_by    uuid references auth.users (id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_plan_requests_coach on public.coach_plan_requests (coach_id);
create index if not exists idx_plan_requests_status on public.coach_plan_requests (status);
create index if not exists idx_plan_requests_created on public.coach_plan_requests (created_at desc);

-- One pending request per coach at a time (friendly "already requested"
-- error instead of silent duplicates).
create unique index if not exists plan_requests_one_pending_per_coach
  on public.coach_plan_requests (coach_id)
  where status = 'PENDING';

alter table public.coach_plan_requests enable row level security;

-- Coaches read only their own requests.
drop policy if exists plan_requests_coach_read on public.coach_plan_requests;
create policy plan_requests_coach_read on public.coach_plan_requests
  for select using (coach_id = auth.uid());

-- Coaches may file requests for themselves only.
drop policy if exists plan_requests_coach_insert on public.coach_plan_requests;
create policy plan_requests_coach_insert on public.coach_plan_requests
  for insert with check (coach_id = auth.uid());

-- Owners see and manage everything.
drop policy if exists plan_requests_owner_all on public.coach_plan_requests;
create policy plan_requests_owner_all on public.coach_plan_requests
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

-- ----------------------------------------------------------------
-- 5. Owner-only atomic review RPC.
--    Approve  -> plan activates (guarded: price from coach_plans, client
--                count must fit the new limit, history + audit written).
--    Reject   -> status recorded with an optional note, plan untouched.
-- ----------------------------------------------------------------
create or replace function public.review_coach_plan_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_req public.coach_plan_requests%rowtype;
  v_plan public.coach_plans%rowtype;
  v_sub public.coach_subscriptions%rowtype;
  v_count integer;
  v_old jsonb;
begin
  if v_caller is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.owners where owners.id = v_caller) then
    raise exception 'Only owners can review plan requests.' using errcode = '42501';
  end if;

  select * into v_req from public.coach_plan_requests where id = p_request_id;
  if not found then
    raise exception 'Request not found.' using errcode = 'P0001';
  end if;
  if v_req.status <> 'PENDING' then
    raise exception 'This request was already reviewed.' using errcode = 'P0001';
  end if;

  if p_approve then
    select * into v_plan from public.coach_plans
    where id = upper(trim(v_req.requested_plan)) and is_active = true;
    if not found then
      raise exception 'Unknown or inactive plan: %', v_req.requested_plan using errcode = 'P0001';
    end if;

    select * into v_sub from public.coach_subscriptions
    where coach_id = v_req.coach_id
    order by end_date desc, created_at desc
    limit 1;

    select count(*)::integer into v_count from public.clients where coach_id = v_req.coach_id;
    if v_plan.max_clients is not null and v_count > v_plan.max_clients then
      raise exception 'PLAN_DOWNGRADE_BLOCKED: this coach has % clients but the % plan allows up to %. Remove clients first or pick a bigger plan.', v_count, v_plan.id, v_plan.max_clients
        using errcode = 'P0001';
    end if;

    v_old := to_jsonb(v_sub);

    if v_sub.id is null then
      insert into public.coach_subscriptions (coach_id, plan_name, status, start_date, end_date, price, auto_renew)
      values (v_req.coach_id, v_plan.id, 'ACTIVE', current_date, current_date + interval '30 days', v_plan.price, false)
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
    values ('plan_request_approved', 'plan_request', v_req.id, to_jsonb(v_req), to_jsonb(v_sub), v_caller);
  else
    insert into public.admin_audit_log (action, target_type, target_id, old_value, new_value, performed_by)
    values ('plan_request_rejected', 'plan_request', v_req.id, to_jsonb(v_req), jsonb_build_object('review_note', coalesce(p_note, '')), v_caller);
  end if;

  update public.coach_plan_requests
  set status = case when p_approve then 'APPROVED' else 'REJECTED' end,
      review_note = p_note,
      reviewed_by = v_caller,
      reviewed_at = now()
  where id = p_request_id
  returning * into v_req;

  return to_jsonb(v_req);
end;
$$;

revoke all on function public.review_coach_plan_request(uuid, boolean, text) from public;
grant execute on function public.review_coach_plan_request(uuid, boolean, text) to authenticated;
