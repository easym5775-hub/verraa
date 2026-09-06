/* ================================================================
   VERRAA — data model + visual metadata.
   ================================================================ */

export type Goal = "Lose weight" | "Build muscle" | "General fitness";
export type ClientStatus = "Active" | "Paused" | "Completed";
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
  /** Creator display name — reserved for future multi-coach teams. */
  by?: string;
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

export interface AppState {
  clients: Client[];
  exercises: Exercise[];
  plans: PlanItem[];
  checkIns: CheckIn[];
  meals: Meal[];
  subscriptions: Subscription[];
  payments: Payment[];
  sessions: Session[];
  messages: Message[];
  notifications: AppNotification[];
  coaches?: Coach[];
  coachSubscriptions?: CoachSubscription[];
  coachPlans?: CoachPlanConfig[];
  planRequests?: CoachPlanRequest[];
}

/* ---------------- input types ---------------- */

export interface NewClientInput {
  username: string;
  password: string;
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
