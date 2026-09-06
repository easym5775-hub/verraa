-- ================================================================
-- 0011 — VERRAA Owner data visibility.
--
-- Problem: owner RLS policies existed only for coaches,
-- coach_subscriptions, history, audit and coach_plans. The owner could
-- NOT read clients, exercises, plans, check-ins, meals, client
-- subscriptions, payments, sessions, messages or notifications — so the
-- Owner Dashboard showed 0 clients, coach client counts were 0, and
-- analytics client metrics were empty.
--
-- Fix: owner full access (read + manage, for support) on every app data
-- table. Policies are permissive (OR-ed with coach/client policies),
-- so existing coach/client behaviour is unchanged. Safe to re-run.
-- ================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'exercises', 'plan_items', 'check_ins', 'meals',
    'subscriptions', 'payments', 'sessions', 'messages', 'notifications'
  ] loop
    execute format('drop policy if exists %s_owner_all on public.%I', t, t);
    execute format(
      'create policy %s_owner_all on public.%I
         for all
         using (exists (select 1 from public.owners where owners.id = auth.uid()))
         with check (exists (select 1 from public.owners where owners.id = auth.uid()))',
      t, t
    );
  end loop;
end
$$;
