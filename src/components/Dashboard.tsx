/* ================================================================
   VERRAA — coach command center. Everything is computed from real
   store data; nothing is invented.
   ================================================================ */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plus,
  Scale,
  Users,
  Wallet,
} from "lucide-react";
import type { CheckIn, Client, CoachView, Session, Subscription } from "../types";
import { SESSION_STATUS_META, SUB_STATE_META, WEEK_DAYS } from "../types";
import { addDays, fmtDate, fmtMoney, fmtShort, fmtTime, relTime, signed, todayISO } from "../lib";
import { actionLists, currentSubscription, remainingLabel, subscriptionState } from "../logic";
import { useApp } from "../store";
import { Avatar, Badge, Skeleton, btnPrimary, btnSecondary, btnSm, useCountUp } from "./ui";
import { ClientFormModal, PaymentFormModal, SessionFormModal } from "./modals";
import { CurrentPlanCard } from "./CoachPricing";

type Severity = "high" | "med" | "low";
interface AlertItem {
  key: string;
  client: Client;
  severity: Severity;
  title: string;
  detail: string;
  sort: number;
}

const SEV_DOT: Record<Severity, string> = { high: "bg-danger-400", med: "bg-warn-400", low: "bg-mist-400" };
const SEV_RING: Record<Severity, string> = { high: "ring-danger-400/25", med: "ring-warn-400/25", low: "ring-night-500/40" };

export function Dashboard({
  go,
  openClientsWithFilter,
}: {
  go: (v: CoachView, id?: string) => void;
  openClientsWithFilter: (f: "Active" | "Expiring Soon" | "Expired") => void;
}) {
  const { state } = useApp();
  const [booting, setBooting] = useState(true);
  const [clientModal, setClientModal] = useState(false);
  const [sessionModal, setSessionModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBooting(false), 420);
    return () => window.clearTimeout(t);
  }, []);

  const today = todayISO();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const lists = useMemo(() => actionLists(state), [state]);

  const activeCount = state.clients.filter((c) => c.status === "Active").length;

  const todaySessions = useMemo(
    () => state.sessions.filter((s) => s.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [state.sessions, today],
  );
  const completedToday = todaySessions.filter((s) => s.status === "Completed").length;

  const freshCheckIns = useMemo(
    () => state.checkIns.filter((c) => Date.now() - c.ts < 86_400_000).sort((a, b) => b.ts - a.ts),
    [state.checkIns],
  );
  const lastCheckInClient = freshCheckIns.length
    ? state.clients.find((c) => c.id === freshCheckIns[0].clientId)?.name.split(" ")[0]
    : null;

  const monthKey = today.slice(0, 7);
  const prevKey = addDays(today.slice(0, 8) + "01", -1).slice(0, 7);
  const paidIn = (key: string) =>
    state.payments.filter((p) => p.status === "Paid" && p.date.slice(0, 7) === key).reduce((s, p) => s + p.amount, 0);
  const revenueMonth = paidIn(monthKey);
  const revenuePrev = paidIn(prevKey);
  const paymentsMonth = state.payments.filter((p) => p.status === "Paid" && p.date.slice(0, 7) === monthKey).length;

  /* ----- needs attention (real issues only, sorted by urgency) ----- */
  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    const flagged = new Set<string>();
    for (const { client, info } of lists.expired) {
      out.push({ key: `exp-${client.id}`, client, severity: "high", title: "Subscription expired", detail: remainingLabel(info.daysLeft), sort: 0 });
      flagged.add(client.id);
    }
    for (const { client, info } of lists.overdueFollowUps) {
      const d = Math.abs(info.daysToNext ?? 0);
      out.push({ key: `fu-${client.id}`, client, severity: "high", title: "Check-in overdue", detail: `${d} day${d === 1 ? "" : "s"} since last contact`, sort: 1 });
      flagged.add(client.id);
    }
    for (const s of state.sessions) {
      if (s.date === today && s.status === "Missed") {
        const client = state.clients.find((c) => c.id === s.clientId);
        if (client) out.push({ key: `miss-${s.id}`, client, severity: "high", title: "Missed session", detail: `${fmtTime(s.time)} · ${s.type}`, sort: 2 });
      }
    }
    for (const { client, info } of lists.expiringSoon) {
      out.push({ key: `soon-${client.id}`, client, severity: "med", title: "Subscription expiring", detail: remainingLabel(info.daysLeft), sort: 3 });
    }
    for (const p of state.payments) {
      if (p.status === "Pending") {
        const client = state.clients.find((c) => c.id === p.clientId);
        if (client) out.push({ key: `pay-${p.id}`, client, severity: "med", title: "Payment pending", detail: `${fmtMoney(p.amount)} EGP · ${p.method}`, sort: 4 });
      }
    }
    for (const client of lists.staleCheckIns) {
      if (flagged.has(client.id)) continue;
      const last = [...state.checkIns].filter((c) => c.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date))[0];
      const days = last ? Math.max(1, Math.round((Date.now() - new Date(last.date + "T12:00:00").getTime()) / 86_400_000)) : null;
      out.push({ key: `stale-${client.id}`, client, severity: "low", title: "No recent activity", detail: last ? `last check-in ${days}d ago` : "has never checked in", sort: 5 });
    }
    return out.sort((a, b) => a.sort - b.sort);
  }, [lists, state.sessions, state.payments, state.checkIns, state.clients, today]);

  /* ----- activity feed (merged real events) ----- */
  const activity = useMemo(() => {
    type Ev = { key: string; clientId: string; ts: number; kind: "checkin" | "subscription" | "payment"; text: string; meta: string };
    const evs: Ev[] = [];
    const name = (id: string) => state.clients.find((c) => c.id === id)?.name ?? "Former client";
    for (const ci of state.checkIns) {
      evs.push({ key: `ci-${ci.id}`, clientId: ci.clientId, ts: ci.ts, kind: "checkin", text: `${name(ci.clientId)} submitted a check-in`, meta: `${ci.weight} kg · mood ${ci.mood}/5` });
    }
    for (const s of state.subscriptions) {
      evs.push({ key: `sub-${s.id}`, clientId: s.clientId, ts: s.createdAt, kind: "subscription", text: `${name(s.clientId)} — subscription ${s.planName}`, meta: `${fmtMoney(s.price)} EGP · ends ${fmtDate(s.endDate)}` });
    }
    for (const p of state.payments) {
      if (p.status !== "Paid") continue;
      evs.push({ key: `pay-${p.id}`, clientId: p.clientId, ts: new Date(p.date + "T12:00:00").getTime(), kind: "payment", text: `Payment received from ${name(p.clientId)}`, meta: `${fmtMoney(p.amount)} EGP · ${p.method}` });
    }
    return evs.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [state]);

  const upcoming = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i + 1));
    return days
      .map((d) => ({ date: d, items: state.sessions.filter((s) => s.date === d).sort((a, b) => a.time.localeCompare(b.time)) }))
      .filter((d) => d.items.length > 0);
  }, [state.sessions, today]);

  const animActive = useCountUp(activeCount);
  const animSessions = useCountUp(todaySessions.length);
  const animCheckIns = useCountUp(freshCheckIns.length);
  const animExpiring = useCountUp(lists.expiringSoon.length + lists.expired.length);
  const animRevenue = useCountUp(revenueMonth);

  const summary =
    alerts.length > 0
      ? `${alerts.length} thing${alerts.length === 1 ? "" : "s"} need${alerts.length === 1 ? "s" : ""} your attention today.`
      : todaySessions.length > 0
        ? `You're all caught up — ${todaySessions.length} session${todaySessions.length === 1 ? "" : "s"} on the books.`
        : "You're all caught up. Quiet day ahead.";

  if (booting) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      {/* header */}
      <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">{fmtDate(today)}</p>
          <h1 className="text-balance mt-1.5 text-[30px] font-extrabold leading-[1.05] tracking-tight text-mist-100 sm:text-[36px]">
            {greeting}, <span className="text-volt-400">Coach.</span>
          </h1>
          <p className="text-balance mt-2 max-w-xl text-sm leading-6 text-mist-400">{summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => setSessionModal(true)}>
            <CalendarDays className="h-3.5 w-3.5" /> Add session
          </button>
          <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => setPaymentModal(true)}>
            <Wallet className="h-3.5 w-3.5" /> Add payment
          </button>
          <button className={`${btnPrimary} ${btnSm} !min-h-[38px]`} onClick={() => setClientModal(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> New client
          </button>
        </div>
      </header>

      {/* KPI band — separate premium cards */}
      <div className="rise grid grid-cols-2 gap-3 lg:grid-cols-5" style={{ animationDelay: "60ms" }}>
        <Kpi delay={0} label="Active clients" value={String(Math.round(animActive))} sub={`of ${state.clients.length} on the roster`} icon={<Users className="h-4 w-4" />} onClick={() => openClientsWithFilter("Active")} />
        <Kpi delay={60} label="Sessions today" value={String(Math.round(animSessions))} sub={todaySessions.length ? `${completedToday} completed` : "schedule is clear"} icon={<CalendarDays className="h-4 w-4" />} />
        <Kpi delay={120} label="New check-ins" value={String(Math.round(animCheckIns))} sub={lastCheckInClient ? `latest from ${lastCheckInClient}` : "last 24 hours"} icon={<Camera className="h-4 w-4" />} onClick={() => go("checkins")} />
        <Kpi delay={180} label="Expiring subs" value={String(Math.round(animExpiring))} sub={lists.expired.length ? `${lists.expired.length} already expired` : "within 7 days"} tone={animExpiring > 0 ? "warn" : undefined} icon={<AlertTriangle className="h-4 w-4" />} onClick={() => openClientsWithFilter("Expiring Soon")} />
        <Kpi delay={240} label="Revenue · month" value={fmtMoney(Math.round(animRevenue))} unit="EGP" sub={`${paymentsMonth} payment${paymentsMonth === 1 ? "" : "s"} collected`} icon={<Wallet className="h-4 w-4" />} className="col-span-2 lg:col-span-1" />
      </div>

      {/* current plan + usage (real backend data) */}
      <div className="rise" style={{ animationDelay: "90ms" }}>
        <CurrentPlanCard onViewPlans={() => go("pricing")} />
      </div>

      {/* attention + schedule */}
      <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-5">
        {/* needs attention */}
        <section aria-label="Needs attention" className="rise flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl lg:col-span-7" style={{ animationDelay: "120ms" }}>
          <header className="flex items-center gap-2.5 border-b border-white/[0.06] px-6 py-4">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Needs attention</h2>
            {alerts.length > 0 ? (
              <span className="rounded-full bg-danger-500/15 px-2 py-0.5 text-xs font-bold leading-5 text-danger-300 tnum ring-1 ring-danger-500/20">{alerts.length}</span>
            ) : (
              <span className="rounded-full bg-moss-400/10 px-2 py-0.5 text-xs font-bold leading-5 text-moss-300 ring-1 ring-moss-400/20">clear</span>
            )}
            {alerts.length > 0 && (
              <button className={`${btnSecondary} ${btnSm} ms-auto`} onClick={() => openClientsWithFilter("Active")}>
                Review clients <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            )}
          </header>
          {alerts.length === 0 ? (
            <div className="grid flex-1 place-items-center px-6 py-12 text-center">
              <div className="animate-pop">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss-400/10 text-moss-300 ring-1 ring-moss-400/25">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <p className="mt-3 font-display text-xl font-semibold text-mist-100">You're all caught up.</p>
                <p className="mt-1 text-xs text-mist-400">No urgent actions today — nice work keeping on top of things.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {alerts.slice(0, 6).map((a, i) => (
                <li key={a.key} className="rise" style={{ animationDelay: `${160 + i * 45}ms` }}>
                  <div className="group flex items-center gap-3.5 px-6 py-3.5 transition-colors duration-200 hover:bg-white/[0.025]">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center">
                      <span className={`absolute inset-0 rounded-full ring-4 ${SEV_RING[a.severity]}`} />
                      <Avatar name={a.client.name} photo={a.client.photo} className="h-10 w-10 text-xs" />
                      <span className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-night-950 ${SEV_DOT[a.severity]} ${a.severity === "high" ? "tick-pulse" : ""}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-mist-100">{a.client.name}</p>
                      <p className="truncate text-[13px] text-mist-400">
                        <span className={a.severity === "high" ? "font-bold text-danger-300" : a.severity === "med" ? "font-bold text-warn-300" : "font-semibold text-mist-300"}>{a.title}</span>
                        <span className="text-mist-500"> — {a.detail}</span>
                      </p>
                    </div>
                    <button
                      className={`${btnSecondary} ${btnSm} shrink-0 opacity-70 transition group-hover:border-volt-400/40 group-hover:text-volt-300 group-hover:opacity-100`}
                      onClick={() => go("client", a.client.id)}
                      aria-label={`Open ${a.client.name}`}
                    >
                      Open client
                    </button>
                  </div>
                </li>
              ))}
              {alerts.length > 6 && (
                <li className="px-6 py-3 text-center">
                  <button className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-mist-400 transition hover:text-volt-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50" onClick={() => openClientsWithFilter("Active")}>
                    + {alerts.length - 6} more in the clients list
                  </button>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* today's schedule */}
        <section aria-label="Today's schedule" className="rise flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl lg:col-span-5" style={{ animationDelay: "170ms" }}>
          <header className="flex items-center gap-2.5 border-b border-white/[0.06] px-6 py-4">
            <span className="icon-tile h-8 w-8"><Clock className="h-4 w-4" /></span>
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Today's schedule</h2>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-mist-400 tnum">{todaySessions.length}</span>
            {upcoming.length > 0 && (
              <button className={`${btnSecondary} ${btnSm} ms-auto`} onClick={() => setWeekOpen(!weekOpen)} aria-expanded={weekOpen}>
                {weekOpen ? "Hide week" : "View schedule"}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${weekOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          </header>
          {todaySessions.length === 0 ? (
            <div className="grid flex-1 place-items-center px-6 py-12 text-center">
              <div>
                <span className="icon-tile mx-auto h-12 w-12 !rounded-full">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[15px] font-bold text-mist-100">No sessions scheduled today.</p>
                <p className="mt-1 text-[13px] text-mist-400">Your schedule is clear.</p>
              </div>
            </div>
          ) : (
            <ul className="relative px-6 py-4">
              <span className="absolute bottom-6 start-[37px] top-6 w-px bg-white/[0.07]" aria-hidden />
              {todaySessions.map((s, i) => (
                <ScheduleRow key={s.id} s={s} delay={200 + i * 50} go={go} />
              ))}
            </ul>
          )}
          <div className={`grid transition-all duration-300 ease-out ${weekOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Next 7 days</p>
                <ul className="mt-2 grid gap-1.5">
                  {upcoming.map((d) => (
                    <li key={d.date} className="flex items-baseline gap-3 text-xs">
                      <span className="w-20 shrink-0 font-display text-sm font-bold text-mist-300">{WEEK_DAYS[(new Date(d.date + "T12:00:00").getDay() + 6) % 7]}</span>
                      <span className="truncate text-mist-500">
                        {d.items.map((s) => `${fmtTime(s.time)} ${state.clients.find((c) => c.id === s.clientId)?.name.split(" ")[0] ?? "?"}`).join(" · ")}
                      </span>
                      <span className="ms-auto shrink-0 font-bold text-mist-400 tnum">{d.items.length}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* recent activity */}
      <section aria-label="Recent activity" className="rise overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl" style={{ animationDelay: "220ms" }}>
        <header className="flex items-center gap-2.5 border-b border-white/[0.06] px-6 py-4">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Recent activity</h2>
          <span className="ms-auto hidden text-[11px] font-semibold text-mist-500 sm:inline">check-ins · renewals · payments</span>
        </header>
        {activity.length === 0 ? (
          <div className="grid place-items-center px-6 py-10 text-center">
            <div>
              <p className="font-display text-lg font-semibold text-mist-100">Nothing yet.</p>
              <p className="mt-1 text-xs text-mist-400">Client check-ins, renewals and payments will show up here.</p>
            </div>
          </div>
        ) : (
          <ul className="grid gap-x-2 p-2 sm:grid-cols-2">
            {activity.map((ev, i) => (
              <li key={ev.key} className="rise" style={{ animationDelay: `${250 + i * 40}ms` }}>
                <button className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-start transition-colors duration-200 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50" onClick={() => go("client", ev.clientId)}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[0.07] ${ev.kind === "checkin" ? "bg-volt-400/10 text-volt-300" : ev.kind === "subscription" ? "bg-moss-400/10 text-moss-300" : "bg-warn-400/10 text-warn-300"}`}>
                    {ev.kind === "checkin" ? <Scale className="h-4 w-4" /> : ev.kind === "subscription" ? <BadgeCheck className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-mist-100">{ev.text}</span>
                    <span className="block truncate text-xs font-medium text-mist-500">{ev.meta}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[11px] font-bold text-mist-400">{relTime(ev.ts)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-mist-500 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-volt-300 group-hover:opacity-100 rtl:rotate-180" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* progress + business health */}
      <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-5">
        <ProgressPanel checkIns={state.checkIns} clients={state.clients} go={go} />
        <BusinessPanel
          clients={state.clients}
          subscriptions={state.subscriptions}
          payments={state.payments}
          revenueMonth={revenueMonth}
          revenuePrev={revenuePrev}
          today={today}
          openClients={openClientsWithFilter}
        />
      </div>

      <ClientFormModal open={clientModal} initial={null} onClose={() => setClientModal(false)} onSaved={(c) => go("client", c.id)} onUpgrade={() => go("pricing")} />
      <SessionFormModal open={sessionModal} clientId={null} initial={null} presetDate={today} onClose={() => setSessionModal(false)} />
      <PaymentFormModal open={paymentModal} clientId={null} initial={null} subscriptions={state.subscriptions} onClose={() => setPaymentModal(false)} />
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Kpi({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  delay,
  onClick,
  className = "",
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  icon: ReactNode;
  tone?: "warn";
  delay: number;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-mist-500">{label}</span>
        <span
          className={`grid h-8 w-8 place-items-center rounded-[10px] border border-white/[0.07] bg-white/[0.03] transition ${
            tone === "warn" ? "text-warn-300" : "text-mist-400"
          } ${onClick ? "group-hover:border-volt-400/25 group-hover:text-volt-300" : ""}`}
        >
          {icon}
        </span>
      </span>
      <span className={`mt-3 block text-[30px] font-extrabold leading-8 tracking-tight tnum ${tone === "warn" ? "text-warn-300" : "text-mist-100"}`}>
        {value}
        {unit && <span className="ms-1.5 text-[13px] font-bold text-mist-500">{unit}</span>}
      </span>
      <span className="mt-1.5 block truncate text-xs font-medium text-mist-500">{sub}</span>
    </>
  );
  const cls = `rise card-lift group relative rounded-[20px] border border-white/[0.07] bg-night-900/60 p-5 text-start shadow-sm backdrop-blur-xl ${className}`;
  if (onClick) {
    return (
      <button
        onClick={onClick}
        aria-label={`${label}: ${value}. ${sub}`}
        className={`${cls} cursor-pointer hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {inner}
        <ArrowUpRight className="absolute end-4 top-4 h-4 w-4 text-mist-500 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-volt-300 group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <div className={cls} style={{ animationDelay: `${delay}ms` }}>
      {inner}
    </div>
  );
}

function ScheduleRow({ s, delay, go }: { s: Session; delay: number; go: (v: CoachView, id?: string) => void }) {
  const { state } = useApp();
  const c = state.clients.find((x) => x.id === s.clientId);
  const meta = SESSION_STATUS_META[s.status];
  const [h, m] = s.time.split(":").map(Number);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const past = (h ?? 0) * 60 + (m ?? 0) < nowMin;
  const isDone = s.status === "Completed";
  const missed = s.status === "Missed" || s.status === "Cancelled";
  return (
    <li className="rise relative flex items-center gap-3.5 py-2.5" style={{ animationDelay: `${delay}ms` }}>
      <span
        className={`relative z-10 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 bg-night-950 shadow-sm ${
          isDone ? "border-moss-400 text-moss-300" : missed ? "border-danger-400/60 text-danger-300" : past ? "border-white/15 text-mist-500" : "border-volt-400 text-volt-300"
        }`}
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : missed ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : <span className={`h-1.5 w-1.5 rounded-full bg-current ${!past ? "tick-pulse" : ""}`} />}
      </span>
      <span className="w-16 shrink-0 text-[17px] font-extrabold leading-5 tracking-tight text-mist-100 tnum">{fmtTime(s.time)}</span>
      <button className="min-w-0 flex-1 cursor-pointer rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50" onClick={() => c && go("client", c.id)} aria-label={`${c?.name ?? "Former client"} at ${fmtTime(s.time)}`}>
        <span className={`block truncate text-sm font-bold transition-colors duration-200 hover:text-volt-300 ${missed ? "text-mist-500 line-through decoration-white/20" : "text-mist-100"}`}>
          {c?.name ?? "Former client"}
        </span>
        <span className="block truncate text-xs font-medium text-mist-500">{s.type}</span>
      </button>
      <Badge className={meta.chip}>{s.status}</Badge>
    </li>
  );
}

function ProgressPanel({ checkIns, clients, go }: { checkIns: CheckIn[]; clients: Client[]; go: (v: CoachView, id?: string) => void }) {
  const candidates = useMemo(
    () =>
      clients
        .map((c) => ({ c, list: checkIns.filter((x) => x.clientId === c.id).sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts) }))
        .filter((x) => x.list.length >= 2)
        .sort((a, b) => b.list.length - a.list.length)
        .slice(0, 5),
    [clients, checkIns],
  );
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const chosen = candidates[Math.min(sel, candidates.length - 1)];
  const points = chosen?.list ?? [];
  const delta = points.length >= 2 ? Math.round((points[points.length - 1].weight - points[0].weight) * 10) / 10 : null;

  const W = 560;
  const H = 200;
  const padL = 8;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const ws = points.map((p) => p.weight);
  const min = ws.length ? Math.min(...ws) - 1 : 0;
  const max = ws.length ? Math.max(...ws) + 1 : 1;
  const x = (i: number) => padL + (W - padL - padR) * (i / Math.max(1, points.length - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min || 1));
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(" L");

  return (
    <section aria-label="Client progress" className="rise flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl lg:col-span-7" style={{ animationDelay: "260ms" }}>
      <header className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-6 py-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Client progress</h2>
        <span className="text-[11px] font-semibold text-mist-500">weight over time</span>
        {chosen && (
          <button className={`${btnSecondary} ${btnSm} ms-auto`} onClick={() => go("client", chosen.c.id)}>
            Open profile <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        )}
      </header>
      {candidates.length === 0 ? (
        <div className="grid flex-1 place-items-center px-6 py-12 text-center">
          <div>
            <span className="icon-tile mx-auto h-12 w-12 !rounded-full">
              <Scale className="h-5 w-5" />
            </span>
            <p className="mt-3 text-[15px] font-bold text-mist-100">Not enough data yet.</p>
            <p className="mt-1 text-[13px] text-mist-400">A client needs at least two check-ins before a trend can be drawn.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-1.5">
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
            {delta !== null && (
              <span className={`ms-auto text-lg font-extrabold tracking-tight tnum ${delta <= 0 ? "text-moss-300" : "text-warn-300"}`}>
                {signed(delta)} <span className="text-xs font-semibold text-mist-500">kg total</span>
              </span>
            )}
          </div>
          <div className="relative mt-3 flex-1">
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
              aria-label="Weight trend"
            >
              <defs>
                <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#cdf14b" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1={padL} x2={W - padR} y1={padT + (H - padT - padB) * f} y2={padT + (H - padT - padB) * f} stroke="#1a251d" strokeWidth="1" />
              ))}
              <path d={`M${line} L${x(points.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`} fill="url(#dashArea)" />
              <path d={`M${line}`} fill="none" stroke="#cdf14b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (hover === i ? null : <circle key={p.id} cx={x(i)} cy={y(p.weight)} r="2.6" fill="#0f1611" stroke="#cdf14b" strokeWidth="1.8" />))}
              {hover !== null && points[hover] && (
                <>
                  <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#31443a" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx={x(hover)} cy={y(points[hover].weight)} r="10" fill="#cdf14b" opacity="0.18" className="ring-pulse" />
                  <circle cx={x(hover)} cy={y(points[hover].weight)} r="4.5" fill="#cdf14b" stroke="#0f1611" strokeWidth="2" />
                </>
              )}
              <text x={x(0)} y={H - 6} textAnchor="middle" fontSize="10" fill="#7c9486">{fmtShort(points[0].date)}</text>
              <text x={x(points.length - 1)} y={H - 6} textAnchor="middle" fontSize="10" fill="#7c9486">{fmtShort(points[points.length - 1].date)}</text>
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
      )}
    </section>
  );
}

function BusinessPanel({
  clients,
  subscriptions,
  payments,
  revenueMonth,
  revenuePrev,
  today,
  openClients,
}: {
  clients: Client[];
  subscriptions: Subscription[];
  payments: { date: string; amount: number; status: string }[];
  revenueMonth: number;
  revenuePrev: number;
  today: string;
  openClients: (f: "Active" | "Expiring Soon" | "Expired") => void;
}) {
  const counts = useMemo(() => {
    const c = { Active: 0, "Expiring Soon": 0, Expired: 0, none: 0 };
    for (const cl of clients) {
      const subs = subscriptions.filter((s) => s.clientId === cl.id);
      const info = subscriptionState(currentSubscription(subs));
      if (info.state === "No Subscription") c.none += 1;
      else c[info.state] += 1;
    }
    return c;
  }, [clients, subscriptions]);

  const weeks = useMemo(() => {
    const todayDow = (new Date(today + "T12:00:00").getDay() + 6) % 7;
    const monday = addDays(today, -todayDow);
    return Array.from({ length: 6 }, (_, i) => {
      const start = addDays(monday, (i - 5) * 7);
      const end = addDays(start, 6);
      const total = payments.filter((p) => p.status === "Paid" && p.date >= start && p.date <= end).reduce((s, p) => s + p.amount, 0);
      return { start, total, current: i === 5 };
    });
  }, [payments, today]);
  const weekMax = Math.max(...weeks.map((w) => w.total), 1);
  const diff = revenueMonth - revenuePrev;

  return (
    <section aria-label="Business health" className="rise flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl lg:col-span-5" style={{ animationDelay: "300ms" }}>
      <header className="flex items-center gap-2.5 border-b border-white/[0.06] px-6 py-4">
        <span className="icon-tile h-8 w-8"><Wallet className="h-4 w-4" /></span>
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Business health</h2>
      </header>
      <div className="px-6 pt-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Subscriptions</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <SubCount label="Active" value={counts.Active} tone="text-moss-300" filter="Active" openClients={openClients} />
          <SubCount label="Expiring" value={counts["Expiring Soon"]} tone="text-warn-300" filter="Expiring Soon" openClients={openClients} />
          <SubCount label="Expired" value={counts.Expired} tone="text-danger-300" filter="Expired" openClients={openClients} />
        </div>
        {counts.none > 0 && <p className="mt-2 text-[11px] font-semibold text-mist-500">{counts.none} client{counts.none === 1 ? " has" : "s have"} no subscription</p>}
      </div>
      <div className="mx-6 my-4 border-t border-white/[0.06]" />
      <div className="flex-1 px-6 pb-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Revenue · this month</p>
            <p className="mt-1 text-[34px] font-extrabold leading-8 tracking-tight text-mist-100 tnum">
              {fmtMoney(revenueMonth)} <span className="text-sm font-bold text-mist-500">EGP</span>
            </p>
          </div>
          {revenuePrev > 0 ? (
            <span className={`mb-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tnum ring-1 ${diff >= 0 ? "bg-moss-400/10 text-moss-300 ring-moss-400/20" : "bg-danger-500/10 text-danger-300 ring-danger-500/20"}`}>
              {diff >= 0 ? "+" : ""}
              {fmtMoney(diff)} EGP vs last month
            </span>
          ) : (
            <span className="mb-1 text-[11px] font-semibold text-mist-500">no payments last month</span>
          )}
        </div>
        <div className="mt-4 flex items-end gap-2" role="img" aria-label={`Weekly revenue, last 6 weeks. This month ${fmtMoney(revenueMonth)} EGP.`}>
          {weeks.map((w, i) => (
            <div key={w.start} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span className={`text-[11px] font-bold tnum ${w.total > 0 ? "text-mist-300" : "text-white/20"}`}>{w.total > 0 ? `${Math.round(w.total / 100) / 10}k` : ""}</span>
              <div className="flex h-16 w-full items-end" title={`Week of ${fmtDate(w.start)}: ${fmtMoney(w.total)} EGP`}>
                <div
                  className={`bar-grow w-full rounded-t-[5px] ${w.current ? "bg-volt-400" : w.total > 0 ? "bg-moss-600" : "bg-white/[0.07]"}`}
                  style={{ height: w.total > 0 ? `${Math.max(8, (w.total / weekMax) * 100)}%` : "4px", animationDelay: `${i * 60}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-mist-500">last 6 weeks · paid only</p>
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
      className="group cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 text-start transition-all duration-200 hover:border-white/[0.13] hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
      title={`Open clients — ${label.toLowerCase()}`}
      aria-label={`${label}: ${value} clients`}
    >
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {label}
      </span>
      <span className={`mt-1 block text-[26px] font-extrabold leading-7 tracking-tight tnum ${value > 0 ? tone : "text-mist-500"}`}>{value}</span>
    </button>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-6">
      <div className="rise">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-10 w-80 max-w-full" />
        <Skeleton className="mt-2.5 h-4 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 lg:col-span-7">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mt-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 !rounded-[12px]" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 lg:col-span-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mt-4 flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    </div>
  );
}
