-- ================================================================
-- FORGE — Owner Mode Security Fix: proper owners table and RLS
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Create the public.owners table
-- ----------------------------------------------------------------
create table if not exists public.owners (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default 'Owner',
  email      text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_owners_id on public.owners(id);
create unique index if not exists idx_owners_email on public.owners(email);

-- Enable RLS on owners table
alter table public.owners enable row level security;

-- Owners can only read their own row (no leakage about other owners)
drop policy if exists owners_read_own on public.owners;
create policy owners_read_own on public.owners
  for select using (id = auth.uid());

-- Only existing owners can insert new owners (via admin action)
drop policy if exists owners_insert on public.owners;
create policy owners_insert on public.owners
  for insert with check (auth.uid() IN (SELECT id FROM public.owners));

-- Owners can update only their own row
drop policy if exists owners_update_own on public.owners;
create policy owners_update_own on public.owners
  for update using (id = auth.uid());

-- ----------------------------------------------------------------
-- 2. Owner-elevated RLS policies for coaches table
-- ----------------------------------------------------------------
-- Allow owners full access to all coaches
drop policy if exists coaches_owner_all on public.coaches;
create policy coaches_owner_all on public.coaches
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()));

-- ----------------------------------------------------------------
-- 3. Owner-elevated RLS policies for coach_subscriptions
-- ----------------------------------------------------------------
drop policy if exists coach_subscriptions_owner_all on public.coach_subscriptions;
create policy coach_subscriptions_owner_all on public.coach_subscriptions
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()));

-- ----------------------------------------------------------------
-- 4. Owner-elevated RLS policies for coach_subscription_history
-- ----------------------------------------------------------------
drop policy if exists coach_subscription_history_owner_all on public.coach_subscription_history;
create policy coach_subscription_history_owner_all on public.coach_subscription_history
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()));

-- ----------------------------------------------------------------
-- 5. Owner-elevated RLS policies for admin_audit_log
-- ----------------------------------------------------------------
drop policy if exists admin_audit_log_owner_all on public.admin_audit_log;
create policy admin_audit_log_owner_all on public.admin_audit_log
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()));

-- ----------------------------------------------------------------
-- 6. Restrict coach self-update on protected columns via trigger
--    A coach cannot change their own account_status
-- ----------------------------------------------------------------
create or replace function public.protect_coach_account_status_update()
returns trigger as $$
begin
  -- If the updater is an owner, allow the change
  if exists (select 1 from public.owners where owners.id = auth.uid()) then
    return new;
  end if;
  
  -- If the updater is NOT the coach themselves, let other RLS handle it
  if auth.uid() != old.id then
    return new;
  end if;
  
  -- Coach is updating their own row - prevent changes to account_status
  if new.account_status is distinct from old.account_status then
    -- Revert the protected column silently
    new.account_status := old.account_status;
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_coach_account_status on public.coaches;
create trigger protect_coach_account_status
  before update on public.coaches
  for each row
  execute function public.protect_coach_account_status_update();

-- ----------------------------------------------------------------
-- 7. Restrict coach self-update on protected subscription columns
--    A coach cannot change status, plan_name, price, end_date on their own subscription
-- ----------------------------------------------------------------
create or replace function public.protect_coach_subscription_update()
returns trigger as $$
begin
  -- If the updater is an owner, allow the change
  if exists (select 1 from public.owners where owners.id = auth.uid()) then
    return new;
  end if;
  
  -- If the updater is NOT the coach themselves, let other RLS handle it
  if auth.uid() != old.coach_id then
    return new;
  end if;
  
  -- Coach is updating their own subscription - prevent changes to protected columns
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
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_coach_subscription on public.coach_subscriptions;
create trigger protect_coach_subscription
  before update on public.coach_subscriptions
  for each row
  execute function public.protect_coach_subscription_update();

-- ----------------------------------------------------------------
-- 8. Example INSERT for developer to manually create owner after
--    creating the corresponding Supabase Auth user in dashboard.
--    DO NOT auto-create an owner with a known password anywhere.
-- ----------------------------------------------------------------
-- To create your first owner:
--   1. In Supabase Dashboard > Authentication, create a new user with your desired email/password
--   2. Copy that user's UUID
--   3. Run this INSERT with your actual values:
--
-- INSERT INTO public.owners (id, name, email)
-- VALUES ('YOUR-AUTH-USER-UUID-HERE', 'Your Name', 'your-email@example.com');
--
-- After this, resolveRole() will recognize you as an owner when signed in.
