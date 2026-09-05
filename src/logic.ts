/* ================================================================
   FORGE — pure derived business logic. Everything here is computed
   from stored records — never persisted as editable values.
   ================================================================ */

import type { AppState, CheckIn, Client, Payment, Session, SubState, Subscription } from "./types";
import { addDays, diffDays, todayISO } from "./lib";

/* ---------------- subscriptions ---------------- */

export interface SubWithState {
  sub: Subscription | null;
  state: SubState;
  daysLeft: number;
}

/** The current subscription = the one ending latest. */
export function currentSubscription(subs: Subscription[]): Subscription | null {
  if (subs.length === 0) return null;
  return [...subs].sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt - a.createdAt)[0];
}

export function subscriptionDaysLeft(sub: Subscription): number {
  return diffDays(todayISO(), sub.endDate);
}

export function subscriptionState(sub: Subscription | null): SubWithState {
  if (!sub) return { sub: null, state: "No Subscription", daysLeft: 0 };
  const daysLeft = subscriptionDaysLeft(sub);
  const state: SubState = daysLeft < 0 ? "Expired" : daysLeft <= 7 ? "Expiring Soon" : "Active";
  return { sub, state, daysLeft };
}

export function remainingLabel(daysLeft: number): string {
  if (daysLeft < 0) return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`;
  if (daysLeft === 0) return "Expires today";
  if (daysLeft === 1) return "1 day remaining";
  return `${daysLeft} days remaining`;
}

export function subHistory(subs: Subscription[]): Subscription[] {
  return [...subs].sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt - a.createdAt);
}

/* ---------------- payments ---------------- */

export function totalPaid(payments: Payment[]): number {
  return payments.filter((p) => p.status === "Paid").reduce((s, p) => s + p.amount, 0);
}

export function paidForSubscription(payments: Payment[], subscriptionId: string): number {
  return payments
    .filter((p) => p.subscriptionId === subscriptionId && p.status === "Paid")
    .reduce((s, p) => s + p.amount, 0);
}

export function outstandingAmount(sub: Subscription | null, payments: Payment[]): number {
  if (!sub) return 0;
  return Math.max(0, sub.price - paidForSubscription(payments, sub.id));
}

/* ---------------- sessions & attendance ---------------- */

/** Cancelled sessions never count against attendance. */
export function attendance(sessions: Session[]): { completed: number; countable: number; pct: number } {
  const countable = sessions.filter((s) => s.status !== "Cancelled");
  const completed = countable.filter((s) => s.status === "Completed");
  const pct = countable.length === 0 ? 0 : Math.round((completed.length / countable.length) * 100);
  return { completed: completed.length, countable: countable.length, pct };
}

export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/* ---------------- check-ins & progress ---------------- */

export function sortCheckIns(checkIns: CheckIn[]): CheckIn[] {
  return [...checkIns].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
}

export function latestCheckIn(checkIns: CheckIn[]): CheckIn | null {
  return sortCheckIns(checkIns)[0] ?? null;
}

export interface Progress {
  startWeight: number | null;
  currentWeight: number | null;
  weightChange: number | null;
  startWaist: number | null;
  currentWaist: number | null;
  waistChange: number | null;
}

export function progressOf(checkIns: CheckIn[]): Progress {
  const asc = [...checkIns].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
  const first = asc[0] ?? null;
  const last = asc[asc.length - 1] ?? null;
  const withWaist = asc.filter((c) => c.waist !== undefined);
  const fw = withWaist[0] ?? null;
  const lw = withWaist[withWaist.length - 1] ?? null;
  return {
    startWeight: first ? first.weight : null,
    currentWeight: last ? last.weight : null,
    weightChange: first && last && asc.length > 1 ? round(last.weight - first.weight) : null,
    startWaist: fw?.waist ?? null,
    currentWaist: lw?.waist ?? null,
    waistChange: fw && lw && withWaist.length > 1 ? round((lw.waist ?? 0) - (fw.waist ?? 0)) : null,
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/* ---------------- follow-ups ---------------- */

export interface FollowUpInfo {
  frequency: number;
  basis: string | null;
  next: string | null;
  daysToNext: number | null;
  label: string;
  overdue: boolean;
}

export function followUpInfo(client: Client, checkIns: CheckIn[]): FollowUpInfo {
  const frequency = client.followUpDays && client.followUpDays > 0 ? client.followUpDays : 7;
  const lastCi = latestCheckIn(checkIns);
  const basis = [client.lastFollowUp, lastCi?.date].filter((x): x is string => Boolean(x)).sort().pop() ?? null;
  if (!basis) {
    return { frequency, basis: null, next: null, daysToNext: null, label: "No check-in yet", overdue: false };
  }
  const next = addDays(basis, frequency);
  const daysToNext = diffDays(todayISO(), next);
  let label: string;
  if (daysToNext < 0) label = `Overdue ${Math.abs(daysToNext)} day${Math.abs(daysToNext) === 1 ? "" : "s"}`;
  else if (daysToNext === 0) label = "Due today";
  else if (daysToNext === 1) label = "Due tomorrow";
  else label = `In ${daysToNext} days`;
  return { frequency, basis, next, daysToNext, label, overdue: daysToNext < 0 };
}

/* ---------------- dashboard aggregates ---------------- */

export interface ActionLists {
  todaySessions: { client: Client; session: Session }[];
  followUpsDue: { client: Client; info: FollowUpInfo }[];
  overdueFollowUps: { client: Client; info: FollowUpInfo }[];
  expiringSoon: { client: Client; info: SubWithState }[];
  expired: { client: Client; info: SubWithState }[];
  staleCheckIns: Client[];
}

export function actionLists(state: AppState): ActionLists {
  const today = todayISO();
  const out: ActionLists = {
    todaySessions: [],
    followUpsDue: [],
    overdueFollowUps: [],
    expiringSoon: [],
    expired: [],
    staleCheckIns: [],
  };
  for (const client of state.clients) {
    if (client.status !== "Active") continue;
    const sessions = state.sessions.filter((s) => s.clientId === client.id);
    for (const session of sessions) {
      if (session.date === today && (session.status === "Scheduled" || session.status === "Confirmed")) {
        out.todaySessions.push({ client, session });
      }
    }
    const checkIns = state.checkIns.filter((c) => c.clientId === client.id);
    const fu = followUpInfo(client, checkIns);
    if (fu.daysToNext !== null) {
      if (fu.overdue) out.overdueFollowUps.push({ client, info: fu });
      else if (fu.daysToNext <= 1) out.followUpsDue.push({ client, info: fu });
    } else {
      out.staleCheckIns.push(client);
    }
    const info = subscriptionState(currentSubscription(state.subscriptions.filter((s) => s.clientId === client.id)));
    if (info.state === "Expiring Soon") out.expiringSoon.push({ client, info });
    if (info.state === "Expired") out.expired.push({ client, info });
    const last = latestCheckIn(checkIns);
    if (last && diffDays(last.date, today) > 7 && !out.staleCheckIns.includes(client)) {
      out.staleCheckIns.push(client);
    }
  }
  out.todaySessions.sort((a, b) => (a.session.date + a.session.time).localeCompare(b.session.date + b.session.time));
  out.overdueFollowUps.sort((a, b) => (a.info.daysToNext ?? 0) - (b.info.daysToNext ?? 0));
  return out;
}
