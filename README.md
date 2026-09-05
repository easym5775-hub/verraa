# FORGE — Coaching OS

A fitness-coaching platform with two roles (**Coach** and **Client**), backed by
**Supabase** (Auth + Postgres + Edge Functions) with a clean, swappable data layer.

## Quick start (demo mode — no setup)

```bash
npm install
npm run dev
```

With no Supabase credentials set, the app runs in a clearly-labelled **demo mode**:
data lives in the browser and is seeded with a coach and three clients.

- **Coach** sign-in: any email + password `demo1234`
- **Client** sign-in: username `ahmed`, `sara` or `omar` + password `demo1234`

## Going live with Supabase

1. **Create a Supabase project**, then apply the schema:
   - Run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
   - It creates all tables, enables RLS, and installs the `client_login_email` RPC.

2. **Deploy the Edge Function** (creates client logins server-side):
   ```bash
   supabase functions deploy create-client-account
   # The service-role key lives ONLY here, never in the frontend:
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

3. **Configure the frontend** — copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```
   Restart the dev server. The app now uses real auth and Postgres.

## How the pieces fit

```
UI (React)
  └─ store.tsx            — CRUD actions, optimistic local state + persist
       └─ services/backend.ts — Backend interface (SupabaseBackend | DemoBackend)
            ├─ Supabase: Postgres via RLS-scoped queries + Edge Function for
            │            client account lifecycle (create / reset / delete)
            └─ Demo:     localStorage, so the app runs with zero setup
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
