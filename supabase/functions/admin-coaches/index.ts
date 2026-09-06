// ================================================================
// FORGE — Edge Function: coach administration (owner/admin only).
//
// Runs server-side with the service role key (set via `supabase secrets
// set SUPABASE_SERVICE_ROLE_KEY=...` — NEVER in frontend code).
//
// Actions:
//   { action: "create-coach", name, email, password }
//     -> create the auth user (pre-confirmed) + coaches row + FREE trial sub
//   { action: "delete-coach", coachId }
//     -> remove the coach login + every client, data row and client login
//   { action: "reset-password", coachId, newPassword }
//     -> set a new password for a coach login
//
// Every action writes an admin_audit_log entry. The admin account itself
// can never be targeted by any action.
//
// Deploy: `supabase functions deploy admin-coaches`
// ================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Edge function is not configured." }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // --- verify the caller is the admin/owner -------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing Authorization header." }, 401);

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid or expired session." }, 401);

  const { data: ownerRow } = await admin.from("owners").select("id").eq("id", userData.user.id).maybeSingle();
  if (!ownerRow) return json({ error: "Only the admin can manage coaches." }, 403);
  const ownerId: string = ownerRow.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const action = String(body.action ?? "");

  /** The admin account itself can never be targeted. */
  const assertNotOwner = async (id: string, email?: string): Promise<Response | null> => {
    if (id) {
      const { data: isOwner } = await admin.from("owners").select("id").eq("id", id).maybeSingle();
      if (isOwner) return json({ error: "Cannot target the admin account." }, 403);
    }
    if (email) {
      const { data: reserved } = await admin.from("owners").select("id").eq("email", email.toLowerCase()).maybeSingle();
      if (reserved) return json({ error: "This email is reserved for the admin account." }, 403);
    }
    return null;
  };

  // =======================================================================
  // CREATE COACH
  // =======================================================================
  if (action === "create-coach") {
    const name = String(body.name ?? "").trim().slice(0, 80);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name) return json({ error: "Coach name is required." }, 400);
    if (!isEmail(email)) return json({ error: "Enter a valid email address." }, 400);
    if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

    const blocked = await assertNotOwner("", email);
    if (blocked) return blocked;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "coach", name },
    });
    if (createError) return json({ error: createError.message }, 400);

    const coachId = created.user.id;

    // Idempotent profile row: the 0008 trigger usually creates it first from
    // user_metadata — upsert so both paths converge on the admin's values.
    const { error: coachError } = await admin
      .from("coaches")
      .upsert({ id: coachId, name, email }, { onConflict: "id" });
    if (coachError) {
      await admin.auth.admin.deleteUser(coachId);
      return json({ error: coachError.message }, 400);
    }

    const { data: existingSub } = await admin
      .from("coach_subscriptions")
      .select("id")
      .eq("coach_id", coachId)
      .limit(1)
      .maybeSingle();
    if (!existingSub) {
      const { data: plan } = await admin.from("coach_plans").select("price").eq("id", "FREE").maybeSingle();
      const price = typeof plan?.price === "number" ? plan.price : 0;
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      const { error: subError } = await admin.from("coach_subscriptions").insert({
        coach_id: coachId,
        plan_name: "FREE",
        status: "ACTIVE",
        start_date: isoDay(start),
        end_date: isoDay(end),
        price,
        auto_renew: false,
      });
      if (subError) {
        await admin.from("coaches").delete().eq("id", coachId);
        await admin.auth.admin.deleteUser(coachId);
        return json({ error: subError.message }, 400);
      }
    }

    await admin.from("admin_audit_log").insert({
      action: "coach_created",
      target_type: "coach",
      target_id: coachId,
      old_value: null,
      new_value: { name, email, plan_name: "FREE" },
      performed_by: ownerId,
    });

    return json({ ok: true, coachId, email });
  }

  // =======================================================================
  // DELETE COACH (full: login + every client, data row and client login)
  // =======================================================================
  if (action === "delete-coach") {
    const coachId = String(body.coachId ?? "");
    if (!coachId) return json({ error: "coachId is required." }, 400);

    const blocked = await assertNotOwner(coachId);
    if (blocked) return blocked;

    const { data: coach } = await admin.from("coaches").select("*").eq("id", coachId).maybeSingle();
    if (!coach) return json({ error: "Coach not found." }, 404);

    // Collect client auth ids BEFORE the cascade wipes the rows.
    const { data: clientRows } = await admin.from("clients").select("id").eq("coach_id", coachId);
    const clientIds: string[] = (clientRows ?? []).map((c: { id: string }) => c.id);

    // Deleting the coach auth user cascades: coaches row -> coach_subscriptions,
    // clients rows -> every client data row (plans, check-ins, meals, payments...).
    const { error: coachDeleteError } = await admin.auth.admin.deleteUser(coachId);
    if (coachDeleteError) return json({ error: coachDeleteError.message }, 400);

    // Client auth rows are referenced by nothing — remove each login explicitly.
    const orphaned: string[] = [];
    for (const clientId of clientIds) {
      const { error } = await admin.auth.admin.deleteUser(clientId);
      if (error) orphaned.push(clientId);
    }
    if (orphaned.length > 0) {
      return json(
        { error: `Coach deleted, but ${orphaned.length} client login(s) could not be removed. Delete them manually from Authentication > Users.` },
        500,
      );
    }

    await admin.from("admin_audit_log").insert({
      action: "coach_deleted",
      target_type: "coach",
      target_id: coachId,
      old_value: { ...coach, clients_deleted: clientIds.length },
      new_value: null,
      performed_by: ownerId,
    });

    return json({ ok: true, deletedClients: clientIds.length });
  }

  // =======================================================================
  // RESET COACH PASSWORD
  // =======================================================================
  if (action === "reset-password") {
    const coachId = String(body.coachId ?? "");
    const newPassword = String(body.newPassword ?? "");
    if (!coachId) return json({ error: "coachId is required." }, 400);
    if (newPassword.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

    const blocked = await assertNotOwner(coachId);
    if (blocked) return blocked;

    const { data: coach } = await admin.from("coaches").select("id, name").eq("id", coachId).maybeSingle();
    if (!coach) return json({ error: "Coach not found." }, 404);

    const { error } = await admin.auth.admin.updateUserById(coachId, { password: newPassword });
    if (error) return json({ error: error.message }, 400);

    await admin.from("admin_audit_log").insert({
      action: "coach_password_reset",
      target_type: "coach",
      target_id: coachId,
      old_value: null,
      new_value: { reset: true },
      performed_by: ownerId,
    });

    return json({ ok: true });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
