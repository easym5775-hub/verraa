-- ================================================================
-- VERRAA — Owner insert policy for admin_audit_log.
--
-- The owner RLS policy (admin_audit_log_owner_all, 0006) is written as
-- `FOR ALL ... USING (...)`. Postgres applies USING to SELECT/UPDATE/
-- DELETE; INSERT rows need an explicit WITH CHECK so owner-side audit
-- writes (coach suspend/activate, subscription edits) succeed from the
-- frontend. Reads/writes stay owner-only.
-- ================================================================

drop policy if exists admin_audit_log_owner_insert on public.admin_audit_log;
create policy admin_audit_log_owner_insert on public.admin_audit_log
  for insert with check (exists (select 1 from public.owners where owners.id = auth.uid()));
