-- ================================================================
-- 0023 — ON UPDATE CASCADE on every FK pointing at clients(id).
--
-- Why: "Create login" upgrades a coach-managed client by rewriting
-- clients.id to the newly created auth user id (the whole app —
-- RLS, Auth, login RPC — assumes clients.id IS the auth uid).
-- Every child row (plans, check-ins, meals, subscriptions, payments,
-- sessions, messages, notifications, strength, meal logs…) must follow
-- the PK change automatically instead of blocking it.
--
-- All of these FKs are single-column client_id with ON DELETE CASCADE;
-- this keeps that and only adds ON UPDATE CASCADE. Re-runnable.
-- ================================================================

do $$
declare
  r record;
  cols text;
begin
  for r in
    select c.oid, c.conname, c.conrelid, c.conkey
    from pg_constraint c
    where c.confrelid = 'public.clients'::regclass
      and c.contype = 'f'
  loop
    select string_agg(a.attname, ', ' order by u.ord) into cols
    from unnest(r.conkey) with ordinality as u(attnum, ord)
    join pg_attribute a on a.attrelid = r.conrelid and a.attnum = u.attnum;

    execute format('alter table %s drop constraint %I', r.conrelid::regclass, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%s) references public.clients (id) on update cascade on delete cascade',
      r.conrelid::regclass, r.conname, cols
    );
  end loop;
end
$$;
