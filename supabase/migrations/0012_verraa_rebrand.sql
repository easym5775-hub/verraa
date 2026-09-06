-- ================================================================
-- 0012 — VERRAA rebrand: synthetic login-email domain.
--
-- The app was rebranded from FORGE to VERRAA. New client accounts use
-- {username}@clients.verraa.internal (see the create-client-account
-- Edge Function). Rows created before the rebrand keep their
-- clients.forge.internal login_email AND their matching auth.users
-- email on purpose — changing them would orphan those logins.
--
-- Sign-in resolves the STORED login_email via client_login_email(),
-- so both domains coexist indefinitely. This migration only backfills
-- rows that somehow have a NULL login_email (safe to re-run).
-- ================================================================

update public.clients
   set login_email = lower(username) || '@clients.verraa.internal'
 where login_email is null;
