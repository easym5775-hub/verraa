/* ================================================================
   FORGE — Supabase client singleton + backend selection.
   Only PUBLIC values live here (project URL + anon key). The service
   role key exists exclusively inside the Edge Function's secrets.

   When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set the app
   runs in a clearly-labelled local DEMO mode so it is fully usable in
   this environment. Add real credentials in `.env` and the same code
   paths switch to live Supabase (Auth + Postgres + Edge Functions).
   ================================================================ */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** True once real Supabase credentials are provided via the environment. */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

/** Convenience inverse — used to branch between Supabase and the demo backend. */
export const isDemoMode = !isSupabaseConfigured;

export const supabase: SupabaseClient = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "public-anon-key-not-set",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
