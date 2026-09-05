import type {
  CheckIn,
  Client,
  CoachNote,
  Exercise,
  Meal,
  Payment,
  PlanItem,
  Session,
  Subscription,
} from "../types";
import type { ConnectionConfig, DataProvider, EntityOp, RemoteData } from "./dataProvider";
import {
  getMetadata,
  initTabs,
  readRecords,
  removeRow,
  removeWhere,
  spreadsheetIdFrom,
  upsertRow,
  type Row,
} from "./googleSheetsApi";

/**
 * GoogleSheetsProvider
 * --------------------
 * Talks to Google Sheets through the Sheets API v4 using the coach's OAuth
 * access token (obtained via the "Link with Google" consent flow). No secret
 * ever reaches the frontend — the OAuth client id is public by design and the
 * access token is short-lived, scoped and granted by the coach.
 *
 * Every record carries a `coach_id`; reads and writes here are always scoped to
 * the connected coach, so one coach can never touch another coach's data.
 */

/* ------------------------------------------------------------------ */
/* Database schema — the 16 required tabs.                             */
/* init() creates any tab that is missing (with headers) and leaves    */
/* existing tabs and their data untouched.                             */
/* ------------------------------------------------------------------ */

const COMMON = ["id", "coach_id", "created_at", "updated_at"];

export const SCHEMA: Record<string, string[]> = {
  Coaches: ["id", "name", "email", "created_at", "updated_at"],
  Clients: [
    ...COMMON,
    "name", "phone", "email", "gender", "age", "goal", "status", "join_date", "notes", "photo",
    "follow_up_days", "last_follow_up", "coach_notes", "nutrition_targets",
  ],
  Subscriptions: [...COMMON, "client_id", "plan_name", "start_date", "end_date", "price", "status"],
  Payments: [...COMMON, "client_id", "subscription_id", "amount", "payment_date", "payment_method", "status", "notes"],
  Sessions: [...COMMON, "client_id", "date", "time", "type", "status", "notes"],
  CheckIns: [...COMMON, "client_id", "date", "ts", "weight", "waist", "mood", "water", "workout_completed", "notes", "photo"],
  Measurements: [...COMMON, "client_id", "date", "weight", "body_fat", "waist", "chest", "arm", "thigh", "hips", "notes"],
  ProgressPhotos: [...COMMON, "client_id", "date", "photo", "notes"],
  WorkoutPlans: [...COMMON, "client_id", "day", "exercise_id", "sets", "reps", "rest", "notes"],
  WorkoutExercises: [...COMMON, "workout_id", "exercise_id", "sets", "reps", "rest", "order"],
  Exercises: [...COMMON, "name", "category", "description", "video_url"],
  NutritionPlans: [...COMMON, "client_id", "name", "start_date", "end_date", "notes"],
  Meals: [...COMMON, "client_id", "type", "description", "calories", "protein", "carbs", "fats"],
  FollowUps: [...COMMON, "client_id", "date", "channel", "message", "status"],
  Notifications: [...COMMON, "client_id", "title", "body", "read"],
  Settings: ["coach_id", "key", "value", "updated_at"],
};

export const TAB_NAMES = Object.keys(SCHEMA);

/** The collections the UI reads/writes, mapped to their tabs. */
const ENTITY_SHEET: Record<EntityOp["entity"], string> = {
  client: "Clients",
  exercise: "Exercises",
  plan: "WorkoutPlans",
  checkin: "CheckIns",
  meal: "Meals",
  subscription: "Subscriptions",
  payment: "Payments",
  session: "Sessions",
};

/* ------------------------------------------------------------------ */
/* Mappers: app entity <-> sheet row (adds coach_id + audit fields).   */
/* ------------------------------------------------------------------ */

/** Sheets cells cap at 50k chars; drop oversized base64 photos so a write never fails. */
const safePhoto = (p?: string) => (p && p.length < 45000 ? p : "");

/** JSON columns stored as text cells (parsed defensively on read). */
const toJsonCell = (v: unknown) => (v === undefined ? "" : JSON.stringify(v));
const fromJsonCell = <T,>(raw: unknown): T | undefined => {
  if (raw === "" || raw === undefined || raw === null) return undefined;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return undefined;
  }
};

const getCoachId = (cfg: ConnectionConfig) => cfg.coachId ?? "";

const clientToRow = (c: Client, cfg: ConnectionConfig): Row => ({
  id: c.id,
  coach_id: getCoachId(cfg),
  name: c.name,
  phone: c.phone,
  email: c.email,
  gender: c.gender ?? "",
  age: c.age ?? "",
  goal: c.goal,
  status: c.status,
  join_date: c.startDate,
  notes: c.notes,
  photo: safePhoto(c.photo),
  follow_up_days: c.followUpDays ?? "",
  last_follow_up: c.lastFollowUp ?? "",
  coach_notes: toJsonCell(c.coachNotes ?? []),
  nutrition_targets: toJsonCell(c.nutritionTargets),
});

const rowToClient = (r: Row, cfg: ConnectionConfig): Client => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  username: String(r.username ?? r.name ?? "client").toLowerCase().replace(/\s+/g, "_"),
  name: String(r.name ?? ""),
  phone: String(r.phone ?? ""),
  email: String(r.email ?? ""),
  gender: r.gender ? (String(r.gender) as Client["gender"]) : undefined,
  age: r.age === "" || r.age === undefined ? undefined : Number(r.age),
  goal: (r.goal as Client["goal"]) || "General fitness",
  status: (r.status as Client["status"]) || "Active",
  startDate: String(r.join_date ?? ""),
  notes: String(r.notes ?? ""),
  photo: r.photo ? String(r.photo) : undefined,
  followUpDays: r.follow_up_days === "" || r.follow_up_days === undefined ? undefined : Number(r.follow_up_days),
  lastFollowUp: r.last_follow_up ? String(r.last_follow_up) : undefined,
  coachNotes: fromJsonCell<Client["coachNotes"]>(r.coach_notes) ?? [],
  nutritionTargets: fromJsonCell<Client["nutritionTargets"]>(r.nutrition_targets),
});

const exerciseToRow = (e: Exercise, cfg: ConnectionConfig): Row => ({
  id: e.id,
  coach_id: getCoachId(cfg),
  name: e.name,
  category: e.category,
  description: e.description,
  video_url: e.videoUrl,
});

const rowToExercise = (r: Row, cfg: ConnectionConfig): Exercise => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  name: String(r.name ?? ""),
  category: (r.category as Exercise["category"]) || "Chest",
  description: String(r.description ?? ""),
  videoUrl: String(r.video_url ?? ""),
});

const planToRow = (p: PlanItem, cfg: ConnectionConfig): Row => ({
  id: p.id,
  coach_id: getCoachId(cfg),
  client_id: p.clientId,
  day: p.day,
  exercise_id: p.exerciseId,
  sets: p.sets,
  reps: p.reps,
  rest: p.rest,
  notes: p.notes,
});

const rowToPlan = (r: Row, cfg: ConnectionConfig): PlanItem => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  day: Number(r.day) || 1,
  exerciseId: String(r.exercise_id ?? ""),
  sets: Number(r.sets) || 1,
  reps: Number(r.reps) || 1,
  rest: Number(r.rest) || 0,
  notes: String(r.notes ?? ""),
});

const checkInToRow = (c: CheckIn, cfg: ConnectionConfig): Row => ({
  id: c.id,
  coach_id: getCoachId(cfg),
  client_id: c.clientId,
  date: c.date,
  ts: c.ts,
  weight: c.weight,
  waist: c.waist ?? "",
  mood: c.mood,
  water: c.water,
  workout_completed: c.workoutDone,
  notes: c.notes ?? "",
  photo: safePhoto(c.photo),
});

const rowToCheckIn = (r: Row, cfg: ConnectionConfig): CheckIn => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  date: String(r.date ?? ""),
  ts: Number(r.ts) || 0,
  weight: Number(r.weight) || 0,
  waist: r.waist === "" || r.waist === undefined ? undefined : Number(r.waist),
  mood: Number(r.mood) || 3,
  water: Number(r.water) || 0,
  workoutDone: r.workout_completed === true || r.workout_completed === "TRUE" || r.workout_completed === "true",
  notes: r.notes ? String(r.notes) : undefined,
  photo: r.photo ? String(r.photo) : undefined,
});

const mealToRow = (m: Meal, cfg: ConnectionConfig): Row => ({
  id: m.id,
  coach_id: getCoachId(cfg),
  client_id: m.clientId,
  type: m.type,
  description: m.description,
  calories: m.calories,
  protein: m.protein,
  carbs: m.carbs,
  fats: m.fats,
});

const rowToMeal = (r: Row, cfg: ConnectionConfig): Meal => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  day: Number(r.day) || 1,
  type: (r.type as Meal["type"]) || "Snack",
  description: String(r.description ?? ""),
  calories: Number(r.calories) || 0,
  protein: Number(r.protein) || 0,
  carbs: Number(r.carbs) || 0,
  fats: Number(r.fats) || 0,
});

const subscriptionToRow = (s: Subscription, cfg: ConnectionConfig): Row => ({
  id: s.id,
  coach_id: getCoachId(cfg),
  client_id: s.clientId,
  plan_name: s.planName,
  start_date: s.startDate,
  end_date: s.endDate,
  price: s.price,
  status: s.paymentStatus,
});

const rowToSubscription = (r: Row, cfg: ConnectionConfig): Subscription => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  planName: String(r.plan_name ?? ""),
  startDate: String(r.start_date ?? ""),
  endDate: String(r.end_date ?? ""),
  price: Number(r.price) || 0,
  paymentStatus: (r.status as Subscription["paymentStatus"]) || "Pending",
  createdAt: Number(r.created_at) || 0,
});

const paymentToRow = (p: Payment, cfg: ConnectionConfig): Row => ({
  id: p.id,
  coach_id: getCoachId(cfg),
  client_id: p.clientId,
  subscription_id: p.subscriptionId ?? "",
  amount: p.amount,
  payment_date: p.date,
  payment_method: p.method,
  status: p.status,
  notes: p.notes,
});

const rowToPayment = (r: Row, cfg: ConnectionConfig): Payment => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  subscriptionId: r.subscription_id ? String(r.subscription_id) : undefined,
  amount: Number(r.amount) || 0,
  date: String(r.payment_date ?? ""),
  method: (r.payment_method as Payment["method"]) || "Cash",
  status: (r.status as Payment["status"]) || "Paid",
  notes: String(r.notes ?? ""),
});

const sessionToRow = (s: Session, cfg: ConnectionConfig): Row => ({
  id: s.id,
  coach_id: getCoachId(cfg),
  client_id: s.clientId,
  date: s.date,
  time: s.time,
  type: s.type,
  status: s.status,
  notes: s.notes,
});

const rowToSession = (r: Row, cfg: ConnectionConfig): Session => ({
  id: String(r.id),
  coachId: String(r.coach_id ?? getCoachId(cfg)),
  clientId: String(r.client_id ?? ""),
  date: String(r.date ?? ""),
  time: String(r.time ?? ""),
  type: String(r.type ?? ""),
  status: (r.status as Session["status"]) || "Scheduled",
  notes: String(r.notes ?? ""),
});

const FIELD_MAP: Record<string, string> = { clientId: "client_id", exerciseId: "exercise_id" };

const toUpsertRow = (op: Extract<EntityOp, { type: "upsert" }>, cfg: ConnectionConfig): Row => {
  switch (op.entity) {
    case "client":
      return clientToRow(op.record, cfg);
    case "exercise":
      return exerciseToRow(op.record, cfg);
    case "plan":
      return planToRow(op.record, cfg);
    case "checkin":
      return checkInToRow(op.record, cfg);
    case "meal":
      return mealToRow(op.record, cfg);
    case "subscription":
      return subscriptionToRow(op.record, cfg);
    case "payment":
      return paymentToRow(op.record, cfg);
    case "session":
      return sessionToRow(op.record, cfg);
  }
};

/* ------------------------------------------------------------------ */
/* Provider implementation (OAuth + Sheets API v4).                    */
/* ------------------------------------------------------------------ */

export const googleSheetsProvider: DataProvider = {
  kind: "google-sheets",

  async ping(cfg) {
    // A successful metadata read proves the token works and the sheet is reachable.
    await getMetadata(cfg);
  },

  async init(cfg) {
    return initTabs(cfg, SCHEMA);
  },

  async load(cfg) {
    const [clients, exercises, plans, checkIns, meals, subscriptions, payments, sessions] = await Promise.all([
      readRecords(cfg, "Clients"),
      readRecords(cfg, "Exercises"),
      readRecords(cfg, "WorkoutPlans"),
      readRecords(cfg, "CheckIns"),
      readRecords(cfg, "Meals"),
      readRecords(cfg, "Subscriptions"),
      readRecords(cfg, "Payments"),
      readRecords(cfg, "Sessions"),
    ]);
    return {
      clients: clients.map((r) => rowToClient(r, cfg)),
      exercises: exercises.map((r) => rowToExercise(r, cfg)),
      plans: plans.map((r) => rowToPlan(r, cfg)),
      checkIns: checkIns.map((r) => rowToCheckIn(r, cfg)),
      meals: meals.map((r) => rowToMeal(r, cfg)),
      subscriptions: subscriptions.map((r) => rowToSubscription(r, cfg)),
      payments: payments.map((r) => rowToPayment(r, cfg)),
      sessions: sessions.map((r) => rowToSession(r, cfg)),
    } satisfies RemoteData;
  },

  async apply(cfg, ops) {
    for (const op of ops) {
      const sheet = ENTITY_SHEET[op.entity];
      if (op.type === "upsert") {
        await upsertRow(cfg, sheet, toUpsertRow(op, cfg));
      } else if (op.type === "remove") {
        await removeRow(cfg, sheet, op.id);
      } else {
        await removeWhere(cfg, sheet, FIELD_MAP[op.field] ?? op.field, op.value);
      }
    }
  },
};

/** Derive a stable spreadsheet id from a sheet URL or bare id. */
export function spreadsheetId(sheetUrl: string): string | null {
  return spreadsheetIdFrom(sheetUrl);
}