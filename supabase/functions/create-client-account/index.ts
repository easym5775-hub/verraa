// ================================================================
// VERRAA — Edge Function: client account lifecycle.
//
// Runs server-side with the service role key (set via `supabase secrets
// set SUPABASE_SERVICE_ROLE_KEY=...` — NEVER in frontend code). Creating an
// auth.users row for a client can't happen from the browser, so the coach's
// JWT is verified here and the admin API does the privileged work.
//
// Actions:
//   { action: "create", username, password, name, ... }  -> new client login
//   { action: "reset-password", clientId, newPassword }  -> coach resets a client's password
//   { action: "delete", clientId }                        -> remove client + auth user
//
// Deploy: `supabase functions deploy create-client-account`
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// New accounts use the VERRAA domain. Existing accounts keep working on the
// legacy clients.forge.internal domain because sign-in resolves the stored
// login_email (client_login_email RPC) instead of reconstructing it.
const EMAIL_DOMAIN = "clients.verraa.internal";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${EMAIL_DOMAIN}`;
}

// Client logins are `<client>.<coach>` — e.g. coach "Ahmed" + "ali" => "ali.ahmed".
// Keep in sync with `coachUsernameSuffix` in src/lib.ts.
function coachSuffixFor(name: unknown, email: unknown): string {
  const slugToken = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const tokens = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const s = slugToken(t);
    if (s) return s;
  }
  const prefix = String(email ?? "").trim().split("@")[0] ?? "";
  const emailSlug = prefix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  if (emailSlug) return emailSlug;
  return "coach";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Edge function is not configured." }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // --- verify the caller is a coach -------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: coachRow } = await admin.from("coaches").select("id, name, email").eq("id", userData.user.id).maybeSingle();
  if (!coachRow) return json({ error: "Only coaches can manage client accounts." }, 403);
  const coachId: string = (coachRow as { id: string }).id;
  const coachSuffix = coachSuffixFor(
    (coachRow as { name?: unknown }).name,
    (coachRow as { email?: unknown }).email ?? userData.user.email,
  );

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const action = String(body.action ?? "create");

  // =======================================================================
  // CREATE
  // =======================================================================
  if (action === "create") {
    let username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const name = String(body.name ?? "").trim();

    // Enforce the `<client>.<coach>` convention server-side: if the coach
    // typed only "ali", store "ali.ahmed". A full "ali.ahmed" passes through
    // untouched so retries / pasted logins never double-append.
    if (username && !username.endsWith(`.${coachSuffix}`)) {
      const part = username.replace(/^\.+|\.+$/g, "");
      username = `${part}.${coachSuffix}`.toLowerCase();
    }

    if (!/^[a-z0-9_.-]{3,24}$/.test(username)) {
      return json({ error: `Username must be 3-24 characters (letters, numbers, dots, dashes) and ends with .${coachSuffix} — e.g. ali.${coachSuffix}.` }, 400);
    }
    if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
    if (!name) return json({ error: "Client name is required." }, 400);

    // Friendly uniqueness check before hitting auth.admin. Usernames must be
    // GLOBALLY unique — the synthetic email ({username}@clients.verraa.internal)
    // has to be unique across all of Supabase Auth, not just within one coach.
    const { data: taken } = await admin
      .from("clients")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (taken) return json({ error: `Username "${username}" is already taken.` }, 409);

    // --- SERVER-SIDE client-limit enforcement (authoritative pre-check;
    //     the DB trigger enforce_coach_client_limit is the final guard) ---
    // Resolve the coach's current plan -> max_clients from coach_plans.
    const { data: latestSub } = await admin
      .from("coach_subscriptions")
      .select("plan_name")
      .eq("coach_id", coachId)
      .order("end_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let planId: string | null = null;
    if (latestSub?.plan_name) {
      const norm = String(latestSub.plan_name).trim().toUpperCase().replace(/[\s_-]+/g, "");
      const map: Record<string, string> = {
        FREE: "FREE", TRIAL: "FREE", TEST: "FREE",
        STARTER: "STARTER", START: "STARTER", BASIC: "STARTER",
        PROFESSIONAL: "PROFESSIONAL", PROFESIONAL: "PROFESSIONAL", PRO: "PROFESSIONAL",
        ENTERPRISE: "ENTERPRISE", ENTERPRIZE: "ENTERPRISE", UNLIMITED: "ENTERPRISE", SCALE: "ENTERPRISE", BUSINESS: "ENTERPRISE",
      };
      planId = map[norm] ?? null;
      // Legacy unknown plan names -> preserve existing behaviour (allow).
      if (latestSub?.plan_name && !planId) planId = "__LEGACY__";
    } else {
      planId = "FREE"; // no subscription -> FREE trial default for new coaches
    }
    if (planId && planId !== "__LEGACY__") {
      const { data: planRow } = await admin
        .from("coach_plans")
        .select("max_clients")
        .eq("id", planId)
        .maybeSingle();
      const maxClients = (planRow?.max_clients as number | null | undefined) ?? null;
      if (maxClients !== null && maxClients !== undefined) {
        const { count } = await admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("coach_id", coachId);
        const current = count ?? 0;
        if (current >= maxClients) {
          const planName = planId.charAt(0) + planId.slice(1).toLowerCase();
          return json(
            { error: `PLAN_LIMIT_REACHED: You've reached the ${maxClients}-client limit (${current}/${maxClients}) of your ${planName} plan. Upgrade your plan to add more clients.` },
            403,
          );
        }
      }
    }

    const email = syntheticEmail(username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "client", username },
    });
    if (createError) return json({ error: createError.message }, 400);

    const clientRow = {
      id: created.user.id,
      coach_id: coachId,
      username,
      name,
      // login_email = the synthetic auth email (what the client signs in with).
      // email       = the real contact email the coach typed (never used for auth).
      login_email: email,
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      gender: body.gender ?? null,
      age: body.age ?? null,
      goal: String(body.goal ?? "General fitness"),
      status: String(body.status ?? "Active"),
      start_date: String(body.startDate ?? new Date().toISOString().slice(0, 10)),
      notes: String(body.notes ?? ""),
      photo: body.photo ?? null,
    };

    const { data: inserted, error: insertError } = await admin
      .from("clients")
      .insert(clientRow)
      .select()
      .single();
    if (insertError) {
      // Roll back the auth user so we don't leave orphans.
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: insertError.message }, 400);
    }

    return json({ ok: true, client: inserted });
  }

  // =======================================================================
  // RESET PASSWORD
  // =======================================================================
  if (action === "reset-password") {
    const clientId = String(body.clientId ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!clientId) return json({ error: "clientId is required." }, 400);
    if (newPassword.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

    // Ensure the coach owns this client.
    const { data: owned } = await admin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (!owned) return json({ error: "Client not found." }, 404);

    const { error } = await admin.auth.admin.updateUserById(clientId, { password: newPassword });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  // =======================================================================
  // DELETE
  // =======================================================================
  if (action === "delete") {
    const clientId = String(body.clientId ?? "");
    if (!clientId) return json({ error: "clientId is required." }, 400);

    const { data: owned } = await admin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("coach_id", coachId)
      .maybeSingle();
    if (!owned) return json({ error: "Client not found." }, 404);

    // Deleting the clients row cascades to all their data; then remove the
    // auth user so their login stops working.
    await admin.from("clients").delete().eq("id", clientId).eq("coach_id", coachId);
    const { error } = await admin.auth.admin.deleteUser(clientId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
