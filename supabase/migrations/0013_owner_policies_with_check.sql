-- ================================================================
-- 0013 — VERRAA Owner policies: explicit WITH CHECK for INSERTs.
--
-- The 0006 owner policies were written as `FOR ALL ... USING (...)`
-- without an explicit WITH CHECK. Owner UPDATE/DELETE/SELECT work, but
-- owner-side INSERTs (creating a subscription row for a coach) must be
-- covered unambiguously. Recreate the four owner policies with both
-- clauses. Permissive and additive — coach/client behaviour unchanged.
-- Safe to re-run.
-- ================================================================

drop policy if exists coaches_owner_all on public.coaches;
create policy coaches_owner_all on public.coaches
  for all
  using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

drop policy if exists coach_subscriptions_owner_all on public.coach_subscriptions;
create policy coach_subscriptions_owner_all on public.coach_subscriptions
  for all
  using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

drop policy if exists coach_subscription_history_owner_all on public.coach_subscription_history;
create policy coach_subscription_history_owner_all on public.coach_subscription_history
  for all
  using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));

drop policy if exists admin_audit_log_owner_all on public.admin_audit_log;
create policy admin_audit_log_owner_all on public.admin_audit_log
  for all
  using (exists (select 1 from public.owners where owners.id = auth.uid()))
  with check (exists (select 1 from public.owners where owners.id = auth.uid()));
