/* ================================================================
   VERRAA — data model + visual metadata.
   ================================================================ */

export type Goal = "Lose weight" | "Build muscle" | "General fitness";
export type ClientStatus = "Active" | "Paused" | "Completed";
/** Coach-set importance: Critical (VIP) always surfaces first, then Medium, then Normal. */
export type ClientPriority = "Critical" | "Medium" | "Normal";
export type ExerciseCategory = "Chest" | "Back" | "Legs" | "Arms" | "Core" | "Cardio";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type SessionStatus = "Scheduled" | "Confirmed" | "Completed" | "Missed" | "Cancelled";
export type PaymentMethod = "Cash" | "Card" | "Bank Transfer" | "Other";
export type PaymentStatus = "Paid" | "Pending";
export type SubscriptionPaymentStatus = "Paid" | "Pending" | "Partial";
export type SubState = "Active" | "Expiring Soon" | "Expired" | "No Subscription";
export type SenderRole = "coach" | "client" | "owner";
export type NotificationKind = "message" | "plan_updated" | "meal_updated" | "reminder" | "subscription";

export type CoachView = "dashboard" | "clients" | "client" | "plans" | "meals" | "library" | "checkins" | "pricing" | "settings";

/* ---------------- coach pricing & subscriptions (centralized source of truth) ---------------- */

export type CoachPlan = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export type CoachSubscriptionStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING" | "CANCELLED";

export interface CoachPlanConfig {
  id: CoachPlan;
  name: string;
  price: number; // EGP / month
  maxClients: number | null; // null = unlimited (Enterprise)
  billingInterval: "monthly";
  isActive: boolean;
  description?: string;
  features?: string[];
}

/* ---------------- entities ---------------- */

export interface CoachNote {
  id: string;
  text: string;
  createdAt: number;
  pinned?: boolean;
  /** Section inside the Notes tab — old notes without one read as General. */
  category?: NoteCategory;
  /** Creator display name — reserved for future multi-coach teams. */
  by?: string;
}

/** Coach-note sections, always displayed in this priority order. */
export type NoteCategory = "critical" | "workout" | "nutrition" | "general";

export const NOTE_CATEGORIES: NoteCategory[] = ["critical", "workout", "nutrition", "general"];

export const NOTE_CATEGORY_META: Record<NoteCategory, { chip: string; dot: string; label: string }> = {
  critical: { chip: "border-danger-500/25 bg-danger-500/10 text-danger-300", dot: "bg-danger-400", label: "Critical" },
  workout: { chip: "border-volt-400/25 bg-volt-400/10 text-volt-300", dot: "bg-volt-400", label: "Workout plan" },
  nutrition: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400", label: "Nutrition" },
  general: { chip: "border-night-500/60 bg-night-600/30 text-mist-300", dot: "bg-mist-400", label: "General info" },
};

/** Normalize raw JSON note rows — unknown/missing categories read as General. */
export function normalizeCoachNotes(notes: unknown): CoachNote[] {
  if (!Array.isArray(notes)) return [];
  const out: CoachNote[] = [];
  for (const n of notes) {
    if (!n || typeof n !== "object") continue;
    const r = n as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!id) continue;
    const cat = r.category;
    out.push({
      id,
      text: String(r.text ?? ""),
      createdAt: Number(r.createdAt ?? 0) || 0,
      ...(typeof r.pinned === "boolean" ? { pinned: r.pinned } : {}),
      category: cat === "critical" || cat === "workout" || cat === "nutrition" ? cat : "general",
      ...(typeof r.by === "string" && r.by ? { by: r.by } : {}),
    });
  }
  return out;
}

/** Coach's private to-do item for a client (Notes tab). Done items are
    cleared explicitly — nothing auto-deletes. */
export interface ClientTodo {
  id: string;
  coachId: string;
  clientId: string;
  text: string;
  done: boolean;
  createdAt: number; // epoch ms
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  water: number; // liters
}

export interface Client {
  id: string;
  coachId: string;
  username: string;
  /** False for coach-managed clients with no Client-mode login. */
  hasLogin: boolean;
  /** Coach-set importance — drives needs-attention ordering. Defaults to Normal. */
  priority: ClientPriority;
  name: string;
  email: string;
  phone: string;
  gender?: "Male" | "Female" | "Other";
  age?: number;
  goal: Goal;
  startDate: string; // ISO
  status: ClientStatus;
  notes: string;
  photo?: string; // data URL
  followUpDays?: number;
  lastFollowUp?: string; // ISO
  coachNotes: CoachNote[];
  nutritionTargets?: NutritionTargets;
}

export interface Exercise {
  id: string;
  coachId: string;
  name: string;
  category: ExerciseCategory;
  description: string;
  videoUrl: string;
}

export interface PlanItem {
  id: string;
  coachId: string;
  clientId: string;
  day: number; // 1..7 — Day 1 = Monday
  exerciseId: string;
  sets: number;
  reps: number;
  rest: number; // seconds
  notes: string;
}

export interface CheckIn {
  id: string;
  coachId: string;
  clientId: string;
  date: string; // ISO
  ts: number; // epoch ms — insertion order
  weight: number; // kg
  waist?: number; // cm
  mood: number; // 1..5
  water: number; // liters
  workoutDone: boolean;
  notes?: string;
  photo?: string; // data URL
}

export interface Meal {
  id: string;
  coachId: string;
  clientId: string;
  /** Which diet-plan version this meal belongs to. Undefined = saved before
      versioning — those meals belong to the client's oldest version. */
  planId?: string;
  day: number; // 1..7 — Day 1 = Monday
  type: MealType;
  time?: string; // HH:mm (optional)
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  notes?: string;
}

/* ---------------- diet-plan versions (one standing plan per client) ----------------
   The coach does NOT rebuild the plan weekly. Each client follows ONE diet
   plan for the whole subscription; when the coach changes it, the previous
   plan is kept as an archived version that can be viewed or restored. */

export type NutritionPlanStatus = "active" | "archived";

export interface NutritionPlan {
  id: string;
  coachId: string;
  clientId: string;
  name: string; // e.g. "Plan 1", "Cutting — March"
  status: NutritionPlanStatus; // exactly one "active" per client; the rest are history
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface Subscription {
  id: string;
  coachId: string;
  clientId: string;
  planName: string;
  startDate: string;
  endDate: string;
  price: number;
  paymentStatus: SubscriptionPaymentStatus;
  createdAt: number;
}

export interface Payment {
  id: string;
  coachId: string;
  clientId: string;
  subscriptionId?: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  notes: string;
}

export interface Session {
  id: string;
  coachId: string;
  clientId: string;
  date: string;
  time: string; // HH:mm
  type: string;
  status: SessionStatus;
  notes: string;
}

export interface Message {
  id: string;
  coachId: string;
  clientId: string;
  senderRole: SenderRole;
  text: string;
  createdAt: number;
}

/** Named AppNotification to avoid colliding with the DOM Notification global. */
export interface AppNotification {
  id: string;
  coachId: string;
  clientId: string;
  kind: NotificationKind;
  text: string;
  createdAt: number;
  read: boolean;
}

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

export interface Coach {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  createdAt: string;
}

export type PlanRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/** A coach's request for a paid plan — approved/rejected by the owner. */
export interface CoachPlanRequest {
  id: string;
  coachId: string;
  requestedPlan: string;
  status: PlanRequestStatus;
  note: string;
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

/* ---------------- strength tracker (client mode) ----------------
   The client logs ONE top weight per exercise per session
   (weight kg + reps + sets) — fast to fill in the gym.
   Identity of an exercise for "last weight" / PR purposes is:
   exerciseId (coach library) ?? clientExerciseId (own) ?? name. */

export interface ClientExercise {
  id: string;
  coachId: string;
  clientId: string;
  name: string;
  category: ExerciseCategory;
  notes: string;
  createdAt: number;
}

export interface WorkoutTemplateItem {
  key: string;
  exerciseId?: string;
  clientExerciseId?: string;
  name: string;
  category?: ExerciseCategory;
  targetSets: number;
  targetReps: number;
}

export interface WorkoutTemplate {
  id: string;
  coachId: string;
  clientId: string;
  name: string;
  items: WorkoutTemplateItem[];
  createdAt: number;
}

export interface WorkoutSession {
  id: string;
  coachId: string;
  clientId: string;
  templateId?: string;
  name: string;
  date: string; // ISO
  ts: number; // epoch ms — insertion order
  notes?: string;
}

export interface WorkoutEntry {
  id: string;
  coachId: string;
  clientId: string;
  sessionId: string;
  exerciseId?: string;
  clientExerciseId?: string;
  exerciseName: string; // snapshot — history survives library deletes
  category?: ExerciseCategory;
  weight: number; // kg — top weight for the exercise
  reps: number;
  sets: number;
  isPR: boolean;
  createdAt: number;
}

/* ---------------- meal edit requests (client asks, coach decides) ----------------
   The client can't edit their own meals — they file a request with the
   issue + an optional suggested alternative. The coach edits the meal
   manually, then Approves (or Rejects with a note). Both sides are
   notified through the existing meal_updated channel. */

export type MealRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MealEditRequest {
  id: string;
  coachId: string;
  clientId: string;
  mealId?: string; // empty when the meal was deleted — snapshot below survives
  day: number; // 1..7 — snapshot at request time
  mealType: MealType; // snapshot at request time
  mealDescription: string; // snapshot at request time
  message: string; // the client's issue
  suggestion?: string; // the client's proposed alternative
  status: MealRequestStatus;
  coachNote?: string;
  createdAt: number;
  reviewedAt?: number;
}

/* ---------------- meal compliance (client logs per meal per day) ----------------
   The client taps ✓ (ate it) or ✕ (skipped / cheated) on each meal.
   One row per meal per calendar date — tapping again switches or clears.
   meal_id is FK-free so history survives meal deletes. */

export type MealLogStatus = "EATEN" | "SKIPPED";

export interface MealLog {
  id: string;
  coachId: string;
  clientId: string;
  mealId?: string;
  date: string; // ISO — the calendar day this log belongs to
  day: number; // snapshot of the plan day
  mealType: MealType;
  mealDescription: string;
  status: MealLogStatus;
  createdAt: number;
}

/* ---------------- flexible menus (client picks which day to eat) ----------------
   The weekly plan is an open menu, not a calendar sentence. Each day the
   client picks which plan-day (1..7) they follow; compliance marks are
   logged against that day's meals with the calendar date. Switching days
   clears that date's marks (after an explicit warning). */

export interface MealDayPick {
  id: string;
  coachId: string;
  clientId: string;
  date: string; // ISO — the calendar day this pick belongs to
  day: number; // 1..7 — the plan-day followed
  createdAt: number;
}

/* ---------------- progress photos (Before / After) ----------------
   Dedicated gallery per client — separate from daily check-ins.
   Both sides can upload; photos are compact JPEG data URLs. */

export type ProgressPhotoKind = "BEFORE" | "AFTER";

export interface ProgressPhoto {
  id: string;
  coachId: string;
  clientId: string;
  kind: ProgressPhotoKind;
  photo: string; // data URL
  date: string; // ISO — upload day
  ts: number; // epoch ms — insertion order
  note?: string;
  /** Who uploaded it — shown as a small badge in shared galleries. */
  by?: SenderRole;
}

export const PHOTO_KINDS: ProgressPhotoKind[] = ["BEFORE", "AFTER"];

/** Stable identity key for last-weight / PR matching. */
export function workoutExerciseKey(e: {
  exerciseId?: string;
  clientExerciseId?: string;
  exerciseName?: string;
  name?: string;
}): string {
  if (e.exerciseId) return `lib:${e.exerciseId}`;
  if (e.clientExerciseId) return `custom:${e.clientExerciseId}`;
  const n = (e.exerciseName ?? e.name ?? "").trim().toLowerCase();
  return `name:${n}`;
}

export interface AppState {
  clients: Client[];
  exercises: Exercise[];
  plans: PlanItem[];
    checkIns: CheckIn[];
    meals: Meal[];
    nutritionPlans?: NutritionPlan[];
  subscriptions: Subscription[];
  payments: Payment[];
  sessions: Session[];
  messages: Message[];
  notifications: AppNotification[];
  coaches?: Coach[];
  coachSubscriptions?: CoachSubscription[];
  coachPlans?: CoachPlanConfig[];
  planRequests?: CoachPlanRequest[];
  clientExercises: ClientExercise[];
  workoutTemplates: WorkoutTemplate[];
  workoutSessions: WorkoutSession[];
  workoutEntries: WorkoutEntry[];
  mealRequests: MealEditRequest[];
  mealLogs: MealLog[];
  mealDayPicks: MealDayPick[];
  progressPhotos: ProgressPhoto[];
  todos: ClientTodo[];
}

/* ---------------- input types ---------------- */

export interface NewClientInput {
  username: string;
  password: string;
  /** False = coach-managed only, no Client-mode login is created. Defaults to true. */
  createLogin?: boolean;
  name: string;
  email?: string;
  phone?: string;
  gender?: Client["gender"];
  age?: number;
  goal: Goal;
  status: ClientStatus;
  startDate: string;
  notes?: string;
  photo?: string;
}

/* ---------------- constants ---------------- */

export const GOALS: Goal[] = ["Lose weight", "Build muscle", "General fitness"];
export const STATUSES: ClientStatus[] = ["Active", "Paused", "Completed"];
export const CATEGORIES: ExerciseCategory[] = ["Chest", "Back", "Legs", "Arms", "Core", "Cardio"];
export const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
export const SESSION_STATUSES: SessionStatus[] = ["Scheduled", "Confirmed", "Completed", "Missed", "Cancelled"];
export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Card", "Bank Transfer", "Other"];
export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEK_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const FOLLOW_UP_PRESETS = [1, 3, 7, 14];

/* ---------------- week display (Sat-first convention) ---------------- */

/** How day buttons/titles are labelled in nutrition views. */
export type DayLabelMode = "weekdays" | "numbered";

/**
 * Display order of the week, starting Saturday (EG gym convention).
 * Values are STORED day numbers (Mon = 1 … Sun = 7) — data is untouched,
 * only the presentation order changes: Sat, Sun, Mon, Tue, Wed, Thu, Fri.
 */
export const WEEK_ORDER_SAT_FIRST = [6, 7, 1, 2, 3, 4, 5];

/** Position (1..7) of a stored day inside the displayed Sat-first week. */
export function weekPos(day: number): number {
  const i = WEEK_ORDER_SAT_FIRST.indexOf(day);
  return i < 0 ? day : i + 1;
}

/** Full label for a stored day: weekday name, or "Day N" (Sat = Day 1). */
export function formatDayName(day: number, mode: DayLabelMode = "weekdays"): string {
  if (mode === "numbered") return `Day ${weekPos(day)}`;
  return WEEK_DAYS[day - 1] ?? `Day ${day}`;
}

/** Short label for a stored day: "Mon", or "D1" (Sat = D1). */
export function formatDayShort(day: number, mode: DayLabelMode = "weekdays"): string {
  if (mode === "numbered") return `D${weekPos(day)}`;
  return WEEK_SHORT[day - 1] ?? `D${day}`;
}

/* ---------------- visual metadata ---------------- */

export const GOAL_META: Record<Goal, { chip: string; dot: string; bar: string }> = {
  "Lose weight": {
    chip: "border-warn-400/25 bg-warn-400/10 text-warn-300",
    dot: "bg-warn-400",
    bar: "bg-warn-400",
  },
  "Build muscle": {
    chip: "border-volt-400/25 bg-volt-400/10 text-volt-300",
    dot: "bg-volt-400",
    bar: "bg-volt-400",
  },
  "General fitness": {
    chip: "border-moss-400/25 bg-moss-400/10 text-moss-300",
    dot: "bg-moss-400",
    bar: "bg-moss-400",
  },
};

export const STATUS_META: Record<ClientStatus, { chip: string; dot: string }> = {
  Active: { chip: "border-volt-400/25 bg-volt-400/10 text-volt-300", dot: "bg-volt-400" },
  Paused: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400" },
  Completed: { chip: "border-night-500/60 bg-night-600/30 text-mist-300", dot: "bg-mist-400" },
};

export const PRIORITIES: ClientPriority[] = ["Critical", "Medium", "Normal"];

export const PRIORITY_META: Record<ClientPriority, { chip: string; dot: string }> = {
  Critical: { chip: "border-danger-500/25 bg-danger-500/10 text-danger-300", dot: "bg-danger-400" },
  Medium: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400" },
  Normal: { chip: "border-night-500/60 bg-night-600/30 text-mist-400", dot: "bg-mist-500" },
};

/** Sort weight — Critical (VIP) always first, then Medium, then Normal. */
export const priorityRank = (p: ClientPriority | string | undefined | null): number =>
  p === "Critical" ? 0 : p === "Medium" ? 1 : 2;

/** Normalize any stored value to a valid priority (pre-migration rows lack the column). */
export const normalizePriority = (p: unknown): ClientPriority =>
  p === "Critical" || p === "Medium" ? p : "Normal";

export const CAT_META: Record<ExerciseCategory, { chip: string; dot: string }> = {
  Chest: { chip: "border-rose-400/25 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
  Back: { chip: "border-sky-400/25 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
  Legs: { chip: "border-amber-400/25 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  Arms: { chip: "border-orange-400/25 bg-orange-400/10 text-orange-300", dot: "bg-orange-400" },
  Core: { chip: "border-volt-400/25 bg-volt-400/10 text-volt-300", dot: "bg-volt-400" },
  Cardio: { chip: "border-red-400/25 bg-red-400/10 text-red-300", dot: "bg-red-400" },
};

export const MEAL_META: Record<MealType, { chip: string; dot: string }> = {
  Breakfast: { chip: "border-amber-400/25 bg-amber-400/10 text-amber-300", dot: "bg-amber-400" },
  Lunch: { chip: "border-volt-400/25 bg-volt-400/10 text-volt-300", dot: "bg-volt-400" },
  Dinner: { chip: "border-teal-400/25 bg-teal-400/10 text-teal-300", dot: "bg-teal-400" },
  Snack: { chip: "border-rose-400/25 bg-rose-400/10 text-rose-300", dot: "bg-rose-400" },
};

export const SESSION_STATUS_META: Record<SessionStatus, { chip: string; dot: string }> = {
  Scheduled: { chip: "border-sky-400/25 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
  Confirmed: { chip: "border-volt-400/25 bg-volt-400/10 text-volt-300", dot: "bg-volt-400" },
  Completed: { chip: "border-moss-400/25 bg-moss-400/10 text-moss-300", dot: "bg-moss-400" },
  Missed: { chip: "border-danger-500/25 bg-danger-500/10 text-danger-300", dot: "bg-danger-400" },
  Cancelled: { chip: "border-night-500/60 bg-night-600/30 text-mist-400", dot: "bg-mist-500" },
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { chip: string; dot: string }> = {
  Paid: { chip: "border-moss-400/25 bg-moss-400/10 text-moss-300", dot: "bg-moss-400" },
  Pending: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400" },
};

export const SUB_PAYMENT_META: Record<SubscriptionPaymentStatus, { chip: string; dot: string }> = {
  Paid: { chip: "border-moss-400/25 bg-moss-400/10 text-moss-300", dot: "bg-moss-400" },
  Pending: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400" },
  Partial: { chip: "border-sky-400/25 bg-sky-400/10 text-sky-300", dot: "bg-sky-400" },
};

export const SUB_STATE_META: Record<SubState, { chip: string; dot: string; bar: string }> = {
  Active: { chip: "border-moss-400/25 bg-moss-400/10 text-moss-300", dot: "bg-moss-400", bar: "bg-moss-400" },
  "Expiring Soon": { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", dot: "bg-warn-400", bar: "bg-warn-400" },
  Expired: { chip: "border-danger-500/25 bg-danger-500/10 text-danger-300", dot: "bg-danger-400", bar: "bg-danger-400" },
  "No Subscription": { chip: "border-night-500/60 bg-night-600/30 text-mist-400", dot: "bg-mist-500", bar: "bg-night-500" },
};

export const NOTIFICATION_META: Record<NotificationKind, { tone: string; dot: string }> = {
  message: { tone: "text-sky-300", dot: "bg-sky-400" },
  plan_updated: { tone: "text-volt-300", dot: "bg-volt-400" },
  meal_updated: { tone: "text-warn-300", dot: "bg-warn-400" },
  reminder: { tone: "text-moss-300", dot: "bg-moss-400" },
  subscription: { tone: "text-danger-300", dot: "bg-danger-400" },
};
