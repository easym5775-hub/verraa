/* ================================================================
   FORGE — backend abstraction.

   The UI and the store never talk to Supabase directly; they talk to
   a `Backend`. Two implementations exist:

     • SupabaseBackend — live Postgres + Auth + Edge Functions (used
       when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set).
     • DemoBackend     — a clearly-labelled local store (localStorage)
       so the app is fully usable with zero credentials.

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
import { todayISO, uuid } from "../lib";
import { rememberAwareStorage, setRemember } from "./remember";
import {
  DEFAULT_COACH_PLANS,
  PlanLimitError,
  getCoachPlanConfig,
  normalizeCoachPlanId,
  resolveCoachSubscription,
  validatePlanChange,
} from "../coachPricing";

/* ---------------- config ---------------- */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
export const isDemoMode = !isSupabaseConfigured;

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
  // created_at is the live column; older demo payloads used `ts`.
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
  // created_at is the live column; older demo payloads used `ts`.
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

/** Table name → entity converter (used by the demo merge path). */
export function rowFromTable(table: string, row: Row): unknown {
  switch (table) {
    case "clients":
      return rowToClient(row);
    case "exercises":
      return rowToExercise(row);
    case "plan_items":
      return rowToPlan(row);
    case "check_ins":
      return rowToCheckIn(row);
    case "meals":
      return rowToMeal(row);
    case "subscriptions":
      return rowToSubscription(row);
    case "payments":
      return rowToPayment(row);
    case "sessions":
      return rowToSession(row);
    case "messages":
      return rowToMessage(row);
    case "notifications":
      return rowToNotification(row);
    case "coaches":
      return rowToCoach(row);
    case "coach_subscriptions":
      return rowToCoachSubscription(row);
    case "coach_plans":
      return rowToCoachPlan(row);
    default:
      return row;
  }
}

/** Write demo coach plans to localStorage. */
export function writeDemoPlans(plans: CoachPlanConfig[]): void {
  try { localStorage.setItem(DEMO_COACH_PLANS_KEY, JSON.stringify(plans)); } catch { /* ignore */ }
}

/** Convert a typed entity back to a full snake_case row (for demo merges). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function entityToRow(table: string, entity: any): Row {
  switch (table) {
    case "clients":
      return { id: entity.id, coach_id: entity.coachId, ...clientToRow(entity) };
    case "exercises":
      return { id: entity.id, coach_id: entity.coachId, ...exerciseToRow(entity) };
    case "plan_items":
      return { id: entity.id, coach_id: entity.coachId, ...planToRow(entity) };
    case "check_ins":
      return { id: entity.id, coach_id: entity.coachId, ...checkInToRow(entity) };
    case "meals":
      return { id: entity.id, coach_id: entity.coachId, ...mealToRow(entity) };
    case "subscriptions":
      return { id: entity.id, coach_id: entity.coachId, ...subscriptionToRow(entity) };
    case "payments":
      return { id: entity.id, coach_id: entity.coachId, ...paymentToRow(entity) };
    case "sessions":
      return { id: entity.id, coach_id: entity.coachId, ...sessionToRow(entity) };
    case "messages":
      return { id: entity.id, coach_id: entity.coachId, ...messageToRow(entity) };
    case "notifications":
      return { id: entity.id, coach_id: entity.coachId, ...notificationToRow(entity) };
    default:
      return entity;
  }
}

/** Strip columns the frontend must never write on update. */
function clean(row: Row): Row {
  const out: Row = { ...row };
  for (const k of ["id", "coach_id", "created_at", "updated_at", "login_email"]) delete out[k];
  return out;
}

/* ---------------- Backend interface ---------------- */

export interface Backend {
  readonly kind: "demo" | "supabase";
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
  loadAllCoachesAndSubscriptions?(): Promise<{ coaches: Row[]; subscriptions: Row[] }>;
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

  async coachSignUp(email: string, password: string, name: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    const userId = data.user?.id;
    if (userId) {
      const { error: insErr } = await supabase.from("coaches").upsert({ id: userId, name, email });
      if (insErr) throw new Error(insErr.message);
    }
  }

  async coachSignIn(email: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async clientSignIn(username: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    const { data, error } = await supabase.rpc("client_login_email", { p_username: username });
    if (error) throw new Error(error.message);
    const email = typeof data === "string" ? data : "";
    if (!email) throw new Error("Invalid username or password.");
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) throw new Error("Invalid username or password.");
  }

  async ownerSignIn(email: string, password: string, remember: boolean): Promise<void> {
    setRemember(remember);
    // For Supabase mode, use real Supabase Auth - no hardcoded credential check
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    localStorage.removeItem("forge-owner-session");
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
    return null;
  }

  /** Load all coaches and subscriptions — works for owners due to RLS policy. */
  async loadAllCoachesAndSubscriptions(): Promise<{ coaches: Row[]; subscriptions: Row[] }> {
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
    const { data, error } = await supabase.functions.invoke("create-client-account", {
      body: { action: "create", ...input },
    });
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
      throw new Error(msg);
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
    const { data, error } = await supabase.functions.invoke("create-client-account", {
      body: { action: "reset-password", clientId, password: newPassword },
    });
    if (error) throw new Error(error.message);
    const body = data as { ok?: boolean; error?: string };
    if (!body?.ok) throw new Error(body?.error ?? "Couldn't reset the password.");
  }

  async deleteClientAccount(clientId: string): Promise<void> {
    const { data } = await supabase.functions.invoke("create-client-account", {
      body: { action: "delete", clientId },
    });
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

/* ================================================================
   DemoBackend — local store so the app runs with zero credentials.
   ================================================================ */

const DEMO_DATA_KEY = "forge-demo-data-v1";
const DEMO_SESSION_KEY = "forge-demo-session-v1";
const DEMO_COACH_ID = "coach-demo-0001";
const DEMO_COACH_ID_2 = "coach-demo-0002";
const DEMO_COACH_ID_3 = "coach-demo-0003";
const DEMO_COACH_ID_4 = "coach-demo-0004";
const DEMO_COACH_ID_5 = "coach-demo-0005";
const DEMO_OWNER_ID = "owner-demo-0001";
export const DEMO_PASSWORD = "forge123";
export const DEMO_COACH_EMAIL = "coach@forge.fit";
export const DEMO_COACH_EMAIL_2 = "sarah@forge.fit";
export const DEMO_COACH_EMAIL_3 = "mike@forge.fit";
export const DEMO_COACH_EMAIL_4 = "emma@forge.fit";
export const DEMO_COACH_EMAIL_5 = "alex@forge.fit";
export const DEMO_OWNER_EMAIL = "admin@forge.demo";
export const DEMO_OWNER_PASSWORD = "ForgeAdmin123!";

interface DemoAuthEntry {
  password: string;
  name?: string;
}

interface DemoStore {
  state: AppState;
  auth: Record<string, DemoAuthEntry>;
}

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const daysAhead = (n: number): string => daysAgo(-n);

function seedData(): DemoStore {
  const coachIds = [DEMO_COACH_ID, DEMO_COACH_ID_2, DEMO_COACH_ID_3, DEMO_COACH_ID_4, DEMO_COACH_ID_5];
  const coachEmails = [DEMO_COACH_EMAIL, DEMO_COACH_EMAIL_2, DEMO_COACH_EMAIL_3, DEMO_COACH_EMAIL_4, DEMO_COACH_EMAIL_5];
  const coachNames = ["Coach Dana", "Coach Sarah", "Coach Mike", "Coach Emma", "Coach Alex"];
  const coachStatuses = ["ACTIVE", "ACTIVE", "SUSPENDED", "INACTIVE", "PENDING"] as const;
  const coachPlans = ["Pro", "Enterprise", "Pro", "Free", "Pro"];
  const coachSubEnds = [daysAhead(45), daysAhead(120), daysAgo(5), daysAhead(365), daysAhead(15)];
  const coachClientCounts = [3, 5, 2, 0, 4];

  const allClients: Client[] = [];
  const allExercises: Exercise[] = [];
  const allPlans: PlanItem[] = [];
  const allMeals: Meal[] = [];
  const allCheckIns: CheckIn[] = [];
  const allSubscriptions: Subscription[] = [];
  const allPayments: Payment[] = [];
  const allSessions: Session[] = [];
  const allMessages: Message[] = [];
  const allNotifications: AppNotification[] = [];
  const auth: Record<string, DemoAuthEntry> = {};

  // Seed data for each coach
  coachIds.forEach((coachId, idx) => {
    const coachName = coachNames[idx];
    const numClients = coachClientCounts[idx];
    const clientNames = [
      ["Ahmed Hassan", "Sara Ali", "Omar Khaled"],
      ["James Wilson", "Emma Thompson", "David Chen", "Lisa Park", "Ryan Garcia"],
      ["Mohamed Salah", "Fatima Al-Zahra"],
      [],
      ["Tom Brady", "Serena Williams", "Usain Bolt", "Simone Biles"]
    ][idx] || [];

    const goals: Client["goal"][] = ["Lose weight", "Build muscle", "General fitness"];
    const genders: Client["gender"][] = ["Male", "Female", "Male", "Female", "Male"];
    const ages = [29, 26, 33, 31, 28, 35, 24, 27, 30, 22, 25, 32, 29, 26];

    // Create clients for this coach
    const coachClients: Client[] = [];
    for (let i = 0; i < numClients; i++) {
      const clientId = uuid();
      const client: Client = {
        id: clientId,
        coachId,
        username: `${coachName.toLowerCase().replace("coach ", "")}-client-${i + 1}`,
        name: clientNames[i] || `Client ${i + 1}`,
        email: `${coachName.toLowerCase().replace("coach ", "")}-client-${i + 1}@example.com`,
        phone: `+1555${String(1000 + i).slice(1)}`,
        gender: genders[i % genders.length],
        age: ages[i % ages.length],
        goal: goals[i % goals.length],
        startDate: daysAgo(30 + i * 7),
        status: i === numClients - 1 && coachStatuses[idx] === "SUSPENDED" ? "Paused" : "Active",
        notes: "",
        coachNotes: [],
        followUpDays: 7,
      };
      coachClients.push(client);
      allClients.push(client);
      auth[clientId] = { password: DEMO_PASSWORD };
    }

    // Create exercises for this coach
    const baseExercises = [
      { name: "Barbell Bench Press", category: "Chest" as const, description: "Retract shoulder blades, bar to lower chest." },
      { name: "Pull-up", category: "Back" as const, description: "Dead hang to chin over bar. Bands OK." },
      { name: "Barbell Back Squat", category: "Legs" as const, description: "Break at hips and knees together, below parallel." },
      { name: "Dumbbell Biceps Curl", category: "Arms" as const, description: "Elbows pinned, slow negative." },
      { name: "Plank Hold", category: "Core" as const, description: "Glutes tight, ribs down." },
      { name: "Rowing Intervals", category: "Cardio" as const, description: "500m hard / 90s easy ×6." },
    ];

    const coachExercises = baseExercises.map(e => ({
      id: uuid(),
      coachId,
      name: e.name,
      category: e.category,
      description: e.description,
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name.toLowerCase().replace(" ", "+"))}`,
    }));
    allExercises.push(...coachExercises);

    const [bench, pullup, squat] = coachExercises;

    // Create plans for this coach's clients
    coachClients.forEach((client, ci) => {
      const day1Exercises = [squat, bench, pullup].slice(0, 3);
      day1Exercises.forEach((ex, ei) => {
        allPlans.push({
          id: uuid(),
          coachId,
          clientId: client.id,
          day: 1,
          exerciseId: ex.id,
          sets: 3 + ei,
          reps: 8 + ei * 2,
          rest: 90,
          notes: ei === 0 ? "Tempo 3-1-1" : "",
        });
      });
    });

    // Create meals for first 2 clients
    coachClients.slice(0, 2).forEach((client, ci) => {
      allMeals.push(
        { id: uuid(), coachId, clientId: client.id, day: 1, type: "Breakfast", time: "08:00", description: "Oats + berries + whey", calories: 380, protein: 32, carbs: 48, fats: 7 },
        { id: uuid(), coachId, clientId: client.id, day: 1, type: "Lunch", time: "13:00", description: "Grilled chicken, rice, salad", calories: 620, protein: 45, carbs: 62, fats: 12 },
        { id: uuid(), coachId, clientId: client.id, day: 1, type: "Dinner", time: "19:00", description: "Salmon, sweet potato, broccoli", calories: 550, protein: 40, carbs: 45, fats: 20 }
      );
    });

    // Create check-ins
    coachClients.forEach((client, ci) => {
      for (let d = 0; d < 5; d++) {
        allCheckIns.push({
          id: uuid(),
          coachId,
          clientId: client.id,
          date: daysAgo(d),
          ts: Date.now() - d * 86400_000,
          weight: 70 + ci * 5 + Math.random() * 3,
          waist: 75 + ci * 3 + Math.random() * 2,
          mood: 3 + (d % 3),
          water: 2 + Math.random(),
          workoutDone: d % 2 === 0,
          notes: d === 0 ? "Felt strong!" : undefined,
        });
      }
    });

    // Create subscriptions for this coach's clients
    const planNames = ["Monthly", "Quarterly", "Annual"];
    const prices = [1200, 3000, 10000];
    coachClients.forEach((client, ci) => {
      const planIdx = ci % 3;
      const startDate = daysAgo(30 + ci * 10);
      const endDate = daysAhead(30 - ci * 5);
      const sub = {
        id: uuid(),
        coachId,
        clientId: client.id,
        planName: planNames[planIdx],
        startDate,
        endDate,
        price: prices[planIdx],
        paymentStatus: "Paid" as const,
        createdAt: Date.now() - (30 + ci * 10) * 86400_000,
      };
      allSubscriptions.push(sub);

      // Payment for this subscription
      allPayments.push({
        id: uuid(),
        coachId,
        clientId: client.id,
        subscriptionId: sub.id,
        amount: prices[planIdx],
        date: startDate,
        method: ["Cash", "Card", "Bank Transfer"][ci % 3] as any,
        status: "Paid",
        notes: "",
      });
    });

    // Create sessions for today
    coachClients.forEach((client, ci) => {
      const statuses: Session["status"][] = ["Confirmed", "Scheduled", "Completed"];
      allSessions.push({
        id: uuid(),
        coachId,
        clientId: client.id,
        date: todayISO(),
        time: `${9 + ci * 2}:00`,
        type: ci % 2 === 0 ? "Personal Training" : "Online Coaching",
        status: statuses[ci % 3],
        notes: "",
      });
    });

    // Create messages
    const h = 3600_000;
    coachClients.slice(0, 2).forEach((client, ci) => {
      allMessages.push(
        { id: uuid(), coachId, clientId: client.id, senderRole: "coach", text: `Great session today, ${client.name.split(" ")[0]}! Keep the protein high this week.`, createdAt: Date.now() - 26 * h },
        { id: uuid(), coachId, clientId: client.id, senderRole: "client", text: "Thanks coach! Should I do cardio on rest days?", createdAt: Date.now() - 25 * h },
        { id: uuid(), coachId, clientId: client.id, senderRole: "coach", text: "Light 20-min walks are perfect. Save the hard intervals for training days.", createdAt: Date.now() - 2 * h }
      );

      allNotifications.push(
        { id: uuid(), coachId, clientId: client.id, kind: "message", text: `New message from ${coachName}`, createdAt: Date.now() - 2 * h, read: false },
        { id: uuid(), coachId, clientId: client.id, kind: "plan_updated", text: "Your workout plan was updated", createdAt: Date.now() - 30 * h, read: true },
        { id: uuid(), coachId, clientId: client.id, kind: "subscription", text: "Your subscription renews soon", createdAt: Date.now() - 6 * h, read: false }
      );
    });
  });

  // Coach auth entries
  coachIds.forEach((id, idx) => {
    auth[id] = { password: DEMO_PASSWORD, name: coachNames[idx] };
  });

  return {
    state: {
      clients: allClients,
      exercises: allExercises,
      plans: allPlans,
      checkIns: allCheckIns,
      meals: allMeals,
      subscriptions: allSubscriptions,
      payments: allPayments,
      sessions: allSessions,
      messages: allMessages,
      notifications: allNotifications,
    },
    auth,
  };
}

/** Backfill stores saved by older versions (missing chat/notification tables). */
function migrateDemo(parsed: DemoStore): DemoStore {
  const s = parsed.state;
  s.clients ??= [];
  s.exercises ??= [];
  s.plans ??= [];
  s.checkIns ??= [];
  s.meals ??= [];
  s.subscriptions ??= [];
  s.payments ??= [];
  s.sessions ??= [];
  let changed = false;
  if (!Array.isArray(s.messages)) {
    const seeded = seedData();
    const byName = new Map(seeded.state.clients.map((c, i) => [c.username, s.clients[i]?.id]));
    s.messages = seeded.state.messages
      .filter((m) => {
        const seedClient = seeded.state.clients.find((c) => c.id === m.clientId);
        return seedClient ? byName.has(seedClient.username) : false;
      })
      .map((m) => {
        const seedClient = seeded.state.clients.find((c) => c.id === m.clientId)!;
        return { ...m, clientId: byName.get(seedClient.username) ?? m.clientId };
      });
    changed = true;
  }
  if (!Array.isArray(s.notifications)) {
    s.notifications = [];
    changed = true;
  }
  if (changed) writeDemo(parsed);
  return parsed;
}

export function readDemo(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      if (parsed?.state?.clients) return migrateDemo(parsed);
    }
  } catch {
    /* fall through to reseed */
  }
  const seeded = seedData();
  writeDemo(seeded);
  return seeded;
}

/**
 * Repair records persisted before the id/coach_id persistence fix.
 * Those rows were stored without an id ("undefined") and without a
 * coach_id (""), so they vanished from the coach view after a reload.
 * The content itself is intact — re-attach a fresh id and recover the
 * coach from the owning client. Returns true when anything changed.
 */
function repairDemoIdentities(store: DemoStore, fallbackCoachId?: string): boolean {
  const s = store.state;
  let changed = false;
  const coachOfClient = new Map(s.clients.map((c) => [c.id, c.coachId]));
  const ensure = (e: { id?: string; coachId?: string; clientId?: string }): void => {
    if (!e.id || e.id === "undefined" || e.id === "null") {
      e.id = uuid();
      changed = true;
    }
    if (!e.coachId) {
      const fromClient = e.clientId ? coachOfClient.get(e.clientId) : undefined;
      const next = fromClient ?? fallbackCoachId;
      if (next) {
        e.coachId = next;
        changed = true;
      }
    }
  };
  for (const e of s.exercises) ensure(e as { id?: string; coachId?: string });
  for (const e of s.plans) ensure(e);
  for (const e of s.checkIns) ensure(e);
  for (const e of s.meals) ensure(e);
  for (const e of s.subscriptions) ensure(e);
  for (const e of s.payments) ensure(e);
  for (const e of s.sessions) ensure(e);
  for (const e of s.messages) {
    ensure(e);
    if (!e.createdAt) {
      e.createdAt = Date.now();
      changed = true;
    }
  }
  for (const e of s.notifications) {
    ensure(e);
    if (!e.createdAt) {
      e.createdAt = Date.now();
      changed = true;
    }
  }
  return changed;
}

function writeDemo(store: DemoStore): void {
  try {
    localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(store));
  } catch {
    /* storage full — non-fatal in demo */
  }
}

type StateKey = keyof AppState;
function tableToKey(table: string): StateKey {
  const map: Record<string, StateKey> = {
    clients: "clients",
    exercises: "exercises",
    plan_items: "plans",
    check_ins: "checkIns",
    meals: "meals",
    subscriptions: "subscriptions",
    payments: "payments",
    sessions: "sessions",
    messages: "messages",
    notifications: "notifications",
  };
  return map[table] ?? "clients";
}

/* ---------------- demo pricing persistence (mirrors Supabase tables) ---------------- */

const DEMO_COACH_SUBS_KEY = "forge-demo-coach-subs-v1";
const DEMO_COACH_STATUS_KEY = "forge-demo-coach-status-v1";
const DEMO_COACH_PLANS_KEY = "forge-demo-coach-plans-v1";
const DEMO_SUB_HISTORY_KEY = "forge-demo-sub-history-v1";
const DEMO_AUDIT_KEY = "forge-demo-audit-v1";

interface DemoCoachSub {
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

const DEMO_COACH_IDS = [DEMO_COACH_ID, DEMO_COACH_ID_2, DEMO_COACH_ID_3, DEMO_COACH_ID_4, DEMO_COACH_ID_5];
const DEMO_COACH_NAMES = ["Coach Dana", "Coach Sarah", "Coach Mike", "Coach Emma", "Coach Alex"];
const DEMO_COACH_EMAILS = [DEMO_COACH_EMAIL, DEMO_COACH_EMAIL_2, DEMO_COACH_EMAIL_3, DEMO_COACH_EMAIL_4, DEMO_COACH_EMAIL_5];
const DEMO_COACH_DEFAULT_STATUS = ["ACTIVE", "ACTIVE", "SUSPENDED", "ACTIVE", "ACTIVE"];

function seedDemoCoachSubs(): DemoCoachSub[] {
  const plans: CoachPlan[] = ["PROFESSIONAL", "ENTERPRISE", "STARTER", "STARTER", "PROFESSIONAL"];
  const ends = [daysAhead(45), daysAhead(120), daysAgo(5), daysAhead(365), daysAhead(15)];
  const statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"];
  return DEMO_COACH_IDS.map((coachId, i) => {
    const plan = DEFAULT_COACH_PLANS.find((p) => p.id === plans[i])!;
    return {
      id: `demo-coach-sub-${i + 1}`,
      coachId,
      planName: plan.id,
      status: statuses[i],
      startDate: daysAgo(30),
      endDate: ends[i],
      price: plan.price,
      autoRenew: false,
      createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
}

function readDemoCoachSubs(): DemoCoachSub[] {
  try {
    const raw = localStorage.getItem(DEMO_COACH_SUBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoCoachSub[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* reseed */ }
  const seeded = seedDemoCoachSubs();
  try { localStorage.setItem(DEMO_COACH_SUBS_KEY, JSON.stringify(seeded)); } catch { /* ignore */ }
  return seeded;
}

function writeDemoCoachSubs(subs: DemoCoachSub[]): void {
  try { localStorage.setItem(DEMO_COACH_SUBS_KEY, JSON.stringify(subs)); } catch { /* ignore */ }
}

function readDemoCoachStatuses(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DEMO_COACH_STATUS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch { /* ignore */ }
  return {};
}

function readDemoPlans(): CoachPlanConfig[] {
  try {
    const raw = localStorage.getItem(DEMO_COACH_PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CoachPlanConfig[];
      if (Array.isArray(parsed) && parsed.length >= 3) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_COACH_PLANS];
}

function pushDemoHistory(entry: Row): void {
  try {
    const raw = localStorage.getItem(DEMO_SUB_HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as Row[]) : [];
    list.unshift({ id: uuid(), performed_at: new Date().toISOString(), ...entry });
    localStorage.setItem(DEMO_SUB_HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
  } catch { /* ignore */ }
}

function pushDemoAudit(entry: Row): void {
  try {
    const raw = localStorage.getItem(DEMO_AUDIT_KEY);
    const list = raw ? (JSON.parse(raw) as Row[]) : [];
    list.unshift({ id: uuid(), performed_at: new Date().toISOString(), ...entry });
    localStorage.setItem(DEMO_AUDIT_KEY, JSON.stringify(list.slice(0, 200)));
  } catch { /* ignore */ }
}

function demoPlanForSub(subs: DemoCoachSub[], coachId: string, plans: CoachPlanConfig[]): { sub: DemoCoachSub | null; plan: CoachPlanConfig } {
  const mine = subs.filter((s) => s.coachId === coachId).sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null;
  const cfg = (mine ? getCoachPlanConfig(plans, mine.planName) : null) ?? plans.find((p) => p.id === "STARTER") ?? DEFAULT_COACH_PLANS[0];
  return { sub: mine, plan: cfg };
}

class DemoBackend implements Backend {
  readonly kind = "demo" as const;
  private listeners = new Set<(userId: string | null) => void>();

  private session(): { userId: string; role: "coach" | "client" } | null {
    try {
      // A still-live non-remembered (sessionStorage) session takes precedence.
      const raw = sessionStorage.getItem(DEMO_SESSION_KEY) ?? localStorage.getItem(DEMO_SESSION_KEY);
      return raw ? (JSON.parse(raw) as { userId: string; role: "coach" | "client" }) : null;
    } catch {
      return null;
    }
  }

  private setSession(userId: string | null, role: "coach" | "client" | "owner" = "coach", remember = true): void {
    setRemember(remember);
    try {
      if (userId) {
        const payload = JSON.stringify({ userId, role });
        (remember ? localStorage : sessionStorage).setItem(DEMO_SESSION_KEY, payload);
        // Keep the two stores mutually exclusive.
        (remember ? sessionStorage : localStorage).removeItem(DEMO_SESSION_KEY);
      } else {
        localStorage.removeItem(DEMO_SESSION_KEY);
        sessionStorage.removeItem(DEMO_SESSION_KEY);
      }
    } catch {
      /* storage unavailable — non-fatal */
    }
    this.listeners.forEach((cb) => cb(userId));
  }

  async getSessionUserId(): Promise<string | null> {
    return this.session()?.userId ?? null;
  }

  onAuthChange(cb: (userId: string | null) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async coachSignUp(_email: string, password: string, _name: string, remember: boolean): Promise<void> {
    if (password !== DEMO_PASSWORD) throw new Error(`Demo mode: use password "${DEMO_PASSWORD}".`);
    this.setSession(DEMO_COACH_ID, "coach", remember);
  }

  async coachSignIn(email: string, password: string, remember: boolean): Promise<void> {
    const coachEmails = [
      DEMO_COACH_EMAIL,
      DEMO_COACH_EMAIL_2,
      DEMO_COACH_EMAIL_3,
      DEMO_COACH_EMAIL_4,
      DEMO_COACH_EMAIL_5,
    ];
    const coachIds = [
      DEMO_COACH_ID,
      DEMO_COACH_ID_2,
      DEMO_COACH_ID_3,
      DEMO_COACH_ID_4,
      DEMO_COACH_ID_5,
    ];
    const idx = coachEmails.findIndex(e => e.trim().toLowerCase() === email.trim().toLowerCase());
    if (idx === -1 || password !== DEMO_PASSWORD) {
      throw new Error(`Demo mode: use a coach email / ${DEMO_PASSWORD}.`);
    }
    this.setSession(coachIds[idx], "coach", remember);
  }

  async clientSignIn(username: string, password: string, remember: boolean): Promise<void> {
    const store = readDemo();
    const uname = username.trim().toLowerCase();
    const client = store.state.clients.find((c) => c.username.toLowerCase() === uname);
    if (!client) throw new Error("Invalid username or password.");
    const entry = store.auth[client.id];
    if (!entry || entry.password !== password) throw new Error("Invalid username or password.");
    this.setSession(client.id, "client", remember);
  }

  async ownerSignIn(email: string, password: string, remember: boolean): Promise<void> {
    if (email.trim().toLowerCase() !== DEMO_OWNER_EMAIL || password !== DEMO_OWNER_PASSWORD) {
      throw new Error(`Demo mode: use ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}.`);
    }
    this.setSession(DEMO_OWNER_ID, "owner", remember);
  }

  async signOut(): Promise<void> {
    this.setSession(null);
  }

  async resolveRole(userId: string): Promise<RoleInfo | null> {
    if (userId === DEMO_OWNER_ID) {
      return {
        role: "owner",
        userId,
        coachId: "",
        name: "Owner",
        email: DEMO_OWNER_EMAIL,
      };
    }
    const coachIds = [DEMO_COACH_ID, DEMO_COACH_ID_2, DEMO_COACH_ID_3, DEMO_COACH_ID_4, DEMO_COACH_ID_5];
    const coachEmails = [DEMO_COACH_EMAIL, DEMO_COACH_EMAIL_2, DEMO_COACH_EMAIL_3, DEMO_COACH_EMAIL_4, DEMO_COACH_EMAIL_5];
    const coachNames = ["Coach Dana", "Coach Sarah", "Coach Mike", "Coach Emma", "Coach Alex"];
    
    const coachIdx = coachIds.indexOf(userId);
    if (coachIdx !== -1) {
      const store = readDemo();
      return {
        role: "coach",
        userId,
        coachId: userId,
        name: store.auth[userId]?.name ?? coachNames[coachIdx],
        email: coachEmails[coachIdx],
      };
    }
    const store = readDemo();
    const client = store.state.clients.find((c) => c.id === userId);
    if (!client) return null;
    return { role: "client", userId, coachId: client.coachId, name: client.name, email: client.email, client };
  }

  async load(): Promise<AppState> {
    const store = readDemo();
    const sess = this.session();
    // One-time repair of records saved without id/coach_id (pre-fix data).
    // The coach is recovered via the owning client; for a coach session
    // the session itself is the fallback.
    const fallback =
      sess?.role === "coach" ? sess.userId : sess?.role === "client" ? store.state.clients.find((c) => c.id === sess.userId)?.coachId : undefined;
    if (repairDemoIdentities(store, fallback)) writeDemo(store);
    const s = store.state;
    const plans = readDemoPlans();
    const coachSubs = readDemoCoachSubs();
    const statusOverrides = readDemoCoachStatuses();

    const coaches = DEMO_COACH_IDS.map((id, idx) => ({
      id,
      name: store.auth[id]?.name ?? DEMO_COACH_NAMES[idx],
      email: DEMO_COACH_EMAILS[idx],
      accountStatus: statusOverrides[id] ?? DEMO_COACH_DEFAULT_STATUS[idx],
      createdAt: "2024-01-01T00:00:00Z",
    }));

    const coachSubscriptions = coachSubs.map((sub) => ({
      id: sub.id,
      coachId: sub.coachId,
      planName: sub.planName,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      price: sub.price,
      autoRenew: sub.autoRenew,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    }));

    const safe: AppState = {
      clients: s.clients ?? [],
      exercises: s.exercises ?? [],
      plans: s.plans ?? [],
      checkIns: s.checkIns ?? [],
      meals: s.meals ?? [],
      subscriptions: s.subscriptions ?? [],
      payments: s.payments ?? [],
      sessions: s.sessions ?? [],
      messages: s.messages ?? [],
      notifications: s.notifications ?? [],
      coaches,
      coachSubscriptions,
      coachPlans: plans,
    };
    if (sess?.role === "client") {
      // A client only ever sees their own slice.
      const id = sess.userId;
      return {
        clients: safe.clients.filter((c) => c.id === id),
        exercises: safe.exercises,
        plans: safe.plans.filter((p) => p.clientId === id),
        checkIns: safe.checkIns.filter((c) => c.clientId === id),
        meals: safe.meals.filter((m) => m.clientId === id),
        subscriptions: safe.subscriptions.filter((x) => x.clientId === id),
        payments: safe.payments.filter((x) => x.clientId === id),
        sessions: safe.sessions.filter((x) => x.clientId === id),
        messages: safe.messages.filter((x) => x.clientId === id),
        notifications: safe.notifications.filter((x) => x.clientId === id),
        coaches: [],
        coachSubscriptions: [],
        coachPlans: plans,
      };
    }
    if (sess?.role === "coach") {
      // A coach only sees their own data
      const coachId = sess.userId;
      return {
        clients: safe.clients.filter((c) => c.coachId === coachId),
        exercises: safe.exercises.filter((e) => e.coachId === coachId),
        plans: safe.plans.filter((p) => p.coachId === coachId),
        checkIns: safe.checkIns.filter((c) => c.coachId === coachId),
        meals: safe.meals.filter((m) => m.coachId === coachId),
        subscriptions: safe.subscriptions.filter((x) => x.coachId === coachId),
        payments: safe.payments.filter((x) => x.coachId === coachId),
        sessions: safe.sessions.filter((x) => x.coachId === coachId),
        messages: safe.messages.filter((x) => x.coachId === coachId),
        notifications: safe.notifications.filter((x) => x.coachId === coachId),
        coaches: (safe.coaches ?? []).filter((c) => c.id === coachId),
        coachSubscriptions: (safe.coachSubscriptions ?? []).filter((x) => x.coachId === coachId),
        coachPlans: plans,
      };
    }
    return JSON.parse(JSON.stringify(safe)) as AppState;
  }

  private mutate(fn: (s: AppState) => void): void {
    const store = readDemo();
    fn(store.state);
    writeDemo(store);
  }

  async insert(table: string, row: Row): Promise<void> {
    this.mutate((s) => {
      const key = tableToKey(table);
      (s[key] as unknown[]).push(rowFromTable(table, row));
    });
  }

  async update(table: string, id: string, row: Row): Promise<void> {
    // Handle coach_plans separately since it's stored in localStorage
    if (table === "coach_plans") {
      const plans = readDemoPlans();
      const idx = plans.findIndex((p) => p.id === id);
      if (idx >= 0) {
        const updated = { ...plans[idx], ...row, id };
        plans[idx] = updated;
        writeDemoPlans(plans);
      }
      return;
    }
    this.mutate((s) => {
      const key = tableToKey(table);
      const arr = s[key] as unknown as { id: string }[];
      const i = arr.findIndex((x) => x.id === id);
      if (i < 0) return;
      const merged = { ...entityToRow(table, arr[i]), ...row, id };
      arr[i] = rowFromTable(table, merged) as never;
    });
  }

  async remove(table: string, id: string): Promise<void> {
    this.mutate((s) => {
      const key = tableToKey(table);
      (s[key] as { id: string }[]) = (s[key] as { id: string }[]).filter((x) => x.id !== id) as never;
    });
  }

  async createClientAccount(input: NewClientInput): Promise<Client> {
    const store = readDemo();
    const uname = input.username.trim().toLowerCase();
    if (store.state.clients.some((c) => c.username.toLowerCase() === uname)) {
      throw new Error(`Username "${uname}" is already taken.`);
    }
    const sess = this.session();
    const coachId = sess?.userId ?? DEMO_COACH_ID;
    // ---- SERVER-SIDE (demo) limit enforcement: real count vs real plan ----
    const plans = readDemoPlans();
    const subs = readDemoCoachSubs();
    const { sub, plan } = demoPlanForSub(subs, coachId, plans);
    const status = (sub?.status ?? "ACTIVE").toUpperCase();
    if (status === "SUSPENDED") {
      throw new Error("Your subscription is suspended. Please contact the administrator to renew your plan.");
    }
    const count = store.state.clients.filter((c) => c.coachId === coachId).length;
    if (plan.maxClients !== null && count >= plan.maxClients) {
      throw new PlanLimitError(count, plan.maxClients, plan);
    }
    const client: Client = {
      id: uuid(),
      coachId,
      username: uname,
      name: input.name,
      email: input.email ?? "",
      phone: input.phone ?? "",
      gender: input.gender,
      age: input.age,
      goal: input.goal,
      startDate: input.startDate,
      status: input.status,
      notes: input.notes ?? "",
      photo: input.photo,
      coachNotes: [],
    };
    this.mutate((s) => {
      s.clients.push(client);
    });
    const fresh = readDemo();
    fresh.auth[client.id] = { password: input.password };
    writeDemo(fresh);
    return client;
  }

  async resetClientPassword(clientId: string, newPassword: string): Promise<void> {
    const store = readDemo();
    store.auth[clientId] = { ...store.auth[clientId], password: newPassword };
    writeDemo(store);
  }

  async deleteClientAccount(clientId: string): Promise<void> {
    this.mutate((s) => {
      s.clients = s.clients.filter((c) => c.id !== clientId);
      s.plans = s.plans.filter((p) => p.clientId !== clientId);
      s.checkIns = s.checkIns.filter((c) => c.clientId !== clientId);
      s.meals = s.meals.filter((m) => m.clientId !== clientId);
      s.subscriptions = s.subscriptions.filter((x) => x.clientId !== clientId);
      s.payments = s.payments.filter((x) => x.clientId !== clientId);
      s.sessions = s.sessions.filter((x) => x.clientId !== clientId);
      s.messages = s.messages.filter((x) => x.clientId !== clientId);
      s.notifications = s.notifications.filter((x) => x.clientId !== clientId);
    });
    const fresh = readDemo();
    delete fresh.auth[clientId];
    writeDemo(fresh);
  }

  async updateCoachName(name: string): Promise<void> {
    const store = readDemo();
    store.auth[DEMO_COACH_ID] = { ...store.auth[DEMO_COACH_ID], password: store.auth[DEMO_COACH_ID]?.password ?? DEMO_PASSWORD, name };
    writeDemo(store);
  }

  async loadAllCoachesAndSubscriptions(): Promise<{ coaches: Row[]; subscriptions: Row[] }> {
    const store = readDemo();
    const coachSubs = readDemoCoachSubs();
    const statusOverrides = readDemoCoachStatuses();

    const coaches: Row[] = DEMO_COACH_IDS.map((id, idx) => {
      const raw = {
        id,
        name: store.auth[id]?.name ?? DEMO_COACH_NAMES[idx],
        email: DEMO_COACH_EMAILS[idx],
        account_status: statusOverrides[id] ?? DEMO_COACH_DEFAULT_STATUS[idx],
        created_at: "2024-01-01T00:00:00Z",
      };
      return rowToCoach(raw);
    });

    const subscriptions: Row[] = coachSubs.map((s) => ({
      id: s.id,
      coach_id: s.coachId,
      plan_name: s.planName,
      status: s.status,
      start_date: s.startDate,
      end_date: s.endDate,
      price: s.price,
      auto_renew: s.autoRenew,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }));
    return { coaches, subscriptions };
  }

  /* ---------------- Demo pricing implementation (mirrors Supabase semantics) ---------------- */

  async loadCoachPlans(): Promise<CoachPlanConfig[]> {
    return readDemoPlans();
  }

  async getCoachClientCount(coachId?: string): Promise<number> {
    const store = readDemo();
    const cid = coachId ?? this.session()?.userId ?? DEMO_COACH_ID;
    return store.state.clients.filter((c) => c.coachId === cid).length;
  }

  async canAddClient(coachId?: string): Promise<{ allowed: boolean; count: number; limit: number | null; planId: CoachPlan | null; reason?: string }> {
    const store = readDemo();
    const cid = coachId ?? this.session()?.userId ?? DEMO_COACH_ID;
    const plans = readDemoPlans();
    const subs = readDemoCoachSubs();
    const { sub, plan } = demoPlanForSub(subs, cid, plans);
    const count = store.state.clients.filter((c) => c.coachId === cid).length;
    if ((sub?.status ?? "").toUpperCase() === "SUSPENDED") {
      return { allowed: false, count, limit: plan.maxClients, planId: plan.id, reason: "SUSPENDED" };
    }
    if (plan.maxClients !== null && count >= plan.maxClients) {
      return { allowed: false, count, limit: plan.maxClients, planId: plan.id, reason: "LIMIT_REACHED" };
    }
    return { allowed: true, count, limit: plan.maxClients, planId: plan.id };
  }

  async changeCoachPlan(coachId: string, newPlanId: CoachPlan): Promise<Row> {
    const plans = readDemoPlans();
    const target = plans.find((p) => p.id === newPlanId);
    if (!target) throw new Error(`Unknown plan: ${newPlanId}`);
    const store = readDemo();
    const count = store.state.clients.filter((c) => c.coachId === coachId).length;
    const subs = readDemoCoachSubs();
    const current = subs.filter((s) => s.coachId === coachId).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const check = validatePlanChange(current?.planName ?? null, newPlanId, count, plans);
    if (!check.ok) throw new Error(check.message);
    const now = new Date().toISOString();
    let next: DemoCoachSub;
    if (!current) {
      next = {
        id: uuid(), coachId, planName: target.id, status: "ACTIVE",
        startDate: daysAgo(0), endDate: daysAhead(30), price: target.price,
        autoRenew: false, createdAt: now, updatedAt: now,
      };
      subs.push(next);
      pushDemoHistory({ subscription_id: next.id, action: "created", old_value: null, new_value: next, performed_by: this.session()?.userId ?? coachId });
    } else {
      const old = { ...current };
      current.planName = target.id;
      current.price = target.price;
      if (current.status !== "SUSPENDED") current.status = "ACTIVE";
      current.updatedAt = now;
      next = current;
      pushDemoHistory({ subscription_id: current.id, action: "plan_changed", old_value: old, new_value: { ...current }, performed_by: this.session()?.userId ?? coachId });
    }
    writeDemoCoachSubs(subs);
    pushDemoAudit({ action: "plan_changed", target_type: "subscription", target_id: next.id, old_value: current ?? null, new_value: { ...next }, performed_by: this.session()?.userId ?? coachId });
    return {
      id: next.id, coach_id: next.coachId, plan_name: next.planName, status: next.status,
      start_date: next.startDate, end_date: next.endDate, price: next.price,
      auto_renew: next.autoRenew, created_at: next.createdAt, updated_at: next.updatedAt,
    };
  }

  async updateCoachSubscription(subscriptionId: string, patch: Row): Promise<void> {
    const subs = readDemoCoachSubs();
    const plans = readDemoPlans();
    const idx = subs.findIndex((s) => s.id === subscriptionId);
    if (idx < 0) throw new Error("Subscription not found");
    const old = { ...subs[idx] };
    const next = subs[idx];
    // Validate plan downgrades the same way the DB guard does.
    if (patch.plan_name && String(patch.plan_name).toUpperCase() !== String(next.planName).toUpperCase()) {
      const targetId = normalizeCoachPlanId(String(patch.plan_name));
      if (targetId) {
        const store = readDemo();
        const count = store.state.clients.filter((c) => c.coachId === next.coachId).length;
        const check = validatePlanChange(next.planName, targetId, count, plans);
        if (!check.ok) throw new Error(check.message);
        const target = plans.find((p) => p.id === targetId)!;
        next.planName = target.id;
        next.price = patch.price !== undefined ? Number(patch.price) : target.price;
      } else {
        next.planName = String(patch.plan_name);
        if (patch.price !== undefined) next.price = Number(patch.price);
      }
    } else if (patch.price !== undefined) {
      next.price = Number(patch.price);
    }
    if (patch.status !== undefined) next.status = String(patch.status);
    if (patch.start_date !== undefined) next.startDate = String(patch.start_date);
    if (patch.end_date !== undefined) next.endDate = String(patch.end_date);
    if (patch.auto_renew !== undefined) next.autoRenew = Boolean(patch.auto_renew);
    next.updatedAt = new Date().toISOString();
    writeDemoCoachSubs(subs);
    const action = old.status !== next.status
      ? (next.status === "SUSPENDED" ? "suspended" : next.status === "ACTIVE" && old.status !== "ACTIVE" ? "activated" : "updated")
      : (old.endDate !== next.endDate ? "extended" : old.planName !== next.planName ? "plan_changed" : "updated");
    pushDemoHistory({ subscription_id: next.id, action, old_value: old, new_value: { ...next }, performed_by: this.session()?.userId ?? "owner-demo-0001" });
    pushDemoAudit({ action, target_type: "subscription", target_id: next.id, old_value: old, new_value: { ...next }, performed_by: this.session()?.userId ?? "owner-demo-0001" });
  }

  async setCoachAccountStatus(coachId: string, status: string): Promise<void> {
    const overrides = readDemoCoachStatuses();
    overrides[coachId] = status;
    try { localStorage.setItem(DEMO_COACH_STATUS_KEY, JSON.stringify(overrides)); } catch { /* ignore */ }
    pushDemoAudit({ action: status === "SUSPENDED" ? "coach_suspended" : status === "ACTIVE" ? "coach_activated" : "coach_updated", target_type: "coach", target_id: coachId, old_value: null, new_value: { account_status: status }, performed_by: this.session()?.userId ?? "owner-demo-0001" });
  }

  async loadSubscriptionHistory(subscriptionId?: string): Promise<Row[]> {
    try {
      const raw = localStorage.getItem(DEMO_SUB_HISTORY_KEY);
      const list = raw ? (JSON.parse(raw) as Row[]) : [];
      const filtered = subscriptionId ? list.filter((r) => String((r as Record<string, unknown>).subscription_id) === subscriptionId) : list;
      return filtered.slice(0, 100);
    } catch {
      return [];
    }
  }

  async loadAuditLog(limit = 100): Promise<Row[]> {
    try {
      const raw = localStorage.getItem(DEMO_AUDIT_KEY);
      const list = raw ? (JSON.parse(raw) as Row[]) : [];
      return list.slice(0, limit);
    } catch {
      return [];
    }
  }
}

/* ---------------- singleton ---------------- */

export const backend: Backend = isDemoMode ? new DemoBackend() : new SupabaseBackend();
