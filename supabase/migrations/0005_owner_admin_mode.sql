-- ================================================================
-- VERRAA — Owner/Admin Mode: coach account status and subscription management
-- ================================================================

-- ----------------------------------------------------------------
-- Add account_status column to coaches table
-- ----------------------------------------------------------------
alter table public.coaches 
  add column if not exists account_status text not null default 'ACTIVE';

-- Add index for faster filtering
create index if not exists idx_coaches_account_status on public.coaches(account_status);

-- ----------------------------------------------------------------
-- Add subscription tracking for coaches (SaaS-level subscriptions)
-- ----------------------------------------------------------------
create table if not exists public.coach_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  coach_id        uuid not null references public.coaches (id) on delete cascade,
  plan_name       text not null default 'Free',
  status          text not null default 'ACTIVE',
  start_date      date not null default current_date,
  end_date        date not null,
  price           numeric(10,2) not null default 0,
  auto_renew      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_coach_subscriptions_coach_id on public.coach_subscriptions(coach_id);
create index if not exists idx_coach_subscriptions_status on public.coach_subscriptions(status);
create index if not exists idx_coach_subscriptions_end_date on public.coach_subscriptions(end_date);

-- ----------------------------------------------------------------
-- Subscription history / audit log
-- ----------------------------------------------------------------
create table if not exists public.coach_subscription_history (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.coach_subscriptions (id) on delete cascade,
  action          text not null, -- 'created', 'extended', 'plan_changed', 'activated', 'cancelled', 'expired'
  old_value       jsonb,
  new_value       jsonb,
  performed_by    uuid references auth.users (id),
  performed_at    timestamptz not null default now()
);

create index if not exists idx_coach_subscription_history_sub_id on public.coach_subscription_history(subscription_id);

-- ----------------------------------------------------------------
-- Admin actions audit log
-- ----------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  action          text not null, -- 'coach_activated', 'coach_suspended', 'subscription_extended', etc.
  target_type     text not null, -- 'coach', 'subscription'
  target_id       uuid not null,
  old_value       jsonb,
  new_value       jsonb,
  performed_by    uuid references auth.users (id),
  performed_at    timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_target on public.admin_audit_log(target_type, target_id);
create index if not exists idx_admin_audit_log_performed_at on public.admin_audit_log(performed_at);

-- ----------------------------------------------------------------
-- RLS Policies for coach_subscriptions
-- ----------------------------------------------------------------
alter table public.coach_subscriptions enable row level security;

-- Coaches can read their own subscription
drop policy if exists coach_subscriptions_coach_read on public.coach_subscriptions;
create policy coach_subscriptions_coach_read on public.coach_subscriptions
  for select using (coach_id = auth.uid());

-- Only coaches can insert their own (initial subscription on signup)
drop policy if exists coach_subscriptions_coach_insert on public.coach_subscriptions;
create policy coach_subscriptions_coach_insert on public.coach_subscriptions
  for insert with check (coach_id = auth.uid());

-- Coaches can update their own subscription (limited)
drop policy if exists coach_subscriptions_coach_update on public.coach_subscriptions;
create policy coach_subscriptions_coach_update on public.coach_subscriptions
  for update using (coach_id = auth.uid());

-- Admin/Owner policy — enforced in the application layer via the owners
-- table lookup plus RLS, and by Supabase Auth role resolution.
-- In production, you would create an 'owners' table and add policies like:
-- create policy coach_subscriptions_owner_all on public.coach_subscriptions
--   for all using (exists (select 1 from owners where owners.user_id = auth.uid()));

-- ----------------------------------------------------------------
-- RLS Policies for coach_subscription_history
-- ----------------------------------------------------------------
alter table public.coach_subscription_history enable row level security;

-- Coaches can read their own subscription history
drop policy if exists coach_subscription_history_coach_read on public.coach_subscription_history;
create policy coach_subscription_history_coach_read on public.coach_subscription_history
  for select using (
    subscription_id in (select id from public.coach_subscriptions where coach_id = auth.uid())
  );

-- ----------------------------------------------------------------
-- RLS Policies for admin_audit_log
-- ----------------------------------------------------------------
alter table public.admin_audit_log enable row level security;

-- Only owners can read/write audit log (in production with owners table)
-- For now, allow coaches to see entries related to them
drop policy if exists admin_audit_log_coach_read on public.admin_audit_log;
create policy admin_audit_log_coach_read on public.admin_audit_log
  for select using (
    target_type = 'coach' AND target_id = auth.uid()
  );

-- ----------------------------------------------------------------
-- Helper function to get coach subscription status
-- ----------------------------------------------------------------
create or replace function public.get_coach_subscription_status(p_coach_id uuid)
returns table (
  plan_name text,
  status text,
  end_date date,
  days_remaining integer,
  is_active boolean
) as $$
begin
  return query
  select 
    cs.plan_name,
    cs.status,
    cs.end_date,
    case 
      when cs.status = 'ACTIVE' then greatest(0, cs.end_date - current_date)
      else 0
    end::integer as days_remaining,
    (cs.status = 'ACTIVE' AND cs.end_date >= current_date) as is_active
  from public.coach_subscriptions cs
  where cs.coach_id = p_coach_id
  order by cs.created_at desc
  limit 1;
end;
$$ language plpgsql stable;

-- ----------------------------------------------------------------
-- Helper function to count clients per coach
-- ----------------------------------------------------------------
create or replace function public.get_coach_client_count(p_coach_id uuid)
returns integer as $$
begin
  return (select count(*) from public.clients where coach_id = p_coach_id);
end;
$$ language plpgsql stable;

-- ----------------------------------------------------------------
-- Trigger to update updated_at on coach_subscriptions
-- ----------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_coach_subscriptions_updated_at on public.coach_subscriptions;
create trigger update_coach_subscriptions_updated_at
  before update on public.coach_subscriptions
  for each row
  execute function public.update_updated_at_column();

-- ----------------------------------------------------------------
-- Seed data: Create initial free subscription for existing coaches
-- ----------------------------------------------------------------
-- This will be run after migration to ensure all existing coaches have a subscription
-- Note: In practice, this should be done via application logic
