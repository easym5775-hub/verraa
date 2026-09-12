/* VERRAA — unit tests for the pure business logic in logic.ts.
   Everything here is computed from stored records; these tests lock
   the money/attendance/subscription math so refactors can't silently
   break what coaches get paid and what clients see. */

import { describe, expect, it } from "vitest";
import type {
  AppState,
  CheckIn,
  Client,
  Payment,
  Session,
  Subscription,
} from "./types";
import { addDays, todayISO } from "./lib";
import {
  actionLists,
  attendance,
  currentSubscription,
  followUpInfo,
  forecastRevenue,
  latestCheckIn,
  outstandingAmount,
  paidForSubscription,
  progressOf,
  remainingLabel,
  sortCheckIns,
  sortSessions,
  subHistory,
  subscriptionDaysLeft,
  subscriptionState,
  totalPaid,
} from "./logic";

/* ---------------- factories ---------------- */

let n = 0;
const id = (p: string) => `${p}-${++n}`;

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: id("sub"),
    coachId: "coach-1",
    clientId: "client-1",
    planName: "Monthly",
    startDate: todayISO(),
    endDate: addDays(todayISO(), 30),
    price: 1000,
    paymentStatus: "Pending",
    createdAt: 1,
    ...over,
  };
}

function pay(over: Partial<Payment> = {}): Payment {
  return {
    id: id("pay"),
    coachId: "coach-1",
    clientId: "client-1",
    subscriptionId: "sub-1",
    amount: 100,
    date: todayISO(),
    method: "Cash",
    status: "Paid",
    notes: "",
    ...over,
  };
}

function sess(over: Partial<Session> = {}): Session {
  return {
    id: id("ses"),
    coachId: "coach-1",
    clientId: "client-1",
    date: todayISO(),
    time: "10:00",
    type: "PT",
    status: "Scheduled",
    notes: "",
    ...over,
  };
}

function checkIn(over: Partial<CheckIn> = {}): CheckIn {
  return {
    id: id("ci"),
    coachId: "coach-1",
    clientId: "client-1",
    date: todayISO(),
    ts: n,
    weight: 80,
    mood: 4,
    water: 2,
    workoutDone: true,
    ...over,
  };
}

function client(over: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    coachId: "coach-1",
    username: "ali",
    hasLogin: true,
    priority: "Normal",
    name: "Ali",
    email: "",
    phone: "",
    goal: "Lose weight",
    startDate: todayISO(),
    status: "Active",
    notes: "",
    coachNotes: [],
    ...over,
  };
}

function appState(over: Partial<AppState> = {}): AppState {
  return {
    clients: [],
    exercises: [],
    plans: [],
    checkIns: [],
    meals: [],
    subscriptions: [],
    payments: [],
    sessions: [],
    messages: [],
    notifications: [],
    clientExercises: [],
    workoutTemplates: [],
    workoutSessions: [],
    workoutEntries: [],
    mealRequests: [],
    dietCheckins: [],
    progressPhotos: [],
    todos: [],
    ...over,
  };
}

/* ---------------- subscriptions ---------------- */

describe("currentSubscription", () => {
  it("returns null when there are no subscriptions", () => {
    expect(currentSubscription([])).toBeNull();
  });

  it("picks the subscription ending latest", () => {
    const a = sub({ id: "a", endDate: addDays(todayISO(), 10), createdAt: 5 });
    const b = sub({ id: "b", endDate: addDays(todayISO(), 30), createdAt: 1 });
    expect(currentSubscription([a, b])?.id).toBe("b");
  });

  it("breaks end-date ties by newest createdAt", () => {
    const end = addDays(todayISO(), 10);
    const old = sub({ id: "old", endDate: end, createdAt: 1 });
    const neu = sub({ id: "new", endDate: end, createdAt: 9 });
    expect(currentSubscription([old, neu])?.id).toBe("new");
  });
});

describe("subscriptionState", () => {
  it("reports No Subscription for null", () => {
    expect(subscriptionState(null)).toEqual({ sub: null, state: "No Subscription", daysLeft: 0 });
  });

  it("is Active when more than 7 days remain", () => {
    const s = sub({ endDate: addDays(todayISO(), 30) });
    const r = subscriptionState(s);
    expect(r.state).toBe("Active");
    expect(r.daysLeft).toBe(30);
  });

  it("is Expiring Soon at the 7-day boundary, Active at 8", () => {
    expect(subscriptionState(sub({ endDate: addDays(todayISO(), 7) })).state).toBe("Expiring Soon");
    expect(subscriptionState(sub({ endDate: addDays(todayISO(), 8) })).state).toBe("Active");
    expect(subscriptionState(sub({ endDate: todayISO() })).state).toBe("Expiring Soon");
  });

  it("is Expired the day after the end date", () => {
    const r = subscriptionState(sub({ endDate: addDays(todayISO(), -1) }));
    expect(r.state).toBe("Expired");
    expect(r.daysLeft).toBe(-1);
  });

  it("subscriptionDaysLeft counts whole days", () => {
    expect(subscriptionDaysLeft(sub({ endDate: todayISO() }))).toBe(0);
  });
});

describe("remainingLabel", () => {
  it("handles expired singular/plural", () => {
    expect(remainingLabel(-1)).toBe("Expired 1 day ago");
    expect(remainingLabel(-5)).toBe("Expired 5 days ago");
  });

  it("handles today / tomorrow / many days", () => {
    expect(remainingLabel(0)).toBe("Expires today");
    expect(remainingLabel(1)).toBe("1 day remaining");
    expect(remainingLabel(12)).toBe("12 days remaining");
  });
});

describe("subHistory", () => {
  it("sorts newest-ending first", () => {
    const a = sub({ id: "a", endDate: addDays(todayISO(), 5), createdAt: 1 });
    const b = sub({ id: "b", endDate: addDays(todayISO(), 40), createdAt: 1 });
    expect(subHistory([a, b]).map((s) => s.id)).toEqual(["b", "a"]);
  });
});

/* ---------------- payments ---------------- */

describe("totalPaid / paidForSubscription / outstandingAmount", () => {
  it("totalPaid ignores non-Paid payments", () => {
    const ps = [
      pay({ amount: 500, status: "Paid" }),
      pay({ amount: 200, status: "Pending" }),
      pay({ amount: 50, status: "Pending" }),
    ];
    expect(totalPaid(ps)).toBe(500);
  });

  it("paidForSubscription matches subscription + Paid only", () => {
    const ps = [
      pay({ subscriptionId: "s1", amount: 300, status: "Paid" }),
      pay({ subscriptionId: "s1", amount: 999, status: "Pending" }),
      pay({ subscriptionId: "s2", amount: 700, status: "Paid" }),
    ];
    expect(paidForSubscription(ps, "s1")).toBe(300);
  });

  it("outstandingAmount is 0 without a subscription", () => {
    expect(outstandingAmount(null, [pay({ amount: 100 })])).toBe(0);
  });

  it("outstandingAmount subtracts partial payments", () => {
    const s = sub({ id: "s1", price: 1000 });
    const ps = [pay({ subscriptionId: "s1", amount: 400 }), pay({ subscriptionId: "s1", amount: 100 })];
    expect(outstandingAmount(s, ps)).toBe(500);
  });

  it("outstandingAmount never goes negative on overpayment", () => {
    const s = sub({ id: "s1", price: 1000 });
    expect(outstandingAmount(s, [pay({ subscriptionId: "s1", amount: 1500 })])).toBe(0);
  });

  it("outstandingAmount ignores payments for other subscriptions", () => {
    const s = sub({ id: "s1", price: 1000 });
    expect(outstandingAmount(s, [pay({ subscriptionId: "other", amount: 1000 })])).toBe(1000);
  });
});

/* ---------------- sessions & attendance ---------------- */

describe("attendance", () => {
  it("is zeroed when there are no countable sessions", () => {
    expect(attendance([])).toEqual({ completed: 0, countable: 0, pct: 0 });
    expect(attendance([sess({ status: "Cancelled" })]).countable).toBe(0);
  });

  it("excludes Cancelled sessions from the rate", () => {
    const list = [
      sess({ status: "Completed" }),
      sess({ status: "Completed" }),
      sess({ status: "Missed" }),
      sess({ status: "Cancelled" }),
    ];
    expect(attendance(list)).toEqual({ completed: 2, countable: 3, pct: 67 });
  });

  it("rounds the percentage", () => {
    const list = [sess({ status: "Completed" }), sess({ status: "Scheduled" }), sess({ status: "Scheduled" })];
    expect(attendance(list).pct).toBe(33);
  });
});

describe("sortSessions", () => {
  it("orders by date then time", () => {
    const b = sess({ id: "b", date: addDays(todayISO(), 1), time: "09:00" });
    const a = sess({ id: "a", date: todayISO(), time: "18:00" });
    expect(sortSessions([b, a]).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

/* ---------------- check-ins & progress ---------------- */

describe("sortCheckIns / latestCheckIn", () => {
  it("orders newest first, ts breaks date ties", () => {
    const old = checkIn({ id: "old", date: addDays(todayISO(), -3), ts: 1 });
    const t1 = checkIn({ id: "t1", date: todayISO(), ts: 1 });
    const t2 = checkIn({ id: "t2", date: todayISO(), ts: 2 });
    expect(sortCheckIns([old, t1, t2]).map((c) => c.id)).toEqual(["t2", "t1", "old"]);
    expect(latestCheckIn([old, t1, t2])?.id).toBe("t2");
  });

  it("latestCheckIn is null for empty input", () => {
    expect(latestCheckIn([])).toBeNull();
  });
});

describe("progressOf", () => {
  it("returns nulls when there are no check-ins", () => {
    expect(progressOf([])).toEqual({
      startWeight: null,
      currentWeight: null,
      weightChange: null,
      startWaist: null,
      currentWaist: null,
      waistChange: null,
    });
  });

  it("reports no change for a single check-in", () => {
    const p = progressOf([checkIn({ weight: 80, waist: 90 })]);
    expect(p.startWeight).toBe(80);
    expect(p.currentWeight).toBe(80);
    expect(p.weightChange).toBeNull();
    expect(p.waistChange).toBeNull();
  });

  it("computes weight + waist deltas, rounded to 1 decimal", () => {
    const p = progressOf([
      checkIn({ date: addDays(todayISO(), -10), ts: 1, weight: 90, waist: 100 }),
      checkIn({ date: todayISO(), ts: 2, weight: 84.55, waist: 94.44 }),
    ]);
    expect(p.weightChange).toBeCloseTo(-5.5, 1);
    expect(p.waistChange).toBeCloseTo(-5.6, 1);
  });
});

/* ---------------- follow-ups ---------------- */

describe("followUpInfo", () => {
  it("reports no check-in yet without any basis", () => {
    const info = followUpInfo(client({}), []);
    expect(info.basis).toBeNull();
    expect(info.next).toBeNull();
    expect(info.overdue).toBe(false);
    expect(info.label).toBe("No check-in yet");
  });

  it("defaults to a 7-day frequency", () => {
    const info = followUpInfo(client({ lastFollowUp: todayISO() }), []);
    expect(info.frequency).toBe(7);
    expect(info.next).toBe(addDays(todayISO(), 7));
  });

  it("uses the latest of lastFollowUp vs last check-in", () => {
    const info = followUpInfo(client({ lastFollowUp: addDays(todayISO(), -10), followUpDays: 7 }), [
      checkIn({ date: addDays(todayISO(), -2) }),
    ]);
    expect(info.basis).toBe(addDays(todayISO(), -2));
    expect(info.label).toBe("In 5 days");
    expect(info.overdue).toBe(false);
  });

  it("flags overdue / due-today / due-tomorrow labels", () => {
    expect(
      followUpInfo(client({ lastFollowUp: addDays(todayISO(), -10), followUpDays: 7 }), []).label,
    ).toBe("Overdue 3 days");
    expect(
      followUpInfo(client({ lastFollowUp: addDays(todayISO(), -7), followUpDays: 7 }), []).label,
    ).toBe("Due today");
    expect(
      followUpInfo(client({ lastFollowUp: addDays(todayISO(), -6), followUpDays: 7 }), []).label,
    ).toBe("Due tomorrow");
  });
});

/* ---------------- dashboard aggregates ---------------- */

describe("actionLists", () => {
  it("skips inactive clients entirely", () => {
    const s = appState({
      clients: [client({ id: "c1", status: "Paused", lastFollowUp: addDays(todayISO(), -30) })],
      subscriptions: [sub({ clientId: "c1", endDate: addDays(todayISO(), -5) })],
    });
    const out = actionLists(s);
    expect(out.expired).toHaveLength(0);
    expect(out.overdueFollowUps).toHaveLength(0);
  });

  it("collects today sessions, expiring + expired subs, overdue follow-ups", () => {
    const c1 = client({ id: "c1", lastFollowUp: addDays(todayISO(), -30), followUpDays: 7 });
    const c2 = client({ id: "c2", lastFollowUp: todayISO(), followUpDays: 7 });
    const s = appState({
      clients: [c1, c2],
      sessions: [
        sess({ id: "t1", clientId: "c1", date: todayISO(), time: "09:00", status: "Scheduled" }),
        sess({ id: "past", clientId: "c1", date: addDays(todayISO(), -1), time: "09:00", status: "Scheduled" }),
      ],
      subscriptions: [
        sub({ id: "e1", clientId: "c1", endDate: addDays(todayISO(), -2) }),
        sub({ id: "s2", clientId: "c2", endDate: addDays(todayISO(), 3) }),
      ],
    });
    const out = actionLists(s);
    expect(out.todaySessions.map((t) => t.session.id)).toEqual(["t1"]);
    expect(out.expired.map((e) => e.client.id)).toEqual(["c1"]);
    expect(out.expiringSoon.map((e) => e.client.id)).toEqual(["c2"]);
    expect(out.overdueFollowUps.map((o) => o.client.id)).toContain("c1");
  });

  it("marks clients with no check-ins as stale", () => {
    const s = appState({ clients: [client({ id: "c9" })] });
    expect(actionLists(s).staleCheckIns.map((c) => c.id)).toEqual(["c9"]);
  });
});

/* ---------------- revenue forecast ---------------- */

describe("forecastRevenue", () => {
  const TODAY = "2026-09-08"; // a pinned "today" keeps month math deterministic

  it("derives the next month key/label, rolling over December", () => {
    expect(forecastRevenue(appState(), TODAY).nextMonthKey).toBe("2026-10");
    expect(forecastRevenue(appState(), TODAY).nextMonthLabel).toMatch(/oct.*2026/i);
    expect(forecastRevenue(appState(), "2026-12-15").nextMonthKey).toBe("2027-01");
  });

  it("counts renewals ending next month at full price", () => {
    const s = appState({
      clients: [client({ id: "c1" }), client({ id: "c2" })],
      subscriptions: [
        sub({ id: "s1", clientId: "c1", endDate: "2026-10-05", price: 1000 }),
        sub({ id: "s2", clientId: "c2", endDate: "2026-10-31", price: 500 }),
      ],
    });
    const f = forecastRevenue(s, TODAY);
    expect(f.renewalsDue).toBe(2);
    expect(f.renewalValue).toBe(1500);
    expect(f.projected).toBe(1500);
  });

  it("ignores subs ending this month or later — and expired ones", () => {
    const s = appState({
      clients: [client({ id: "c1" }), client({ id: "c2" }), client({ id: "c3" })],
      subscriptions: [
        sub({ id: "s1", clientId: "c1", endDate: "2026-09-20", price: 1000 }),
        sub({ id: "s2", clientId: "c2", endDate: "2026-12-01", price: 2000 }),
        sub({ id: "s3", clientId: "c3", endDate: "2026-09-01", price: 3000 }),
      ],
    });
    const f = forecastRevenue(s, TODAY);
    expect(f.renewalsDue).toBe(0);
    expect(f.renewalValue).toBe(0);
  });

  it("excludes inactive clients and clients without a subscription", () => {
    const s = appState({
      clients: [client({ id: "c1", status: "Paused" }), client({ id: "c2" })],
      subscriptions: [sub({ id: "s1", clientId: "c1", endDate: "2026-10-05", price: 1000 })],
    });
    expect(forecastRevenue(s, TODAY).renewalsDue).toBe(0);
  });

  it("uses the current (latest-ending) subscription per client", () => {
    const s = appState({
      clients: [client({ id: "c1" })],
      subscriptions: [
        sub({ id: "old", clientId: "c1", endDate: "2026-09-20", price: 100, createdAt: 1 }),
        sub({ id: "cur", clientId: "c1", endDate: "2026-10-05", price: 900, createdAt: 2 }),
      ],
    });
    const f = forecastRevenue(s, TODAY);
    expect(f.renewalsDue).toBe(1);
    expect(f.renewalValue).toBe(900);
  });

  it("adds prepayments already recorded for next month (Paid only)", () => {
    const s = appState({
      clients: [client({ id: "c1" })],
      subscriptions: [sub({ id: "s1", clientId: "c1", endDate: "2026-12-01", price: 1000 })],
      payments: [
        pay({ subscriptionId: "s1", amount: 400, status: "Paid", date: "2026-10-02" }),
        pay({ subscriptionId: "s1", amount: 999, status: "Pending", date: "2026-10-03" }),
        pay({ subscriptionId: "s1", amount: 700, status: "Paid", date: "2026-09-10" }),
      ],
    });
    const f = forecastRevenue(s, TODAY);
    expect(f.prepaid).toBe(400);
    expect(f.projected).toBe(400);
  });

  it("tracks the 30-day renewal pipeline with inclusive bounds", () => {
    const s = appState({
      clients: [client({ id: "c1" }), client({ id: "c2" }), client({ id: "c3" }), client({ id: "c4" })],
      subscriptions: [
        sub({ id: "s1", clientId: "c1", endDate: "2026-09-08", price: 100 }), // today — in
        sub({ id: "s2", clientId: "c2", endDate: "2026-10-08", price: 200 }), // +30 — in
        sub({ id: "s3", clientId: "c3", endDate: "2026-10-09", price: 400 }), // +31 — out
        sub({ id: "s4", clientId: "c4", endDate: "2026-09-07", price: 800 }), // expired — out
      ],
    });
    const f = forecastRevenue(s, TODAY);
    expect(f.endingSoon).toBe(2);
    expect(f.endingSoonValue).toBe(300);
  });
});
