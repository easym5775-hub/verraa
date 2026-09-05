import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CheckIn,
  CoachView,
  Payment,
  Session,
  SessionStatus,
  Subscription,
} from "../types";
import { FOLLOW_UP_PRESETS, MEAL_META, SESSION_STATUS_META, SUB_STATE_META, WEEK_DAYS } from "../types";
import { fmtDate, fmtMoney, relDay, signed, todayISO, waHref } from "../lib";
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
  MoodDots,
  SectionCard,
  btnDanger,
  btnGhost,
  btnVolt,
  chip,
  inputCls,
  labelCls,
} from "./ui";
import { WeightLine } from "./Chart";
import {
  ClientFormModal,
  NutritionTargetsModal,
  PaymentFormModal,
  PhotoModal,
  SessionFormModal,
  SubscriptionFormModal,
} from "./modals";
import {
  IconArrowLeft,
  IconBell,
  IconCalendar,
  IconCheck,
  IconClipboard,
  IconDrop,
  IconNote,
  IconPencil,
  IconPhone,
  IconPlus,
  IconScale,
  IconTrash,
  IconTrendDown,
  IconTrendUp,
  IconUtensils,
  IconWallet,
  IconWhatsapp,
  IconX,
} from "../icons";

/* ================================================================== */

export function ClientProfile({ clientId, go }: { clientId: string; go: (v: CoachView, id?: string) => void }) {
  const app = useApp();
  const { state } = app;
  const client = state.clients.find((c) => c.id === clientId);

  const subs = useMemo(() => state.subscriptions.filter((s) => s.clientId === clientId), [state.subscriptions, clientId]);
  const payments = useMemo(() => state.payments.filter((p) => p.clientId === clientId), [state.payments, clientId]);
  const sessions = useMemo(() => state.sessions.filter((s) => s.clientId === clientId), [state.sessions, clientId]);
  const checkIns = useMemo(() => state.checkIns.filter((c) => c.clientId === clientId), [state.checkIns, clientId]);
  const plans = useMemo(() => state.plans.filter((p) => p.clientId === clientId), [state.plans, clientId]);
  const meals = useMemo(() => state.meals.filter((m) => m.clientId === clientId), [state.meals, clientId]);

  /* modal state */
  const [editOpen, setEditOpen] = useState(false);
  const [subModal, setSubModal] = useState<{ open: boolean; initial: Subscription | null }>({ open: false, initial: null });
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [payModal, setPayModal] = useState<{ open: boolean; initial: Payment | null }>({ open: false, initial: null });
  const [confirmDeletePayment, setConfirmDeletePayment] = useState<Payment | null>(null);
  const [sessionModal, setSessionModal] = useState<{ open: boolean; initial: Session | null }>({ open: false, initial: null });
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<Session | null>(null);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [detail, setDetail] = useState<CheckIn | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [confirmDeleteCheckIn, setConfirmDeleteCheckIn] = useState<CheckIn | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: string; text: string } | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const [customFreq, setCustomFreq] = useState("");

  if (!client) {
    return (
      <div>
        <button className={`${btnGhost} mb-4`} onClick={() => go("clients")}>
          <IconArrowLeft className="h-4 w-4" />
          Back to Clients
        </button>
        <EmptyState icon={<IconX className="h-6 w-6" />} title="Client not found" sub="This client may have been deleted." />
      </div>
    );
  }

  /* derived business data */
  const current = currentSubscription(subs);
  const subInfo = subscriptionState(current);
  const history = subHistory(subs);
  const outstanding = outstandingAmount(current, payments);
  const paid = totalPaid(payments);
  const att = attendance(sessions);
  const fu = followUpInfo(client, checkIns);
  const prog = progressOf(checkIns);
  const latest = latestCheckIn(checkIns);
  const wa = waHref(client.phone);
  const sortedSessions = sortSessions(sessions);
  const upcoming = sortedSessions.filter((s) => s.date >= todayISO() && s.status !== "Cancelled" && s.status !== "Completed" && s.status !== "Missed");
  const pastSessions = [...sortedSessions].reverse();
  const planDays = [...new Set(plans.map((p) => p.day))].sort((a, b) => a - b);

  const addNote = () => {
    if (!noteText.trim()) return;
    app.addCoachNote(client.id, noteText.trim());
    setNoteText("");
  };

  return (
    <div>
      {/* header */}
      <button className={`${btnGhost} mb-4 px-3! py-1.5! text-xs`} onClick={() => go("clients")}>
        <IconArrowLeft className="h-4 w-4" />
        Back to Clients
      </button>

      <div className="rise flex flex-wrap items-center gap-4">
        <Avatar name={client.name} photo={client.photo} className="h-16 w-16 rounded-xl text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            {client.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={`chip ${GOAL_CHIP[client.goal]}`}>{client.goal}</Badge>
            <Badge className={STATUS_CHIP[client.status]}>{client.status}</Badge>
            <Badge className={SUB_STATE_META[subInfo.state].chip}>
              <span className={`h-1.5 w-1.5 rounded-full ${SUB_STATE_META[subInfo.state].dot}`} />
              {subInfo.state === "No Subscription" ? "No Subscription" : `${subInfo.state} · ${remainingLabel(subInfo.daysLeft)}`}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`${btnGhost}`} onClick={() => setEditOpen(true)}>
            <IconPencil className="h-4 w-4" />
            Edit Client
          </button>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-bold text-night-950 shadow-[0_8px_24px_-10px_rgba(37,211,102,0.6)] transition hover:brightness-110 active:scale-[0.98]"
            >
              <IconWhatsapp className="h-4.5 w-4.5" />
              Contact on WhatsApp
            </a>
          ) : (
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-night-600 bg-night-800 px-4 py-2 text-sm font-bold text-mist-500" title="No phone number available">
              <IconWhatsapp className="h-4.5 w-4.5" />
              No phone number
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* ================= main column ================= */}
        <div className="space-y-4 lg:col-span-2">
          {/* Progress overview */}
          <SectionCard title="Progress Overview" icon={<IconScale className="h-5 w-5" />} delay={60} bodyCls="p-5">
            {prog.currentWeight === null ? (
              <EmptyState icon={<IconScale className="h-6 w-6" />} title="No progress yet" sub="Progress is calculated from check-ins — none submitted yet." />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Starting" value={`${prog.startWeight}`} unit="kg" />
                  <Stat label="Current" value={`${prog.currentWeight}`} unit="kg" />
                  <Stat
                    label="Weight Change"
                    value={prog.weightChange === null ? "—" : signed(prog.weightChange)}
                    unit="kg"
                    tone={prog.weightChange === null ? undefined : prog.weightChange <= 0 ? "good" : "warn"}
                    trend={prog.weightChange === null ? undefined : prog.weightChange <= 0 ? "down" : "up"}
                  />
                  <Stat
                    label="Waist"
                    value={prog.currentWaist === null ? "—" : `${prog.currentWaist}`}
                    unit={prog.currentWaist === null ? "" : "cm"}
                    sub={prog.waistChange !== null ? `${signed(prog.waistChange)} cm` : undefined}
                  />
                </div>
                <div className="mt-4">
                  <WeightLine entries={checkIns} />
                </div>
              </>
            )}
          </SectionCard>

          {/* Latest check-in */}
          <SectionCard title="Latest Check-in" icon={<IconCheck className="h-5 w-5" />} delay={110} bodyCls="p-5">
            {!latest ? (
              <p className="text-sm font-semibold text-mist-500">No check-in submitted yet.</p>
            ) : (
              <div className="rounded-lg border border-night-700 bg-night-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display text-lg font-bold uppercase tracking-wide text-volt-300">{relDay(latest.date)}</p>
                  <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => setDetail(latest)}>
                    View full check-in
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniStat label="Weight" value={`${latest.weight} kg`} />
                  <MiniStat label="Waist" value={latest.waist !== undefined ? `${latest.waist} cm` : "—"} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Mood</p>
                    <div className="mt-1.5"><MoodDots mood={latest.mood} /></div>
                  </div>
                  <MiniStat label="Water" value={`${latest.water} L`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={latest.workoutDone ? "border-volt-400/25 bg-volt-400/10 text-volt-300" : "border-danger-500/25 bg-danger-500/10 text-danger-300"}>
                    {latest.workoutDone ? <IconCheck className="h-3 w-3" strokeWidth={2.6} /> : <IconX className="h-3 w-3" strokeWidth={2.6} />}
                    {latest.workoutDone ? "Workout done" : "Workout skipped"}
                  </Badge>
                  {latest.notes && <span className="truncate text-xs italic text-mist-400">"{latest.notes}"</span>}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Check-in history */}
          <SectionCard title={`Check-in History (${checkIns.length})`} icon={<IconClipboard className="h-5 w-5" />} delay={160} bodyCls="p-3">
            {checkIns.length === 0 ? (
              <div className="p-2">
                <EmptyState icon={<IconClipboard className="h-6 w-6" />} title="No check-ins" sub="Every check-in this client submits will appear here, newest first." />
              </div>
            ) : (
              <ul className="grid gap-2">
                {sortCheckIns(checkIns).map((ci) => (
                  <li key={ci.id} className="group flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
                    <button className="min-w-0 flex-1 cursor-pointer text-start" onClick={() => setDetail(ci)}>
                      <p className="text-sm font-bold text-mist-100">{fmtDate(ci.date)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-mist-400">
                        <span className="text-mist-200">Weight: {ci.weight} kg</span>
                        {ci.waist !== undefined && <span>Waist: {ci.waist} cm</span>}
                        <MoodDots mood={ci.mood} />
                      </p>
                    </button>
                    <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => setDetail(ci)}>
                      View Check-in
                    </button>
                    <button
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 opacity-60 transition hover:bg-danger-500/15 hover:text-danger-300 group-hover:opacity-100"
                      title="Delete check-in"
                      onClick={() => setConfirmDeleteCheckIn(ci)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Sessions + attendance */}
          <SectionCard
            title="Sessions"
            icon={<IconCalendar className="h-5 w-5" />}
            delay={210}
            bodyCls="p-3"
            action={
              <div className="flex items-center gap-2">
                <span className={`${chip} border-moss-400/25 bg-moss-400/10 text-moss-300`} title="Attendance = completed / non-cancelled sessions">
                  Attendance {att.completed}/{att.countable} · {att.pct}%
                </span>
                <button className={`${btnVolt} px-3! py-1.5! text-xs`} onClick={() => setSessionModal({ open: true, initial: null })}>
                  <IconPlus className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Book
                </button>
              </div>
            }
          >
            {sessions.length === 0 ? (
              <div className="p-2">
                <EmptyState icon={<IconCalendar className="h-6 w-6" />} title="No sessions" sub="Book the first session for this client." />
              </div>
            ) : (
              <div className="grid gap-4">
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-mist-500">Upcoming</p>
                  {upcoming.length === 0 ? (
                    <p className="px-2 pb-2 text-xs font-semibold text-mist-500">Nothing scheduled ahead.</p>
                  ) : (
                    <ul className="grid gap-2">
                      {upcoming.map((s) => (
                        <SessionRow key={s.id} session={s} onEdit={() => setSessionModal({ open: true, initial: s })} onDelete={() => setConfirmDeleteSession(s)} />
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-mist-500">History</p>
                  <ul className="grid gap-2">
                    {pastSessions.slice(0, 8).map((s) => (
                      <SessionRow key={s.id} session={s} onEdit={() => setSessionModal({ open: true, initial: s })} onDelete={() => setConfirmDeleteSession(s)} />
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Coach notes */}
          <SectionCard title="Coach Notes" icon={<IconNote className="h-5 w-5" />} delay={260} bodyCls="p-4">
            <p className="mb-3 text-[11px] font-semibold text-mist-500">Private notes — the client never sees these, and they are separate from check-in notes.</p>
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Write a note… (e.g. watch the left shoulder on presses)"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
              />
              <button className={`${btnVolt} shrink-0`} onClick={addNote} disabled={!noteText.trim()}>
                <IconPlus className="h-4 w-4" strokeWidth={2.4} />
                Add
              </button>
            </div>
            {(client.coachNotes ?? []).length === 0 ? (
              <p className="mt-4 text-center text-xs font-semibold text-mist-500">No coach notes yet.</p>
            ) : (
              <ul className="mt-4 grid gap-2">
                {[...(client.coachNotes ?? [])].sort((a, b) => b.createdAt - a.createdAt).map((n) => (
                  <li key={n.id} className="group rounded-lg border border-night-700 bg-night-800 p-3">
                    {editingNote?.id === n.id ? (
                      <div className="flex gap-2">
                        <input className={inputCls} value={editingNote.text} onChange={(e) => setEditingNote({ id: n.id, text: e.target.value })} autoFocus />
                        <button className={`${btnVolt} shrink-0 px-3!`} onClick={() => { app.updateCoachNote(client.id, n.id, editingNote.text.trim()); setEditingNote(null); }}>
                          Save
                        </button>
                        <button className={`${btnGhost} shrink-0 px-3!`} onClick={() => setEditingNote(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-6 text-mist-100">{n.text}</p>
                          <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wider text-mist-500">{fmtDate(new Date(n.createdAt).toISOString().split("T")[0])}</p>
                        </div>
                        <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-mist-100" title="Edit note" onClick={() => setEditingNote({ id: n.id, text: n.text })}>
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete note" onClick={() => setConfirmDeleteNote(n.id)}>
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* ================= side column ================= */}
        <div className="space-y-4">
          {/* Basic information */}
          <SectionCard title="Basic Information" icon={<IconPhone className="h-5 w-5" />} delay={90} bodyCls="p-4">
            <dl className="grid gap-2.5 text-sm">
              <InfoRow label="Phone" value={client.phone || "—"} />
              <InfoRow label="Email" value={client.email || "—"} />
              <InfoRow label="Age" value={client.age !== undefined ? `${client.age}` : "—"} />
              <InfoRow label="Gender" value={client.gender ?? "—"} />
              <InfoRow label="Goal" value={client.goal} />
              <InfoRow label="Join date" value={fmtDate(client.startDate)} />
              <InfoRow label="Status" value={client.status} />
            </dl>
            {client.notes && (
              <p className="mt-3 rounded-lg border border-night-700 bg-night-800 p-3 text-xs leading-5 text-mist-300">{client.notes}</p>
            )}
          </SectionCard>

          {/* Subscription */}
          <SectionCard
            title="Subscription"
            icon={<IconClipboard className="h-5 w-5" />}
            delay={140}
            bodyCls="p-4"
            action={
              <button className={`${btnVolt} px-3! py-1.5! text-xs`} onClick={() => setSubModal({ open: true, initial: null })}>
                <IconPlus className="h-3.5 w-3.5" strokeWidth={2.4} />
                Add
              </button>
            }
          >
            {!current ? (
              <p className="text-xs font-bold uppercase tracking-wider text-mist-500">No Subscription</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-xl font-bold text-mist-100">{current.planName}</p>
                  <Badge className={SUB_STATE_META[subInfo.state].chip}>
                    <span className={`h-1.5 w-1.5 rounded-full ${SUB_STATE_META[subInfo.state].dot} ${subInfo.state === "Active" ? "tick-pulse" : ""}`} />
                    {subInfo.state}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <InfoRow label="Start" value={fmtDate(current.startDate)} />
                  <InfoRow label="End" value={fmtDate(current.endDate)} />
                  <InfoRow label="Remaining" value={remainingLabel(subInfo.daysLeft)} strong />
                  <InfoRow label="Price" value={fmtMoney(current.price)} />
                  <InfoRow label="Payment" value={current.paymentStatus} />
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={`${btnVolt} px-3! py-1.5! text-xs`} onClick={() => setConfirmRenew(true)}>
                    Renew
                  </button>
                  <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => setSubModal({ open: true, initial: current })}>
                    <IconPencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </>
            )}

            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-mist-500">History</p>
            {history.length === 0 ? (
              <p className="text-xs font-semibold text-mist-500">No subscription history.</p>
            ) : (
              <ul className="grid gap-1.5">
                {history.map((s) => {
                  const si = subscriptionState(s);
                  const isCurrent = s.id === current?.id;
                  return (
                    <li key={s.id} className={`flex items-center gap-2 rounded-lg border border-night-700 bg-night-800 px-2.5 py-2 text-xs ${isCurrent ? "ring-1 ring-volt-400/40" : ""}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold text-mist-200">
                          {s.planName}
                          {isCurrent && <span className="ms-1.5 text-[9.5px] font-bold uppercase text-volt-300">Current</span>}
                        </span>
                        <span className="block text-[10.5px] text-mist-500">
                          {fmtDate(s.startDate)} → {fmtDate(s.endDate)} · {fmtMoney(s.price)} · {s.paymentStatus}
                        </span>
                      </span>
                      <span className={`font-display text-[11px] font-bold ${SUB_STATE_META[si.state].chip}`}>{si.state}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Payments */}
          <SectionCard
            title="Payments"
            icon={<IconWallet className="h-5 w-5" />}
            delay={190}
            bodyCls="p-4"
            action={
              <button className={`${btnVolt} px-3! py-1.5! text-xs`} onClick={() => setPayModal({ open: true, initial: null })}>
                <IconPlus className="h-3.5 w-3.5" strokeWidth={2.4} />
                Record
              </button>
            }
          >
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Total Paid" value={fmtMoney(paid)} />
              <MiniStat label="Current Price" value={current ? fmtMoney(current.price) : "—"} />
              <MiniStat label="Outstanding" value={fmtMoney(outstanding)} tone={outstanding > 0 ? "warn" : "good"} />
            </div>
            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-mist-500">Payment History</p>
            {payments.length === 0 ? (
              <p className="text-xs font-semibold text-mist-500">No payments recorded.</p>
            ) : (
              <ul className="grid gap-1.5">
                {[...payments].sort((a, b) => b.date.localeCompare(a.date)).map((p) => {
                  const linked = subs.find((s) => s.id === p.subscriptionId);
                  return (
                    <li key={p.id} className="group flex items-center gap-2 rounded-lg border border-night-700 bg-night-800 px-2.5 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-mist-200">
                          {fmtMoney(p.amount)} <span className="font-semibold text-mist-500">· {p.method}</span>
                        </p>
                        <p className="text-[10.5px] text-mist-500">
                          {fmtDate(p.date)}
                          {linked ? ` · ${linked.planName}` : ""}
                          {p.notes ? ` · ${p.notes}` : ""}
                        </p>
                      </div>
                      <Badge className={p.status === "Paid" ? "border-moss-400/25 bg-moss-400/10 text-moss-300" : "border-warn-400/25 bg-warn-400/10 text-warn-300"}>
                        {p.status}
                      </Badge>
                      <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-500 opacity-0 transition hover:bg-night-700 hover:text-mist-100 group-hover:opacity-100" title="Edit payment" onClick={() => setPayModal({ open: true, initial: p })}>
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                      <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-500 opacity-0 transition hover:bg-danger-500/15 hover:text-danger-300 group-hover:opacity-100" title="Delete payment" onClick={() => setConfirmDeletePayment(p)}>
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Follow-up */}
          <SectionCard title="Follow-up" icon={<IconBell className="h-5 w-5" />} delay={240} bodyCls="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mist-500">Next Follow-up</p>
              <p className={`font-display text-lg font-bold ${fu.overdue ? "text-danger-300" : fu.daysToNext !== null && fu.daysToNext <= 1 ? "text-warn-300" : "text-volt-300"}`}>
                {fu.label}
              </p>
            </div>
            {fu.next && <p className="mt-0.5 text-[10.5px] text-mist-500">Calculated from latest check-in / follow-up · {fmtDate(fu.next)}</p>}
            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-mist-500">Frequency</p>
            <div className="flex flex-wrap gap-1.5">
              {FOLLOW_UP_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => app.setFollowUpDays(client.id, d)}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    fu.frequency === d ? "border-volt-400 bg-volt-400/15 text-volt-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"
                  }`}
                >
                  Every {d}d
                </button>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} w-16 px-2! py-1.5! text-xs`}
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customFreq}
                  onChange={(e) => setCustomFreq(e.target.value)}
                />
                <button
                  className={`${btnGhost} px-2.5! py-1.5! text-xs`}
                  onClick={() => {
                    const n = Number(customFreq);
                    if (n >= 1) {
                      app.setFollowUpDays(client.id, Math.floor(n));
                      setCustomFreq("");
                    }
                  }}
                >
                  Set
                </button>
              </div>
            </div>
            <button className={`${btnGhost} mt-3 w-full`} onClick={() => app.markFollowUpDone(client.id)}>
              <IconCheck className="h-4 w-4" />
              Mark follow-up done (today)
            </button>
          </SectionCard>

          {/* Workout plan */}
          <SectionCard
            title="Workout Plan"
            icon={<IconClipboard className="h-5 w-5" />}
            delay={290}
            bodyCls="p-4"
            action={
              <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => go("plans", client.id)}>
                Open plan
              </button>
            }
          >
            {plans.length === 0 ? (
              <p className="text-xs font-semibold text-mist-500">No workout plan assigned yet.</p>
            ) : (
              <ul className="grid gap-1.5">
                {planDays.map((d) => {
                  const items = plans.filter((p) => p.day === d);
                  return (
                    <li key={d} className="flex items-center justify-between rounded-lg border border-night-700 bg-night-800 px-2.5 py-2 text-xs">
                      <span className="font-bold text-mist-200">Day {d} · {WEEK_DAYS[d - 1]}</span>
                      <span className="font-semibold text-mist-500">{items.length} exercise{items.length > 1 ? "s" : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Nutrition */}
          <SectionCard
            title="Nutrition"
            icon={<IconUtensils className="h-5 w-5" />}
            delay={340}
            bodyCls="p-4"
            action={
              <div className="flex gap-1.5">
                <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => setNutritionOpen(true)}>
                  Targets
                </button>
                <button className={`${btnGhost} px-3! py-1.5! text-xs`} onClick={() => go("meals", client.id)}>
                  Meals
                </button>
              </div>
            }
          >
            {client.nutritionTargets ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="Calories" value={`${client.nutritionTargets.calories}`} />
                <MiniStat label="Protein" value={`${client.nutritionTargets.protein}g`} />
                <MiniStat label="Carbs" value={`${client.nutritionTargets.carbs}g`} />
                <MiniStat label="Fats" value={`${client.nutritionTargets.fats}g`} />
                <MiniStat label="Water" value={`${client.nutritionTargets.water}L`} />
              </dl>
            ) : (
              <p className="text-xs font-semibold text-mist-500">No nutrition targets set.</p>
            )}
            <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-mist-500">Meals ({meals.length})</p>
            {meals.length === 0 ? (
              <p className="text-xs font-semibold text-mist-500">No meals assigned.</p>
            ) : (
              <ul className="grid gap-1.5">
                {meals.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 rounded-lg border border-night-700 bg-night-800 px-2.5 py-2 text-xs">
                    <Badge className={MEAL_META[m.type].chip}>{m.type}</Badge>
                    <span className="min-w-0 flex-1 truncate font-semibold text-mist-300">{m.description}</span>
                    <span className="font-display font-bold text-warn-300">{m.calories}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ================= modals ================= */}

      <ClientFormModal open={editOpen} initial={client} onClose={() => setEditOpen(false)} />
      <SubscriptionFormModal open={subModal.open} clientId={client.id} initial={subModal.initial} onClose={() => setSubModal({ open: false, initial: null })} />
      <PaymentFormModal
        open={payModal.open}
        clientId={client.id}
        subscriptions={history}
        initial={payModal.initial}
        onClose={() => setPayModal({ open: false, initial: null })}
      />
      <SessionFormModal open={sessionModal.open} clientId={client.id} initial={sessionModal.initial} onClose={() => setSessionModal({ open: false, initial: null })} />
      <NutritionTargetsModal open={nutritionOpen} clientId={client.id} onClose={() => setNutritionOpen(false)} />

      {detail && <CheckInDetailModal checkIn={detail} onClose={() => setDetail(null)} onPhoto={setPhoto} />}
      <PhotoModal src={photo} onClose={() => setPhoto(null)} />

      <ConfirmModal
        open={confirmRenew}
        onClose={() => setConfirmRenew(false)}
        title="Renew subscription?"
        message={
          <>
            A <strong className="text-mist-100">new subscription record</strong> will be created starting the day after the
            current one ends. The existing history is preserved, nothing is overwritten.
          </>
        }
        confirmLabel="Renew"
        onConfirm={() => current && app.renewSubscription(current)}
      />
      <ConfirmModal
        open={!!confirmDeletePayment}
        onClose={() => setConfirmDeletePayment(null)}
        title="Delete payment?"
        message={<>This payment of <strong className="text-mist-100">{confirmDeletePayment ? fmtMoney(confirmDeletePayment.amount) : ""}</strong> will be permanently removed.</>}
        confirmLabel="Delete payment"
        onConfirm={() => confirmDeletePayment && app.deletePayment(confirmDeletePayment.id)}
      />
      <ConfirmModal
        open={!!confirmDeleteSession}
        onClose={() => setConfirmDeleteSession(null)}
        title="Delete session?"
        message={<>The session on <strong className="text-mist-100">{confirmDeleteSession ? fmtDate(confirmDeleteSession.date) : ""}</strong> will be permanently removed. Cancelled sessions don't hurt attendance — consider "Cancel" instead.</>}
        confirmLabel="Delete session"
        onConfirm={() => confirmDeleteSession && app.deleteSession(confirmDeleteSession.id)}
      />
      <ConfirmModal
        open={!!confirmDeleteCheckIn}
        onClose={() => setConfirmDeleteCheckIn(null)}
        title="Delete check-in?"
        message={<>The check-in from <strong className="text-mist-100">{confirmDeleteCheckIn ? fmtDate(confirmDeleteCheckIn.date) : ""}</strong> (with its photo, if any) will be permanently removed.</>}
        confirmLabel="Delete check-in"
        onConfirm={() => confirmDeleteCheckIn && app.deleteCheckIn(confirmDeleteCheckIn.id)}
      />
      <ConfirmModal
        open={!!confirmDeleteNote}
        onClose={() => setConfirmDeleteNote(null)}
        title="Delete coach note?"
        message="This note will be permanently removed."
        confirmLabel="Delete note"
        onConfirm={() => confirmDeleteNote && app.deleteCoachNote(client.id, confirmDeleteNote)}
      />
    </div>
  );
}

/* ================================================================== */
/* helpers                                                            */

const GOAL_CHIP: Record<string, string> = {
  "Lose weight": "border-warn-400/25 bg-warn-400/10 text-warn-300",
  "Build muscle": "border-volt-400/25 bg-volt-400/10 text-volt-300",
  "General fitness": "border-moss-400/25 bg-moss-400/10 text-moss-300",
};

const STATUS_CHIP: Record<string, string> = {
  Active: "border-volt-400/25 bg-volt-400/10 text-volt-300",
  Paused: "border-warn-400/25 bg-warn-400/10 text-warn-300",
  Completed: "border-night-500/50 bg-night-500/20 text-mist-300",
};

function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mist-500">{label}</dt>
      <dd className={`text-end ${strong ? "font-display text-base font-bold text-volt-300" : "font-semibold text-mist-200"}`}>{value}</dd>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-bold ${tone === "good" ? "text-moss-300" : tone === "warn" ? "text-warn-300" : "text-mist-100"}`}>{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  tone,
  trend,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: "good" | "warn";
  trend?: "up" | "down";
}) {
  return (
    <div className="rounded-lg border border-night-700 bg-night-800 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
      <p className={`mt-1 flex items-center gap-1.5 font-display text-2xl font-bold leading-7 ${tone === "good" ? "text-moss-300" : tone === "warn" ? "text-warn-300" : "text-mist-100"}`}>
        {trend === "down" && <IconTrendDown className="h-4 w-4 text-moss-300" />}
        {trend === "up" && <IconTrendUp className="h-4 w-4 text-warn-300" />}
        {value}
        {unit && <span className="text-xs font-semibold text-mist-500">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-[10.5px] font-semibold text-mist-500">{sub}</p>}
    </div>
  );
}

function SessionRow({ session, onEdit, onDelete }: { session: Session; onEdit: () => void; onDelete: () => void }) {
  const { setSessionStatus } = useApp();
  const meta = SESSION_STATUS_META[session.status];
  return (
    <li className="group flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-mist-100">
          {relDay(session.date)} <span className="font-semibold text-mist-500">· {session.time} · {session.type}</span>
        </p>
        {session.notes && <p className="mt-0.5 truncate text-[11px] italic text-mist-500">"{session.notes}"</p>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(session.status === "Scheduled" || session.status === "Confirmed") && (
            <>
              {session.status === "Scheduled" && (
                <MiniAction label="Confirm" onClick={() => setSessionStatus(session.id, "Confirmed")} />
              )}
              <MiniAction label="Complete" tone="good" onClick={() => setSessionStatus(session.id, "Completed")} />
              <MiniAction label="Missed" tone="bad" onClick={() => setSessionStatus(session.id, "Missed")} />
              <MiniAction label="Cancel" onClick={() => setSessionStatus(session.id, "Cancelled")} />
            </>
          )}
          {(session.status === "Completed" || session.status === "Missed" || session.status === "Cancelled") && (
            <MiniAction label="Reopen" onClick={() => setSessionStatus(session.id, "Scheduled")} />
          )}
        </div>
      </div>
      <Badge className={meta.chip}>
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {session.status}
      </Badge>
      <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-mist-100" title="Edit session" onClick={onEdit}>
          <IconPencil className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete session" onClick={onDelete}>
          <IconTrash className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function MiniAction({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "good" | "bad" }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-md border px-2 py-1 text-[10.5px] font-bold transition active:scale-95 ${
        tone === "good"
          ? "border-moss-400/30 bg-moss-400/10 text-moss-300 hover:bg-moss-400/20"
          : tone === "bad"
            ? "border-danger-500/30 bg-danger-500/10 text-danger-300 hover:bg-danger-500/20"
            : "border-night-600 bg-night-700 text-mist-300 hover:bg-night-600"
      }`}
    >
      {label}
    </button>
  );
}

function CheckInDetailModal({ checkIn, onClose, onPhoto }: { checkIn: CheckIn; onClose: () => void; onPhoto: (src: string) => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="animate-fade absolute inset-0 bg-night-950/85" onClick={onClose} />
      <div className="animate-pop relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-xl border border-night-600 bg-night-850 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-night-700 bg-night-850 px-5 py-3.5">
          <div>
            <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-mist-100">Check-in Details</h3>
            <p className="text-[11px] font-bold uppercase tracking-wider text-volt-300">{fmtDate(checkIn.date)}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-mist-100" aria-label="Close">
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist-500">Measurements</p>
            <div className="grid grid-cols-2 gap-2">
              <DetailStat label="Weight" value={`${checkIn.weight} kg`} />
              <DetailStat label="Waist" value={checkIn.waist !== undefined ? `${checkIn.waist} cm` : "Not recorded"} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist-500">Lifestyle / adherence</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-night-700 bg-night-800 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Mood</p>
                <div className="mt-1.5"><MoodDots mood={checkIn.mood} /></div>
              </div>
              <DetailStat label="Water" value={`${checkIn.water} L`} />
              <div className="col-span-2 rounded-lg border border-night-700 bg-night-800 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Workout</p>
                <p className={`mt-0.5 inline-flex items-center gap-1.5 text-sm font-bold ${checkIn.workoutDone ? "text-moss-300" : "text-danger-300"}`}>
                  {checkIn.workoutDone ? <IconCheck className="h-4 w-4" strokeWidth={2.6} /> : <IconX className="h-4 w-4" strokeWidth={2.6} />}
                  {checkIn.workoutDone ? "Completed" : "Skipped"}
                </p>
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist-500">Client notes</p>
            {checkIn.notes ? (
              <p className="rounded-lg border border-night-700 bg-night-800 p-3 text-sm leading-6 text-mist-200">"{checkIn.notes}"</p>
            ) : (
              <p className="text-xs font-semibold text-mist-500">No notes submitted.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist-500">Progress photos</p>
            {checkIn.photo ? (
              <button className="cursor-zoom-in" onClick={() => onPhoto(checkIn.photo!)} aria-label="View photo larger">
                <img src={checkIn.photo} alt={`Check-in ${checkIn.date}`} className="max-h-56 rounded-lg object-cover ring-1 ring-night-600 transition hover:ring-volt-400" />
              </button>
            ) : (
              <p className="text-xs font-semibold text-mist-500">No progress photos for this check-in.</p>
            )}
          </div>
          {checkIn.water >= 0 && (
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-mist-500">
              <IconDrop className="h-3.5 w-3.5 text-sky-400" />
              Hydration target is tracked per client's nutrition plan.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-night-700 bg-night-800 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
      <p className="mt-0.5 font-display text-xl font-bold text-mist-100">{value}</p>
    </div>
  );
}
