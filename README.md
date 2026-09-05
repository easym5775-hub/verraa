# FORGE — Coaching OS

A fitness-coaching platform with two roles (**Coach** and **Client**), backed by
**Supabase** (Auth + Postgres + Edge Functions) with a clean, swappable data layer.

## Quick start (production — Supabase required)

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then:
npm run dev
```

The app uses **Supabase as the only authentication and data source**
(Auth + Postgres + Edge Functions). There is no demo mode and no demo
fallback: if Supabase is unreachable the app shows an error state.

## Going live with Supabase

1. **Create a Supabase project**, then apply the schema **in order**:
   - Via CLI (recommended): `supabase link --project-ref <ref>` then `supabase db push`
     (applies `supabase/migrations/0001` → `0008`).
   - Or via Dashboard → SQL editor: run each file in `supabase/migrations/` in
     numeric order (`0001_init.sql` … `0008_coach_signup_trigger.sql`).
   - `0008` installs the `handle_new_coach` trigger so a coach row + STARTER
     subscription are created automatically on signup — even when
     **Confirm email** is ON.

2. **Auth settings** (Dashboard → Authentication → Settings):
   - For instant coach signup, turn **Confirm email OFF** — coaches land in
     their dashboard immediately. If you keep it ON, the app shows
     "check your inbox, then sign in" and the profile is created on first
     sign-in (trigger + frontend self-heal).
   - No extra providers or SMTP config required for the core flow.

3. **Deploy the Edge Function** (creates client logins server-side):
   ```bash
   supabase functions deploy create-client-account
   # The service-role key lives ONLY here, never in the frontend:
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

4. **Configure the frontend** — copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```
   Restart the dev server. The app now uses real auth and Postgres.

## Deploy to Vercel

1. Push this repo to GitHub (`.env` is gitignored — secrets never get committed).
2. In Vercel → **New Project** → import the repo. Settings are pre-configured
   in `vercel.json` (Vite build, `dist` output, SPA rewrite to `/index.html`).
3. Add **Environment Variables** (same values as `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy.** No server-side code runs on Vercel — the app talks directly to
   Supabase (Postgres + Auth + Edge Functions) from the browser via RLS.

> Supabase Dashboard → Authentication → URL Configuration: add your Vercel
> domain to **Redirect URLs** (e.g. `https://your-app.vercel.app/**`) so
> email-confirmation links return to the deployed app.

## How the pieces fit

```
UI (React)
  └─ store.tsx            — CRUD actions, optimistic local state + persist
       └─ services/backend.ts — Backend interface (SupabaseBackend, the only implementation)
            └─ Supabase: Postgres via RLS-scoped queries + Edge Function for
                         client account lifecycle (create / reset / delete)
```

- **Both roles are Supabase Auth users.** `auth.uid()` scopes everything via RLS;
  no `coach_id` is ever passed manually from the UI.
- **Client login uses a username.** The coach picks a username + password when
  creating a client; an Edge Function stores a synthetic email
  (`username@clients.forge.internal`) and the `client_login_email` RPC resolves it
  at sign-in, so clients never see or type an email.
- **Clients can only read their own data** and may insert their own check-ins —
  exactly mirroring the app's behaviour.

## Security notes

- The **service-role key is never** in `src/`, `.env`, or `.env.example` — it is a
  Supabase Edge Function secret only.
- All tables have **Row Level Security** enabled.
- Client passwords are managed exclusively through the privileged Edge Function.

## Scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
```
