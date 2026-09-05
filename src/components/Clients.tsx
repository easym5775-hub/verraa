/* ================================================================
   FORGE — clients roster + full client profile (coach mode).
   ================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  CreditCard,
  KeyRound,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RotateCw,
  Scale,
  Search,
  Send,
  StickyNote,
  Trash2,
  User,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import type { CheckIn, Client, CoachView, Payment, Session, SubState, Subscription } from "../types";
import { FOLLOW_UP_PRESETS, GOAL_META, PAYMENT_STATUS_META, SESSION_STATUS_META, STATUS_META, SUB_PAYMENT_META, SUB_STATE_META } from "../types";
import { fmtDate, fmtMoney, fmtTime, relDay, relTime, signed, waHref } from "../lib";
import {
  attendance,
  currentSubscription,
  followUpInfo,
  latestCheckIn,
  outstandingAmount,
  progressOf,
  remainingLabel,
  sortCheckIns,
  sortSessions,
  subHistory,
  subscriptionState,
  totalPaid,
} from "../logic";
import { useApp } from "../store";
import {
  Avatar,
  Badge,
  ConfirmModal,
  EmptyState,
  Modal,
  MoodDots,
  SectionCard,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSm,
  inputCls,
  labelCls,
} from "./ui";
import { WeightLine } from "./Chart";
import {
  ClientFormModal,
  PaymentFormModal,
  PhotoModal,
  ResetPasswordModal,
  SessionFormModal,
  SubscriptionFormModal,
} from "./modals";

export type ClientsFilter = "All" | "Active" | "Inactive" | SubState;

const FILTERS: ClientsFilter[] = ["All", "Active", "Inactive", "Expiring Soon", "Expired", "No Subscription"];

/* ================================================================
   Roster
   ================================================================ */

export function ClientsView({
  go,
  initialFilter,
}: {
  go: (v: CoachView, id?: string) => void;
  initialFilter?: ClientsFilter;
}) {
  const { state, deleteClient, myClientCount, myClientLimit, myCoachPlan } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientsFilter>(initialFilter ?? "All");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const enriched = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        subInfo: subscriptionState(currentSubscription(state.subscriptions.filter((s) => s.clientId === client.id))),
        last: latestCheckIn(state.checkIns.filter((c) => c.clientId === client.id)),
      })),
    [state],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched
      .filter(({ client }) => !needle || client.name.toLowerCase().includes(needle) || client.phone.replace(/\s/g, "").includes(needle.replace(/\s/g, "")))
      .filter(({ client, subInfo }) => {
        switch (filter) {
          case "Active":
            return client.status === "Active";
          case "Inactive":
            return client.status !== "Active";
          case "Expiring Soon":
          case "Expired":
          case "No Subscription":
            return subInfo.state === filter;
          default:
            return true;
        }
      })
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [enriched, q, filter]);

  return (
    <div>
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            Client <span className="text-volt-400">roster</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">
            {state.clients.length} on the roster · {state.clients.filter((c) => c.status === "Active").length} active
            <span className="text-mist-500"> · </span>
            <button
              className="cursor-pointer font-bold text-volt-300 hover:underline"
              onClick={() => go("pricing")}
              title="Open Plans & Pricing"
            >
              {myClientLimit === null
                ? `${myClientCount} clients · ${myCoachPlan.name} (Unlimited)`
                : `${myClientCount} / ${myClientLimit} clients · ${myCoachPlan.name}`}
            </button>
          </p>
        </div>
        <button
          className={`${btnPrimary} h-11`}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Add client
        </button>
      </header>

      <div className="rise mt-5 flex flex-wrap items-center gap-3" style={{ animationDelay: "80ms" }}>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input className={`${inputCls} ps-9`} placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                filter === f ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rise mt-4 overflow-hidden rounded-2xl border border-night-700 bg-night-850" style={{ animationDelay: "140ms" }}>
        {filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<User className="h-6 w-6" />}
              title={q ? `No matches for "${q}"` : "No clients here"}
              sub={q ? "Try another search or clear the filter." : "Add your first client to start programming."}
            >
              {!q && (
                <button
                  className={`${btnPrimary} mt-2`}
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.6} /> Add client
                </button>
              )}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-night-700 bg-night-800/50 text-[11px] font-bold uppercase tracking-wider text-mist-500">
                  <th className="px-5 py-3 text-start">Client</th>
                  <th className="px-4 py-3 text-start">Goal</th>
                  <th className="px-4 py-3 text-start">Status</th>
                  <th className="px-4 py-3 text-start">Subscription</th>
                  <th className="px-4 py-3 text-start">Last check-in</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ client: c, subInfo, last }) => (
                  <tr key={c.id} className="group cursor-pointer border-b border-night-700/60 transition last:border-0 hover:bg-night-800/60" onClick={() => go("client", c.id)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} photo={c.photo} className="h-10 w-10 text-xs" />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-mist-100 transition group-hover:text-volt-300">{c.name}</p>
                          <p className="truncate text-[11px] text-mist-500">@{c.username} · {c.phone || c.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={GOAL_META[c.goal].chip}>
                        <span className={`h-1.5 w-1.5 rounded-full ${GOAL_META[c.goal].dot}`} />
                        {c.goal}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_META[c.status].chip}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot} ${c.status === "Active" ? "tick-pulse" : ""}`} />
                        {c.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {subInfo.sub ? (
                        <span className="block">
                          <Badge className={SUB_STATE_META[subInfo.state].chip}>{subInfo.state}</Badge>
                          <span className={`mt-1 block text-[11px] font-semibold ${subInfo.state === "Expired" ? "text-danger-300" : subInfo.state === "Expiring Soon" ? "text-warn-300" : "text-mist-500"}`}>
                            {remainingLabel(subInfo.daysLeft)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-mist-500">No subscription</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-mist-300">
                      {last ? (
                        <span>
                          {last.weight} kg
                          <span className="ms-2 text-[11px] text-mist-500">{relDay(last.date)}</span>
                        </span>
                      ) : (
                        <span className="text-mist-500">none yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Open profile" onClick={() => go("client", c.id)}>
                          <User className="h-4 w-4" />
                        </button>
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Workout plan" onClick={() => go("plans", c.id)}>
                          <ClipboardList className="h-4 w-4" />
                        </button>
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Meals" onClick={() => go("meals", c.id)}>
                          <UtensilsCrossed className="h-4 w-4" />
                        </button>
                        <button
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100"
                          title="Edit"
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientFormModal open={formOpen} initial={editing} onClose={() => setFormOpen(false)} onUpgrade={() => go("pricing")} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete client?"
        message={
          <>
            <strong className="text-mist-100">{deleting?.name}</strong> will be removed along with their plan, meals,
            check-ins, payments, chat and login. This cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        onConfirm={() => deleting && deleteClient(deleting.id)}
      />
    </div>
  );
}

/* ================================================================
   Client profile
   ================================================================ */

export function ClientProfile({ clientId, go }: { clientId: string; go: (v: CoachView, id?: string) => void }) {
  const app = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const client = app.state.clients.find((c) => c.id === clientId);
  const subs = useMemo(() => app.state.subscriptions.filter((s) => s.clientId === clientId), [app.state.subscriptions, clientId]);
  const payments = useMemo(() => app.state.payments.filter((p) => p.clientId === clientId), [app.state.payments, clientId]);
  const sessions = useMemo(() => app.state.sessions.filter((s) => s.clientId === clientId), [app.state.sessions, clientId]);
  const checkIns = useMemo(() => app.state.checkIns.filter((c) => c.clientId === clientId), [app.state.checkIns, clientId]);
  const plans = useMemo(() => app.state.plans.filter((p) => p.clientId === clientId), [app.state.plans, clientId]);
  const meals = useMemo(() => app.state.meals.filter((m) => m.clientId === clientId), [app.state.meals, clientId]);

  if (!client) {
    return (
      <EmptyState icon={<User className="h-6 w-6" />} title="Client not found" sub="They may have been deleted.">
        <button className={`${btnSecondary} mt-2`} onClick={() => go("clients")}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to clients
        </button>
      </EmptyState>
    );
  }

  const subInfo = subscriptionState(currentSubscription(subs));
  const wa = waHref(client.phone);

  return (
    <div>
      {/* header */}
      <div className="rise">
        <button className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-mist-400 transition hover:text-volt-300" onClick={() => go("clients")}>
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> Back to clients
        </button>
        <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
          <div className="relative flex flex-wrap items-center gap-4">
            <span className="relative">
              <Avatar name={client.name} photo={client.photo} className="h-16 w-16 rounded-xl text-xl" />
              <span className={`absolute -bottom-1 -end-1 h-3.5 w-3.5 rounded-full ring-2 ring-night-850 ${STATUS_META[client.status].dot} ${client.status === "Active" ? "tick-pulse" : ""}`} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100">{client.name}</h1>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge className={GOAL_META[client.goal].chip}>{client.goal}</Badge>
                <Badge className={STATUS_META[client.status].chip}>{client.status}</Badge>
                <Badge className={SUB_STATE_META[subInfo.state].chip}>
                  <span className={`h-1.5 w-1.5 rounded-full ${SUB_STATE_META[subInfo.state].dot}`} />
                  {subInfo.state}
                </Badge>
                <span className="text-[11px] font-semibold text-mist-500">@{client.username}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className={`${btnSecondary} ${btnSm} !border-moss-600/50 !text-moss-300 hover:!bg-moss-900`}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-semibold text-mist-500" title="No phone number available">
                  <Phone className="h-3.5 w-3.5" /> No phone number
                </span>
              )}
              <button className={`${btnSecondary} ${btnSm}`} onClick={() => setPwOpen(true)}>
                <KeyRound className="h-3.5 w-3.5" /> Reset password
              </button>
              <button className={`${btnSecondary} ${btnSm}`} onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button className={`${btnDanger} ${btnSm}`} onClick={() => setDelOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="grid content-start gap-4 lg:col-span-2">
          <SubscriptionCard subs={subs} payments={payments} clientId={client.id} />
          <CheckInsCard checkIns={checkIns} clientId={client.id} />
          <SessionsCard sessions={sessions} clientId={client.id} />
          <PaymentsCard payments={payments} subs={subs} clientId={client.id} sub={subInfo.sub} />
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanCard plans={plans} go={go} clientId={client.id} />
            <MealsCard mealsCount={meals.length} go={go} clientId={client.id} targets={client.nutritionTargets} />
          </div>
        </div>
        <div className="grid content-start gap-4">
          <ProgressCard checkIns={checkIns} sessionsCount={attendance(sessions)} />
          <FollowUpCard client={client} checkIns={checkIns} />
          <ChatThreadCard clientId={client.id} clientName={client.name} />
          <CoachNotesCard client={client} />
          <BasicInfoCard client={client} />
        </div>
      </div>

      <ClientFormModal open={editOpen} initial={client} onClose={() => setEditOpen(false)} />
      <ResetPasswordModal open={pwOpen} clientId={client.id} onClose={() => setPwOpen(false)} />
      <ConfirmModal
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Delete client?"
        message={
          <>
            <strong className="text-mist-100">{client.name}</strong> will be removed along with all their data and login.
            This cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        onConfirm={() => {
          app.deleteClient(client.id);
          go("clients");
        }}
      />
    </div>
  );
}

/* ---------------- subscription ---------------- */

function SubscriptionCard({ subs, payments, clientId }: { subs: Subscription[]; payments: Payment[]; clientId: string }) {
  const { renewSubscription } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const info = subscriptionState(currentSubscription(subs));
  const sub = info.sub;
  const meta = SUB_STATE_META[info.state];
  const history = subHistory(subs).filter((s) => s.id !== sub?.id);
  const outstanding = outstandingAmount(sub, payments);

  return (
    <SectionCard
      title="Subscription"
      icon={<CreditCard className="h-4.5 w-4.5" />}
      bodyCls="p-5"
      action={
        <div className="flex gap-1.5">
          {sub && (
            <>
              <button className={`${btnSecondary} ${btnSm}`} onClick={() => renewSubscription(sub)}>
                <RotateCw className="h-3.5 w-3.5" /> Renew
              </button>
              <button className={`${btnSecondary} ${btnSm}`} onClick={() => { setEditing(sub); setFormOpen(true); }}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            </>
          )}
          <button className={`${btnPrimary} ${btnSm}`} onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> {sub ? "New" : "Add"}
          </button>
        </div>
      }
    >
      {!sub ? (
        <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No subscription" sub="Add a plan to start tracking renewals and payments." />
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-bold uppercase leading-none text-mist-100">{sub.planName}</p>
              <p className="mt-1.5 text-xs font-semibold text-mist-500">
                {fmtDate(sub.startDate)} → {fmtDate(sub.endDate)}
              </p>
            </div>
            <div className="text-end">
              <Badge className={meta.chip}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${info.state === "Expiring Soon" ? "tick-pulse" : ""}`} />
                {info.state}
              </Badge>
              <p className={`mt-1.5 font-display text-xl font-bold tnum ${info.state === "Expired" ? "text-danger-300" : info.state === "Expiring Soon" ? "text-warn-300" : "text-moss-300"}`}>
                {remainingLabel(info.daysLeft)}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <KV k="Price" v={`${fmtMoney(sub.price)} EGP`} />
            <KV k="Payment" v={sub.paymentStatus} />
            <KV k="Outstanding" v={outstanding > 0 ? `${fmtMoney(outstanding)} EGP` : "—"} tone={outstanding > 0 ? "text-warn-300" : undefined} />
          </div>
          {history.length > 0 && (
            <div className="mt-4 border-t border-night-700 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">History ({history.length})</p>
              <ul className="mt-2 grid gap-1.5">
                {history.slice(0, 3).map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-xs text-mist-400">
                    <span className="font-bold text-mist-200">{h.planName}</span>
                    <span>{fmtDate(h.startDate)} → {fmtDate(h.endDate)}</span>
                    <span className="ms-auto font-bold text-mist-300 tnum">{fmtMoney(h.price)} EGP</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <SubscriptionFormModal open={formOpen} clientId={clientId} initial={editing} onClose={() => setFormOpen(false)} />
    </SectionCard>
  );
}

/* ---------------- check-ins ---------------- */

function CheckInsCard({ checkIns, clientId }: { checkIns: CheckIn[]; clientId: string }) {
  const { deleteCheckIn } = useApp();
  const [detail, setDetail] = useState<CheckIn | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CheckIn | null>(null);
  const sorted = sortCheckIns(checkIns);
  const latest = sorted[0] ?? null;

  return (
    <SectionCard title={`Check-ins (${checkIns.length})`} icon={<Camera className="h-4.5 w-4.5" />} bodyCls="p-5">
      {checkIns.length === 0 ? (
        <EmptyState icon={<Camera className="h-6 w-6" />} title="No check-ins submitted yet" sub="They'll appear here the moment the client logs their first day." />
      ) : (
        <>
          {latest && (
            <div className="rounded-xl border border-volt-400/20 bg-volt-400/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-volt-300">Latest · {relDay(latest.date)}</p>
                <Badge className={latest.workoutDone ? "border-moss-400/25 bg-moss-400/10 text-moss-300" : "border-danger-500/25 bg-danger-500/10 text-danger-300"}>
                  {latest.workoutDone ? "Workout done" : "Skipped"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KV k="Weight" v={`${latest.weight} kg`} />
                <KV k="Waist" v={latest.waist !== undefined ? `${latest.waist} cm` : "—"} />
                <KV k="Water" v={`${latest.water} L`} />
                <div className="rounded-xl border border-night-700 bg-night-800 p-3">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Mood</p>
                  <div className="mt-2"><MoodDots mood={latest.mood} /></div>
                </div>
              </div>
              {latest.notes && <p className="mt-3 text-xs italic text-mist-400">"{latest.notes}"</p>}
              {latest.photo && (
                <button className="mt-3 cursor-zoom-in" onClick={() => setPhoto(latest.photo ?? null)}>
                  <img src={latest.photo} alt="Progress" className="h-20 rounded-xl object-cover ring-1 ring-night-600 transition-all duration-200 hover:ring-volt-400" />
                </button>
              )}
            </div>
          )}
          {sorted.length > 1 && (
            <ul className="mt-4 grid gap-1.5">
              {sorted.slice(1, 6).map((ci) => (
                <li key={ci.id}>
                  <button className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5 text-start transition-all duration-200 hover:border-night-500" onClick={() => setDetail(ci)}>
                    <span className="w-24 shrink-0 text-xs font-bold text-mist-300">{relDay(ci.date)}</span>
                    <span className="text-xs text-mist-400 tnum">{ci.weight} kg{ci.waist !== undefined ? ` · ${ci.waist} cm` : ""}</span>
                    <MoodDots mood={ci.mood} />
                    <span className="ms-auto text-[11px] font-bold text-mist-500 transition group-hover:text-volt-300">View →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Check-in · ${fmtDate(detail.date)}`} description="Full daily record">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KV k="Weight" v={`${detail.weight} kg`} />
            <KV k="Waist" v={detail.waist !== undefined ? `${detail.waist} cm` : "—"} />
            <KV k="Water" v={`${detail.water} L`} />
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Mood</p>
              <div className="mt-2"><MoodDots mood={detail.mood} /></div>
            </div>
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Workout</p>
              <p className={`mt-1 font-display text-lg font-bold ${detail.workoutDone ? "text-moss-300" : "text-danger-300"}`}>{detail.workoutDone ? "Done" : "Skipped"}</p>
            </div>
          </div>
          {detail.notes && (
            <div className="mt-3 rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Client notes</p>
              <p className="mt-1.5 text-sm leading-6 text-mist-200">"{detail.notes}"</p>
            </div>
          )}
          {detail.photo && (
            <div className="mt-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Progress photo</p>
              <button className="mt-1.5 cursor-zoom-in" onClick={() => setPhoto(detail.photo ?? null)}>
                <img src={detail.photo} alt="Progress" className="h-32 rounded-xl object-cover ring-1 ring-night-600 transition-all duration-200 hover:ring-volt-400" />
              </button>
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button className={`${btnDanger} ${btnSm}`} onClick={() => { setDeleting(detail); setDetail(null); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete check-in
            </button>
          </div>
        </Modal>
      )}

      <PhotoModal src={photo} onClose={() => setPhoto(null)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete check-in?"
        message={<>The check-in from {deleting ? relDay(deleting.date) : ""} ({deleting?.weight} kg) will be removed.</>}
        onConfirm={() => deleting && deleteCheckIn(deleting.id)}
      />
      <span className="hidden">{clientId}</span>
    </SectionCard>
  );
}

/* ---------------- sessions ---------------- */

function SessionsCard({ sessions, clientId }: { sessions: Session[]; clientId: string }) {
  const { setSessionStatus, deleteSession } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const sorted = sortSessions(sessions);
  const att = attendance(sessions);

  return (
    <SectionCard
      title="Sessions"
      icon={<CalendarDays className="h-4.5 w-4.5" />}
      bodyCls="p-5"
      action={
        <button className={`${btnPrimary} ${btnSm}`} onClick={() => setFormOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Book
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-night-700 bg-night-800/60 px-4 py-3">
        <p className="text-xs font-bold text-mist-300">
          Attendance: <span className="font-display text-lg text-volt-300 tnum">{att.completed}/{att.countable}</span>
        </p>
        <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-night-700">
          <div className="grow-x h-full rounded-full bg-volt-400" style={{ width: `${att.pct}%` }} />
        </div>
        <p className="font-display text-lg font-bold text-mist-100 tnum">{att.pct}%</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No sessions" sub="Book the first session for this client." />
      ) : (
        <ul className="grid gap-1.5">
          {sorted.map((s) => {
            const meta = SESSION_STATUS_META[s.status];
            return (
              <li key={s.id} className="group flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5 transition-all duration-200 hover:border-night-500">
                <span className="w-24 shrink-0 text-xs font-bold text-mist-300">{relDay(s.date)}</span>
                <span className="w-20 shrink-0 font-display text-base font-bold text-mist-100 tnum">{fmtTime(s.time)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-mist-400">{s.type}</span>
                <Badge className={meta.chip}>{s.status}</Badge>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {s.status !== "Completed" && (
                    <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-moss-300 transition hover:bg-moss-400/15" title="Mark completed" onClick={() => setSessionStatus(s.id, "Completed")}>
                      <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </button>
                  )}
                  {s.status !== "Missed" && s.status !== "Cancelled" && (
                    <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-warn-300 transition hover:bg-warn-400/15" title="Mark missed" onClick={() => setSessionStatus(s.id, "Missed")}>
                      <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </button>
                  )}
                  <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={() => setDeleting(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SessionFormModal open={formOpen} clientId={clientId} initial={null} onClose={() => setFormOpen(false)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete session?"
        message={<>The {deleting?.type} session on {deleting ? relDay(deleting.date) : ""} will be removed.</>}
        onConfirm={() => deleting && deleteSession(deleting.id)}
      />
    </SectionCard>
  );
}

/* ---------------- payments ---------------- */

function PaymentsCard({ payments, subs, clientId, sub }: { payments: Payment[]; subs: Subscription[]; clientId: string; sub: Subscription | null }) {
  const { deletePayment } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date));
  const outstanding = outstandingAmount(sub, payments);

  return (
    <SectionCard
      title="Payments"
      icon={<Wallet className="h-4.5 w-4.5" />}
      bodyCls="p-5"
      action={
        <button className={`${btnPrimary} ${btnSm}`} onClick={() => setFormOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Record
        </button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-3">
        <KV k="Total paid" v={`${fmtMoney(totalPaid(payments))} EGP`} tone="text-moss-300" />
        <KV k="Current plan" v={sub ? `${fmtMoney(sub.price)} EGP` : "—"} />
        <KV k="Outstanding" v={outstanding > 0 ? `${fmtMoney(outstanding)} EGP` : "—"} tone={outstanding > 0 ? "text-warn-300" : undefined} />
      </div>
      {sorted.length === 0 ? (
        <EmptyState icon={<Wallet className="h-6 w-6" />} title="No payments" sub="Record the first payment for this client." />
      ) : (
        <ul className="grid gap-1.5">
          {sorted.map((p) => {
            const linked = subs.find((s) => s.id === p.subscriptionId);
            return (
              <li key={p.id} className="group flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5 transition-all duration-200 hover:border-night-500">
                <span className="w-24 shrink-0 text-xs font-bold text-mist-300">{relDay(p.date)}</span>
                <span className="font-display text-lg font-bold text-mist-100 tnum">{fmtMoney(p.amount)} <span className="text-xs font-semibold text-mist-500">EGP</span></span>
                <span className="min-w-0 flex-1 truncate text-xs text-mist-400">{p.method}{linked ? ` · ${linked.planName}` : ""}</span>
                <Badge className={PAYMENT_STATUS_META[p.status].chip}>{p.status}</Badge>
                <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 opacity-0 transition hover:bg-danger-500/15 hover:text-danger-300 group-hover:opacity-100" title="Delete" onClick={() => setDeleting(p)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PaymentFormModal open={formOpen} clientId={clientId} initial={null} subscriptions={subs} onClose={() => setFormOpen(false)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete payment?"
        message={<>{deleting ? fmtMoney(deleting.amount) : 0} EGP from {deleting ? relDay(deleting.date) : ""} will be removed.</>}
        onConfirm={() => deleting && deletePayment(deleting.id)}
      />
    </SectionCard>
  );
}

/* ---------------- plan / meals summaries ---------------- */

function PlanCard({ plans, go, clientId }: { plans: { id: string; day: number }[]; go: (v: CoachView, id?: string) => void; clientId: string }) {
  const days = [...new Set(plans.map((p) => p.day))].sort((a, b) => a - b);
  return (
    <SectionCard title="Workout plan" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-5">
      {plans.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No plan yet" sub="Build their weekly split." />
      ) : (
        <>
          <p className="font-display text-3xl font-bold text-mist-100 tnum">
            {plans.length} <span className="text-sm font-semibold text-mist-500">exercises</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-mist-400">across {days.length} training day{days.length === 1 ? "" : "s"}</p>
        </>
      )}
      <button className={`${btnSecondary} ${btnSm} mt-4 w-full`} onClick={() => go("plans", clientId)}>
        Open plan editor <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </SectionCard>
  );
}

function MealsCard({ mealsCount, go, clientId, targets }: { mealsCount: number; go: (v: CoachView, id?: string) => void; clientId: string; targets?: { calories: number } }) {
  return (
    <SectionCard title="Nutrition" icon={<UtensilsCrossed className="h-4.5 w-4.5" />} bodyCls="p-5">
      {mealsCount === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-6 w-6" />} title="No meals assigned" sub="Set targets and assign meals." />
      ) : (
        <>
          <p className="font-display text-3xl font-bold text-mist-100 tnum">
            {mealsCount} <span className="text-sm font-semibold text-mist-500">meals</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-mist-400">
            {targets ? `target ${fmtMoney(targets.calories)} kcal/day` : "no daily target set"}
          </p>
        </>
      )}
      <button className={`${btnSecondary} ${btnSm} mt-4 w-full`} onClick={() => go("meals", clientId)}>
        Open meal planner <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </SectionCard>
  );
}

/* ---------------- progress + attendance ---------------- */

function ProgressCard({ checkIns, sessionsCount }: { checkIns: CheckIn[]; sessionsCount: { completed: number; countable: number; pct: number } }) {
  const prog = progressOf(checkIns);
  const sorted = useMemo(() => [...checkIns].sort((a, b) => a.date.localeCompare(a.date) || a.ts - b.ts), [checkIns]);
  return (
    <SectionCard title="Progress" icon={<Scale className="h-4.5 w-4.5" />} bodyCls="p-5">
      <div className="grid grid-cols-3 gap-2">
        <KV k="Start" v={prog.startWeight !== null ? `${prog.startWeight} kg` : "—"} />
        <KV k="Current" v={prog.currentWeight !== null ? `${prog.currentWeight} kg` : "—"} />
        <KV k="Change" v={prog.weightChange !== null ? `${signed(prog.weightChange)} kg` : "—"} tone={prog.weightChange !== null && prog.weightChange <= 0 ? "text-moss-300" : "text-warn-300"} />
      </div>
      {prog.waistChange !== null && (
        <p className="mt-2 text-[11px] font-semibold text-mist-500">
          Waist: {prog.startWaist} → {prog.currentWaist} cm ({signed(prog.waistChange)})
        </p>
      )}
      <div className="mt-4">
        <WeightLine entries={sorted} />
      </div>
      <div className="mt-4 border-t border-night-700 pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Attendance</p>
        <p className="mt-1 text-xs font-bold text-mist-300">
          {sessionsCount.completed}/{sessionsCount.countable} sessions · <span className="font-display text-base text-volt-300 tnum">{sessionsCount.pct}%</span>
        </p>
      </div>
    </SectionCard>
  );
}

/* ---------------- follow-up ---------------- */

function FollowUpCard({ client, checkIns }: { client: Client; checkIns: CheckIn[] }) {
  const { setFollowUpDays, markFollowUpDone } = useApp();
  const info = followUpInfo(client, checkIns);
  return (
    <SectionCard title="Follow-up" icon={<RotateCw className="h-4.5 w-4.5" />} bodyCls="p-5">
      <p className={`font-display text-2xl font-bold ${info.overdue ? "text-danger-300" : info.daysToNext !== null && info.daysToNext <= 1 ? "text-warn-300" : "text-mist-100"}`}>
        {info.label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-mist-500">
        every {info.frequency} day{info.frequency === 1 ? "" : "s"} · from {info.basis ? relDay(info.basis) : "first check-in"}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[...FOLLOW_UP_PRESETS, 30].map((d) => (
          <button
            key={d}
            onClick={() => setFollowUpDays(client.id, d)}
            className={`cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-bold transition ${
              info.frequency === d ? "border-volt-400 bg-volt-400/15 text-volt-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>
      <button className={`${btnSecondary} ${btnSm} mt-4 w-full`} onClick={() => markFollowUpDone(client.id)}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Mark follow-up done today
      </button>
    </SectionCard>
  );
}

/* ---------------- chat thread (coach side) ---------------- */

function ChatThreadCard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { state, sendMessage, markNotificationRead } = useApp();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const thread = useMemo(
    () => state.messages.filter((m) => m.clientId === clientId).sort((a, b) => a.createdAt - b.createdAt),
    [state.messages, clientId],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length]);

  useEffect(() => {
    // Opening the thread clears the client's unread "message" pings.
    state.notifications
      .filter((n) => n.clientId === clientId && n.kind === "message" && !n.read)
      .forEach((n) => markNotificationRead(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, thread.length]);

  const submit = () => {
    if (!draft.trim()) return;
    sendMessage(clientId, draft);
    setDraft("");
  };

  return (
    <SectionCard title={`Chat · ${clientName.split(" ")[0]}`} icon={<MessageCircle className="h-4.5 w-4.5" />} bodyCls="p-0">
      <div className="flex h-72 flex-col">
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {thread.length === 0 && (
            <p className="grid h-full place-items-center text-center text-xs text-mist-500">No messages yet.<br />Say hi — it lands on their Chat tab.</p>
          )}
          {thread.map((m) => {
            const mine = m.senderRole === "coach";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2 ${mine ? "rounded-ee-sm bg-volt-400 text-night-950" : "rounded-es-sm border border-night-600 bg-night-800 text-mist-100"}`}>
                  <p className="text-sm font-semibold leading-5">{m.text}</p>
                  <p className={`mt-0.5 text-[10px] font-bold ${mine ? "text-night-950/60" : "text-mist-500"}`}>{relTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 border-t border-night-700 p-3">
          <input
            className={`${inputCls} h-11 min-w-0 flex-1`}
            placeholder={`Message ${clientName.split(" ")[0]}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button onClick={submit} disabled={!draft.trim()} className={`${btnPrimary} h-11 shrink-0 px-4`} aria-label="Send">
            <Send className="h-4 w-4 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

/* ---------------- coach notes ---------------- */

function CoachNotesCard({ client }: { client: Client }) {
  const { addCoachNote, updateCoachNote, deleteCoachNote } = useApp();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const notes = [...(client.coachNotes ?? [])].sort((a, b) => b.createdAt - a.createdAt);

  const add = () => {
    if (!draft.trim()) return;
    addCoachNote(client.id, draft.trim());
    setDraft("");
  };

  return (
    <SectionCard title="Coach notes" icon={<StickyNote className="h-4.5 w-4.5" />} bodyCls="p-5">
      <div className="flex gap-2">
        <input className={`${inputCls} h-10 min-w-0 flex-1`} placeholder="Private note — the client never sees this…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} disabled={!draft.trim()} className={`${btnPrimary} h-10 shrink-0 px-3.5`} aria-label="Add note">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-night-600 px-4 py-5 text-center text-xs text-mist-500">No notes yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-xl border border-night-700 bg-night-800 p-3">
              {editingId === n.id ? (
                <div className="flex gap-2">
                  <input className={`${inputCls} h-9 min-w-0 flex-1`} value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { updateCoachNote(client.id, n.id, editText.trim()); setEditingId(null); } }} autoFocus />
                  <button className={`${btnPrimary} h-9 px-3`} onClick={() => { updateCoachNote(client.id, n.id, editText.trim()); setEditingId(null); }}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold leading-6 text-mist-100">{n.text}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-mist-500">{relTime(n.createdAt)}</span>
                    <span className="ms-auto flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100" title="Edit" onClick={() => { setEditingId(n.id); setEditText(n.text); }}>
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={() => setDeleting(n.id)}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete note?"
        message="This private note will be removed."
        onConfirm={() => deleting && deleteCoachNote(client.id, deleting)}
      />
    </SectionCard>
  );
}

/* ---------------- basic info ---------------- */

function BasicInfoCard({ client }: { client: Client }) {
  const wa = waHref(client.phone);
  return (
    <SectionCard title="Basic info" icon={<User className="h-4.5 w-4.5" />} bodyCls="p-5">
      <dl className="grid gap-2.5 text-sm">
        <InfoRow k="Username" v={`@${client.username}`} />
        <InfoRow k="Phone" v={client.phone || "—"} />
        <InfoRow k="Email" v={client.email || "—"} />
        <InfoRow k="Age" v={client.age !== undefined ? String(client.age) : "—"} />
        <InfoRow k="Gender" v={client.gender ?? "—"} />
        <InfoRow k="Joined" v={fmtDate(client.startDate)} />
        {client.notes && <InfoRow k="Notes" v={client.notes} />}
      </dl>
      <div className="mt-4 flex gap-2">
        {client.email && (
          <a href={`mailto:${client.email}`} className={`${btnSecondary} ${btnSm} flex-1`}>
            <Mail className="h-3.5 w-3.5" /> Email
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className={`${btnSecondary} ${btnSm} flex-1`}>
            <Phone className="h-3.5 w-3.5" /> Call / WhatsApp
          </a>
        )}
      </div>
    </SectionCard>
  );
}

function InfoRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-night-700/60 pb-2 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-mist-500">{k}</dt>
      <dd className="min-w-0 truncate text-end font-semibold text-mist-200">{v}</dd>
    </div>
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-800 p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">{k}</p>
      <p className={`mt-1 font-display text-lg font-bold tnum ${tone ?? "text-mist-100"}`}>{v}</p>
    </div>
  );
}
