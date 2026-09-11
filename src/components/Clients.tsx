/* ================================================================
   VERRAA — clients roster + full client profile (coach mode).
   ================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Dumbbell,
  ImagePlus,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Pencil,
  Pin,
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
import type { CheckIn, Client, CoachNote, CoachView, Meal, NoteCategory, Payment, Session, SubState, Subscription } from "../types";
import { FOLLOW_UP_PRESETS, GOAL_META, NOTE_CATEGORIES, NOTE_CATEGORY_META, PAYMENT_STATUS_META, PRIORITIES, SESSION_STATUS_META, STATUS_META, SUB_PAYMENT_META, SUB_STATE_META, WEEK_DAYS, WEEK_SHORT, normalizeCoachNotes, priorityRank } from "../types";
import { addDays, dayNum, fmtDate, fmtMoney, fmtTime, relDay, relTime, signed, toISO, todayISO, waHref } from "../lib";
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
  Dropdown,
  EmptyState,
  Modal,
  MoodDots,
  SectionCard,
  UserPlus,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSm,
  inputCls,
  labelCls,
  textareaCls,
} from "./ui";
import { WeightLine, AdherenceTrend, type AdherenceDay } from "./Chart";
import { PhotoGallery } from "./Photos";
import { CoachStrengthView } from "./StrengthTracker";
import {
  ClientFormModal,
  CreateLoginModal,
  NutritionTargetsModal,
  PaymentFormModal,
  PhotoModal,
  ResetPasswordModal,
  SessionFormModal,
  SubscriptionFormModal,
} from "./modals";
import { HeaderFact, Kpi, KV, MiniEmpty, PriorityBadge } from "./clients/index";
import {
  RosterCard,
  RosterRow,
  RosterTableHead,
  VIRTUALIZE_AFTER,
  VirtualMobileList,
  VirtualRosterBody,
  useIsDesktop,
} from "./clients/index";
import { ProfileSkeleton, RosterSkeleton, useViewReady } from "./skeletons";

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
  const { state, deleteClient, myClientCount, myClientLimit, myCoachPlan, myPlanAllowsClientMode, myProgressMode, myFrozenLoginCount } = useApp();
  const planAllowsLogin = (myPlanAllowsClientMode as boolean | undefined) ?? true;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<ClientsFilter>(initialFilter ?? "All");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const ready = useViewReady("roster");
  const isDesktop = useIsDesktop();

  /* Narrow slice deps (not the whole state): the store updates slices
     immutably, so writing a meal/plan/message never recomputes the roster. */
  const enriched = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        subInfo: subscriptionState(currentSubscription(state.subscriptions.filter((s) => s.clientId === client.id))),
        last: latestCheckIn(state.checkIns.filter((c) => c.clientId === client.id)),
      })),
    [state.clients, state.subscriptions, state.checkIns],
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
      .sort((a, b) => priorityRank(a.client.priority) - priorityRank(b.client.priority) || a.client.name.localeCompare(b.client.name));
  }, [enriched, q, filter]);

  if (!ready) return <RosterSkeleton />;

  // Past VIRTUALIZE_AFTER rows only the visible slice is mounted
  // (window scroller — page scroll UX is unchanged).
  const virtualize = filtered.length > VIRTUALIZE_AFTER;
  const rowActions = {
    go,
    onEdit: (c: Client) => {
      setEditing(c);
      setFormOpen(true);
    },
    onDelete: (c: Client) => setDeleting(c),
  };

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
            <span className="text-mist-500"> · </span>
            {planAllowsLogin ? (
              <span className="font-bold text-moss-300" title="Progress is auto-calculated via Client Mode">
                Auto via Client Mode
              </span>
            ) : (
              <button
                className="cursor-pointer font-bold text-danger-300 hover:underline"
                onClick={() => go("pricing")}
                title="Starter has No Client Mode — upgrade to Professional"
              >
                No Client Mode · Manual{myFrozenLoginCount > 0 ? ` · ${myFrozenLoginCount} frozen` : ""}
              </button>
            )}
          </p>
        </div>
        <button
          className={`${btnPrimary} h-11 w-full sm:w-auto`}
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
              className={`min-h-[36px] cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
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
        ) : virtualize ? (
          // Large roster: mount ONLY the visible layout + the visible row
          // window (window scroller — page scroll UX is unchanged).
          isDesktop ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm" aria-rowcount={filtered.length + 1}>
              <RosterTableHead />
              <VirtualRosterBody items={filtered} {...rowActions} />
            </table>
          </div>
          ) : (
            <VirtualMobileList items={filtered} {...rowActions} />
          )
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-sm">
              <RosterTableHead />
              <tbody>
                {filtered.map((entry) => (
                  <RosterRow key={entry.client.id} entry={entry} {...rowActions} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-2 p-3 md:hidden">
            {filtered.map((entry) => (
              <RosterCard key={entry.client.id} entry={entry} {...rowActions} />
            ))}
          </ul>
          </>
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

  type ProfileTab = "overview" | "checkins" | "training" | "sessions" | "nutrition" | "photos" | "billing" | "notes" | "connect";

export function ClientProfile({ clientId, go }: { clientId: string; go: (v: CoachView, id?: string) => void }) {
  const app = useApp();
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [nutritionOpen, setNutritionOpen] = useState(false);

  const client = app.state.clients.find((c) => c.id === clientId);
  const subs = useMemo(() => app.state.subscriptions.filter((s) => s.clientId === clientId), [app.state.subscriptions, clientId]);
  const payments = useMemo(() => app.state.payments.filter((p) => p.clientId === clientId), [app.state.payments, clientId]);
  const sessions = useMemo(() => app.state.sessions.filter((s) => s.clientId === clientId), [app.state.sessions, clientId]);
  const checkIns = useMemo(() => app.state.checkIns.filter((c) => c.clientId === clientId), [app.state.checkIns, clientId]);
  const plans = useMemo(() => app.state.plans.filter((p) => p.clientId === clientId), [app.state.plans, clientId]);
  const meals = useMemo(() => app.state.meals.filter((m) => m.clientId === clientId), [app.state.meals, clientId]);
  const photoCount = useMemo(
    () => (app.state.progressPhotos ?? []).filter((p) => p.clientId === clientId).length,
    [app.state.progressPhotos, clientId],
  );
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const ready = useViewReady(clientId);

  if (!client) {
    return (
      <EmptyState icon={<User className="h-6 w-6" />} title="Client not found" sub="They may have been deleted.">
        <button className={`${btnSecondary} mt-2`} onClick={() => go("clients")}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to clients
        </button>
      </EmptyState>
    );
  }

  if (!ready) return <ProfileSkeleton />;

  const subInfo = subscriptionState(currentSubscription(subs));
  const wa = waHref(client.phone);
  const fu = followUpInfo(client, checkIns);
  const latest = latestCheckIn(checkIns);
  const outstanding = outstandingAmount(subInfo.sub, payments);
  const att = attendance(sessions);
  const paid = totalPaid(payments);

  const scrollToBilling = () => {
    document.getElementById("client-billing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const attention: { tone: string; dot: string; text: string }[] = [];
  if (client.priority === "Critical") attention.push({ tone: "text-danger-300", dot: "bg-danger-400", text: "Critical priority client" });
  if (fu.overdue) attention.push({ tone: "text-danger-300", dot: "bg-danger-400", text: `Follow-up ${fu.label.toLowerCase()}` });
  if (subInfo.state === "Expired") attention.push({ tone: "text-danger-300", dot: "bg-danger-400", text: "Subscription expired" });
  else if (subInfo.state === "Expiring Soon") attention.push({ tone: "text-warn-300", dot: "bg-warn-400", text: "Subscription expiring soon" });
  if (outstanding > 0) attention.push({ tone: "text-warn-300", dot: "bg-warn-400", text: `${fmtMoney(outstanding)} EGP outstanding` });
  if (latest && !latest.workoutDone && latest.date >= addDays(todayISO(), -2)) attention.push({ tone: "text-warn-300", dot: "bg-warn-400", text: "Skipped last workout" });
  if (checkIns.length === 0) attention.push({ tone: "text-mist-400", dot: "bg-mist-500", text: "No check-ins yet" });
  if (!subInfo.sub) attention.push({ tone: "text-mist-400", dot: "bg-mist-500", text: "No subscription yet" });

  const focusChat = () => {
    setTab("connect");
    window.setTimeout(() => document.getElementById("coach-chat-input")?.focus({ preventScroll: true }), 200);
  };

  const today = todayISO();
  const upcomingCount = sessions.filter((s) => s.date >= today && (s.status === "Scheduled" || s.status === "Confirmed")).length;
  const msgCount = app.state.messages.filter((m) => m.clientId === clientId).length;
  const targets = client.nutritionTargets;

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode; count?: number; dot?: boolean }[] = [
    { id: "overview", label: "Overview", icon: <LayoutGrid className="h-3.5 w-3.5" /> },
    { id: "checkins", label: "Check-ins", icon: <Camera className="h-3.5 w-3.5" />, count: checkIns.length },
    { id: "training", label: "Training", icon: <Dumbbell className="h-3.5 w-3.5" /> },
    { id: "sessions", label: "Sessions", icon: <CalendarDays className="h-3.5 w-3.5" />, count: upcomingCount || undefined },
    { id: "nutrition", label: "Nutrition", icon: <UtensilsCrossed className="h-3.5 w-3.5" />, count: meals.length || undefined },
    { id: "photos", label: "Photos", icon: <ImagePlus className="h-3.5 w-3.5" />, count: photoCount || undefined },
    { id: "billing", label: "Billing", icon: <Wallet className="h-3.5 w-3.5" />, dot: outstanding > 0 },
    { id: "notes", label: "Notes", icon: <StickyNote className="h-3.5 w-3.5" />, count: client.coachNotes?.length || undefined },
    { id: "connect", label: "Connect", icon: <MessageCircle className="h-3.5 w-3.5" />, count: msgCount || undefined },
  ];

  const statusTone = client.status === "Active" ? "text-moss-300" : client.status === "Paused" ? "text-warn-300" : "text-mist-400";
  const planAllowsLogin = ((app as unknown as { myPlanAllowsClientMode?: boolean }).myPlanAllowsClientMode) ?? true;
  const loginFrozen = client.hasLogin && !planAllowsLogin;
  const requestLogin = () => {
    if (!planAllowsLogin) {
      app.toast("Starter plan has No Client Mode — upgrade to Professional for client logins.", "warn");
      go("pricing");
      return;
    }
    setLoginOpen(true);
  };

  return (
    <div>
      {/* compact header */}
      <div className="rise">
        <button className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-mist-400 transition hover:text-volt-300" onClick={() => go("clients")}>
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> Back to clients
        </button>
        <div className="rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <span className="relative shrink-0">
              <Avatar name={client.name} photo={client.photo} className="h-12 w-12 rounded-xl text-lg" />
              <span className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-night-850 ${STATUS_META[client.status].dot} ${client.status === "Active" ? "tick-pulse" : ""}`} />
            </span>
            <div className="min-w-0 flex-1 basis-52">
              <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-mist-100">{client.name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                {client.hasLogin ? (
                  <>
                    <span className="font-bold text-mist-400">@{client.username}</span>
                    {loginFrozen && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-danger-500/30 bg-danger-500/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-danger-300" title="Starter plan has No Client Mode — this login is frozen until you upgrade">
                        Frozen · No Client Mode
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    onClick={requestLogin}
                    title={planAllowsLogin ? "Create a login for this client" : "Starter plan has No Client Mode — upgrade to Professional"}
                    className={`cursor-pointer font-bold transition hover:underline ${planAllowsLogin ? "text-warn-300 hover:text-volt-300" : "text-danger-300 hover:text-danger-200"}`}
                  >
                    {planAllowsLogin ? "Coach-managed · no login — create one →" : "No Client Mode (Starter) — upgrade for logins →"}
                  </button>
                )}
                <span aria-hidden="true" className="text-mist-600">•</span>
                <span className={`inline-flex items-center gap-1.5 font-bold ${statusTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[client.status].dot}`} />
                  {client.status}{client.status === "Active" ? " client" : ""}
                </span>
                <PriorityBadge priority={client.priority} />
              </p>
              <p className="mt-1 text-xs font-semibold text-mist-500">{client.goal}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-mist-500">
                Last check-in: <span className="font-bold text-mist-300">{latest ? relDay(latest.date) : "—"}</span>
                <span aria-hidden="true" className="mx-1.5 text-mist-600">•</span>
                Next follow-up:{" "}
                <span className={`font-bold ${fu.overdue ? "text-danger-300" : fu.daysToNext !== null && fu.daysToNext <= 1 ? "text-warn-300" : "text-mist-300"}`}>
                  {fu.label}
                </span>
              </p>
            </div>
            {/* basic info — fills the header's empty middle instead of its own card */}
            <dl className="grid min-w-0 flex-1 basis-64 grid-cols-2 gap-x-6 gap-y-1.5 lg:border-s lg:border-white/[0.06] lg:ps-6">
              <HeaderFact label="Phone" value={client.phone || "—"} title={client.phone || undefined} />
              <HeaderFact label="Age · Gender" value={`${client.age !== undefined ? client.age : "—"} · ${client.gender ?? "—"}`} />
              <div className="min-w-0">
                <dt className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Email</dt>
                {client.email ? (
                  <dd className="mt-0.5 truncate text-xs font-bold text-mist-200">
                    <a href={`mailto:${client.email}`} title={client.email} className="transition hover:text-volt-300 hover:underline">
                      {client.email}
                    </a>
                  </dd>
                ) : (
                  <dd className="mt-0.5 text-xs font-bold text-mist-500">—</dd>
                )}
              </div>
              <HeaderFact label="Joined" value={fmtDate(client.startDate)} />
              {client.notes && (
                <div className="col-span-2 min-w-0">
                  <dt className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Notes</dt>
                  <dd title={client.notes} className="mt-0.5 line-clamp-2 text-xs font-semibold leading-5 text-mist-300">
                    {client.notes}
                  </dd>
                </div>
              )}
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <button className={`${btnSecondary} ${btnSm}`} onClick={focusChat}>
                <MessageCircle className="h-3.5 w-3.5" /> Message
              </button>
              <button className={`${btnPrimary} ${btnSm}`} onClick={() => setCheckInOpen(true)}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Add check-in
              </button>
              <Dropdown
                open={moreOpen}
                onOpenChange={setMoreOpen}
                align="end"
                label="More client actions"
                trigger={
                  <button className={`${btnSecondary} ${btnSm}`} onClick={() => setMoreOpen((v) => !v)} aria-haspopup="menu" aria-expanded={moreOpen}>
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                }
                items={[
                  ...(wa ? [{ type: "item" as const, label: "WhatsApp", icon: MessageCircle, onClick: () => window.open(wa, "_blank", "noopener") }] : []),
                  { type: "item" as const, label: "Edit client", icon: Pencil, onClick: () => setEditOpen(true) },
                  ...(client.hasLogin
                    ? [{ type: "item" as const, label: "Reset password", icon: KeyRound, onClick: () => setPwOpen(true) }]
                    : [{ type: "item" as const, label: planAllowsLogin ? "Create login" : "Create login (Starter: disabled)", icon: UserPlus, onClick: requestLogin }]),
                  { type: "divider" as const },
                  ...PRIORITIES.map((p) => ({
                    type: "item" as const,
                    label: `${p} priority`,
                    hint: client.priority === p ? "✓" : undefined,
                    onClick: () => {
                      if (client.priority !== p) app.updateClient({ ...client, priority: p });
                    },
                  })),
                  { type: "divider" as const },
                  { type: "item" as const, label: "Delete client", icon: Trash2, danger: true, onClick: () => setDelOpen(true) },
                ]}
              />
            </div>
          </div>
        </div>
        {/* needs-attention strip */}
        {attention.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-moss-400/20 bg-moss-400/[0.06] px-3.5 py-2 text-xs font-bold text-moss-300">
            <span className="h-1.5 w-1.5 rounded-full bg-moss-400" /> All clear — nothing needs attention.
          </p>
        ) : (
          <div role="status" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-white/[0.06] bg-night-900/60 px-3.5 py-2.5">
            {attention.map((a) => (
              <span key={a.text} className={`inline-flex items-center gap-1.5 text-xs font-bold ${a.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
                {a.text}
              </span>
            ))}
          </div>
        )}
        {loginFrozen && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-danger-500/25 bg-danger-500/[0.07] px-3.5 py-2.5">
            <span className="text-xs font-extrabold text-danger-300">Login frozen — No Client Mode on your current plan.</span>
            <span className="text-[11px] font-semibold text-mist-400">Their data is safe; progress is manual until you upgrade.</span>
            <button onClick={() => go("pricing")} className="cursor-pointer text-[11px] font-extrabold text-volt-300 hover:underline">
              View plans →
            </button>
          </div>
        )}
      </div>

      {/* priority KPIs — money & adherence at a glance (TrueCoach-style compliance strip) */}
      <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Kpi
          label="Plan"
          value={subInfo.sub ? remainingLabel(subInfo.daysLeft) : "No plan"}
          sub={subInfo.sub ? `${subInfo.sub.planName} · ends ${fmtDate(subInfo.sub.endDate)}` : "Add one from Billing"}
          tone={subInfo.state === "Active" ? "good" : subInfo.state === "Expiring Soon" ? "warn" : subInfo.state === "Expired" ? "bad" : undefined}
          onClick={scrollToBilling}
        />
        <Kpi
          label="Outstanding"
          value={outstanding > 0 ? `${fmtMoney(outstanding)} EGP` : "Clear"}
          sub={subInfo.sub ? `${fmtMoney(paid)} paid of ${fmtMoney(subInfo.sub.price)}` : `${fmtMoney(paid)} paid total`}
          tone={outstanding > 0 ? "warn" : "good"}
          onClick={scrollToBilling}
        />
        <Kpi
          label="Follow-up"
          value={fu.label}
          sub={`every ${fu.frequency}d · from ${fu.basis ? relDay(fu.basis) : "start"}`}
          tone={fu.overdue ? "bad" : fu.daysToNext !== null && fu.daysToNext <= 1 ? "warn" : "good"}
        />
        <Kpi
          label="Attendance"
          value={`${att.pct}%`}
          sub={`${att.completed}/${att.countable} sessions`}
          tone={att.pct >= 70 ? "good" : att.pct >= 40 ? "warn" : undefined}
        />
      </div>

      {/* tab bar — one workflow at a time instead of one long scroll */}
      <div
        role="tablist"
        aria-label="Client sections"
        className="rise no-scrollbar mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-night-900/60 p-1.5 backdrop-blur-xl"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                active ? "bg-volt-400 text-night-950" : "text-mist-400 hover:bg-white/[0.05] hover:text-mist-100"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tnum ${active ? "bg-night-950/15 text-night-950" : "bg-white/[0.06] text-mist-300"}`}>
                  {t.count}
                </span>
              )}
              {t.dot && <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-night-950" : "bg-warn-400"}`} />}
            </button>
          );
        })}
      </div>

      {/* Overview — status at a glance */}
      {tab === "overview" && (
        <div className="mt-3 grid items-start gap-3 lg:grid-cols-3">
          <div className="grid content-start gap-3 lg:col-span-2">
            <ProgressCard checkIns={checkIns} sessionsCount={att} />
          </div>
          <div className="grid content-start gap-3">
            <FollowUpCard client={client} checkIns={checkIns} />
          </div>
        </div>
      )}

      {/* Check-ins — latest + history side by side on wide screens, no dead margins */}
      {tab === "checkins" && (
        <div className="mt-3 w-full">
          <CheckInsCard checkIns={checkIns} clientId={client.id} />
        </div>
      )}

      {/* Training — plan summary beside strength outcomes */}
      {tab === "training" && (
        <div className="mt-3 grid w-full content-start items-start gap-3 xl:grid-cols-3">
          <PlanCard plans={plans} go={go} clientId={client.id} />
          <div className="xl:col-span-2">
            <CoachStrengthView clientId={client.id} />
          </div>
        </div>
      )}

      {/* Sessions — booking follow-up meetings with the client */}
      {tab === "sessions" && (
        <div className="mt-3 w-full">
          <SessionsCard sessions={sessions} clientId={client.id} />
        </div>
      )}

      {/* Nutrition — targets + meals side by side, full width */}
      {tab === "nutrition" && (
        <div className="mt-3 grid w-full content-start items-start gap-3 sm:grid-cols-2">
          <SectionCard
            title="Daily targets"
            icon={<UtensilsCrossed className="h-4.5 w-4.5" />}
            bodyCls="p-4"
            action={
              <button className={`${btnSecondary} ${btnSm}`} onClick={() => setNutritionOpen(true)}>
                {targets ? "Edit" : "Set targets"}
              </button>
            }
          >
            {targets ? (
              <div className="grid grid-cols-2 gap-2">
                <KV k="Calories" v={`${targets.calories} kcal`} />
                <KV k="Protein" v={`${targets.protein}g`} />
                <KV k="Carbs" v={`${targets.carbs}g`} />
                <KV k="Fats" v={`${targets.fats}g`} />
                <KV k="Water" v={`${targets.water}L`} />
              </div>
            ) : (
              <MiniEmpty
                icon={<UtensilsCrossed className="h-4 w-4" />}
                title="No targets set"
                sub="Daily calories, macros and water for this client."
                action={
                  <button className={`${btnPrimary} ${btnSm}`} onClick={() => setNutritionOpen(true)}>
                    Set targets
                  </button>
                }
              />
            )}
          </SectionCard>
          <MealsCard mealsCount={meals.length} go={go} clientId={client.id} targets={targets ? { calories: targets.calories } : undefined} />
          <div className="sm:col-span-2">
            <MealAdherenceCard clientId={client.id} meals={meals} />
          </div>
        </div>
      )}

      {/* Photos — before & after gallery */}
      {tab === "photos" && (
        <div className="mt-3 w-full">
          <PhotoGallery key={client.id} clientId={client.id} role="coach" />
        </div>
      )}

      {/* Billing — money in one focused view */}
      {tab === "billing" && (
        <div className="mt-3 w-full">
          <BillingCard payments={payments} subs={subs} clientId={client.id} />
        </div>
      )}

      {/* Notes — categorized, priority-ordered coach notes */}
      {tab === "notes" && (
        <div className="mt-3 w-full">
          <CoachNotesTab key={client.id} client={client} />
        </div>
      )}

      {/* Connect — chat gets the full width */}
      {tab === "connect" && (
        <div className="mx-auto mt-3 w-full max-w-4xl">
          <ChatThreadCard clientId={client.id} clientName={client.name} tall />
        </div>
      )}

      <AddCheckInModal open={checkInOpen} clientId={client.id} clientName={client.name} onClose={() => setCheckInOpen(false)} />
      <ClientFormModal open={editOpen} initial={client} onClose={() => setEditOpen(false)} />
      <NutritionTargetsModal open={nutritionOpen} clientId={client.id} onClose={() => setNutritionOpen(false)} />
      <ResetPasswordModal open={pwOpen} clientId={client.id} onClose={() => setPwOpen(false)} />
      {!client.hasLogin && <CreateLoginModal open={loginOpen} client={client} onClose={() => setLoginOpen(false)} onUpgrade={() => go("pricing")} />}
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

/* ---------------- billing (subscription + payments merged — money in one place) ---------------- */

function BillingCard({ subs, payments, clientId }: { subs: Subscription[]; payments: Payment[]; clientId: string }) {
  const { renewSubscription, deletePayment } = useApp();
  const [subFormOpen, setSubFormOpen] = useState(false);
  const [subEditing, setSubEditing] = useState<Subscription | null>(null);
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [payDeleting, setPayDeleting] = useState<Payment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const info = subscriptionState(currentSubscription(subs));
  const sub = info.sub;
  const meta = SUB_STATE_META[info.state];
  const history = subHistory(subs).filter((s) => s.id !== sub?.id);
  const outstanding = outstandingAmount(sub, payments);
  const sortedPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <SectionCard
      id="client-billing"
      title="Billing"
      icon={<Wallet className="h-4.5 w-4.5" />}
      bodyCls="p-4"
      action={
        <div className="flex gap-1.5">
          <button className={`${btnPrimary} ${btnSm}`} onClick={() => setPayFormOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Record
          </button>
          <button className={`${btnSecondary} ${btnSm}`} onClick={() => { setSubEditing(null); setSubFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Plan
          </button>
        </div>
      }
    >
      <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="min-w-0">
      {!sub ? (
        <MiniEmpty
          icon={<CreditCard className="h-4 w-4" />}
          title="No subscription yet"
          sub="Add a plan to track renewals and payments."
        />
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge className={meta.chip}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${info.state === "Expiring Soon" ? "tick-pulse" : ""}`} />
              {info.state}
            </Badge>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-extrabold text-mist-100">{sub.planName}</span>
              <span className="ms-2 text-xs font-semibold text-mist-500">
                {fmtDate(sub.startDate)} → {fmtDate(sub.endDate)} · {remainingLabel(info.daysLeft)}
              </span>
            </p>
            <p className="text-end text-sm font-extrabold text-mist-100 tnum">
              {fmtMoney(sub.price)} <span className="text-[11px] font-bold text-mist-500">EGP</span>
              <span className={`ms-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${sub.paymentStatus === "Paid" ? "bg-moss-400/10 text-moss-300" : sub.paymentStatus === "Partial" ? "bg-sky-400/10 text-sky-300" : "bg-warn-400/10 text-warn-300"}`}>
                {sub.paymentStatus}
              </span>
            </p>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <KV k="Total paid" v={`${fmtMoney(totalPaid(payments))} EGP`} tone="text-moss-300" />
            <KV k="Plan price" v={`${fmtMoney(sub.price)} EGP`} />
            <KV k="Outstanding" v={outstanding > 0 ? `${fmtMoney(outstanding)} EGP` : "—"} tone={outstanding > 0 ? "text-warn-300" : undefined} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className={`${btnSecondary} ${btnSm}`} title="Renew" onClick={() => renewSubscription(sub)}>
              <RotateCw className="h-3.5 w-3.5" /> Renew
            </button>
            <button className={`${btnSecondary} ${btnSm}`} title="Edit plan" onClick={() => { setSubEditing(sub); setSubFormOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" /> Edit plan
            </button>
          </div>
          {history.length > 0 && (
            <div className="mt-2 border-t border-night-700/70 pt-2">
              <button className="cursor-pointer text-[11px] font-bold text-mist-500 transition hover:text-volt-300" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
                {showHistory ? "Hide history" : `History (${history.length})`}
              </button>
              {showHistory && (
                <ul className="mt-1.5 grid gap-1">
                  {history.slice(0, 5).map((h) => (
                    <li key={h.id} className="flex items-center gap-2 text-xs text-mist-400">
                      <span className="font-bold text-mist-200">{h.planName}</span>
                      <span>{fmtDate(h.startDate)} → {fmtDate(h.endDate)}</span>
                      <span className="ms-auto font-bold text-mist-300 tnum">{fmtMoney(h.price)} EGP</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      <div className="min-w-0 border-t border-night-700/70 pt-2.5 xl:border-t-0 xl:pt-0">
        <div className="flex items-center justify-between pb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Payments ({sortedPayments.length})</p>
          {sortedPayments.length > 5 && (
            <button className="cursor-pointer text-[11px] font-bold text-volt-300 hover:underline" onClick={() => setShowAllPayments((v) => !v)}>
              {showAllPayments ? "Show less" : `Show all (${sortedPayments.length})`}
            </button>
          )}
        </div>
        {sortedPayments.length === 0 ? (
          <p className="text-xs font-semibold text-mist-500">No payments recorded.</p>
        ) : (
          <ul className="grid gap-1.5">
            {(showAllPayments ? sortedPayments : sortedPayments.slice(0, 5)).map((p) => {
              const linked = subs.find((s) => s.id === p.subscriptionId);
              return (
                <li key={p.id} className="group flex items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-3 py-2 transition-all duration-200 hover:border-night-500">
                  <span className="w-20 shrink-0 truncate text-xs font-bold text-mist-300">{relDay(p.date)}</span>
                  <span className="shrink-0 font-display text-base font-bold text-mist-100 tnum">{fmtMoney(p.amount)} <span className="text-[11px] font-semibold text-mist-500">EGP</span></span>
                  <span className="min-w-0 flex-1 truncate text-xs text-mist-400">{p.method}{linked ? ` · ${linked.planName}` : ""}</span>
                  <Badge className={PAYMENT_STATUS_META[p.status].chip}>{p.status}</Badge>
                  <button className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-mist-400 opacity-0 transition hover:bg-danger-500/15 hover:text-danger-300 focus-visible:opacity-100 group-hover:opacity-100" title="Delete" onClick={() => setPayDeleting(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>

      <SubscriptionFormModal open={subFormOpen} clientId={clientId} initial={subEditing} onClose={() => setSubFormOpen(false)} />
      <PaymentFormModal open={payFormOpen} clientId={clientId} initial={null} subscriptions={subs} onClose={() => setPayFormOpen(false)} />
      <ConfirmModal
        open={!!payDeleting}
        onClose={() => setPayDeleting(null)}
        title="Delete payment?"
        message={<>{payDeleting ? fmtMoney(payDeleting.amount) : 0} EGP from {payDeleting ? relDay(payDeleting.date) : ""} will be removed.</>}
        onConfirm={() => payDeleting && deletePayment(payDeleting.id)}
      />
    </SectionCard>
  );
}

/* ---------------- check-ins ---------------- */

function CheckInsCard({ checkIns, clientId }: { checkIns: CheckIn[]; clientId: string }) {
  const { deleteCheckIn } = useApp();
  const [detail, setDetail] = useState<CheckIn | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CheckIn | null>(null);
  const [showAll, setShowAll] = useState(false);
  const sorted = sortCheckIns(checkIns);
  const latest = sorted[0] ?? null;
  const rest = sorted.slice(1);

  return (
    <SectionCard title={`Check-ins (${checkIns.length})`} icon={<Camera className="h-4.5 w-4.5" />} bodyCls="p-4">
      {checkIns.length === 0 ? (
        <MiniEmpty
          icon={<Camera className="h-4 w-4" />}
          title="No check-ins yet"
          sub="They'll appear here the moment the client logs their first day."
        />
      ) : (
        <div className="grid items-start gap-2.5 xl:grid-cols-5">
          {latest && (
            <div className="rounded-xl border border-volt-400/20 bg-volt-400/5 p-3 xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-volt-300">Latest · {relDay(latest.date)}</p>
                <Badge className={latest.workoutDone ? "border-moss-400/25 bg-moss-400/10 text-moss-300" : "border-danger-500/25 bg-danger-500/10 text-danger-300"}>
                  {latest.workoutDone ? "Workout done" : "Skipped"}
                </Badge>
              </div>
              <div className={`mt-2.5 grid grid-cols-2 gap-2 ${latest.waist === undefined ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
                <KV k="Weight" v={`${latest.weight} kg`} />
                {latest.waist !== undefined && <KV k="Waist" v={`${latest.waist} cm`} />}
                <KV k="Water" v={`${latest.water} L`} />
                <div className="rounded-xl border border-night-700 bg-night-800 p-2.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Mood</p>
                  <div className="mt-1.5"><MoodDots mood={latest.mood} /></div>
                </div>
              </div>
              {latest.notes && <p className="mt-2 truncate text-xs italic text-mist-400">"{latest.notes}"</p>}
              {latest.photo && (
                <button className="mt-2 cursor-zoom-in" onClick={() => setPhoto(latest.photo ?? null)}>
                  <img src={latest.photo} alt="Latest client check-in progress photo" loading="lazy" className="h-16 rounded-xl object-cover ring-1 ring-night-600 transition-all duration-200 hover:ring-volt-400" />
                </button>
              )}
            </div>
          )}
          {rest.length > 0 && (
            <div className="min-w-0 xl:col-span-2">
              <p className="px-0.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">
                History ({rest.length})
              </p>
              <ul className="grid gap-1.5">
                {(showAll ? rest : rest.slice(0, 6)).map((ci) => (
                  <li key={ci.id}>
                    <button className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-3 py-2 text-start transition-all duration-200 hover:border-night-500" onClick={() => setDetail(ci)}>
                      <span className="w-20 shrink-0 truncate text-xs font-bold text-mist-300">{relDay(ci.date)}</span>
                      <span className="truncate text-xs text-mist-400 tnum">{ci.weight} kg{ci.waist !== undefined ? ` · ${ci.waist} cm` : ""}</span>
                      <span className="shrink-0"><MoodDots mood={ci.mood} /></span>
                      <span className="ms-auto shrink-0 text-[11px] font-bold text-mist-500 transition group-hover:text-volt-300">View →</span>
                    </button>
                  </li>
                ))}
              </ul>
              {rest.length > 6 && (
                <button className="mt-1.5 cursor-pointer text-[11px] font-bold text-volt-300 hover:underline" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show less" : `Show all (${rest.length})`}
                </button>
              )}
            </div>
          )}
        </div>
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
                <img src={detail.photo} alt="Client check-in progress photo detail" loading="lazy" className="h-32 rounded-xl object-cover ring-1 ring-night-600 transition-all duration-200 hover:ring-volt-400" />
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

/* ---------------- log check-in (coach side) ---------------- */

function AddCheckInModal({ open, clientId, clientName, onClose }: { open: boolean; clientId: string; clientName: string; onClose: () => void }) {
  const { addCheckIn } = useApp();
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [water, setWater] = useState("");
  const [mood, setMood] = useState(3);
  const [workoutDone, setWorkoutDone] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setWeight("");
      setWaist("");
      setWater("");
      setMood(3);
      setWorkoutDone(true);
      setNotes("");
      setError("");
    }
  }, [open ]);

  const save = () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return setError("Enter the client's weight.");
    if (!date) return setError("Pick a date.");
    addCheckIn({
      clientId,
      date,
      weight: Math.round(w * 10) / 10,
      waist: waist.trim() === "" ? undefined : Math.round(Number(waist) * 10) / 10,
      mood,
      water: water.trim() === "" ? 0 : Math.max(0, Number(water) || 0),
      workoutDone,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Log check-in · ${clientName.split(" ")[0]}`} description="Recorded on the client's behalf.">
      <div className="grid gap-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="ci-date">Date *</label>
            <input id="ci-date" className={inputCls} type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="ci-weight">Weight (kg) *</label>
            <input id="ci-weight" className={inputCls} type="number" min={0} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 82.5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="ci-waist">Waist (cm)</label>
            <input id="ci-waist" className={inputCls} type="number" min={0} step={0.1} value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className={labelCls} htmlFor="ci-water">Water (L)</label>
            <input id="ci-water" className={inputCls} type="number" min={0} step={0.5} value={water} onChange={(e) => setWater(e.target.value)} placeholder="—" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={labelCls}>Mood</span>
            <div className="mt-1"><MoodDots mood={mood} /></div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  aria-pressed={mood === m}
                  className={`h-8 flex-1 cursor-pointer rounded-lg border text-xs font-extrabold transition ${mood === m ? "border-volt-400 bg-volt-400/15 text-volt-300" : "border-night-600 bg-night-800 text-mist-500 hover:border-night-500"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={labelCls}>Workout</span>
            <button
              type="button"
              onClick={() => setWorkoutDone((v) => !v)}
              aria-pressed={workoutDone}
              className={`mt-1 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${workoutDone ? "border-moss-400/40 bg-moss-400/10 text-moss-300" : "border-night-600 bg-night-800 text-mist-500 hover:border-night-500"}`}
            >
              {workoutDone && <Check className="h-4 w-4" strokeWidth={3} />}
              {workoutDone ? "Done" : "Skipped"}
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="ci-notes">Notes</label>
          <input id="ci-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did they look / feel…" />
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-xs font-bold text-danger-400">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button className={`${btnSecondary} flex-1`} onClick={onClose}>Cancel</button>
        <button className={`${btnPrimary} flex-1`} onClick={save}>Log check-in</button>
      </div>
    </Modal>
  );
}

/* ---------------- sessions ---------------- */

function SessionsCard({ sessions, clientId }: { sessions: Session[]; clientId: string }) {
  const { setSessionStatus, deleteSession } = useApp();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Session | null>(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const sorted = sortSessions(sessions);
  const att = attendance(sessions);
  const today = todayISO();
  const upcoming = sorted.filter((s) => s.date >= today && (s.status === "Scheduled" || s.status === "Confirmed"));
  const past = sorted.filter((s) => !upcoming.includes(s)).reverse();

  return (
    <SectionCard
      title={`Sessions (${sessions.length})`}
      icon={<CalendarDays className="h-4.5 w-4.5" />}
      bodyCls="p-4"
      action={
        <button className={`${btnPrimary} ${btnSm}`} onClick={() => setFormOpen(true)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Book
        </button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-night-700 bg-night-800/60 px-3.5 py-2.5">
        <p className="text-xs font-bold text-mist-300">
          Attendance: <span className="font-display text-base text-volt-300 tnum">{att.completed}/{att.countable}</span>
        </p>
        <div className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-night-700">
          <div className="grow-x h-full rounded-full bg-volt-400" style={{ width: `${att.pct}%` }} />
        </div>
        <p className="font-display text-base font-bold text-mist-100 tnum">{att.pct}%</p>
      </div>

      {sorted.length === 0 ? (
        <MiniEmpty
          icon={<CalendarDays className="h-4 w-4" />}
          title="No sessions yet"
          sub="Book the first session for this client."
        />
      ) : (
        <div className={`grid items-start gap-2.5 ${upcoming.length > 0 && past.length > 0 ? "xl:grid-cols-2" : ""}`}>
          <div className="min-w-0">
            <p className="px-0.5 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Upcoming ({upcoming.length})</p>
            {upcoming.length === 0 ? (
              <p className="px-0.5 text-xs font-semibold text-mist-500">Nothing scheduled ahead.</p>
            ) : (
              <ul className="grid gap-1.5">
                {upcoming.map((s) => (
                  <SessionRow key={s.id} s={s} setSessionStatus={setSessionStatus} setDeleting={setDeleting} />
                ))}
              </ul>
            )}
          </div>
          {past.length > 0 && (
            <div className="min-w-0">
              <div className="flex items-center justify-between px-0.5 pb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">History ({past.length})</p>
                {past.length > 4 && (
                  <button className="cursor-pointer text-[11px] font-bold text-volt-300 hover:underline" onClick={() => setShowAllPast((v) => !v)}>
                    {showAllPast ? "Show less" : `Show all (${past.length})`}
                  </button>
                )}
              </div>
              <ul className="grid gap-1.5">
                {(showAllPast ? past : past.slice(0, 4)).map((s) => (
                  <SessionRow key={s.id} s={s} setSessionStatus={setSessionStatus} setDeleting={setDeleting} />
                ))}
              </ul>
            </div>
          )}
        </div>
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

function SessionRow({
  s,
  setSessionStatus,
  setDeleting,
}: {
  s: Session;
  setSessionStatus: (id: string, status: Session["status"]) => void;
  setDeleting: (s: Session) => void;
}) {
  const meta = SESSION_STATUS_META[s.status];
  return (
    <li className="group flex items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-3 py-2 transition-all duration-200 hover:border-night-500">
      <span className="w-20 shrink-0 text-xs font-bold text-mist-300">{relDay(s.date)}</span>
      <span className="w-16 shrink-0 font-display text-sm font-bold text-mist-100 tnum">{fmtTime(s.time)}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-mist-400">{s.type}</span>
      <Badge className={meta.chip}>{s.status}</Badge>
      <div className="flex shrink-0 gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
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
}

/* ---------------- plan / meals summaries ---------------- */

function PlanCard({ plans, go, clientId }: { plans: { id: string; day: number }[]; go: (v: CoachView, id?: string) => void; clientId: string }) {
  const days = [...new Set(plans.map((p) => p.day))].sort((a, b) => a - b);
  return (
    <SectionCard title="Workout plan" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-4">
      {plans.length === 0 ? (
        <MiniEmpty
          icon={<ClipboardList className="h-4 w-4" />}
          title="No plan yet"
          sub="Build their weekly split."
        />
      ) : (
        <>
          <p className="font-display text-2xl font-bold text-mist-100 tnum">
            {plans.length} <span className="text-[13px] font-semibold text-mist-500">exercises</span>
          </p>
          <p className="mt-0.5 text-xs font-semibold text-mist-400">across {days.length} training day{days.length === 1 ? "" : "s"}</p>
        </>
      )}
      <button className={`${btnSecondary} ${btnSm} mt-3 w-full`} onClick={() => go("plans", clientId)}>
        Open plan editor <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </SectionCard>
  );
}

function MealsCard({ mealsCount, go, clientId, targets }: { mealsCount: number; go: (v: CoachView, id?: string) => void; clientId: string; targets?: { calories: number } }) {
  return (
    <SectionCard title="Nutrition" icon={<UtensilsCrossed className="h-4.5 w-4.5" />} bodyCls="p-4">
      {mealsCount === 0 ? (
        <MiniEmpty
          icon={<UtensilsCrossed className="h-4 w-4" />}
          title="No meals assigned"
          sub={targets ? `target ${fmtMoney(targets.calories)} kcal/day — add meals.` : "Set targets and assign meals."}
        />
      ) : (
        <>
          <p className="font-display text-2xl font-bold text-mist-100 tnum">
            {mealsCount} <span className="text-[13px] font-semibold text-mist-500">meals</span>
          </p>
          <p className="mt-0.5 text-xs font-semibold text-mist-400">
            {targets ? `target ${fmtMoney(targets.calories)} kcal/day` : "no daily target set"}
          </p>
        </>
      )}
      <button className={`${btnSecondary} ${btnSm} mt-3 w-full`} onClick={() => go("meals", clientId)}>
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
    <SectionCard title="Progress" icon={<Scale className="h-4.5 w-4.5" />} bodyCls="p-4">
      <div className="grid grid-cols-3 gap-2">
        <KV k="Start" v={prog.startWeight !== null ? `${prog.startWeight} kg` : "—"} />
        <KV k="Current" v={prog.currentWeight !== null ? `${prog.currentWeight} kg` : "—"} />
        <KV k="Change" v={prog.weightChange !== null ? `${signed(prog.weightChange)} kg` : "—"} tone={prog.weightChange !== null && prog.weightChange <= 0 ? "text-moss-300" : "text-warn-300"} />
      </div>
      {prog.waistChange !== null && (
        <p className="mt-1.5 text-[11px] font-semibold text-mist-500">
          Waist: {prog.startWaist} → {prog.currentWaist} cm ({signed(prog.waistChange)})
        </p>
      )}
      <div className="mt-2.5 overflow-hidden rounded-xl border border-night-700 bg-night-800/50 p-1.5">
        <WeightLine entries={sorted} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-night-700 pt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Attendance</p>
        <p className="text-xs font-bold text-mist-300">
          {sessionsCount.completed}/{sessionsCount.countable} · <span className="font-display text-sm text-volt-300 tnum">{sessionsCount.pct}%</span>
        </p>
      </div>
    </SectionCard>
  );
}

/* ---------------- meal adherence (last 7 days) ----------------
   Planned meals come from the current weekly plan (by weekday);
   eaten comes from the client's ✓ marks. Rest days (no plan) are
   skipped so they don't drag the average down. */

function MealAdherenceCard({ clientId, meals }: { clientId: string; meals: Meal[] }) {
  const { state } = useApp();
  const days: AdherenceDay[] = useMemo(() => {
    const logs = (state.mealLogs ?? []).filter((l) => l.clientId === clientId);
    const picks = (state.mealDayPicks ?? []).filter((p) => p.clientId === clientId);
    const arr: AdherenceDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = addDays(todayISO(), -i);
      const wd = dayNum(new Date(date + "T12:00:00")); // 1 = Monday
      // Flexible menus: measure against the day the client actually followed
      // (falls back to the calendar weekday for days picked before this feature).
      const pickDay = picks.find((p) => p.date === date)?.day;
      const planned = meals.filter((m) => m.day === (pickDay ?? wd)).length;
      const dayLogs = logs.filter((l) => l.date === date);
      const eaten = Math.min(
        dayLogs.filter((l) => l.status === "EATEN").length,
        planned,
      );
      arr.push({
        date,
        weekday: WEEK_DAYS[wd - 1] ?? `Day ${wd}`,
        letter: (WEEK_SHORT[wd - 1] ?? "?").slice(0, 1),
        planned,
        eaten,
        skipped: dayLogs
          .filter((l) => l.status === "SKIPPED")
          .map((l) => ({ mealType: l.mealType, mealDescription: l.mealDescription })),
        rate: planned > 0 ? eaten / planned : null,
        followed: pickDay ? (WEEK_DAYS[pickDay - 1] ?? `Day ${pickDay}`) : null,
      });
    }
    return arr;
  }, [state.mealLogs, state.mealDayPicks, meals, clientId]);

  const withPlan = days.filter((d) => d.rate !== null);
  const totP = withPlan.reduce((s, d) => s + d.planned, 0);
  const totE = withPlan.reduce((s, d) => s + d.eaten, 0);
  const pct = totP > 0 ? Math.round((totE / totP) * 100) : null;

  return (
    <SectionCard title="Meal adherence" description="Last 7 days" icon={<UtensilsCrossed className="h-4.5 w-4.5" />} bodyCls="p-5">
      {pct === null ? (
        <EmptyState icon={<UtensilsCrossed className="h-6 w-6" />} title="No meals planned" sub="Assign meals first — adherence is measured against the plan." />
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <p className={`font-display text-3xl font-bold tnum ${pct >= 80 ? "text-moss-300" : pct >= 50 ? "text-warn-300" : "text-danger-300"}`}>
              {pct}%
            </p>
            <p className="text-xs font-semibold text-mist-500 tnum">
              {totE} of {totP} meals on track
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-night-700">
            <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-moss-400" : pct >= 50 ? "bg-warn-400" : "bg-danger-400"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3">
            <AdherenceTrend days={days} />
          </div>
          <p className="mt-2 text-[11px] font-semibold text-mist-500">Hover or tap the trend to inspect any day — rest days (no plan) don't count.</p>
        </>
      )}
    </SectionCard>
  );
}

/* ---------------- follow-up ---------------- */

function FollowUpCard({ client, checkIns }: { client: Client; checkIns: CheckIn[] }) {
  const { setFollowUpDays, markFollowUpDone } = useApp();
  const info = followUpInfo(client, checkIns);
  return (
    <SectionCard title="Follow-up" icon={<RotateCw className="h-4.5 w-4.5" />} bodyCls="p-4">
      <p className={`font-display text-xl font-bold ${info.overdue ? "text-danger-300" : info.daysToNext !== null && info.daysToNext <= 1 ? "text-warn-300" : "text-mist-100"}`}>
        {info.label}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-mist-500">
        every {info.frequency} day{info.frequency === 1 ? "" : "s"} · from {info.basis ? relDay(info.basis) : "first check-in"}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {[...FOLLOW_UP_PRESETS, 30].map((d) => (
          <button
            key={d}
            onClick={() => setFollowUpDays(client.id, d)}
            className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-bold transition ${
              info.frequency === d ? "border-volt-400 bg-volt-400/15 text-volt-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>
      <button className={`${btnSecondary} ${btnSm} mt-3 w-full`} onClick={() => markFollowUpDone(client.id)}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Mark follow-up done today
      </button>
    </SectionCard>
  );
}

/* ---------------- chat thread (coach side) ---------------- */

function ChatThreadCard({ clientId, clientName, tall }: { clientId: string; clientName: string; tall?: boolean }) {
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
      {/* bounded height with internal scroll — never stretches the page */}
      <div id="coach-chat" className={`flex scroll-mt-24 flex-col ${tall ? "h-[min(62vh,600px)]" : "h-72"}`}>
        <div className="flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-4">
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
            id="coach-chat-input"
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

/* ---------------- coach notes tab (categorized, priority-ordered) ---------------- */

function NoteCatIcon({ cat, className = "h-4 w-4" }: { cat: NoteCategory; className?: string }) {
  if (cat === "critical") return <AlertTriangle className={className} />;
  if (cat === "workout") return <Dumbbell className={className} />;
  if (cat === "nutrition") return <UtensilsCrossed className={className} />;
  return <StickyNote className={className} />;
}

const sortNotes = (list: CoachNote[]): CoachNote[] =>
  [...list].sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.createdAt - a.createdAt);

/* ---------------- coach to-do list (private tasks per client) ---------------- */

function TodoCard({ clientId }: { clientId: string }) {
  const { state, addTodo, toggleTodo, deleteTodo, clearCompletedTodos } = useApp();
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);

  const todos = useMemo(
    () =>
      (state.todos ?? [])
        .filter((t) => t.clientId === clientId)
        .sort((a, b) => a.createdAt - b.createdAt),
    [state.todos, clientId],
  );
  const pending = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  const add = () => {
    if (!draft.trim()) return;
    addTodo(clientId, draft.trim());
    setDraft("");
  };

  return (
    <SectionCard
      title="To-do"
      icon={<ListChecks className="h-4.5 w-4.5" />}
      bodyCls="p-3 sm:p-4"
      description="Your private tasks for this client."
      action={
        pending.length > 0 ? (
          <span className="rounded-full bg-volt-400/15 px-2.5 py-1 text-[11px] font-extrabold text-volt-300 tnum">
            {pending.length} open
          </span>
        ) : undefined
      }
    >
      <div className="flex gap-2">
        <input
          className={`${inputCls} h-10 min-w-0 flex-1`}
          placeholder="e.g. Review Friday's check-in…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="New task"
        />
        <button onClick={add} disabled={!draft.trim()} className={`${btnPrimary} h-10 shrink-0 px-3.5`} aria-label="Add task">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
        </button>
      </div>

      {pending.length > 0 && (
        <ul className="mt-2.5 grid gap-1.5">
          {pending.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-2.5 py-2"
            >
              <button
                onClick={() => toggleTodo(t.id)}
                aria-pressed={false}
                aria-label={`Mark done: ${t.text}`}
                className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-md border border-night-500 transition hover:border-volt-400 hover:bg-volt-400/10"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-100" title={t.text}>
                {t.text}
              </span>
              <button
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 opacity-0 transition hover:bg-danger-500/15 hover:text-danger-300 focus-visible:opacity-100 group-hover:opacity-100"
                title="Delete task"
                onClick={() => deleteTodo(t.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex cursor-pointer items-center gap-1.5 px-0.5 py-1 text-[11px] font-bold text-mist-500 transition hover:text-mist-200"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showDone ? "rotate-180" : ""}`} />
              Done ({done.length})
            </button>
            <button
              onClick={() => clearCompletedTodos(clientId)}
              className="ms-auto cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold text-mist-500 transition hover:bg-danger-500/10 hover:text-danger-300"
            >
              Clear completed
            </button>
          </div>
          {showDone && (
            <ul className="mt-1 grid gap-1.5">
              {done.map((t) => (
                <li
                  key={t.id}
                  className="group flex items-center gap-2.5 rounded-xl border border-night-700/60 bg-night-800/50 px-2.5 py-2"
                >
                  <button
                    onClick={() => toggleTodo(t.id)}
                    aria-pressed={true}
                    aria-label={`Reopen: ${t.text}`}
                    title="Reopen"
                    className="grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-md border border-volt-400 bg-volt-400 text-night-950 transition hover:brightness-110"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-500 line-through" title={t.text}>
                    {t.text}
                  </span>
                  <button
                    className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 opacity-0 transition hover:bg-danger-500/15 hover:text-danger-300 focus-visible:opacity-100 group-hover:opacity-100"
                    title="Delete task"
                    onClick={() => deleteTodo(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {todos.length === 0 && (
        <p className="mt-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3 text-center text-xs font-semibold text-mist-500">
          Nothing to do — enjoy the calm.
        </p>
      )}
    </SectionCard>
  );
}

function CoachNotesTab({ client }: { client: Client }) {
  const { addCoachNote, updateCoachNote, deleteCoachNote, toggleCoachNotePin } = useApp();
  const [draft, setDraft] = useState("");
  const [draftCat, setDraftCat] = useState<NoteCategory>("general");
  const [filter, setFilter] = useState<"all" | NoteCategory>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editCat, setEditCat] = useState<NoteCategory>("general");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Partial<Record<NoteCategory, boolean>>>({});

  const notes = useMemo(() => normalizeCoachNotes(client.coachNotes), [client.coachNotes]);
  const counts = useMemo(() => {
    const m: Record<NoteCategory, number> = { critical: 0, workout: 0, nutrition: 0, general: 0 };
    for (const n of notes) m[n.category ?? "general"] += 1;
    return m;
  }, [notes]);

  const visibleCats: NoteCategory[] = filter === "all" ? NOTE_CATEGORIES : [filter];

  const add = () => {
    if (!draft.trim()) return;
    addCoachNote(client.id, draft.trim(), draftCat);
    setDraft("");
  };

  const startEdit = (n: CoachNote) => {
    setEditingId(n.id);
    setEditText(n.text);
    setEditCat(n.category ?? "general");
  };

  const saveEdit = () => {
    if (!editingId || !editText.trim()) return;
    updateCoachNote(client.id, editingId, editText.trim(), editCat);
    setEditingId(null);
  };

  const shared = { onEdit: startEdit, onDelete: setDeleting, togglePin: (id: string) => toggleCoachNotePin(client.id, id) };

  return (
    <div className="grid items-start gap-3 lg:grid-cols-3">
      {/* composer + filter rail */}
      <div className="grid content-start gap-3 lg:sticky lg:top-24">
        <SectionCard
          title="New note"
          icon={<Plus className="h-4.5 w-4.5" />}
          bodyCls="p-4"
          description="Private — the client never sees these."
        >
          <textarea
            className={`${textareaCls} min-h-20`}
            placeholder="e.g. Cut carbs by 20g on rest days…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="New note text"
          />
          <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-mist-500">Section</p>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Note section">
            {NOTE_CATEGORIES.map((c) => {
              const meta = NOTE_CATEGORY_META[c];
              const on = draftCat === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDraftCat(c)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition active:scale-[0.98] ${
                    on ? meta.chip : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500 hover:text-mist-200"
                  }`}
                >
                  <NoteCatIcon cat={c} className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                </button>
              );
            })}
          </div>
          <button className={`${btnPrimary} mt-3 w-full`} onClick={add} disabled={!draft.trim()}>
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Add note
          </button>
        </SectionCard>

        <SectionCard title="Sections" icon={<StickyNote className="h-4.5 w-4.5" />} bodyCls="p-2">
          <FilterRow
            active={filter === "all"}
            onClick={() => setFilter("all")}
            icon={<StickyNote className="h-3.5 w-3.5" />}
            label="All notes"
            count={notes.length}
          />
          {NOTE_CATEGORIES.map((c) => (
            <FilterRow
              key={c}
              active={filter === c}
              onClick={() => setFilter(filter === c ? "all" : c)}
              icon={<NoteCatIcon cat={c} className="h-3.5 w-3.5" />}
              label={NOTE_CATEGORY_META[c].label}
              count={counts[c]}
            />
          ))}
        </SectionCard>
      </div>

      {/* grouped sections — critical first, then workout, nutrition, general */}
      <div className="grid content-start gap-3 lg:col-span-2">
        <TodoCard clientId={client.id} />
        {notes.length === 0 ? (
          <SectionCard title="Notes" icon={<StickyNote className="h-4.5 w-4.5" />} bodyCls="p-4">
            <MiniEmpty
              icon={<StickyNote className="h-4 w-4" />}
              title="No notes yet"
              sub="Capture anything worth remembering — flagged, training, food or general."
            />
          </SectionCard>
        ) : (
          visibleCats.map((cat) => {
            const list = sortNotes(notes.filter((n) => (n.category ?? "general") === cat));
            if (list.length === 0) return null;
            return (
              <NoteSection
                key={cat}
                cat={cat}
                notes={list}
                collapsed={!!collapsed[cat]}
                onToggle={() => setCollapsed((s) => ({ ...s, [cat]: !s[cat] }))}
                editingId={editingId}
                editText={editText}
                editCat={editCat}
                setEditText={setEditText}
                setEditCat={setEditCat}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                {...shared}
              />
            );
          })
        )}
        {filter !== "all" && notes.length > 0 && sortNotes(notes.filter((n) => (n.category ?? "general") === filter)).length === 0 && (
          <MiniEmpty
            icon={<NoteCatIcon cat={filter} className="h-4 w-4" />}
            title={`No ${NOTE_CATEGORY_META[filter].label.toLowerCase()} notes`}
            sub="Switch sections or add one from the composer."
          />
        )}
      </div>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete note?"
        message="This private note will be removed."
        onConfirm={() => deleting && deleteCoachNote(client.id, deleting)}
      />
    </div>
  );
}

function FilterRow({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-start text-[13px] font-bold transition ${
        active ? "bg-volt-400 text-night-950" : "text-mist-300 hover:bg-white/[0.05] hover:text-mist-100"
      }`}
    >
      <span className="shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tnum ${active ? "bg-night-950/15 text-night-950" : "bg-white/[0.06] text-mist-400"}`}>
        {count}
      </span>
    </button>
  );
}

function NoteSection({
  cat,
  notes,
  collapsed,
  onToggle,
  editingId,
  editText,
  editCat,
  setEditText,
  setEditCat,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
  togglePin,
}: {
  cat: NoteCategory;
  notes: CoachNote[];
  collapsed: boolean;
  onToggle: () => void;
  editingId: string | null;
  editText: string;
  editCat: NoteCategory;
  setEditText: (v: string) => void;
  setEditCat: (v: NoteCategory) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEdit: (n: CoachNote) => void;
  onDelete: (id: string) => void;
  togglePin: (id: string) => void;
}) {
  const meta = NOTE_CATEGORY_META[cat];
  const critical = cat === "critical";
  return (
    <section
      aria-label={`${meta.label} notes`}
      className={`rise overflow-hidden rounded-[20px] border shadow-sm backdrop-blur-xl ${
        critical ? "border-danger-500/25 bg-night-900/60" : "border-white/[0.07] bg-night-900/60"
      }`}
    >
      <button onClick={onToggle} aria-expanded={!collapsed} className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3.5 text-start">
        <span className={`icon-tile h-9 w-9 shrink-0 ${critical ? "!border-danger-500/30 !bg-danger-500/10 !text-danger-300" : ""}`} aria-hidden="true">
          <NoteCatIcon cat={cat} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[13px] font-bold uppercase tracking-[0.14em] ${critical ? "text-danger-300" : "text-mist-100"}`}>
            {meta.label}
          </span>
          <span className="mt-0.5 block text-xs text-mist-500">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-mist-500 transition-transform duration-200 ${collapsed ? "" : "rotate-180"}`} />
      </button>
      {!collapsed && (
        <ul className={`grid gap-2 border-t p-3 ${critical ? "border-danger-500/20" : "border-white/[0.06]"}`}>
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              critical={critical}
              editing={editingId === n.id}
              editText={editText}
              editCat={editCat}
              setEditText={setEditText}
              setEditCat={setEditCat}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onEdit={() => onEdit(n)}
              onDelete={() => onDelete(n.id)}
              onTogglePin={() => togglePin(n.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({
  note: n,
  critical,
  editing,
  editText,
  editCat,
  setEditText,
  setEditCat,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  note: CoachNote;
  critical: boolean;
  editing: boolean;
  editText: string;
  editCat: NoteCategory;
  setEditText: (v: string) => void;
  setEditCat: (v: NoteCategory) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const meta = NOTE_CATEGORY_META[n.category ?? "general"];
  if (editing) {
    return (
      <li className="rounded-xl border border-volt-400/40 bg-night-800 p-3">
        <input
          className={`${inputCls} h-10`}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          autoFocus
          aria-label="Edit note"
        />
        <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Note section">
          {NOTE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={editCat === c}
              onClick={() => setEditCat(c)}
              className={`cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-bold transition ${
                editCat === c
                  ? NOTE_CATEGORY_META[c].chip
                  : "border-night-600 bg-night-800 text-mist-500 hover:border-night-500"
              }`}
            >
              {NOTE_CATEGORY_META[c].label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button className={`${btnPrimary} ${btnSm} flex-1`} disabled={!editText.trim()} onClick={onSaveEdit}>
            <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> Save
          </button>
          <button className={`${btnSecondary} ${btnSm}`} onClick={onCancelEdit}>
            Cancel
          </button>
        </div>
      </li>
    );
  }
  return (
    <li
      className={`group rounded-xl border p-3 transition-colors ${
        n.pinned
          ? "border-volt-400/30 bg-volt-400/[0.05]"
          : critical
            ? "border-danger-500/20 bg-night-800"
            : "border-night-700 bg-night-800"
      }`}
    >
      <div className="flex items-start gap-2">
        {n.pinned && <Pin className="mt-1 h-3.5 w-3.5 shrink-0 fill-volt-400 text-volt-400" aria-label="Pinned" />}
        <p className="min-w-0 flex-1 text-sm font-semibold leading-6 text-mist-100">{n.text}</p>
        <Badge className={`${meta.chip} shrink-0`}>{meta.label}</Badge>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="text-[10px] font-bold text-mist-500">
          Added {relDay(toISO(new Date(n.createdAt)))}{n.by ? ` • ${n.by}` : ""}
        </span>
        <span className="ms-auto flex gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button
            className={`grid h-6 w-6 cursor-pointer place-items-center rounded-md transition-all duration-200 ${n.pinned ? "text-volt-300 hover:bg-volt-400/15" : "text-mist-400 hover:bg-night-700 hover:text-mist-100"}`}
            title={n.pinned ? "Unpin" : "Pin to top"}
            onClick={onTogglePin}
          >
            <Pin className={`h-3 w-3 ${n.pinned ? "fill-volt-400" : ""}`} />
          </button>
          <button className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100" title="Edit" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </button>
          <button className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      </div>
    </li>
  );
}

/* ---------------- shared profile primitives (live in ./clients) ---------------- */
