-- ================================================================
-- 0025 — VERRAA Diet-plan versions (one standing plan per client).
--
-- The coach does NOT rebuild the plan weekly: each client follows ONE
-- diet plan for the whole subscription. When the coach changes it, the
-- previous plan is kept as an archived version that can be restored.
--
-- nutrition_plans holds the versions (exactly one "active" per client,
-- enforced app-side); meals.plan_id points at its version. Legacy meals
-- (plan_id NULL) belong to the client's oldest version — the app reads
-- them that way, so no data migration is needed.
--
-- RLS mirrors the other client-scoped tables. Safe to re-run.
-- ================================================================

create table if not exists public.nutrition_plans (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references public.coaches (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null default 'Plan 1',
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_nutrition_plans_client on public.nutrition_plans (client_id);
create index if not exists idx_nutrition_plans_status on public.nutrition_plans (client_id, status);

-- Link meals to their version (nullable so legacy rows keep working).
alter table public.meals
  add column if not exists plan_id uuid references public.nutrition_plans (id) on delete cascade;

create index if not exists idx_meals_plan on public.meals (client_id, plan_id);

alter table public.nutrition_plans enable row level security;

-- coach: full access to their own rows
drop policy if exists nutrition_plans_coach_all on public.nutrition_plans;
create policy nutrition_plans_coach_all on public.nutrition_plans
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- client: read their own versions (the app shows them the active one)
drop policy if exists nutrition_plans_client_read on public.nutrition_plans;
create policy nutrition_plans_client_read on public.nutrition_plans
  for select using (client_id = auth.uid());

-- owner: full access (support)
drop policy if exists nutrition_plans_owner_all on public.nutrition_plans;
create policy nutrition_plans_owner_all on public.nutrition_plans
  for all using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

-- keep updated_at fresh
create or replace function public.touch_nutrition_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_nutrition_plans_touch on public.nutrition_plans;
create trigger trg_nutrition_plans_touch
  before update on public.nutrition_plans
  for each row execute function public.touch_nutrition_plan_updated_at();
