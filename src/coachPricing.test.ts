/* VERRAA — unit tests for coachPricing.ts */

import { describe, expect, it } from "vitest";
import {
  normalizeCoachPlanId,
  getCoachPlanConfig,
  getPlanById,
  resolveCoachSubscription,
  normalizeSubscriptionStatus,
  effectiveCoachStatus,
  getCoachClientCount,
  getCoachClientLimit,
  getCoachPlan,
  canAddClient,
  validatePlanChange,
  isPlanLimitError,
  parsePlanLimitError,
  formatEGP,
  planRenewalLabel,
  clientUsageLabel,
  DEFAULT_COACH_PLANS,
  PlanLimitError,
} from "./coachPricing";
import type { Client, CoachSubscription } from "./types";
import { todayISO, addDays } from "./lib";

function makeSub(over: Record<string, unknown> = {}): CoachSubscription {
  return {
    id: "s1",
    coachId: "coach-1",
    planName: "FREE",
    status: "ACTIVE",
    startDate: todayISO(),
    endDate: addDays(todayISO(), 30),
    price: 0,
    autoRenew: false,
    createdAt: todayISO(),
    updatedAt: todayISO(),
    ...over,
  } as CoachSubscription;
}

describe("normalizeCoachPlanId", () => {
  it("normalizes canonical plan names", () => {
    expect(normalizeCoachPlanId("FREE")).toBe("FREE");
    expect(normalizeCoachPlanId("STARTER")).toBe("STARTER");
    expect(normalizeCoachPlanId("PROFESSIONAL")).toBe("PROFESSIONAL");
    expect(normalizeCoachPlanId("ENTERPRISE")).toBe("ENTERPRISE");
  });
  it("normalizes aliases", () => {
    expect(normalizeCoachPlanId("trial")).toBe("FREE");
    expect(normalizeCoachPlanId("start")).toBe("STARTER");
    expect(normalizeCoachPlanId("pro")).toBe("PROFESSIONAL");
    expect(normalizeCoachPlanId("business")).toBe("ENTERPRISE");
  });
  it("returns null for unknown", () => {
    expect(normalizeCoachPlanId("UNKNOWN")).toBeNull();
    expect(normalizeCoachPlanId("")).toBeNull();
    expect(normalizeCoachPlanId(null)).toBeNull();
  });
});

describe("getCoachPlanConfig", () => {
  it("finds a plan by name", () => {
    const result = getCoachPlanConfig(DEFAULT_COACH_PLANS, "STARTER");
    expect(result?.id).toBe("STARTER");
    expect(result?.price).toBe(1999);
  });
  it("returns null for unknown plan", () => {
    expect(getCoachPlanConfig(DEFAULT_COACH_PLANS, "UNKNOWN")).toBeNull();
  });
  it("falls back to defaults when empty list", () => {
    const result = getCoachPlanConfig([], "STARTER");
    expect(result?.id).toBe("STARTER");
  });
});

describe("getPlanById", () => {
  it("finds a plan by id", () => {
    expect(getPlanById(DEFAULT_COACH_PLANS, "ENTERPRISE").name).toBe("Enterprise");
  });
  it("falls back to defaults", () => {
    expect(getPlanById([], "FREE").id).toBe("FREE");
  });
});

describe("resolveCoachSubscription", () => {
  it("returns null for empty list", () => {
    expect(resolveCoachSubscription([], "coach-1")).toBeNull();
  });
  it("picks the subscription ending latest", () => {
    const subs = [
      makeSub({ id: "a", endDate: addDays(todayISO(), 10) }),
      makeSub({ id: "b", endDate: addDays(todayISO(), 30) }),
    ];
    expect(resolveCoachSubscription(subs, "coach-1")?.id).toBe("b");
  });
  it("returns null for other coach", () => {
    const subs = [makeSub({ id: "s1", coachId: "other" })];
    expect(resolveCoachSubscription(subs, "coach-1")).toBeNull();
  });
});

describe("normalizeSubscriptionStatus", () => {
  it("normalizes various statuses", () => {
    expect(normalizeSubscriptionStatus("ACTIVE")).toBe("ACTIVE");
    expect(normalizeSubscriptionStatus("activated")).toBe("ACTIVE");
    expect(normalizeSubscriptionStatus("EXPIRED")).toBe("EXPIRED");
    expect(normalizeSubscriptionStatus("suspended")).toBe("SUSPENDED");
    expect(normalizeSubscriptionStatus("cancelled")).toBe("CANCELLED");
    expect(normalizeSubscriptionStatus("pending")).toBe("PENDING");
  });
  it("defaults to PENDING", () => {
    expect(normalizeSubscriptionStatus("")).toBe("PENDING");
    expect(normalizeSubscriptionStatus(null)).toBe("PENDING");
    expect(normalizeSubscriptionStatus("UNKNOWN")).toBe("PENDING");
  });
});

describe("effectiveCoachStatus", () => {
  it("returns NONE for null sub", () => {
    expect(effectiveCoachStatus(null, todayISO())).toBe("NONE");
  });
  it("returns ACTIVE for active non-expired", () => {
    const sub = makeSub({ endDate: addDays(todayISO(), 30) });
    expect(effectiveCoachStatus(sub, todayISO())).toBe("ACTIVE");
  });
  it("returns EXPIRED for time-expired ACTIVE", () => {
    const sub = makeSub({ endDate: addDays(todayISO(), -1) });
    expect(effectiveCoachStatus(sub, todayISO())).toBe("EXPIRED");
  });
});

describe("getCoachClientCount", () => {
  it("counts clients for a coach", () => {
    const clients: Client[] = [
      { id: "c1", coachId: "coach-1", username: "a", hasLogin: true, priority: "Normal", name: "A", email: "", phone: "", goal: "Lose weight", startDate: todayISO(), status: "Active", notes: "", coachNotes: [] },
      { id: "c2", coachId: "coach-1", username: "b", hasLogin: true, priority: "Normal", name: "B", email: "", phone: "", goal: "Build muscle", startDate: todayISO(), status: "Active", notes: "", coachNotes: [] },
      { id: "c3", coachId: "coach-2", username: "c", hasLogin: true, priority: "Normal", name: "C", email: "", phone: "", goal: "General fitness", startDate: todayISO(), status: "Active", notes: "", coachNotes: [] },
    ];
    expect(getCoachClientCount(clients, "coach-1")).toBe(2);
    expect(getCoachClientCount(clients, "coach-2")).toBe(1);
    expect(getCoachClientCount(clients, "coach-3")).toBe(0);
  });
});

describe("getCoachClientLimit", () => {
  it("returns null for unlimited (Enterprise)", () => {
    const sub = makeSub({ planName: "ENTERPRISE" });
    expect(getCoachClientLimit(DEFAULT_COACH_PLANS, sub)).toBeNull();
  });
  it("returns the plan limit", () => {
    const sub = makeSub({ planName: "STARTER" });
    expect(getCoachClientLimit(DEFAULT_COACH_PLANS, sub)).toBe(20);
  });
});

describe("getCoachPlan", () => {
  it("returns the plan from subscription", () => {
    const sub = makeSub({ planName: "PROFESSIONAL" });
    expect(getCoachPlan(DEFAULT_COACH_PLANS, sub).id).toBe("PROFESSIONAL");
  });
  it("returns STARTER when no subscription", () => {
    expect(getCoachPlan(DEFAULT_COACH_PLANS, null).id).toBe("STARTER");
  });
});

describe("canAddClient", () => {
  it("returns allowed when under limit", () => {
    const clients: Client[] = [{ id: "c1", coachId: "coach-1", username: "a", hasLogin: true, priority: "Normal", name: "A", email: "", phone: "", goal: "Lose weight", startDate: todayISO(), status: "Active", notes: "", coachNotes: [] }];
    const sub = makeSub({ planName: "STARTER" });
    const result = canAddClient({ clients }, DEFAULT_COACH_PLANS, [sub], "coach-1");
    expect(result.allowed).toBe(true);
  });
  it("returns not allowed when at limit", () => {
    const clients: Client[] = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`, coachId: "coach-1", username: `u${i}`, hasLogin: true, priority: "Normal" as const, name: `User ${i}`, email: "", phone: "", goal: "Lose weight", startDate: todayISO(), status: "Active" as const, notes: "", coachNotes: [],
    }));
    const sub = makeSub({ planName: "STARTER" });
    const result = canAddClient({ clients }, DEFAULT_COACH_PLANS, [sub], "coach-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("LIMIT_REACHED");
  });
  it("returns not allowed when suspended", () => {
    const sub = makeSub({ planName: "STARTER", status: "SUSPENDED" });
    const result = canAddClient({ clients: [] }, DEFAULT_COACH_PLANS, [sub], "coach-1");
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("SUSPENDED");
  });
});

describe("validatePlanChange", () => {
  it("allows downgrade when clients under target limit", () => {
    const result = validatePlanChange("PROFESSIONAL", "STARTER", 5, DEFAULT_COACH_PLANS);
    expect(result.ok).toBe(true);
  });
  it("blocks downgrade when clients exceed target limit", () => {
    const result = validatePlanChange("PROFESSIONAL", "FREE", 15, DEFAULT_COACH_PLANS);
    expect(result.ok).toBe(false);
  });
  it("allows upgrade", () => {
    const result = validatePlanChange("FREE", "ENTERPRISE", 100, DEFAULT_COACH_PLANS);
    expect(result.ok).toBe(true);
  });
});

describe("isPlanLimitError", () => {
  it("returns true for PlanLimitError", () => {
    const err = new PlanLimitError(5, 20, DEFAULT_COACH_PLANS[1]);
    expect(isPlanLimitError(err)).toBe(true);
  });
  it("returns true for error with code PLAN_LIMIT_REACHED", () => {
    const err = new Error("test") as Error & { code?: string };
    err.code = "PLAN_LIMIT_REACHED";
    expect(isPlanLimitError(err)).toBe(true);
  });
  it("returns false for regular errors", () => {
    expect(isPlanLimitError(new Error("other"))).toBe(false);
  });
});

describe("parsePlanLimitError", () => {
  it("parses limit error messages", () => {
    const msg = "You've reached the 20-client limit of your Starter plan.";
    const result = parsePlanLimitError(msg, DEFAULT_COACH_PLANS);
    expect(result).not.toBeNull();
    if (result) expect(result.limit).toBe(20);
  });
  it("returns null for non-limit messages", () => {
    expect(parsePlanLimitError("something else", DEFAULT_COACH_PLANS)).toBeNull();
  });
});

describe("formatEGP", () => {
  it("formats with EGP suffix", () => {
    expect(formatEGP(1999)).toBe("1,999 EGP");
  });
});

describe("planRenewalLabel", () => {
  it("returns formatted date", () => {
    expect(planRenewalLabel("2026-12-25")).toBe("25 Dec 2026");
  });
  it("returns dash for null", () => {
    expect(planRenewalLabel(null)).toBe("—");
  });
});

describe("clientUsageLabel", () => {
  it("shows count for unlimited", () => {
    expect(clientUsageLabel(5, null)).toBe("5");
  });
  it("shows count/limit for limited plans", () => {
    expect(clientUsageLabel(5, 20)).toBe("5 / 20");
  });
});