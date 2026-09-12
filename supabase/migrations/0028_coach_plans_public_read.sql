-- ================================================================
-- 0028 — VERRAA Public pricing read (landing page linkage)
--
-- The landing PricingSection is viewed LOGGED OUT (anon role), but its
-- prices must come from `coach_plans` — the same single source of truth
-- the owner edits in SaaS Settings and coaches see in Coach Mode.
--
-- This policy lets ANYONE (including anon visitors) read ACTIVE plans
-- only — i.e. the public fields id / name / price / max_clients.
-- Inactive plans stay hidden publicly, and ALL writes stay owner-only
-- (coach_plans_owner_write). Safe to re-run. Preserves existing data.
-- ================================================================

-- Public read of active plans (landing page + any logged-out surface).
drop policy if exists coach_plans_public_read on public.coach_plans;
create policy coach_plans_public_read on public.coach_plans
  for select using (is_active = true);
