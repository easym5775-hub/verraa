/* ================================================================
   VERRAA — coach command center (action-oriented workspace).
   Priority: Needs Attention → Today's Schedule → Pending Work (KPIs)
   → Clients to Review → Business Health → Recent Activity → Plan Usage.
   Everything is computed from real store data; nothing is invented.
   ================================================================ */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Plus,
  Scale,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { CheckIn, Client, CoachView, Session } from "../types";
import { SESSION_STATUS_META, SUB_STATE_META, WEEK_DAYS } from "../types";
import {
  addDays,
  diffDays,
  fmtDate,
  fmtMoney,
  fmtShort,
  fmtTime,
  relTime,
  signed,
  todayISO,
} from "../lib";
import {
  actionLists,
  attendance,
  currentSubscription,
  followUpInfo,
  latestCheckIn,
  outstandingAmount,
  remainingLabel,
  subscriptionState,
} from "../logic";
import { useApp } from "../store";
import {
  effectiveCoachStatus,
  formatEGP,
  planRenewalLabel,
} from "../coachPricing";
import { Avatar, Badge, Skeleton, btnPrimary, btnSecondary, btnSm, useCountUp } from "./ui";
import { ClientFormModal, PaymentFormModal, SessionFormModal } from "./modals";

type Severity = "high" | "med" | "low";

interface AttentionItem {
  key: string;
  client: Client;
  severity: Severity;
  title: string;
  detail: string;
  meta: string;
  actionLabel: string;
  run: () => void;
  sort: number;
}

interface ReviewRow {
  client: Client;
  reason: string;
  reasonTone: Severity;
  status: string;
  lastActivity: string;
  actionLabel: string;
  run: () => void;
  sort: number;
}

const SEV_DOT: Record<Severity, string> = {
  high: "bg-danger-400",
  med: "bg-warn-400",
  low: "bg-mist-400",
};
const SEV_TEXT: Record<Severity, string> = {
  high: "text-danger-300",
  med: "text-warn-300",
  low: "text-mist-300",
};

export function Dashboard({
  go,
  openClientsWithFilter,
}: {
  go: (v: CoachView, id?: string) => void;
  openClientsWithFilter: (f: "Active" | "Expiring Soon" | "Expired") => void;
}) {
  const { state, setSessionStatus, myCoachPlan, myCoachSubscription, myClientCount, myClientLimit } = useApp();
  const [booting, setBooting] = useState(true);
  const [clientModal, setClientModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentClientId, setPaymentClientId] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  const today = todayISO();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const lists = useMemo(() => actionLists(state), [state]);
  const clientById = useMemo(() => new Map(state.clients.map((c) => [c.id, c])), [state.clients]);

  const activeClients = useMemo(() => state.clients.filter((c) => c.status === "Active"), [state.clients]);

  /* ----- pending check-ins: recent (7d) check-ins the coach hasn't followed up yet.
     There is no reviewed flag in the data model, so "pending" = submitted in the
     last 7 days AND the client's lastFollowUp predates the check-in (or is unset). */
  const pendingCheckIns = useMemo(() => {
    const cutoff = addDays(today, -7);
    return state.checkIns
      .filter((ci) => ci.date >= cutoff)
      .filter((ci) => {
        const c = clientById.get(ci.clientId);
        if (!c) return true;
        if (!c.lastFollowUp) return true;
        return c.lastFollowUp < ci.date;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  }, [state.checkIns, clientById, today]);

  const overduePendingCount = useMemo(
    () => pendingCheckIns.filter((ci) => diffDays(ci.date, today) >= 3).length,
    [pendingCheckIns, today],
  );

  const todaySessions = useMemo(
    () => state.sessions.filter((s) => s.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [state.sessions, today],
  );
  const openTodaySessions = useMemo(
    () => todaySessions.filter((s) => s.status === "Scheduled" || s.status === "Confirmed"),
    [todaySessions],
  );
  const nextSession = useMemo(() => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    return (
      openTodaySessions.find((s) => {
        const [h, m] = s.time.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0) >= nowMin;
      }) ?? openTodaySessions[0] ??
      null
    );
  }, [openTodaySessions]);

  /* ----- outstanding payments: subscription balances + standalone pending payments.
     Linked pending payments are NOT double-counted (paidForSubscription only counts Paid). */
  const outstanding = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const sub of state.subscriptions) {
      if (sub.paymentStatus === "Paid") continue;
      const out = outstandingAmount(sub, state.payments);
      if (out > 0) {
        total += out;
        count += 1;
      }
    }
    const unlinked = state.payments.filter((p) => p.status === "Pending" && !p.subscriptionId);
    for (const p of unlinked) {
      total += p.amount;
      count += 1;
    }
    return { total, count };
  }, [state.subscriptions, state.payments]);

  const monthKey = today.slice(0, 7);
  const prevKey = addDays(today.slice(0, 8) + "01", -1).slice(0, 7);
  const paidIn = (key: string) =>
    state.payments.filter((p) => p.status === "Paid" && p.date.slice(0, 7) === key).reduce((s, p) => s + p.amount, 0);
  const revenueMonth = paidIn(monthKey);
  const revenuePrev = paidIn(prevKey);

  const openRecordPayment = (clientId: string | null) => {
    setPaymentClientId(clientId);
    setPaymentModal(true);
  };

  /* ----- needs attention (actionable only, sorted by urgency) ----- */
  const alerts = useMemo<AttentionItem[]>(() => {
    const out: AttentionItem[] = [];
    const covered = new Set<string>(); // client ids already carrying a high-severity card

    for (const { client, info } of lists.expired) {
      out.push({
        key: `exp-${client.id}`,
        client,
        severity: "high",
        title: "Subscription expired",
        detail: remainingLabel(info.daysLeft),
        meta: "Overdue",
        actionLabel: "Renew",
        run: () => go("client", client.id),
        sort: 0,
      });
      covered.add(client.id);
    }
    for (const { client, info } of lists.overdueFollowUps) {
      const d = Math.abs(info.daysToNext ?? 0);
      out.push({
        key: `fu-${client.id}`,
        client,
        severity: "high",
        title: "Check-in overdue",
        detail: `${d} day${d === 1 ? "" : "s"} since last contact`,
        meta: d <= 1 ? "Due now" : `${d}d overdue`,
        actionLabel: "Review",
        run: () => go("checkins"),
        sort: 1,
      });
      covered.add(client.id);
    }
    for (const s of state.sessions) {
      if (s.date === today && s.status === "Missed") {
        const client = clientById.get(s.clientId);
        if (client) {
          out.push({
            key: `miss-${s.id}`,
            client,
            severity: "high",
            title: "Missed session",
            detail: `${fmtTime(s.time)} · ${s.type}`,
            meta: "Today",
            actionLabel: "Open",
            run: () => go("client", client.id),
            sort: 2,
          });
        }
      }
    }
    // Check-ins waiting for review (one card per client, newest first)
    const seenCheckin = new Set<string>();
    for (const ci of pendingCheckIns) {
      if (seenCheckin.has(ci.clientId)) continue;
      seenCheckin.add(ci.clientId);
      const client = clientById.get(ci.clientId);
      if (!client) continue;
      const urgent = diffDays(ci.date, today) >= 3;
      out.push({
        key: `ci-${client.id}`,
        client,
        severity: urgent ? "high" : "med",
        title: "Check-in needs review",
        detail: `${ci.weight} kg · ${ci.date === today ? "today" : fmtShort(ci.date)}`,
        meta: ci.date === today ? "Today" : urgent ? `${diffDays(ci.date, today)}d waiting` : "Waiting",
        actionLabel: "Review",
        run: () => go("checkins"),
        sort: 3,
      });
      if (urgent) covered.add(client.id);
    }
    // Overdue / pending money (one card per subscription or standalone payment)
    for (const sub of state.subscriptions) {
      if (sub.paymentStatus === "Paid") continue;
      const out2 = outstandingAmount(sub, state.payments);
      if (out2 <= 0) continue;
      const client = clientById.get(sub.clientId);
      if (!client) continue;
      out.push({
        key: `subpay-${sub.id}`,
        client,
        severity: "med",
        title: "Payment overdue",
        detail: `${fmtMoney(out2)} EGP · ${sub.planName}`,
        meta: "Due",
        actionLabel: "Record payment",
        run: () => openRecordPayment(client.id),
        sort: 4,
      });
    }
    for (const p of state.payments) {
      if (p.status !== "Pending" || p.subscriptionId) continue;
      const client = clientById.get(p.clientId);
      if (client) {
        out.push({
          key: `pay-${p.id}`,
          client,
          severity: "med",
          title: "Payment pending",
          detail: `${fmtMoney(p.amount)} EGP · ${p.method}`,
          meta: "Due",
          actionLabel: "Record payment",
          run: () => openRecordPayment(client.id),
          sort: 4,
        });
      }
    }
    for (const { client, info } of lists.expiringSoon) {
      out.push({
        key: `soon-${client.id}`,
        client,
        severity: "med",
        title: "Subscription expiring",
        detail: remainingLabel(info.daysLeft),
        meta: info.daysLeft <= 1 ? "Due soon" : `${info.daysLeft}d left`,
        actionLabel: "Renew",
        run: () => go("client", client.id),
        sort: 5,
      });
    }
    for (const { client, info } of lists.followUpsDue) {
      if (covered.has(client.id) || seenCheckin.has(client.id)) continue;
      out.push({
        key: `due-${client.id}`,
        client,
        severity: "low",
        title: "Follow-up due",
        detail: info.label,
        meta: info.label,
        actionLabel: "View",
        run: () => go("client", client.id),
        sort: 6,
      });
    }
    for (const client of lists.staleCheckIns) {
      if (covered.has(client.id) || seenCheckin.has(client.id)) continue;
      const last = latestCheckIn(state.checkIns.filter((c) => c.clientId === client.id));
      const days = last ? Math.max(1, diffDays(last.date, today)) : null;
      out.push({
        key: `stale-${client.id}`,
        client,
        severity: "low",
        title: "No recent activity",
        detail: last ? `last check-in ${days}d ago` : "has never checked in",
        meta: last ? `${days}d quiet` : "New",
        actionLabel: "View",
        run: () => go("client", client.id),
        sort: 7,
      });
    }
    return out.sort((a, b) => a.sort - b.sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, state.sessions, state.payments, state.subscriptions, state.checkIns, clientById, pendingCheckIns, today]);

  /* ----- clients to review (actionable roster slice) ----- */
  const reviewRows = useMemo<ReviewRow[]>(() => {
    const pendingByClient = new Map<string, CheckIn>();
    for (const ci of pendingCheckIns) {
      if (!pendingByClient.has(ci.clientId)) pendingByClient.set(ci.clientId, ci);
    }
    const overdueIds = new Set(lists.overdueFollowUps.map((x) => x.client.id));
    const dueIds = new Map(lists.followUpsDue.map((x) => [x.client.id, x.info.label]));
    const expiringIds = new Map(lists.expiringSoon.map((x) => [x.client.id, remainingLabel(x.info.daysLeft)]));
    const expiredIds = new Map(lists.expired.map((x) => [x.client.id, remainingLabel(x.info.daysLeft)]));
    const staleIds = new Set(lists.staleCheckIns.map((c) => c.id));
    const pendingPayIds = new Set<string>();
    for (const sub of state.subscriptions) {
      if (sub.paymentStatus !== "Paid" && outstandingAmount(sub, state.payments) > 0) pendingPayIds.add(sub.clientId);
    }
    for (const p of state.payments) {
      if (p.status === "Pending") pendingPayIds.add(p.clientId);
    }
    const missedIds = new Set(
      state.sessions.filter((s) => s.date === today && s.status === "Missed").map((s) => s.clientId),
    );

    const rows: ReviewRow[] = [];
    for (const client of activeClients) {
      const cis = state.checkIns.filter((c) => c.clientId === client.id);
      const last = latestCheckIn(cis);
      const lastLabel = last ? (last.date === today ? "Today" : `${diffDays(last.date, today)}d ago`) : "No check-ins";
      const reasons: { reason: string; tone: Severity; sort: number; action: string; run: () => void }[] = [];

      const pend = pendingByClient.get(client.id);
      if (pend) {
        reasons.push({
          reason: "Check-in received",
          tone: "high",
          sort: 1,
          action: "Review",
          run: () => go("checkins"),
        });
      }
      if (expiredIds.has(client.id)) {
        reasons.push({ reason: "Subscription expired", tone: "high", sort: 0, action: "Renew", run: () => go("client", client.id) });
      } else if (expiringIds.has(client.id)) {
        reasons.push({ reason: "Plan ending soon", tone: "med", sort: 3, action: "Update", run: () => go("client", client.id) });
      }
      if (overdueIds.has(client.id)) {
        reasons.push({ reason: "Follow-up overdue", tone: "high", sort: 1, action: "Review", run: () => go("checkins") });
      } else if (dueIds.has(client.id)) {
        reasons.push({ reason: "Follow-up due", tone: "low", sort: 5, action: "View", run: () => go("client", client.id) });
      }
      if (pendingPayIds.has(client.id)) {
        reasons.push({
          reason: "Payment due",
          tone: "med",
          sort: 2,
          action: "Record",
          run: () => openRecordPayment(client.id),
        });
      }
      if (missedIds.has(client.id)) {
        reasons.push({ reason: "Missed session", tone: "high", sort: 1, action: "Open", run: () => go("client", client.id) });
      }
      if (staleIds.has(client.id) && !pend) {
        reasons.push({ reason: "No recent activity", tone: "low", sort: 6, action: "View", run: () => go("client", client.id) });
      }
      // Low attendance from real session outcomes (needs a meaningful sample).
      const sess = state.sessions.filter((s) => s.clientId === client.id);
      const att = attendance(sess);
      if (att.countable >= 4 && att.pct < 50) {
        reasons.push({
          reason: `Low attendance ${att.pct}%`,
          tone: "med",
          sort: 4,
          action: "View",
          run: () => go("client", client.id),
        });
      }

      if (reasons.length === 0) continue;
      reasons.sort((a, b) => a.sort - b.sort);
      const top = reasons[0];
      rows.push({
        client,
        reason: reasons.length > 1 ? `${top.reason} · +${reasons.length - 1} more` : top.reason,
        reasonTone: top.tone,
        status: lastLabel,
        lastActivity: last ? `${last.weight} kg · ${lastLabel}` : "No check-ins yet",
        actionLabel: top.action,
        run: top.run,
        sort: top.sort,
      });
    }
    return rows.sort((a, b) => a.sort - b.sort).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClients, pendingCheckIns, lists, state.checkIns, state.sessions, state.subscriptions, state.payments, today]);

  /* ----- activity feed (real events, newest first, max 5) ----- */
  const activity = useMemo(() => {
    type Ev = { key: string; clientId: string; ts: number; kind: "checkin" | "subscription" | "payment" | "client" | "session"; text: string; meta: string };
    const evs: Ev[] = [];
    const name = (id: string) => clientById.get(id)?.name ?? "Former client";
    for (const ci of state.checkIns) {
      evs.push({
        key: `ci-${ci.id}`,
        clientId: ci.clientId,
        ts: ci.ts,
        kind: "checkin",
        text: `${name(ci.clientId)} submitted a check-in`,
        meta: `${ci.weight} kg · mood ${ci.mood}/5`,
      });
    }
    for (const s of state.subscriptions) {
      evs.push({
        key: `sub-${s.id}`,
        clientId: s.clientId,
        ts: s.createdAt,
        kind: "subscription",
        text: `${name(s.clientId)} — subscription ${s.planName}`,
        meta: `${fmtMoney(s.price)} EGP · ends ${fmtDate(s.endDate)}`,
      });
    }
    for (const p of state.payments) {
      if (p.status !== "Paid") continue;
      evs.push({
        key: `pay-${p.id}`,
        clientId: p.clientId,
        ts: new Date(p.date + "T12:00:00").getTime(),
        kind: "payment",
        text: `Payment received from ${name(p.clientId)}`,
        meta: `${fmtMoney(p.amount)} EGP · ${p.method}`,
      });
    }
    for (const c of state.clients) {
      const ts = new Date(c.startDate + "T12:00:00").getTime();
      if (Number.isNaN(ts)) continue;
      evs.push({ key: `cli-${c.id}`, clientId: c.id, ts, kind: "client", text: `${c.name} joined your roster`, meta: c.goal });
    }
    for (const s of state.sessions) {
      if (s.status !== "Completed" && s.status !== "Scheduled") continue;
      const ts = new Date(`${s.date}T${(s.time || "12:00").slice(0, 5)}:00`).getTime();
      if (Number.isNaN(ts)) continue;
      evs.push({
        key: `ses-${s.id}`,
        clientId: s.clientId,
        ts,
        kind: "session",
        text: s.status === "Completed" ? `Session completed with ${name(s.clientId)}` : `Session booked with ${name(s.clientId)}`,
        meta: `${fmtDate(s.date)} · ${fmtTime(s.time)}`,
      });
    }
    return evs.sort((a, b) => b.ts - a.ts).slice(0, 5);
  }, [state, clientById]);

  const upcoming = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
    return days
      .map((d) => ({ date: d, items: state.sessions.filter((s) => s.date === d).sort((a, b) => a.time.localeCompare(b.time)) }))
      .filter((d) => d.items.length > 0);
  }, [state.sessions, today]);

  const animPending = useCountUp(pendingCheckIns.length);
  const animSessions = useCountUp(todaySessions.length);
  const animActive = useCountUp(activeClients.length);
  const animOutstanding = useCountUp(outstanding.total);

  const attentionCount = alerts.length;
  const primaryIsReview = pendingCheckIns.length > 0;
  const isNewCoach = state.clients.length === 0;

  const contextLine = isNewCoach
    ? "Add your first client to start coaching."
    : pendingCheckIns.length > 0
      ? `${pendingCheckIns.length} check-in${pendingCheckIns.length === 1 ? " is" : "s are"} waiting for review${overduePendingCount > 0 ? ` · ${overduePendingCount} overdue` : ""}`
      : openTodaySessions.length > 0
        ? `${openTodaySessions.length} session${openTodaySessions.length === 1 ? "" : "s"} today${nextSession ? ` · next at ${fmtTime(nextSession.time)}` : ""}`
        : attentionCount > 0
          ? `${attentionCount} thing${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} your attention today.`
          : "You're all caught up. Quiet day ahead.";

  if (booting) return <DashboardSkeleton />;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 sm:gap-5">
      {/* 1 — compact page header */}
      <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">{fmtDate(today)}</p>
          <h1 className="text-balance mt-1 text-[30px] font-extrabold leading-[1.02] tracking-tight text-mist-100 sm:text-[36px] lg:text-[42px]">
            {greeting}, <span className="text-volt-400">Coach.</span>
          </h1>
          <p className="text-balance mt-1.5 max-w-xl text-[13px] leading-6 text-mist-400">{contextLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {primaryIsReview ? (
            <>
              <button className={`${btnPrimary} ${btnSm} !min-h-[38px]`} onClick={() => go("checkins")}>
                <Camera className="h-3.5 w-3.5" /> Review check-ins
                {pendingCheckIns.length > 0 && (
                  <span className="rounded-full bg-night-950/15 px-1.5 py-0.5 text-[11px] font-extrabold leading-4 tnum">
                    {pendingCheckIns.length}
                  </span>
                )}
              </button>
              <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => setSessionModal(true)}>
                <CalendarDays className="h-3.5 w-3.5" /> Add session
              </button>
              <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => setClientModal(true)}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> New client
              </button>
            </>
          ) : (
            <>
              <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => setSessionModal(true)}>
                <CalendarDays className="h-3.5 w-3.5" /> Add session
              </button>
              <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => openRecordPayment(null)}>
                <Wallet className="h-3.5 w-3.5" /> Add payment
              </button>
              <button className={`${btnPrimary} ${btnSm} !min-h-[38px]`} onClick={() => setClientModal(true)}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> New client
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2 — action center (2:1 on desktop, stacked on tablet/mobile) */}
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-3">
        <NeedsAttentionCard
          alerts={alerts}
          onReviewAll={() => openClientsWithFilter("Active")}
          onOpenClient={(id) => go("client", id)}
        />
        <TodayScheduleCard
          sessions={todaySessions}
          upcoming={upcoming}
          weekOpen={weekOpen}
          onToggleWeek={() => setWeekOpen((v) => !v)}
          onAdd={() => setSessionModal(true)}
          onOpenClient={(id) => go("client", id)}
          onComplete={(id) => setSessionStatus(id, "Completed")}
          clientName={(id) => clientById.get(id)?.name ?? "Former client"}
        />
      </div>

      {/* 3 — operational KPI row (4) */}
      <div className="rise grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "60ms" }} role="list" aria-label="Today's key numbers">
        <KpiCard
          label="Pending Check-ins"
          value={String(Math.round(animPending))}
          sub={pendingCheckIns.length ? (overduePendingCount > 0 ? `${overduePendingCount} overdue · Review now` : "Review now") : "Inbox zero — nice"}
          icon={<Camera className="h-4 w-4" />}
          tone={pendingCheckIns.length > 0 ? (overduePendingCount > 0 ? "danger" : "warn") : undefined}
          onClick={pendingCheckIns.length ? () => go("checkins") : undefined}
          actionLabel="Review"
        />
        <KpiCard
          label="Sessions Today"
          value={String(Math.round(animSessions))}
          sub={todaySessions.length ? (nextSession ? `Next at ${fmtTime(nextSession.time)}` : `${todaySessions.length} on the books`) : "Schedule is clear"}
          icon={<CalendarDays className="h-4 w-4" />}
          onClick={todaySessions.length ? undefined : () => setSessionModal(true)}
          actionLabel={todaySessions.length ? undefined : "Add session"}
        />
        <KpiCard
          label="Active Clients"
          value={String(Math.round(animActive))}
          sub={
            attentionCount > 0
              ? `${Math.min(attentionCount, activeClients.length)} need${Math.min(attentionCount, activeClients.length) === 1 ? "s" : ""} attention`
              : state.clients.length - activeClients.length > 0
                ? `${state.clients.length - activeClients.length} inactive`
                : "Roster healthy"
          }
          icon={<Users className="h-4 w-4" />}
          onClick={() => openClientsWithFilter("Active")}
          actionLabel="View roster"
        />
        <KpiCard
          label="Outstanding Payments"
          value={fmtMoney(Math.round(animOutstanding))}
          unit="EGP"
          sub={outstanding.count ? `${outstanding.count} overdue payment${outstanding.count === 1 ? "" : "s"}` : "All settled"}
          icon={<Wallet className="h-4 w-4" />}
          tone={outstanding.count > 0 ? "danger" : undefined}
          onClick={outstanding.count ? () => openRecordPayment(null) : undefined}
          actionLabel={outstanding.count ? "Collect" : undefined}
        />
      </div>

      {/* 4 — clients to review */}
      <ClientsToReviewCard rows={reviewRows} totalClients={state.clients.length} onAddClient={() => setClientModal(true)} onOpenCheckins={() => go("checkins")} />

      {/* secondary progress (only when meaningful) */}
      <SecondaryProgress checkIns={state.checkIns} clients={state.clients} go={go} />

      {/* 5 + 6 — business health + recent activity (60:40 on desktop, stacked below) */}
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-5">
        <BusinessHealthCard
          clients={state.clients}
          revenueMonth={revenueMonth}
          revenuePrev={revenuePrev}
          outstanding={outstanding}
          openClients={openClientsWithFilter}
        />
        <RecentActivityCard activity={activity} onOpen={(id) => go("client", id)} />
      </div>

      {/* 7 — compact plan usage */}
      <CompactPlanUsage
        planName={myCoachPlan.name}
        planPrice={myCoachPlan.price}
        count={myClientCount}
        limit={myClientLimit}
        endDate={myCoachSubscription?.endDate ?? null}
        status={effectiveCoachStatus(myCoachSubscription, today)}
        onManage={() => go("pricing")}
      />

      <ClientFormModal open={clientModal} initial={null} onClose={() => setClientModal(false)} onSaved={(c) => go("client", c.id)} onUpgrade={() => go("pricing")} />
      <SessionFormModal open={sessionModal} clientId={null} initial={null} presetDate={today} onClose={() => setSessionModal(false)} />
      <PaymentFormModal
        open={paymentModal}
        clientId={paymentClientId}
        initial={null}
        subscriptions={state.subscriptions}
        onClose={() => {
          setPaymentModal(false);
          setPaymentClientId(null);
        }}
      />
    </div>
  );
}

/* ---------------- header-adjacent pieces ---------------- */

function CardShell({
  label,
  icon,
  count,
  countTone,
  action,
  children,
  delay = 0,
  className = "",
}: {
  label: string;
  icon?: ReactNode;
  count?: ReactNode;
  countTone?: string;
  action?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`rise flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        {icon && (
          <span className="icon-tile h-8 w-8 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">{label}</h2>
        {count !== undefined && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold leading-5 tnum ring-1 ${countTone ?? "bg-white/[0.05] text-mist-400 ring-white/10"}`}>
            {count}
          </span>
        )}
        {action && <div className="ms-auto flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function NeedsAttentionCard({
  alerts,
  onReviewAll,
  onOpenClient,
}: {
  alerts: AttentionItem[];
  onReviewAll: () => void;
  onOpenClient: (id: string) => void;
}) {
  return (
    <CardShell
      label="Needs Attention"
      icon={<AlertTriangle className="h-4 w-4" />}
      delay={100}
      className="xl:col-span-2"
      count={alerts.length > 0 ? alerts.length : "clear"}
      countTone={alerts.length > 0 ? "bg-danger-500/15 text-danger-300 ring-danger-500/20" : "bg-moss-400/10 text-moss-300 ring-moss-400/20"}
      action={
        alerts.length > 0 ? (
          <button className={`${btnSecondary} ${btnSm}`} onClick={onReviewAll}>
            Review clients <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        ) : undefined
      }
    >
      {alerts.length === 0 ? (
        <div className="grid flex-1 place-items-center px-5 py-8 text-center">
          <div className="animate-pop">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-moss-400/10 text-moss-300 ring-1 ring-moss-400/25">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="mt-2.5 text-[15px] font-bold text-mist-100">You&apos;re all caught up.</p>
            <p className="mt-0.5 text-xs text-mist-400">No urgent client actions right now.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.key}>
              <div className="group flex items-center gap-3 px-5 py-3 transition-colors duration-200 hover:bg-white/[0.025]">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center">
                  <Avatar name={a.client.name} photo={a.client.photo} className="h-10 w-10 text-xs" />
                  <span
                    className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-night-950 ${SEV_DOT[a.severity]} ${a.severity === "high" ? "tick-pulse" : ""}`}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-mist-100">{a.client.name}</p>
                  <p className="truncate text-[13px] text-mist-400">
                    <span className={`font-bold ${SEV_TEXT[a.severity]}`}>{a.title}</span>
                    <span className="text-mist-500"> — {a.detail}</span>
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-mist-500 sm:inline">
                  {a.meta}
                </span>
                <button
                  className={`${btnSecondary} ${btnSm} !min-h-[36px] shrink-0`}
                  onClick={a.run}
                  aria-label={`${a.actionLabel} — ${a.client.name}: ${a.title}`}
                >
                  {a.actionLabel}
                </button>
                <button
                  className="hidden shrink-0 cursor-pointer rounded-lg px-1.5 py-1 text-[11px] font-bold text-mist-500 underline-offset-2 hover:text-volt-300 hover:underline xl:inline"
                  onClick={() => onOpenClient(a.client.id)}
                >
                  Profile
                </button>
              </div>
            </li>
          ))}
          {alerts.length > 6 && (
            <li className="px-5 py-2.5 text-center">
              <button
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-mist-400 transition hover:text-volt-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
                onClick={onReviewAll}
              >
                + {alerts.length - 6} more in the clients list
              </button>
            </li>
          )}
        </ul>
      )}
    </CardShell>
  );
}

function TodayScheduleCard({
  sessions,
  upcoming,
  weekOpen,
  onToggleWeek,
  onAdd,
  onOpenClient,
  onComplete,
  clientName,
}: {
  sessions: Session[];
  upcoming: { date: string; items: Session[] }[];
  weekOpen: boolean;
  onToggleWeek: () => void;
  onAdd: () => void;
  onOpenClient: (id: string) => void;
  onComplete: (id: string) => void;
  clientName: (id: string) => string;
}) {
  return (
    <CardShell
      label="Today's Schedule"
      icon={<Clock className="h-4 w-4" />}
      delay={140}
      count={sessions.length}
      action={
        upcoming.length > 0 ? (
          <button className={`${btnSecondary} ${btnSm}`} onClick={onToggleWeek} aria-expanded={weekOpen}>
            {weekOpen ? "Hide week" : "Week"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${weekOpen ? "rotate-180" : ""}`} />
          </button>
        ) : undefined
      }
    >
      {sessions.length === 0 ? (
        <div className="grid flex-1 place-items-center px-5 py-8 text-center">
          <div>
            <span className="icon-tile mx-auto h-10 w-10 !rounded-full">
              <CalendarDays className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-sm font-bold text-mist-100">No sessions scheduled today.</p>
            <button className={`${btnSecondary} ${btnSm} mt-3`} onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" /> Add session
            </button>
          </div>
        </div>
      ) : (
        <ul className="relative px-5 py-3">
          <span className="absolute bottom-5 start-[31px] top-5 w-px bg-white/[0.07]" aria-hidden="true" />
          {sessions.map((s) => (
            <ScheduleRow key={s.id} s={s} onOpen={() => onOpenClient(s.clientId)} onComplete={() => onComplete(s.id)} name={clientName(s.clientId)} />
          ))}
        </ul>
      )}
      <div className={`grid transition-all duration-300 ease-out ${weekOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Next 7 days</p>
            <ul className="mt-1.5 grid gap-1">
              {upcoming.map((d) => (
                <li key={d.date} className="flex items-baseline gap-3 text-xs">
                  <span className="w-20 shrink-0 font-display text-sm font-bold text-mist-300">
                    {WEEK_DAYS[(new Date(d.date + "T12:00:00").getDay() + 6) % 7]}
                  </span>
                  <span className="truncate text-mist-500">
                    {d.items.map((s) => `${fmtTime(s.time)} ${clientName(s.clientId).split(" ")[0]}`).join(" · ")}
                  </span>
                  <span className="ms-auto shrink-0 font-bold text-mist-400 tnum">{d.items.length}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function ScheduleRow({ s, name, onOpen, onComplete }: { s: Session; name: string; onOpen: () => void; onComplete: () => void }) {
  const meta = SESSION_STATUS_META[s.status];
  const [h, m] = s.time.split(":").map(Number);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const past = (h ?? 0) * 60 + (m ?? 0) < nowMin;
  const isDone = s.status === "Completed";
  const bad = s.status === "Missed" || s.status === "Cancelled";
  const actionable = s.status === "Scheduled" || s.status === "Confirmed";
  return (
    <li className="relative flex items-center gap-3 py-2">
      <span
        className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 bg-night-950 ${
          isDone ? "border-moss-400 text-moss-300" : bad ? "border-danger-400/60 text-danger-300" : past ? "border-white/15 text-mist-500" : "border-volt-400 text-volt-300"
        }`}
        aria-hidden="true"
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className={`h-1.5 w-1.5 rounded-full bg-current ${!past && actionable ? "tick-pulse" : ""}`} />}
      </span>
      <span className="w-[70px] shrink-0 text-sm font-extrabold leading-5 tracking-tight text-mist-100 tnum">{fmtTime(s.time)}</span>
      <button
        className="min-w-0 flex-1 cursor-pointer rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
        onClick={onOpen}
        aria-label={`${name} at ${fmtTime(s.time)} — open profile`}
      >
        <span className={`block truncate text-sm font-bold transition-colors hover:text-volt-300 ${bad ? "text-mist-500 line-through decoration-white/20" : "text-mist-100"}`}>
          {name}
        </span>
        <span className="block truncate text-xs font-medium text-mist-500">{s.type}</span>
      </button>
      {actionable ? (
        <button
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/[0.08] text-mist-400 transition hover:border-moss-400/40 hover:text-moss-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
          onClick={onComplete}
          title={`Mark ${name}'s session complete`}
          aria-label={`Mark ${name}'s session at ${fmtTime(s.time)} complete`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
        </button>
      ) : (
        <Badge className={meta.chip}>{s.status}</Badge>
      )}
    </li>
  );
}

/* ---------------- KPI ---------------- */

function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  icon: ReactNode;
  tone?: "warn" | "danger";
  onClick?: () => void;
  actionLabel?: string;
}) {
  const valueTone = tone === "danger" ? "text-danger-300" : tone === "warn" ? "text-warn-300" : "text-mist-100";
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist-500">{label}</span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] ${tone ? valueTone : "text-mist-400"}`}>
          {icon}
        </span>
      </span>
      <span className={`mt-2.5 block text-[30px] font-extrabold leading-8 tracking-tight tnum sm:text-[32px] ${valueTone}`}>
        {value}
        {unit && <span className="ms-1.5 text-[13px] font-bold text-mist-500">{unit}</span>}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-mist-500">
        <span className="truncate">{sub}</span>
        {onClick && actionLabel && (
          <span className="ms-auto inline-flex shrink-0 items-center gap-0.5 font-bold text-volt-300">
            {actionLabel} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </span>
        )}
      </span>
    </>
  );
  const cls = "rise card-lift group relative min-h-[104px] rounded-2xl border border-white/[0.07] bg-night-900/60 p-5 text-start shadow-sm backdrop-blur-xl";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        role="listitem"
        aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${sub}`}
        className={`${cls} cursor-pointer hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div role="listitem" aria-label={`${label}: ${value}. ${sub}`} className={cls}>
      {inner}
    </div>
  );
}

/* ---------------- clients to review ---------------- */

function ClientsToReviewCard({
  rows,
  totalClients,
  onAddClient,
  onOpenCheckins,
}: {
  rows: ReviewRow[];
  totalClients: number;
  onAddClient: () => void;
  onOpenCheckins: () => void;
}) {
  return (
    <section
      aria-label="Clients to review"
      className="rise overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl"
      style={{ animationDelay: "100ms" }}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <span className="icon-tile h-8 w-8" aria-hidden="true">
          <Users className="h-4 w-4" />
        </span>
        <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">Clients to Review</h2>
        <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-mist-400 tnum">{rows.length}</span>
        {rows.length > 0 && (
          <button className={`${btnSecondary} ${btnSm} ms-auto`} onClick={onOpenCheckins}>
            Open check-ins <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        )}
      </header>
      {totalClients === 0 ? (
        <div className="grid place-items-center px-5 py-8 text-center">
          <div>
            <span className="icon-tile mx-auto h-10 w-10 !rounded-full">
              <UserPlus className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-sm font-bold text-mist-100">Add your first client.</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-mist-400">Create a client profile, assign a plan, and start tracking progress.</p>
            <button className={`${btnPrimary} ${btnSm} mt-3`} onClick={onAddClient}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Add client
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center px-5 py-8 text-center">
          <div>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-moss-400/10 text-moss-300 ring-1 ring-moss-400/25">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <p className="mt-2.5 text-sm font-bold text-mist-100">No clients need review.</p>
            <p className="mt-1 text-xs text-mist-400">Follow-ups are on track and plans are current.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06]">
          {rows.map((r) => (
            <li key={r.client.id}>
              <div className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.025]">
                <button
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
                  onClick={r.run}
                  aria-label={`${r.client.name} — ${r.reason}. ${r.lastActivity}`}
                >
                  <Avatar name={r.client.name} photo={r.client.photo} className="h-9 w-9 text-[11px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-mist-100 transition-colors group-hover:text-volt-200">{r.client.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-bold ${SEV_TEXT[r.reasonTone]}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[r.reasonTone]}`} aria-hidden="true" />
                        {r.reason}
                      </span>
                      <span className="font-medium text-mist-500">{r.lastActivity}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-[11px] font-bold text-mist-500 md:inline">{r.status}</span>
                </button>
                <button className={`${btnSecondary} ${btnSm} !min-h-[36px] shrink-0`} onClick={r.run} aria-label={`${r.actionLabel} — ${r.client.name}`}>
                  {r.actionLabel}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- secondary progress (opt-in, only when meaningful) ---------------- */

function SecondaryProgress({ checkIns, clients, go }: { checkIns: CheckIn[]; clients: Client[]; go: (v: CoachView, id?: string) => void }) {
  const candidates = useMemo(
    () =>
      clients
        .map((c) => ({ c, list: checkIns.filter((x) => x.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts).slice(-8) }))
        .filter((x) => x.list.length >= 2)
        .sort((a, b) => b.list.length - a.list.length)
        .slice(0, 5),
    [clients, checkIns],
  );
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;

  const chosen = candidates[Math.min(sel, candidates.length - 1)];
  const points = chosen?.list ?? [];
  const delta = points.length >= 2 ? Math.round((points[points.length - 1].weight - points[0].weight) * 10) / 10 : null;

  const W = 560;
  const H = 180;
  const padL = 8;
  const padR = 12;
  const padT = 12;
  const padB = 22;
  const ws = points.map((p) => p.weight);
  const min = ws.length ? Math.min(...ws) - 1 : 0;
  const max = ws.length ? Math.max(...ws) + 1 : 1;
  const x = (i: number) => padL + (W - padL - padR) * (i / Math.max(1, points.length - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min || 1));
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(" L");

  return (
    <section aria-label="Client progress" className="rise overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl">
      <button
        className="flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-volt-400/50"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Scale className="h-4 w-4 text-mist-500" aria-hidden="true" />
        <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">Client Progress</h2>
        <span className="hidden shrink-0 text-xs font-medium text-mist-500 sm:inline">weight · last 8 check-ins</span>
        {delta !== null && (
          <span className={`ms-2 text-sm font-extrabold tnum ${delta <= 0 ? "text-moss-300" : "text-warn-300"}`}>
            {signed(delta)} kg
          </span>
        )}
        <span className="ms-auto flex items-center gap-2">
          {chosen && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                go("client", chosen.c.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  go("client", chosen.c.id);
                }
              }}
              className="hidden cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-mist-400 hover:text-volt-300 sm:inline-flex"
            >
              Open profile <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-mist-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select client">
              {candidates.map((cand, i) => {
                const selected = i === Math.min(sel, candidates.length - 1);
                return (
                  <button
                    key={cand.c.id}
                    onClick={() => {
                      setSel(i);
                      setHover(null);
                    }}
                    aria-pressed={selected}
                    className={`flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full py-1 pe-3 ps-1 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 ${
                      selected ? "bg-volt-400 text-night-950" : "border border-white/[0.07] bg-white/[0.03] text-mist-400 hover:text-mist-100"
                    }`}
                  >
                    <Avatar name={cand.c.name} photo={cand.c.photo} className="h-5 w-5 !rounded-full text-[8px]" />
                    {cand.c.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
            <div className="relative mt-2">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full"
                onMouseLeave={() => setHover(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const px = ((e.clientX - rect.left) / rect.width) * W;
                  let best = 0;
                  let bd = Infinity;
                  points.forEach((_, i) => {
                    const d = Math.abs(x(i) - px);
                    if (d < bd) {
                      bd = d;
                      best = i;
                    }
                  });
                  setHover(best);
                }}
                role="img"
                aria-label={`Weight trend for ${chosen?.c.name ?? "client"}`}
              >
                <defs>
                  <linearGradient id="dashAreaCompact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#cdf14b" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1={padL} x2={W - padR} y1={padT + (H - padT - padB) * f} y2={padT + (H - padT - padB) * f} stroke="#1a251d" strokeWidth="1" />
                ))}
                {points.length > 1 && (
                  <>
                    <path d={`M${line} L${x(points.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`} fill="url(#dashAreaCompact)" />
                    <path d={`M${line}`} fill="none" stroke="#cdf14b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                )}
                {points.map((p, i) => (hover === i ? null : <circle key={p.id} cx={x(i)} cy={y(p.weight)} r="2.6" fill="#0f1611" stroke="#cdf14b" strokeWidth="1.8" />))}
                {hover !== null && points[hover] && (
                  <>
                    <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#31443a" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx={x(hover)} cy={y(points[hover].weight)} r="4.5" fill="#cdf14b" stroke="#0f1611" strokeWidth="2" />
                  </>
                )}
                {points.length > 0 && (
                  <>
                    <text x={x(0)} y={H - 6} textAnchor="middle" fontSize="10" fill="#7c9486">{fmtShort(points[0].date)}</text>
                    <text x={x(points.length - 1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#7c9486">{fmtShort(points[points.length - 1].date)}</text>
                  </>
                )}
              </svg>
              {hover !== null && points[hover] && (
                <div
                  className="animate-pop pointer-events-none absolute -top-1 z-10 rounded-xl border border-night-600 bg-night-800 px-2.5 py-1.5 shadow-xl"
                  style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? "-108%" : "8%"})` }}
                >
                  <p className="font-display text-base font-bold leading-5 text-volt-300 tnum">{points[hover].weight} kg</p>
                  <p className="text-[10px] font-semibold text-mist-500">{fmtDate(points[hover].date)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- business health + activity ---------------- */

function BusinessHealthCard({
  clients,
  revenueMonth,
  revenuePrev,
  outstanding,
  openClients,
}: {
  clients: Client[];
  revenueMonth: number;
  revenuePrev: number;
  outstanding: { total: number; count: number };
  openClients: (f: "Active" | "Expiring Soon" | "Expired") => void;
}) {
  const { state } = useApp();
  const today = todayISO();
  const counts = useMemo(() => {
    const c = { Active: 0, "Expiring Soon": 0, Expired: 0, none: 0 };
    for (const cl of clients) {
      const subs = state.subscriptions.filter((s) => s.clientId === cl.id);
      const info = subscriptionState(currentSubscription(subs));
      if (info.state === "No Subscription") c.none += 1;
      else c[info.state] += 1;
    }
    return c;
  }, [clients, state.subscriptions]);

  const weeks = useMemo(() => {
    const todayDow = (new Date(today + "T12:00:00").getDay() + 6) % 7;
    const monday = addDays(today, -todayDow);
    return Array.from({ length: 6 }, (_, i) => {
      const start = addDays(monday, (i - 5) * 7);
      const end = addDays(start, 6);
      const total = state.payments
        .filter((p) => p.status === "Paid" && p.date >= start && p.date <= end)
        .reduce((s, p) => s + p.amount, 0);
      return { start, total, current: i === 5 };
    });
  }, [state.payments, today]);
  const hasRevenue = weeks.some((w) => w.total > 0) || revenueMonth > 0;
  const weekMax = Math.max(...weeks.map((w) => w.total), 1);
  const diff = revenueMonth - revenuePrev;

  return (
    <section
      aria-label="Business health"
      className="rise flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl xl:col-span-3"
      style={{ animationDelay: "140ms" }}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <span className="icon-tile h-8 w-8" aria-hidden="true">
          <Wallet className="h-4 w-4" />
        </span>
        <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">Business Health</h2>
        <span className="ms-auto hidden shrink-0 text-[11px] font-semibold text-mist-500 sm:inline">revenue · plans · dues</span>
      </header>
      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Revenue · this month</p>
            <p className="mt-1 text-[30px] font-extrabold leading-8 tracking-tight text-mist-100 tnum">
              {fmtMoney(revenueMonth)} <span className="text-sm font-bold text-mist-500">EGP</span>
            </p>
          </div>
          {revenuePrev > 0 ? (
            <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tnum ring-1 ${diff >= 0 ? "bg-moss-400/10 text-moss-300 ring-moss-400/20" : "bg-danger-500/10 text-danger-300 ring-danger-500/20"}`}>
              {diff >= 0 ? "+" : ""}{fmtMoney(diff)} vs last mo
            </span>
          ) : (
            <span className="mb-1 text-[11px] font-semibold text-mist-500">no payments last month</span>
          )}
        </div>
        {hasRevenue ? (
          <>
            <div className="mt-3 flex items-end gap-2" role="img" aria-label={`Weekly revenue, last 6 weeks. This month ${fmtMoney(revenueMonth)} EGP.`}>
              {weeks.map((w, i) => (
                <div key={w.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className={`text-[11px] font-bold tnum ${w.total > 0 ? "text-mist-300" : "text-white/20"}`}>
                    {w.total > 0 ? `${Math.round(w.total / 100) / 10}k` : ""}
                  </span>
                  <div className="flex h-14 w-full items-end" title={`Week of ${fmtDate(w.start)}: ${fmtMoney(w.total)} EGP`}>
                    <div
                      className={`bar-grow w-full rounded-t-[5px] ${w.current ? "bg-volt-400" : w.total > 0 ? "bg-moss-600" : "bg-white/[0.07]"}`}
                      style={{ height: w.total > 0 ? `${Math.max(8, (w.total / weekMax) * 100)}%` : "4px", animationDelay: `${i * 60}ms` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-mist-500">last 6 weeks · paid only</p>
          </>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-3 py-2.5 text-center text-xs text-mist-500">
            No revenue yet — recorded payments will build this trend.
          </p>
        )}
      </div>
      <div className="mx-5 my-3.5 border-t border-white/[0.06]" />
      <div className="grid flex-1 grid-cols-3 gap-2 px-5 pb-5">
        <SubCount label="Active" value={counts.Active} tone="text-moss-300" filter="Active" openClients={openClients} />
        <SubCount label="Expiring" value={counts["Expiring Soon"]} tone="text-warn-300" filter="Expiring Soon" openClients={openClients} />
        <SubCount label="Expired" value={counts.Expired} tone="text-danger-300" filter="Expired" openClients={openClients} />
      </div>
      <div className="border-t border-white/[0.06] bg-white/[0.015] px-5 py-3">
        {outstanding.count > 0 ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-400">
            <AlertTriangle className="h-3.5 w-3.5 text-warn-300" aria-hidden="true" />
            <span>
              <span className="font-extrabold text-warn-300 tnum">{fmtMoney(outstanding.total)} EGP</span> outstanding across {outstanding.count} item{outstanding.count === 1 ? "" : "s"}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mist-500">
            <Check className="h-3.5 w-3.5 text-moss-300" aria-hidden="true" /> All payments settled.
            {counts.none > 0 && <span className="ms-1">· {counts.none} without a plan</span>}
          </p>
        )}
      </div>
    </section>
  );
}

function SubCount({
  label,
  value,
  tone,
  filter,
  openClients,
}: {
  label: string;
  value: number;
  tone: string;
  filter: "Active" | "Expiring Soon" | "Expired";
  openClients: (f: "Active" | "Expiring Soon" | "Expired") => void;
}) {
  const meta = SUB_STATE_META[filter];
  return (
    <button
      onClick={() => openClients(filter)}
      className="group min-w-0 cursor-pointer rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-2.5 text-start transition-all duration-200 hover:border-white/[0.13] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 sm:px-3"
      title={`Open clients — ${label.toLowerCase()}`}
      aria-label={`${label}: ${value} clients`}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
        {label}
      </span>
      <span className={`mt-0.5 block text-2xl font-extrabold leading-7 tracking-tight tnum ${value > 0 ? tone : "text-mist-500"}`}>{value}</span>
    </button>
  );
}

function RecentActivityCard({
  activity,
  onOpen,
}: {
  activity: { key: string; clientId: string; ts: number; kind: "checkin" | "subscription" | "payment" | "client" | "session"; text: string; meta: string }[];
  onOpen: (id: string) => void;
}) {
  return (
    <section
      aria-label="Recent activity"
      className="rise flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl xl:col-span-2"
      style={{ animationDelay: "180ms" }}
    >
      <header className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <span className="icon-tile h-8 w-8" aria-hidden="true">
          <Clock className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold tracking-tight text-mist-100">Recent Activity</h2>
      </header>
      {activity.length === 0 ? (
        <div className="grid flex-1 place-items-center px-5 py-8 text-center">
          <div>
            <p className="text-sm font-bold text-mist-100">Nothing yet.</p>
            <p className="mx-auto mt-1 max-w-[240px] text-xs leading-5 text-mist-400">Check-ins, payments and new clients will show up here.</p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-white/[0.05] px-2 py-1.5">
          {activity.map((ev) => (
            <li key={ev.key}>
              <button
                className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors duration-200 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
                onClick={() => onOpen(ev.clientId)}
                aria-label={`${ev.text} — ${ev.meta}, ${relTime(ev.ts)}`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] ${
                    ev.kind === "checkin"
                      ? "bg-volt-400/10 text-volt-300"
                      : ev.kind === "subscription"
                        ? "bg-moss-400/10 text-moss-300"
                        : ev.kind === "payment"
                          ? "bg-warn-400/10 text-warn-300"
                          : ev.kind === "client"
                            ? "bg-sky-400/10 text-sky-300"
                            : "bg-white/[0.05] text-mist-300"
                  }`}
                  aria-hidden="true"
                >
                  {ev.kind === "checkin" ? (
                    <Scale className="h-4 w-4" />
                  ) : ev.kind === "subscription" ? (
                    <BadgeCheck className="h-4 w-4" />
                  ) : ev.kind === "payment" ? (
                    <Wallet className="h-4 w-4" />
                  ) : ev.kind === "client" ? (
                    <UserPlus className="h-4 w-4" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold leading-5 text-mist-100">{ev.text}</span>
                  <span className="block truncate text-xs font-medium text-mist-500">{ev.meta}</span>
                </span>
                <span className="shrink-0 text-[11px] font-bold text-mist-500">{relTime(ev.ts)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------- compact plan usage ---------------- */

function CompactPlanUsage({
  planName,
  planPrice,
  count,
  limit,
  endDate,
  status,
  onManage,
}: {
  planName: string;
  planPrice: number;
  count: number;
  limit: number | null;
  endDate: string | null;
  status: string;
  onManage: () => void;
}) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((count / Math.max(1, limit)) * 100));
  const daysToRenewal = endDate ? diffDays(todayISO(), endDate) : null;
  const renewalSoon = daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal <= 14;
  const warning = status === "EXPIRED" || status === "SUSPENDED" || (limit !== null && pct >= 80) || renewalSoon || status === "NONE" || status === "PENDING";

  return (
    <section
      aria-label="Plan usage"
      className={`rise flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-xl ${
        warning ? "border-warn-400/25 bg-warn-400/[0.05]" : "border-white/[0.07] bg-night-900/60"
      }`}
      style={{ animationDelay: "220ms" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
            warning ? "border-warn-400/30 bg-warn-400/10 text-warn-300" : "border-white/[0.07] bg-white/[0.04] text-mist-300"
          }`}
          aria-hidden="true"
        >
          <ClipboardList className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-mist-100">
            {planName} Plan
            <span className="ms-2 text-xs font-semibold text-mist-500 tnum">{formatEGP(planPrice)} / mo</span>
          </p>
          <p className="mt-0.5 text-xs text-mist-500">
            {limit === null ? `${count} client slots used · Unlimited` : `${count} of ${limit} client slots used`}
            {endDate ? ` · Renews ${planRenewalLabel(endDate)}` : ""}
          </p>
        </div>
      </div>
      {limit !== null && (
        <div className="min-w-[160px] flex-1 sm:max-w-[280px]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Client usage ${count} of ${limit}`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-danger-400" : pct >= 80 ? "bg-warn-400" : "bg-volt-400"}`} style={{ width: `${pct}%` }} />
          </div>
          {warning && (
            <p className="mt-1 text-[11px] font-bold text-warn-300">
              {status === "EXPIRED" ? "Subscription expired — contact admin." : pct >= 100 ? "Limit reached — upgrade to add more." : pct >= 80 ? "Almost full — consider upgrading." : renewalSoon ? `Renews in ${daysToRenewal} day${daysToRenewal === 1 ? "" : "s"}.` : "Needs attention."}
            </p>
          )}
        </div>
      )}
      <button className={`${btnSecondary} ${btnSm} ms-auto`} onClick={onManage}>
        Manage plan <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </section>
  );
}

/* ---------------- skeleton ---------------- */

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 sm:gap-5">
      <div className="rise">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-[42px] w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 xl:col-span-2">
          <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
            <Skeleton className="h-8 w-8 !rounded-xl" />
            <Skeleton className="h-4 w-36" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3 last:border-0">
              <Skeleton className="h-10 w-10 shrink-0 !rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-9 w-20 shrink-0" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60">
          <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
            <Skeleton className="h-8 w-8 !rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2">
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
              <Skeleton className="h-[18px] w-[70px] shrink-0" />
              <Skeleton className="h-3.5 min-w-0 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-h-[104px] rounded-2xl border border-white/[0.07] bg-night-900/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-8 !rounded-xl" />
            </div>
            <Skeleton className="mt-2.5 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-night-900/60">
        <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <Skeleton className="h-8 w-8 !rounded-xl" />
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3 last:border-0">
            <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-48 max-w-full" />
            </div>
            <Skeleton className="h-9 w-16 shrink-0" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-5 xl:col-span-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-8 w-48" />
          <Skeleton className="mt-3 h-14 w-full" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px]" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-2 py-1.5 xl:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-white/[0.07] bg-night-900/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
          <div>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-1.5 min-w-[160px] flex-1 sm:max-w-[280px]" />
        <Skeleton className="ms-auto h-8 w-28" />
      </div>
    </div>
  );
}


