/* ================================================================
   FORGE — backend abstraction (production).

   The UI and the store never talk to Supabase directly; they talk to
   a `Backend`. SupabaseBackend is the only production implementation:
   live Postgres + Auth + Edge Functions, configured via
   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.

   Row mapping between Postgres snake_case and the app's camelCase
   types lives here.
   ================================================================ */

import { createClient } from "@supabase/supabase-js";
import type {
  AppNotification,
  AppState,
  CheckIn,
  Client,
  CoachPlan,
  CoachPlanConfig,
  Exercise,
  Meal,
  Message,
  NewClientInput,
  Payment,
  PlanItem,
  Session,
  Subscription,
} from "../types";
import { todayISO } from "../lib";
import { rememberAwareStorage, setRemember } from "./remember";
import {
  DEFAULT_COACH_PLANS,
  PlanLimitError,
  getCoachPlanConfig,
  normalizeCoachPlanId,
  resolveCoachSubscription,
} from "../coachPricing";

/* ---------------- config ---------------- */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

if (!isSupabaseConfigured && typeof console !== "undefined") {
  console.error(
    "FORGE production build: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Configure them in .env — the app has no demo fallback and will show an error state until they are provided.",
  );
}

const supabase = createClient(
  SUPABASE_URL || "https://not-configured.supabase.co",
  SUPABASE_ANON_KEY || "public-anon-key-not-set",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Honour "Remember me": localStorage vs sessionStorage.
      storage: rememberAwareStorage,
    },
  },
);

/** Direct client access for owner-only history/audit queries (RLS still applies). */
export const supabaseClient = supabase;

/* ---------------- role model ---------------- */

export interface RoleInfo {
  role: "coach" | "client" | "owner";
  userId: string;
  coachId: string;
  name: string;
  email: string;
  client?: Client;
}

/* ---------------- row mappers (snake_case ⇄ camelCase) ---------------- */

type Row = Record<string, unknown>;

export const clientToRow = (c: Client): Row => ({
  username: c.username,
  name: c.name,
  email: c.email,
  phone: c.phone,
  gender: c.gender ?? null,
  age: c.age ?? null,
  goal: c.goal,
  status: c.status,
  start_date: c.startDate,
  notes: c.notes,
  photo: c.photo ?? null,
  follow_up_days: c.followUpDays ?? null,
  last_follow_up: c.lastFollowUp ?? null,
  coach_notes: JSON.stringify(c.coachNotes ?? []),
  nutrition_targets: c.nutritionTargets ? JSON.stringify(c.nutritionTargets) : null,
});

const jsonField = <T,>(v: unknown, fallback: T): T => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "object") return v as T;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
};

export const rowToClient = (r: Row): Client => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  username: String(r.username ?? ""),
  name: String(r.name ?? ""),
  email: String(r.email ?? ""),
  phone: String(r.phone ?? ""),
  gender: (r.gender as Client["gender"]) ?? undefined,
  age: r.age === null || r.age === undefined || r.age === "" ? undefined : Number(r.age),
  goal: (r.goal as Client["goal"]) ?? "General fitness",
  startDate: String(r.start_date ?? todayISO()),
  status: (r.status as Client["status"]) ?? "Active",
  notes: String(r.notes ?? ""),
  photo: r.photo ? String(r.photo) : undefined,
  followUpDays: r.follow_up_days === null || r.follow_up_days === undefined || r.follow_up_days === "" ? undefined : Number(r.follow_up_days),
  lastFollowUp: r.last_follow_up ? String(r.last_follow_up) : undefined,
  coachNotes: jsonField<Client["coachNotes"]>(r.coach_notes, []),
  nutritionTargets: r.nutrition_targets ? jsonField<Client["nutritionTargets"]>(r.nutrition_targets, undefined as unknown as Client["nutritionTargets"]) : undefined,
});

export const exerciseToRow = (e: Exercise): Row => ({
  name: e.name,
  category: e.category,
  description: e.description,
  video_url: e.videoUrl,
});

export const rowToExercise = (r: Row): Exercise => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  name: String(r.name ?? ""),
  category: (r.category as Exercise["category"]) ?? "Chest",
  description: String(r.description ?? ""),
  videoUrl: String(r.video_url ?? ""),
});

export const planToRow = (p: PlanItem): Row => ({
  client_id: p.clientId,
  day: p.day,
  exercise_id: p.exerciseId,
  sets: p.sets,
  reps: p.reps,
  rest: p.rest,
  notes: p.notes,
});

export const rowToPlan = (r: Row): PlanItem => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  day: Number(r.day) || 1,
  exerciseId: String(r.exercise_id ?? ""),
  sets: Number(r.sets) || 1,
  reps: Number(r.reps) || 1,
  rest: Number(r.rest) || 0,
  notes: String(r.notes ?? ""),
});

export const checkInToRow = (c: CheckIn): Row => ({
  client_id: c.clientId,
  date: c.date,
  ts: c.ts,
  weight: c.weight,
  waist: c.waist ?? null,
  mood: c.mood,
  water: c.water,
  workout_done: c.workoutDone,
  notes: c.notes ?? null,
  photo: c.photo ?? null,
});

export const rowToCheckIn = (r: Row): CheckIn => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  date: String(r.date ?? todayISO()),
  ts: Number(r.ts) || 0,
  weight: Number(r.weight) || 0,
  waist: r.waist === null || r.waist === undefined || r.waist === "" ? undefined : Number(r.waist),
  mood: Number(r.mood) || 3,
  water: Number(r.water) || 0,
  workoutDone: Boolean(r.workout_done),
  notes: r.notes ? String(r.notes) : undefined,
  photo: r.photo ? String(r.photo) : undefined,
});

export const mealToRow = (m: Meal): Row => ({
  client_id: m.clientId,
  day: m.day,
  type: m.type,
  time: m.time ?? null,
  description: m.description,
  calories: m.calories,
  protein: m.protein,
  carbs: m.carbs,
  fats: m.fats,
  notes: m.notes ?? null,
});

export const rowToMeal = (r: Row): Meal => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  day: Number(r.day) || 1,
  type: (r.type as Meal["type"]) ?? "Snack",
  time: r.time ? String(r.time) : undefined,
  description: String(r.description ?? ""),
  calories: Number(r.calories) || 0,
  protein: Number(r.protein) || 0,
  carbs: Number(r.carbs) || 0,
  fats: Number(r.fats) || 0,
  notes: r.notes ? String(r.notes) : undefined,
});

export const subscriptionToRow = (s: Subscription): Row => ({
  client_id: s.clientId,
  plan_name: s.planName,
  start_date: s.startDate,
  end_date: s.endDate,
  price: s.price,
  payment_status: s.paymentStatus,
  created_at: s.createdAt,
});

export const rowToSubscription = (r: Row): Subscription => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  planName: String(r.plan_name ?? ""),
  startDate: String(r.start_date ?? todayISO()),
  endDate: String(r.end_date ?? todayISO()),
  price: Number(r.price) || 0,
  paymentStatus: (r.payment_status as Subscription["paymentStatus"]) ?? "Pending",
  createdAt: Number(r.created_at) || 0,
});

export const paymentToRow = (p: Payment): Row => ({
  client_id: p.clientId,
  subscription_id: p.subscriptionId ?? null,
  amount: p.amount,
  date: p.date,
  method: p.method,
  status: p.status,
  notes: p.notes,
});

export const rowToPayment = (r: Row): Payment => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  subscriptionId: r.subscription_id ? String(r.subscription_id) : undefined,
  amount: Number(r.amount) || 0,
  date: String(r.date ?? todayISO()),
  method: (r.method as Payment["method"]) ?? "Cash",
  status: (r.status as Payment["status"]) ?? "Paid",
  notes: String(r.notes ?? ""),
});

export const sessionToRow = (s: Session): Row => ({
  client_id: s.clientId,
  date: s.date,
  time: s.time,
  type: s.type,
  status: s.status,
  notes: s.notes,
});

export const rowToSession = (r: Row): Session => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  date: String(r.date ?? todayISO()),
  time: String(r.time ?? "18:00"),
  type: String(r.type ?? "Training"),
  status: (r.status as Session["status"]) ?? "Scheduled",
  notes: String(r.notes ?? ""),
});

export const messageToRow = (m: Message): Row => ({
  client_id: m.clientId,
  sender_role: m.senderRole,
  text: m.text,
  created_at: m.createdAt,
});

export const rowToMessage = (r: Row): Message => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  senderRole: (r.sender_role as Message["senderRole"]) ?? "client",
  text: String(r.text ?? ""),
  // created_at is the live column; older legacy payloads used `ts`.
  createdAt: Number(r.created_at ?? r.ts) || 0,
});

export const notificationToRow = (n: AppNotification): Row => ({
  client_id: n.clientId,
  kind: n.kind,
  text: n.text,
  created_at: n.createdAt,
  read: n.read,
});

export const rowToNotification = (r: Row): AppNotification => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  clientId: String(r.client_id ?? ""),
  kind: (r.kind as AppNotification["kind"]) ?? "reminder",
  text: String(r.text ?? ""),
  // created_at is the live column; older legacy payloads used `ts`.
  createdAt: Number(r.created_at ?? r.ts) || 0,
  read: Boolean(r.read),
});

export interface Coach {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  createdAt: string;
}

export const rowToCoach = (r: Row): Coach => ({
  id: String(r.id),
  name: String(r.name ?? ""),
  email: String(r.email ?? ""),
  accountStatus: String(r.account_status ?? "ACTIVE"),
  createdAt: String(r.created_at ?? ""),
});

export interface CoachSubscription {
  id: string;
  coachId: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string;
  price: number;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export const rowToCoachSubscription = (r: Row): CoachSubscription => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? ""),
  planName: String(r.plan_name ?? ""),
  status: String(r.status ?? "PENDING"),
  startDate: String(r.start_date ?? ""),
  endDate: String(r.end_date ?? ""),
  price: Number(r.price ?? 0),
  autoRenew: Boolean(r.auto_renew ?? false),
  createdAt: String(r.created_at ?? ""),
  updatedAt: String(r.updated_at ?? ""),
});

/* ---------------- coach_plans row mapper (centralized pricing source) ---------------- */

export const rowToCoachPlan = (r: Row): CoachPlanConfig => ({
  id: String(r.id ?? "STARTER").toUpperCase() as CoachPlanConfig["id"],
  name: String(r.name ?? r.id ?? "Starter"),
  price: Number(r.price ?? 0),
  maxClients: r.max_clients === null || r.max_clients === undefined || r.max_clients === "" ? null : Number(r.max_clients),
  billingInterval: "monthly",
  isActive: r.is_active === undefined ? true : Boolean(r.is_active),
});

export const coachPlanToRow = (p: CoachPlanConfig): Row => ({
  id: p.id,
  name: p.name,
  price: p.price,
  max_clients: p.maxClients,
  billing_interval: p.billingInterval,
  is_active: p.isActive,
});

/** Strip columns the frontend must never write on update. */
function clean(row: Row): Row {
  const out: Row = { ...row };
  for (const k of ["id", "coach_id", "created_at", "updated_at", "login_email"]) delete out[k];
  return out;
}

/* ---------------- Edge Function error translation ---------------- */

/**
 * The `create-client-account` Edge Function is required for client account
 * lifecycle (create / reset-password / delete). When it is not deployed, the
 * Supabase gateway answers 404 WITHOUT CORS headers, so the browser blocks
 * the response and supabase-js surfaces `FunctionsFetchError: "Failed to send
 * a request to the Edge Function"` (or `FunctionsRelayError`). Translate those
 * cryptic errors into an actionable message instead.
 */
export function isFunctionUnreachable(e: unknown): boolean {
  const name = e instanceof Error ? e.name : (e as { name?: string })?.name ?? "";
  const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e ?? "");
  return (
    name === "FunctionsFetchError" ||
    name === "FunctionsRelayError" ||
    /failed to send a request to the edge function|relay error invoking|requested function was not found|not_found/i.test(msg)
  );
}

export function friendlyFunctionError(e: unknown): Error {
  if (isFunctionUnreachable(e)) {
    return new Error(
      "Client accounts service isn't deployed yet. Deploy it with: supabase functions deploy create-client-account (then set SUPABASE_SERVICE_ROLE_KEY as a function secret).",
    );
  }
  const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? "");
  if (/edge function is not configured/i.test(msg)) {
    return new Error(
      "Client accounts service is missing its key. Set SUPABASE_SERVICE_ROLE_KEY as an Edge Function secret (supabase secrets set ...).",
    );
  }
  if (/invalid or expired session|missing authorization/i.test(msg)) {
    return new Error("Your session expired — sign out and sign back in, then try again.");
  }
  if (/only coaches can manage/i.test(msg)) {
    return new Error("Only coaches can manage client accounts.");
  }
  return e instanceof Error ? e : new Error(msg || "Couldn't reach the client accounts service.");
}

/* ---------------- Backend interface ---------------- */

export interface Backend {
  readonly kind: "supabase";
  getSessionUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  coachSignUp(email: string, password: string, name: string, remember: boolean): Promise<void>;
  coachSignIn(email: string, password: string, remember: boolean): Promise<void>;
  clientSignIn(username: string, password: string, remember: boolean): Promise<void>;
  ownerSignIn(email: string, password: string, remember: boolean): Promise<void>;
  signOut(): Promise<void>;
  resolveRole(userId: string): Promise<RoleInfo | null>;
  load(): Promise<AppState>;
  insert(table: string, row: Row): Promise<void>;
  update(table: string, id: string, row: Row): Promise<void>;
  remove(table: string, id: string): Promise<void>;
  createClientAccount(input: NewClientInput): Promise<Client>;
  resetClientPassword(clientId: string, newPassword: string): Promise<void>;
  deleteClientAccount(clientId: string): Promise<void>;
  updateCoachName(name: string): Promise<void>;
  /** Load all coaches and subscriptions — for owner dashboard. */
  loadAllCoachesAndSubscriptions?(): Promise<{ coaches: Coach[]; subscriptions: Row[] }>;
  /* ---- Coach Pricing & Limits (real, backend-enforced) ---- */
  /** Centralized pricing catalog (DB-backed, falls back to defaults). */
  loadCoachPlans(): Promise<CoachPlanConfig[]>;
  /** Real client count for a coach (defaults to the session coach). */
  getCoachClientCount(coachId?: string): Promise<number>;
  /** Pre-check (UX only) — final enforcement is server-side (trigger / edge function). */
  canAddClient(coachId?: string): Promise<{ allowed: boolean; count: number; limit: number | null; planId: CoachPlan | null; reason?: string }>;
  /** Authorized plan change (validates downgrade rule, records history). Owners + self. */
  changeCoachPlan(coachId: string, newPlanId: CoachPlan): Promise<Row>;
  /** Owner subscription controls (extend / activate / suspend / plan edit). */
  updateCoachSubscription(subscriptionId: string, patch: Row): Promise<void>;
  /** Owner coach account controls. */
  setCoachAccountStatus(coachId: string, status: string): Promise<void>;
  /** Subscription history for a coach subscription (or all when omitted). */
  loadSubscriptionHistory(subscriptionId?: string): Promise<Row[]>;
  /** Admin audit log (owner). */
  loadAuditLog(limit?: number): Promise<Row[]>;
}

const TABLES = [
  "clients",
  "exercises",
  "plan_items",
  "check_ins",
  "meals",
  "subscriptions",
  "payments",
  "sessions",
  "messages",
  "notifications",
  "coaches",
  "coach_subscriptions",
] as const;

/* ================================================================
   SupabaseBackend — live Postgres + Auth (RLS scopes everything).
   ================================================================ */

class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;

  async getSessionUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  onAuthChange(cb: (userId: string | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      cb(session?.user?.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }

  /**
   * Translate raw Supabase Auth errors into short, user-facing messages.
   * Supabase messages are technical ("Invalid login credentials") and vary
   * by version — normalise the ones coaches hit most often.
   */
  private friendlyAuthError(err: { message?: string } | null, fallback: string): Error {
    const raw = (err?.message ?? "").trim();
    const low = raw.toLowerCase();
    if (!raw) return new Error(fallback);
    if (low.includes("user already registered") || low.includes("already been registered") || low.includes("already exists")) {
      return new Error("This email is already registered. Try signing in instead.");
    }
    if (low.includes("invalid login credentials") || low.includes("invalid email or password")) {
      return new Error("Invalid email or password. Double-check and try again.");
    }
    if (low.includes("email not confirmed") || low.includes("email not verified") || low.includes("confirmation")) {
      return new Error("Please confirm your email first — check your inbox for the verification link, then sign in.");
    }
    if (low.includes("password should be at least") || low.includes("password is too short") || low.includes("weak password")) {
      return new Error("Password must be at least 6 characters.");
    }
    if (low.includes("invalid email") || low.includes("email address") && low.includes("invalid")) {
      return new Error("Enter a valid email address.");
    }
    if (low.includes("rate limit") || low.includes("too many requests") || low.includes("email rate limit")) {
      return new Error("Too many attempts — wait a minute and try again.");
    }
    if (low.includes("network") || low.includes("fetch failed") || low.includes("failed to fetch")) {
      return new Error("Can't reach the server. Check your connection and try again.");
    }
    return new Error(raw);
  }

  /** Best-effort STARTER subscription for a brand-new coach (never blocks signup). */
  private async ensureCoachSubscription(userId: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("coach_id", userId)
        .limit(1)
        .maybeSingle();
      if (existing) return;
      // Price comes from coach_plans when readable; falls back to the canonical default.
      let price = 1999;
      try {
        const { data: plan } = await supabase.from("coach_plans").select("price").eq("id", "STARTER").maybeSingle();
        if (plan && typeof (plan as Row).price === "number") price = Number((plan as Row).price);
      } catch {
        /* keep default */
      }
      const start = todayISO();
      const end = new Date(start + "T12:00:00");
      end.setDate(end.getDate() + 30);
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      await supabase.from("coach_subscriptions").insert({
        coach_id: userId,
        plan_name: "STARTER",
        status: "ACTIVE",
        start_date: start,
        end_date: endIso,
        price,
        auto_renew: false,
      });
    } catch {
      /* best-effort only — limits fall back to STARTER defaults server-side */
    }
  }

  async coachSignUp(email: string, password: string, name: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { role: "coach", name: name.trim() || "Coach" } },
    });
    if (error) throw this.friendlyAuthError(error, "Couldn't create your account.");
    const userId = data.user?.id;
    if (!userId) throw new Error("Couldn't create your account. Try again.");
    // When "Confirm email" is ON in Supabase Auth, there is no session yet —
    // the coach row is created by the DB trigger (0008) or on first sign-in
    // self-heal. Tell the UI so it can show "check your inbox" instead of an error.
    if (!data.session) {
      const err = new Error("EMAIL_CONFIRMATION_REQUIRED: check your inbox for the verification link, then sign in.");
      (err as { code?: string }).code = "EMAIL_CONFIRMATION_REQUIRED";
      throw err;
    }
    // Session exists (email confirmation OFF): create the coach profile row now.
    // RLS `coaches_all` allows this because auth.uid() === userId here.
    const { error: insErr } = await supabase.from("coaches").upsert({ id: userId, name: name.trim() || "Coach", email: cleanEmail });
    if (insErr) throw new Error(insErr.message);
    await this.ensureCoachSubscription(userId);
  }

  async coachSignIn(email: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
    if (!password) throw new Error("Enter your password.");
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw this.friendlyAuthError(error, "Couldn't sign you in.");
    // Self-heal: a coach created while email-confirmation was ON (or before
    // the 0008 trigger existed) may have an auth user but no coaches row.
    // resolveRole() also heals, but doing it here makes the first sign-in instant.
    try {
      const userId = await this.getSessionUserId();
      if (userId) await this.ensureCoachRow(userId);
    } catch {
      /* non-fatal — resolveRole retries on boot */
    }
  }

  async clientSignIn(username: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const clean = username.trim().toLowerCase();
    if (!clean) throw new Error("Enter your username.");
    if (!password) throw new Error("Enter your password.");
    let email = "";
    try {
      const { data, error } = await supabase.rpc("client_login_email", { p_username: clean });
      if (error) throw error;
      email = typeof data === "string" ? data : "";
    } catch {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    if (!email) throw new Error("Invalid username or password.");
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) throw new Error("Invalid username or password.");
  }

  async ownerSignIn(email: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    // Production: real Supabase Auth. The owners table (RLS-scoped) resolves the role.
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid email address.");
    if (!password) throw new Error("Enter your password.");
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw this.friendlyAuthError(error, "Couldn't sign you in.");
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  /**
   * Self-heal for coaches whose auth.users row exists but whose public.coaches
   * row is missing (signed up while email-confirmation was ON, or created
   * before the auto-create trigger). Runs as the user themselves, so the
   * `coaches_all` RLS policy (id = auth.uid()) permits the insert.
   * Returns the coach row when it exists or was just created, else null.
   */
  private async ensureCoachRow(userId: string): Promise<Row | null> {
    const { data: existing } = await supabase.from("coaches").select("id, name, email").eq("id", userId).maybeSingle();
    if (existing) return existing as Row;
    // Only heal users that look like coaches: never steal client/owner accounts.
    const { data: clientRow } = await supabase.from("clients").select("id").eq("id", userId).maybeSingle();
    if (clientRow) return null;
    const { data: ownerRow } = await supabase.from("owners").select("id").eq("id", userId).maybeSingle();
    if (ownerRow) return null;
    let name = "Coach";
    let email = "";
    try {
      const { data: userData } = await supabase.auth.getUser();
      const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
      if (userData.user?.id !== userId) return null;
      // Clients created via the Edge Function carry role=client — never convert them.
      if (String(meta.role ?? "").toLowerCase() === "client") return null;
      if (typeof meta.name === "string" && meta.name.trim()) name = meta.name.trim().slice(0, 80);
      email = String(userData.user?.email ?? "");
    } catch {
      return null;
    }
    const { data: created, error } = await supabase
      .from("coaches")
      .upsert({ id: userId, name, email }, { onConflict: "id" })
      .select("id, name, email")
      .maybeSingle();
    if (error || !created) return null;
    await this.ensureCoachSubscription(userId);
    return created as Row;
  }

  async resolveRole(userId: string): Promise<RoleInfo | null> {
    // Check for owner role first by querying the owners table (RLS-scoped)
    const { data: owner } = await supabase.from("owners").select("id, name, email").eq("id", userId).maybeSingle();
    if (owner) {
      return { role: "owner", userId, coachId: "", name: String(owner.name ?? "Owner"), email: String(owner.email ?? "") };
    }
    const { data: coach } = await supabase.from("coaches").select("id, name, email").eq("id", userId).maybeSingle();
    if (coach) {
      return { role: "coach", userId, coachId: userId, name: String(coach.name ?? "Coach"), email: String(coach.email ?? "") };
    }
    const { data: clientRow } = await supabase.from("clients").select("*").eq("id", userId).maybeSingle();
    if (clientRow) {
      const client = rowToClient(clientRow as Row);
      return { role: "client", userId, coachId: client.coachId, name: client.name, email: client.email, client };
    }
    // Last resort: heal an orphaned coach account (see ensureCoachRow), so a
    // previously-stuck coach lands in their dashboard instead of signed-out.
    const healed = await this.ensureCoachRow(userId).catch(() => null);
    if (healed) {
      return {
        role: "coach",
        userId,
        coachId: userId,
        name: String(healed.name ?? "Coach"),
        email: String(healed.email ?? ""),
      };
    }
    return null;
  }

  /** Load all coaches and subscriptions — works for owners due to RLS policy. */
  async loadAllCoachesAndSubscriptions(): Promise<{ coaches: Coach[]; subscriptions: Row[] }> {
    const [{ data: coaches, error: e1 }, { data: subscriptions, error: e2 }] = await Promise.all([
      supabase.from("coaches").select("*"),
      supabase.from("coach_subscriptions").select("*"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { 
      coaches: (coaches as Row[]).map(rowToCoach), 
      subscriptions: subscriptions as Row[] 
    };
  }

  /* ---------------- Coach Pricing (Supabase = source of truth) ---------------- */

  async loadCoachPlans(): Promise<CoachPlanConfig[]> {
    const { data, error } = await supabase.from("coach_plans").select("*").eq("is_active", true).order("price");
    if (error) return [...DEFAULT_COACH_PLANS];
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) return [...DEFAULT_COACH_PLANS];
    const mapped = rows.map(rowToCoachPlan);
    // Guarantee the three canonical plans exist even if the DB was seeded partially.
    for (const d of DEFAULT_COACH_PLANS) {
      if (!mapped.some((m) => m.id === d.id)) mapped.push(d);
    }
    return mapped.sort((a, b) => (a.maxClients ?? Number.MAX_SAFE_INTEGER) - (b.maxClients ?? Number.MAX_SAFE_INTEGER));
  }

  private async currentCoachId(): Promise<string> {
    const userId = await this.getSessionUserId();
    if (!userId) throw new Error("Not signed in.");
    return userId;
  }

  async getCoachClientCount(coachId?: string): Promise<number> {
    const cid = coachId ?? (await this.currentCoachId());
    const { count, error } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("coach_id", cid);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async canAddClient(coachId?: string): Promise<{ allowed: boolean; count: number; limit: number | null; planId: CoachPlan | null; reason?: string }> {
    const cid = coachId ?? (await this.currentCoachId());
    // Prefer the server-side RPC (real DB count + real plan).
    const { data, error } = await supabase.rpc("can_coach_add_client", { p_coach_id: cid });
    if (!error && data && (Array.isArray(data) ? data[0] : data)) {
      const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; client_count: number; max_clients: number | null; plan_id: string | null };
      const planId = normalizeCoachPlanId(row.plan_id);
      return {
        allowed: Boolean(row.allowed),
        count: Number(row.client_count ?? 0),
        limit: row.max_clients === null || row.max_clients === undefined ? null : Number(row.max_clients),
        planId,
        reason: row.allowed ? undefined : "LIMIT_REACHED",
      };
    }
    // Fallback: derive from RLS-scoped load (still real DB rows, just client-side join).
    const plans = await this.loadCoachPlans().catch(() => [...DEFAULT_COACH_PLANS]);
    const { data: subs } = await supabase.from("coach_subscriptions").select("*").eq("coach_id", cid).order("end_date", { ascending: false }).limit(5);
    const typed = ((subs ?? []) as Row[]).map(rowToCoachSubscription);
    const sub = resolveCoachSubscription(typed, cid);
    const cfg = getCoachPlanConfig(plans, sub?.planName) ?? plans[0];
    const count = await this.getCoachClientCount(cid).catch(() => 0);
    const limit = cfg?.maxClients ?? null;
    return { allowed: limit === null || count < limit, count, limit, planId: cfg?.id ?? null, reason: limit !== null && count >= limit ? "LIMIT_REACHED" : undefined };
  }

  async changeCoachPlan(coachId: string, newPlanId: CoachPlan): Promise<Row> {
    const { data, error } = await supabase.rpc("change_coach_plan", { p_coach_id: coachId, p_new_plan_id: newPlanId });
    if (error) throw new Error(error.message);
    return data as Row;
  }

  async updateCoachSubscription(subscriptionId: string, patch: Row): Promise<void> {
    // Owner path: direct update (RLS owner policy) — downgrade guard trigger validates plan changes.
    const { error } = await supabase.from("coach_subscriptions").update(patch).eq("id", subscriptionId);
    if (error) throw new Error(error.message);
  }

  async setCoachAccountStatus(coachId: string, status: string): Promise<void> {
    const { error } = await supabase.from("coaches").update({ account_status: status }).eq("id", coachId);
    if (error) throw new Error(error.message);
  }

  async loadSubscriptionHistory(subscriptionId?: string): Promise<Row[]> {
    let q = supabase.from("coach_subscription_history").select("*").order("performed_at", { ascending: false }).limit(100);
    if (subscriptionId) q = q.eq("subscription_id", subscriptionId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  }

  async loadAuditLog(limit = 100): Promise<Row[]> {
    const { data, error } = await supabase.from("admin_audit_log").select("*").order("performed_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  }

  async load(): Promise<AppState> {
    const results = await Promise.all(TABLES.map((t) => supabase.from(t).select("*")));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    const [clients, exercises, plans, checkIns, meals, subscriptions, payments, sessions, messages, notifications, coaches, coachSubscriptions] = results;
    let coachPlans: CoachPlanConfig[] = [...DEFAULT_COACH_PLANS];
    try {
      const { data } = await supabase.from("coach_plans").select("*").eq("is_active", true).order("price");
      if (data && (data as Row[]).length > 0) {
        coachPlans = (data as Row[]).map(rowToCoachPlan);
        for (const d of DEFAULT_COACH_PLANS) {
          if (!coachPlans.some((m) => m.id === d.id)) coachPlans.push(d);
        }
      }
    } catch {
      /* table may not exist on older projects — fall back to defaults */
    }
    return {
      clients: (clients.data as Row[]).map(rowToClient),
      exercises: (exercises.data as Row[]).map(rowToExercise),
      plans: (plans.data as Row[]).map(rowToPlan),
      checkIns: (checkIns.data as Row[]).map(rowToCheckIn),
      meals: (meals.data as Row[]).map(rowToMeal),
      subscriptions: (subscriptions.data as Row[]).map(rowToSubscription),
      payments: (payments.data as Row[]).map(rowToPayment),
      sessions: (sessions.data as Row[]).map(rowToSession),
      messages: (messages.data as Row[]).map(rowToMessage),
      notifications: (notifications.data as Row[]).map(rowToNotification),
      coaches: (coaches.data as Row[]).map(rowToCoach),
      coachSubscriptions: (coachSubscriptions.data as Row[]).map(rowToCoachSubscription),
      coachPlans,
    };
  }

  async insert(table: string, row: Row): Promise<void> {
    const { error } = await supabase.from(table).insert(row);
    if (error) throw new Error(error.message);
  }

  async update(table: string, id: string, row: Row): Promise<void> {
    const { error } = await supabase.from(table).update(clean(row)).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async remove(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async createClientAccount(input: NewClientInput): Promise<Client> {
    let data: unknown;
    let error: { name?: string; message?: string } | null;
    try {
      const res = await supabase.functions.invoke("create-client-account", {
        body: { action: "create", ...input },
      });
      data = res.data;
      error = res.error as { name?: string; message?: string } | null;
    } catch (e) {
      // Network-level failure (offline, blocked request, paused project).
      throw friendlyFunctionError(e);
    }
    if (error) {
      // Surface structured limit errors even when the function gateway wraps them.
      const msg = error.message ?? "";
      if (/PLAN_LIMIT_REACHED|client limit|maximum.*clients/i.test(msg)) {
        const countM = msg.match(/(\d+)\s*\/\s*(\d+)/);
        if (countM) {
          const limit = Number(countM[2]);
          const plan = DEFAULT_COACH_PLANS.find((p) => p.maxClients === limit) ?? DEFAULT_COACH_PLANS[0];
          throw new PlanLimitError(Number(countM[1]), limit, plan);
        }
        throw new Error(msg);
      }
      throw friendlyFunctionError(error);
    }
    const body = data as { ok?: boolean; client?: Row; error?: string };
    if (!body?.ok || !body.client) {
      const msg = body?.error ?? "Couldn't create the client account.";
      if (/PLAN_LIMIT_REACHED|client limit/i.test(msg)) {
        const countM = msg.match(/(\d+)\s*\/\s*(\d+)/);
        if (countM) {
          const limit = Number(countM[2]);
          const plan = DEFAULT_COACH_PLANS.find((p) => p.maxClients === limit) ?? DEFAULT_COACH_PLANS[0];
          throw new PlanLimitError(Number(countM[1]), limit, plan);
        }
      }
      throw new Error(msg);
    }
    return rowToClient(body.client);
  }

  async resetClientPassword(clientId: string, newPassword: string): Promise<void> {
    let data: unknown;
    let error: { name?: string; message?: string } | null;
    try {
      const res = await supabase.functions.invoke("create-client-account", {
        body: { action: "reset-password", clientId, password: newPassword },
      });
      data = res.data;
      error = res.error as { name?: string; message?: string } | null;
    } catch (e) {
      throw friendlyFunctionError(e);
    }
    if (error) throw friendlyFunctionError(error);
    const body = data as { ok?: boolean; error?: string };
    if (!body?.ok) throw new Error(body?.error ?? "Couldn't reset the password.");
  }

  async deleteClientAccount(clientId: string): Promise<void> {
    let data: unknown;
    try {
      const res = await supabase.functions.invoke("create-client-account", {
        body: { action: "delete", clientId },
      });
      if (res.error) {
        // Unreachable (not deployed / offline): rethrow raw so the catch below
        // translates it — never silently delete data while orphaning the login.
        if (isFunctionUnreachable(res.error)) throw res.error;
        data = undefined; // function ran but reported a problem → RLS fallback below
      } else {
        data = res.data;
      }
    } catch (e) {
      if (isFunctionUnreachable(e)) throw friendlyFunctionError(e);
      data = undefined;
    }
    const body = data as { ok?: boolean } | undefined;
    if (!body?.ok) {
      // Fallback: RLS-scoped delete (auth user stays, data cascades).
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw new Error(error.message);
    }
  }

  async updateCoachName(name: string): Promise<void> {
    const userId = await this.getSessionUserId();
    if (!userId) throw new Error("Not signed in.");
    const { error } = await supabase.from("coaches").update({ name }).eq("id", userId);
    if (error) throw new Error(error.message);
  }
}

/* ---------------- singleton ---------------- */

/** Supabase is the only production backend. No demo fallback. */
export const backend: Backend = new SupabaseBackend();

