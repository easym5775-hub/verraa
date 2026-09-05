/* ================================================================
   FORGE — centralized Coach Pricing & Subscription source of truth.

   All pricing values live here (as DB-backed defaults). UI components
   must NEVER hardcode 1999 / 5000 / 10000 / 20 / 100 — import from here
   or, preferably, use the live `coachPlans` loaded from the database
   (which falls back to DEFAULT_COACH_PLANS when offline).

   Enterprise uses maxClients = null to represent unlimited capacity.
   ================================================================ */

import type { AppState, Client, CoachPlan, CoachPlanConfig, CoachSubscription } from "./types";
import { fmtDate } from "./lib";

export type { CoachPlan, CoachPlanConfig };

/* ---------------- canonical defaults (seeded into coach_plans) ---------------- */

export const DEFAULT_COACH_PLANS: CoachPlanConfig[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 1999,
    maxClients: 20,
    billingInterval: "monthly",
    isActive: true,
    description: "For coaches starting out",
    features: [
      "Up to 20 Clients",
      "Client Management",
      "Progress Tracking",
      "Nutrition Management",
      "Coach Dashboard",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: 5000,
    maxClients: 100,
    billingInterval: "monthly",
    isActive: true,
    description: "For growing coaching businesses",
    features: [
      "Up to 100 Clients",
      "Client Management",
      "Progress Tracking",
      "Nutrition Management",
      "Coach Dashboard",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: 10000,
    maxClients: null,
    billingInterval: "monthly",
    isActive: true,
    description: "For teams & high-volume coaches",
    features: [
      "100+ Clients",
      "Unlimited Client Capacity",
      "Client Management",
      "Progress Tracking",
      "Nutrition Management",
      "Coach Dashboard",
    ],
  },
];

export const COACH_PLAN_ORDER: CoachPlan[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];

/* ---------------- normalization ---------------- */

/** Map legacy / free-form plan names to canonical plan IDs. Returns null when unknown. */
export function normalizeCoachPlanId(raw?: string | null): CoachPlan | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (v === "STARTER" || v === "START" || v === "BASIC" || v === "FREE") return "STARTER";
  if (v === "PROFESSIONAL" || v === "PROFESIONAL" || v === "PRO") return "PROFESSIONAL";
  if (v === "ENTERPRISE" || v === "ENTERPRIZE" || v === "UNLIMITED" || v === "SCALE" || v === "BUSINESS") return "ENTERPRISE";
  // Legacy client-plan names ("Monthly"/"Quarterly"/"Annual") are NOT coach plans.
  return null;
}

/** Resolve a plan config from a list (DB rows preferred, defaults as fallback). */
export function getCoachPlanConfig(
  plans: CoachPlanConfig[] | undefined,
  planName: string | null | undefined,
): CoachPlanConfig | null {
  const list = plans && plans.length > 0 ? plans : DEFAULT_COACH_PLANS;
  const id = normalizeCoachPlanId(planName);
  if (!id) return null;
  return list.find((p) => p.id === id) ?? DEFAULT_COACH_PLANS.find((p) => p.id === id) ?? null;
}

export function getPlanById(plans: CoachPlanConfig[] | undefined, id: CoachPlan): CoachPlanConfig {
  const list = plans && plans.length > 0 ? plans : DEFAULT_COACH_PLANS;
  return list.find((p) => p.id === id) ?? DEFAULT_COACH_PLANS.find((p) => p.id === id)!;
}

/* ---------------- subscription resolution ---------------- */

/** The current coach subscription = the one ending latest (ties → most recently updated). */
export function resolveCoachSubscription(
  subscriptions: CoachSubscription[] | undefined,
  coachId: string,
): CoachSubscription | null {
  const list = (subscriptions ?? []).filter((s) => s.coachId === coachId);
  if (list.length === 0) return null;
  return (
    [...list].sort(
      (a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? "") || (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    )[0] ?? null
  );
}

export function normalizeSubscriptionStatus(raw?: string | null): "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING" | "CANCELLED" {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "ACTIVE" || v === "ACTIVATED") return "ACTIVE";
  if (v === "EXPIRED") return "EXPIRED";
  if (v === "SUSPENDED" || v === "SUSPEND") return "SUSPENDED";
  if (v === "CANCELLED" || v === "CANCELED" || v === "CANCEL") return "CANCELLED";
  return "PENDING";
}

/** Effective status: a time-expired ACTIVE subscription reads as EXPIRED. */
export function effectiveCoachStatus(sub: CoachSubscription | null, todayISO: string): "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING" | "CANCELLED" | "NONE" {
  if (!sub) return "NONE";
  const s = normalizeSubscriptionStatus(sub.status);
  if (s === "ACTIVE" && sub.endDate && sub.endDate < todayISO) return "EXPIRED";
  return s;
}

/* ---------------- counts & limits ---------------- */

export function getCoachClientCount(clients: Client[], coachId: string): number {
  return clients.filter((c) => c.coachId === coachId).length;
}

/** Resolve the client limit for a coach: number, or null for unlimited. Unknown plan → STARTER default (safe). */
export function getCoachClientLimit(
  plans: CoachPlanConfig[] | undefined,
  subscription: CoachSubscription | null,
): number | null {
  if (!subscription) return getPlanById(plans, "STARTER").maxClients;
  const cfg = getCoachPlanConfig(plans, subscription.planName);
  if (!cfg) return getPlanById(plans, "STARTER").maxClients;
  return cfg.maxClients;
}

/** Resolve the effective plan config for a coach (fallback STARTER when unknown). */
export function getCoachPlan(
  plans: CoachPlanConfig[] | undefined,
  subscription: CoachSubscription | null,
): CoachPlanConfig {
  if (!subscription) return getPlanById(plans, "STARTER");
  return getCoachPlanConfig(plans, subscription.planName) ?? getPlanById(plans, "STARTER");
}

export interface CanAddClientResult {
  allowed: boolean;
  count: number;
  limit: number | null;
  plan: CoachPlanConfig;
  subscription: CoachSubscription | null;
  reason?: "LIMIT_REACHED" | "SUSPENDED" | "NO_SUBSCRIPTION";
}

/** Pure limit check shared by Dashboard, Pricing page, client creation and Owner views. */
export function canAddClient(
  state: Pick<AppState, "clients">,
  plans: CoachPlanConfig[] | undefined,
  subscriptions: CoachSubscription[] | undefined,
  coachId: string,
): CanAddClientResult {
  const subscription = subscriptions ? resolveCoachSubscription(subscriptions, coachId) : null;
  const plan = getCoachPlan(plans, subscription);
  const count = getCoachClientCount(state.clients, coachId);
  const limit = plan.maxClients;
  const status = subscription ? normalizeSubscriptionStatus(subscription.status) : null;
  if (status === "SUSPENDED") {
    return { allowed: false, count, limit, plan, subscription, reason: "SUSPENDED" };
  }
  if (limit !== null && count >= limit) {
    return { allowed: false, count, limit, plan, subscription, reason: "LIMIT_REACHED" };
  }
  return { allowed: true, count, limit, plan, subscription };
}

/* ---------------- plan changes ---------------- */

export interface PlanChangeValidation {
  ok: boolean;
  message?: string;
  currentCount?: number;
  targetLimit?: number | null;
}

/** Validate an upgrade/downgrade. Downgrades below the current client count are rejected. */
export function validatePlanChange(
  currentPlanName: string | null | undefined,
  targetPlanId: CoachPlan,
  clientCount: number,
  plans?: CoachPlanConfig[] | undefined,
): PlanChangeValidation {
  const target = getPlanById(plans, targetPlanId);
  const targetLimit = target.maxClients;
  if (targetLimit !== null && clientCount > targetLimit) {
    const current = currentPlanName ?? "current";
    void current;
    return {
      ok: false,
      currentCount: clientCount,
      targetLimit,
      message: `You currently have ${clientCount} clients.\nThe ${target.name} plan supports up to ${targetLimit} clients.\nYou cannot downgrade until your client count is within the plan limit.`,
    };
  }
  return { ok: true, currentCount: clientCount, targetLimit };
}

/* ---------------- errors & messages ---------------- */

/** Structured error thrown when the client limit blocks creation (both backends use this shape). */
export class PlanLimitError extends Error {
  count: number;
  limit: number;
  plan: CoachPlanConfig;
  code = "PLAN_LIMIT_REACHED" as const;
  constructor(count: number, limit: number, plan: CoachPlanConfig) {
    super(
      `You've reached the ${limit}-client limit of your ${plan.name} plan.\n\nUpgrade your plan to add more clients.`,
    );
    this.name = "PlanLimitError";
    this.count = count;
    this.limit = limit;
    this.plan = plan;
  }
}

export function isPlanLimitError(e: unknown): e is PlanLimitError {
  return e instanceof PlanLimitError || (e instanceof Error && (e as { code?: string }).code === "PLAN_LIMIT_REACHED");
}

/** Reconstruct a PlanLimitError from a backend message string (Supabase trigger / edge function). */
export function parsePlanLimitError(message: string, plans?: CoachPlanConfig[]): PlanLimitError | null {
  if (!/client limit|PLAN_LIMIT_REACHED|maximum.*clients/i.test(message)) return null;
  const m = message.match(/(\d+)\s*[-/]?\s*client/i) ?? message.match(/limit.*?(\d+)/i);
  const mCount = message.match(/(\d+)\s*\/\s*(\d+)/);
  if (mCount) {
    const count = Number(mCount[1]);
    const limit = Number(mCount[2]);
    const plan = (plans ?? DEFAULT_COACH_PLANS).find((p) => p.maxClients === limit) ?? DEFAULT_COACH_PLANS[0];
    return new PlanLimitError(count, limit, plan);
  }
  if (m) {
    const limit = Number(m[1]);
    const plan = (plans ?? DEFAULT_COACH_PLANS).find((p) => p.maxClients === limit) ?? DEFAULT_COACH_PLANS[0];
    return new PlanLimitError(limit, limit, plan);
  }
  return new PlanLimitError(0, 0, DEFAULT_COACH_PLANS[0]);
}

/* ---------------- formatting ---------------- */

export const formatEGP = (n: number): string => `${n.toLocaleString("en-US")} EGP`;

export function planRenewalLabel(endDate?: string | null): string {
  if (!endDate) return "—";
  try {
    return fmtDate(endDate);
  } catch {
    return endDate;
  }
}

export function clientUsageLabel(count: number, limit: number | null): string {
  return limit === null ? `${count}` : `${count} / ${limit}`;
}
