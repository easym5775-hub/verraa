-- New coaches start on USD (Ahmed, 2026-11-26): client subscription prices,
-- payments and revenue begin in dollars; the coach can switch to EGP in
-- Coach Settings. Existing coaches keep whatever currency they already have:
-- this only changes the column DEFAULT, no rows are touched. All coach-row
-- creation paths (0008 signup trigger, frontend upsert on signup when email
-- confirmation is OFF, ensureCoachRow self-heal) insert without a currency
-- value, so the default governs every new signup.
alter table public.coaches alter column currency set default 'USD';
