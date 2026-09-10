-- ================================================================
-- 0024 — Client priority (Critical / Medium / Normal).
--
-- Coaches with big rosters need VIPs surfaced first: the app sorts
-- needs-attention, review lists and the roster itself by priority
-- before urgency. Defaults to Normal; only changed explicitly.
-- ================================================================

alter table public.clients add column if not exists priority text not null default 'Normal';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_priority_check') then
    alter table public.clients add constraint clients_priority_check
      check (priority in ('Critical', 'Medium', 'Normal'));
  end if;
end
$$;
