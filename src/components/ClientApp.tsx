/* ================================================================
   VERRAA — client mode: Today, Daily check-in, My progress, Chat,
   Subscription + the notification bell.
   ================================================================ */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Droplets,
  FileDown,
  FileText,
  Flame,
  Home,
  ImagePlus,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  PauseCircle,
  Pencil,
  Play,
  Scale,
  Send,
  TrendingUp,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { AppNotification, Client, Meal, MealLogStatus, MealRequestStatus, MealType, DayLabelMode } from "../types";
import { CAT_META, GOAL_META, MEAL_META, MEAL_TYPES, NOTIFICATION_META, SUB_PAYMENT_META, SUB_STATE_META, WEEK_DAYS,
WEEK_SHORT, WEEK_ORDER_SAT_FIRST, formatDayName, formatDayShort } from "../types";
import { dayNum, fmtDate, fmtMoney, fmtTime, getDayLabelMode, activePlan, clientPlans, mealInPlan, relTime, round1, signed, todayISO } from "../lib";
import { attendance, currentSubscription, progressOf, remainingLabel, subscriptionState } from "../logic";
import { useApp } from "../store";
import { backend } from "../services/backend";
import { Avatar, Badge, ConfirmModal, Dropdown, EmptyState, Modal, MoodPicker, SectionCard, Toggle, btnPrimary, btnSecondary, btnVolt, chip, inputCls, labelCls, textareaCls, useCountUp } from "./ui";
import { exportDayImage, exportWeekPdf } from "./nutritionExport";
import { exportWorkoutDayImage, exportWorkoutWeekPdf } from "./workoutExport";
import { WeightLine } from "./Chart";
import { StrengthTracker } from "./StrengthTracker";
import { PhotoGallery } from "./Photos";

const MEAL_REQ_META: Record<MealRequestStatus, { chip: string; label: string }> = {
  PENDING: { chip: "border-warn-400/25 bg-warn-400/10 text-warn-300", label: "Pending review" },
  APPROVED: { chip: "border-moss-400/25 bg-moss-400/10 text-moss-300", label: "Approved" },
  REJECTED: { chip: "border-danger-500/25 bg-danger-500/10 text-danger-300", label: "Rejected" },
};

/* ---------------- meal compliance buttons (✓ ate it / ✕ skipped) ---------------- */

function MealLogButtons({ meal, date, clientId }: { meal: Meal; date: string; clientId: string }) {
  const { state, setMealLog } = useApp();
  const status = (state.mealLogs ?? []).find((l) => l.clientId === clientId && l.mealId === meal.id && l.date === date)?.status ?? null;
  // Tapping the active mark clears it; tapping the other one switches.
  const tap = (s: MealLogStatus) => setMealLog({ meal, date, clientId, status: status === s ? null : s });
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        onClick={() => tap("EATEN")}
        title="I ate this meal"
        aria-label={`Mark ${meal.description} as eaten`}
        aria-pressed={status === "EATEN"}
        className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg border transition active:scale-95 ${status === "EATEN" ? "border-moss-400 bg-moss-400 text-night-950" : "border-night-600 text-mist-500 hover:border-moss-400/60 hover:text-moss-300"}`}
      >
        <Check className="h-4 w-4" strokeWidth={2.8} />
      </button>
      <button
        onClick={() => tap("SKIPPED")}
        title="I skipped it / cheated"
        aria-label={`Mark ${meal.description} as skipped`}
        aria-pressed={status === "SKIPPED"}
        className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg border transition active:scale-95 ${status === "SKIPPED" ? "border-danger-500 bg-danger-500 text-white" : "border-night-600 text-mist-500 hover:border-danger-500/60 hover:text-danger-300"}`}
      >
        <X className="h-4 w-4" strokeWidth={2.8} />
      </button>
    </span>
  );
}

/** Today adherence chip: "3/5 on track". */
function DayAdherence({ clientId, date, total }: { clientId: string; date: string; total: number }) {
  const { state } = useApp();
  if (total === 0) return null;
  const logs = (state.mealLogs ?? []).filter((l) => l.clientId === clientId && l.date === date);
  const eaten = logs.filter((l) => l.status === "EATEN").length;
  const done = logs.length >= total;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${done && eaten === total ? "border-moss-400/30 bg-moss-400/10 text-moss-300" : "border-white/[0.08] bg-white/[0.03] text-mist-200"}`}>
      <Check className={`h-3.5 w-3.5 ${eaten === total && done ? "text-moss-300" : "text-mist-400"}`} />
      {eaten}/{total} on track
    </span>
  );
}

type Tab = "today" | "training" | "nutrition" | "checkin" | "progress" | "photos" | "chat" | "subscription";

/* ---------------- frozen Client Mode (coach downgraded to Starter) ----------------
   The login still exists and all data is safe — but the coach's plan has
   No Client Mode, so the app stays paused until they upgrade. Status comes
   from the authoritative `my_client_mode_status` RPC (null = legacy/unknown
   backend → treat as not frozen to preserve old behavior). */

function ClientFrozenScreen({ clientName, onLogout }: { clientName: string; onLogout: () => void }) {
  return (
    <div className="relative grid min-h-screen place-items-center p-6">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="rise w-full max-w-md rounded-[24px] border border-danger-500/25 bg-night-900/70 p-8 text-center backdrop-blur-xl">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger-500/30 bg-danger-500/10 text-danger-300">
          <PauseCircle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-mist-100">
          Client Mode <span className="text-danger-300">paused</span>
        </h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-mist-300">
          Hi {clientName.split(" ")[0]} — your coach&apos;s plan doesn&apos;t include Client Mode right now,
          so progress is tracked manually by your coach.
        </p>
        <p className="mt-1.5 text-[13px] font-medium leading-5 text-mist-500">
          Nothing is deleted. Your app reopens automatically once your coach upgrades to Professional.
        </p>
        <button className={`${btnPrimary} mt-5 w-full`} onClick={onLogout}>
          <LogOut className="h-4 w-4" /> Back to sign in
        </button>
      </div>
    </div>
  );
}

export function ClientApp({ onLogout }: { onLogout: () => void }) {
  const { state, me, markAllNotificationsRead } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const [bellOpen, setBellOpen] = useState(false);
  const [modeFrozen, setModeFrozen] = useState(false);

  // Authoritative freeze check — the coach may have downgraded to Starter
  // (No Client Mode) after this login was created.
  useEffect(() => {
    let cancelled = false;
    void backend
      .getMyClientModeStatus()
      .then((s) => {
        if (!cancelled && s?.frozen) setModeFrozen(true);
      })
      .catch(() => {
        /* offline / legacy backend → keep legacy behavior (not frozen) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientId = me?.userId ?? "";
  const client = state.clients.find((c) => c.id === clientId);
  const plans = useMemo(() => state.plans.filter((p) => p.clientId === clientId), [state.plans, clientId]);
  // The client follows ONE standing plan: only the active version's meals
  // are visible (pre-versioning meals belong to the oldest version; with no
  // versions yet everything shows — legacy behavior).
  const meals = useMemo(() => {
    const mine = state.meals.filter((m) => m.clientId === clientId);
    const versions = clientPlans(state.nutritionPlans, clientId);
    if (versions.length === 0) return mine;
    const active = activePlan(state.nutritionPlans, clientId) ?? versions[0];
    const legacy = versions[0].id === active.id;
    return mine.filter((m) => mealInPlan(m, active.id, legacy));
  }, [state.meals, state.nutritionPlans, clientId]);
  const checkIns = useMemo(() => state.checkIns.filter((c) => c.clientId === clientId), [state.checkIns, clientId]);
  const sessions = useMemo(() => state.sessions.filter((s) => s.clientId === clientId), [state.sessions, clientId]);
  const notifications = useMemo(
    () => state.notifications.filter((n) => n.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt),
    [state.notifications, clientId],
  );
  const unread = notifications.filter((n) => !n.read).length;
  const todayPickDay = useMemo(
    () => (state.mealDayPicks ?? []).find((p) => p.clientId === clientId && p.date === todayISO())?.day ?? null,
    [state.mealDayPicks, clientId],
  );

  if (!client) {
    return (
      <div className="relative grid min-h-screen place-items-center p-6">
        <div className="app-glow pointer-events-none fixed inset-0" />
        <EmptyState icon={<LogOut className="h-6 w-6" />} title="Profile unavailable" sub="Your account isn't linked to a client record. Ask your coach to re-add you.">
          <button className={`${btnPrimary} mt-2`} onClick={onLogout}>
            <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" /> Back to sign in
          </button>
        </EmptyState>
      </div>
    );
  }

  if (modeFrozen) {
    return <ClientFrozenScreen clientName={client.name} onLogout={onLogout} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "training", label: "Training" },
    { id: "nutrition", label: "Nutrition" },
    { id: "checkin", label: "Check-in" },
    { id: "progress", label: "Progress" },
    { id: "photos", label: "Photos" },
    { id: "chat", label: "Chat" },
    { id: "subscription", label: "Subscription" },
  ];

  const onNotifTap = (n: AppNotification) => {
    if (n.kind === "message") setTab("chat");
    else if (n.kind === "plan_updated") setTab("today");
    else if (n.kind === "meal_updated") setTab("nutrition");
    else if (n.kind === "subscription") setTab("subscription");
    setBellOpen(false);
  };

  const goTab = (t: Tab) => {
    setTab(t);
    setBellOpen(false);
    // Instant jump — smooth scrolling fights the tab-switch paint on mobile GPUs.
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  };

  return (
    <div className="client-app noise relative min-h-screen">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-40" />

      {/* ── compact app bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-night-950/85 backdrop-blur-xl">
        <span aria-hidden="true" className="absolute inset-x-8 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-volt-400/30 to-transparent" />
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-2.5 px-4 sm:gap-3 sm:px-6">
          <Avatar name={client.name} photo={client.photo} className="h-10 w-10 text-xs" status="online" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-tight text-mist-100 sm:text-[15px]">{client.name}</p>
            <span className={`${chip} mt-0.5 hidden !border-white/[0.08] sm:inline-flex ${GOAL_META[client.goal].chip}`}>{client.goal}</span>
            <p className="truncate text-[11px] font-semibold text-mist-500 sm:hidden">{client.goal} · {WEEK_DAYS[dayNum() - 1]}</p>
          </div>
          {/* desktop pills */}
          <nav aria-label="Client sections" className="ms-auto hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.02] p-1 lg:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => goTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`relative h-9 cursor-pointer whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/60 ${tab === t.id ? "bg-volt-400 text-night-950 shadow-[0_4px_16px_-6px_rgba(205,241,75,0.5)]" : "text-mist-400 hover:bg-white/[0.05] hover:text-mist-100"}`}
              >
                {t.label}
                {t.id === "chat" && unread > 0 && tab !== "chat" && (
                  <span className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-night-950 tnum">{unread}</span>
                )}
              </button>
            ))}
          </nav>
          {/* training shortcut — visible on mobile/tablet where bottom nav hides it */}
          <button
            onClick={() => goTab("training")}
            aria-label="Strength tracker"
            aria-current={tab === "training" ? "page" : undefined}
            className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 lg:hidden ${tab === "training" ? "border-volt-400/50 bg-volt-400/15 text-volt-300" : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-100"}`}
          >
            <Dumbbell className="h-[18px] w-[18px]" />
          </button>
          {/* photos shortcut — visible on mobile/tablet where bottom nav hides it */}
          <button
            onClick={() => goTab("photos")}
            aria-label="Progress photos"
            aria-current={tab === "photos" ? "page" : undefined}
            className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 lg:hidden ${tab === "photos" ? "border-volt-400/50 bg-volt-400/15 text-volt-300" : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-100"}`}
          >
            <ImagePlus className="h-[18px] w-[18px]" />
          </button>
          {/* subscription shortcut — visible on mobile/tablet where bottom nav hides it */}
          <button
            onClick={() => goTab("subscription")}
            aria-label="My subscription"
            aria-current={tab === "subscription" ? "page" : undefined}
            className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 lg:hidden ${tab === "subscription" ? "border-volt-400/50 bg-volt-400/15 text-volt-300" : "border-white/[0.08] bg-white/[0.02] text-mist-400 hover:border-white/[0.14] hover:text-mist-100"}`}
          >
            <CreditCard className="h-[18px] w-[18px]" />
          </button>
          {/* bell */}
          <div className="relative shrink-0">
            <button
              onClick={() => setBellOpen(!bellOpen)}
              aria-expanded={bellOpen}
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-mist-400 transition-all duration-200 hover:border-white/[0.14] hover:text-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-night-950 tnum">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} aria-hidden="true" />
                <div role="dialog" aria-label="Notifications" className="animate-dropdown absolute end-0 top-12 z-50 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border border-white/10 bg-night-900/95 shadow-xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                    <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-mist-100">Notifications</p>
                    {unread > 0 && (
                      <button className="cursor-pointer rounded-lg px-1 py-0.5 text-xs font-bold text-volt-300 transition hover:text-volt-200" onClick={() => markAllNotificationsRead(clientId)}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[320px] overflow-y-auto p-1.5">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-mist-500">No notifications yet — you're all caught up.</p>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => onNotifTap(n)}
                          className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-start transition hover:bg-white/[0.04] ${n.read ? "opacity-60" : ""}`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-white/15" : NOTIFICATION_META[n.kind].dot}`} />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[13px] font-semibold leading-5 ${n.read ? "text-mist-400" : "text-mist-100"}`}>{n.text}</span>
                            <span className="mt-0.5 block text-[11px] font-medium text-mist-500">{relTime(n.createdAt)}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* logout — desktop only, mobile uses the sign-out in Subscription tab */}
          <button onClick={onLogout} className="hidden h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-mist-400 transition-all duration-200 hover:border-danger-500/30 hover:text-danger-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 lg:grid" aria-label="Sign out">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main id="main-content" className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:pb-12 lg:py-8">
        {/* Single cheap opacity fade per tab — replaces staggered rise animations (see .client-app CSS). */}
        <div key={tab} className="animate-fade">
          {tab === "today" && <TodayTab clientId={clientId} todayPickDay={todayPickDay} plans={plans} meals={meals} exercises={state.exercises} onCheckIn={() => goTab("checkin")} onOpenTraining={() => goTab("training")} onOpenNutrition={() => goTab("nutrition")} sessionsToday={sessions.filter((s) => s.date === todayISO())} />}
          {tab === "training" && <StrengthTracker clientId={clientId} />}
          {tab === "nutrition" && (
            <NutritionTab
              clientId={clientId}
              client={client}
              allMeals={meals}
              planName={(() => {
                const versions = clientPlans(state.nutritionPlans, clientId);
                if (versions.length === 0) return undefined;
                return (activePlan(state.nutritionPlans, clientId) ?? versions[0]).name;
              })()}
            />
          )}
          {tab === "checkin" && <CheckInTab clientId={clientId} onDone={() => goTab("progress")} alreadyToday={checkIns.some((c) => c.date === todayISO())} />}
          {tab === "progress" && <ProgressTab checkIns={checkIns} sessionsCount={attendance(sessions)} />}
          {tab === "photos" && <PhotoGallery clientId={clientId} role="client" />}
          {tab === "chat" && <ChatTab clientId={clientId} />}
          {tab === "subscription" && <SubscriptionTab clientId={clientId} onLogout={onLogout} />}
        </div>
      </main>

      {/* ── mobile bottom navigation ── */}
      <nav aria-label="Client sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-night-950/90 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid w-full max-w-md grid-cols-5 items-end px-2 pb-2 pt-1.5">
          <BottomItem active={tab === "today"} onClick={() => goTab("today")} icon={<Home className="h-5 w-5" />} label="Today" />
          <BottomItem active={tab === "nutrition"} onClick={() => goTab("nutrition")} icon={<UtensilsCrossed className="h-5 w-5" />} label="Meals" />
          {/* center check-in FAB */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => goTab("checkin")}
              aria-label="Daily check-in"
              aria-current={tab === "checkin" ? "page" : undefined}
              className={`-mt-7 grid h-14 w-14 cursor-pointer place-items-center rounded-full border-4 border-night-950 shadow-[0_8px_24px_-8px_rgba(205,241,75,0.6)] transition-all duration-200 active:scale-95 ${tab === "checkin" ? "bg-volt-300 text-night-950" : "bg-volt-400 text-night-950 hover:bg-volt-300"}`}
            >
              <Camera className="h-6 w-6" strokeWidth={2.2} />
            </button>
            <span className={`mt-1 text-[10px] font-extrabold tracking-wide ${tab === "checkin" ? "text-volt-300" : "text-mist-500"}`}>Check-in</span>
          </div>
          <BottomItem active={tab === "progress"} onClick={() => goTab("progress")} icon={<TrendingUp className="h-5 w-5" />} label="Progress" />
          <BottomItem active={tab === "chat"} onClick={() => goTab("chat")} icon={<MessageCircle className="h-5 w-5" />} label="Chat" badge={unread > 0 && tab !== "chat" ? unread : 0} />
        </div>
      </nav>
    </div>
  );
}

function BottomItem({ active, onClick, icon, label, badge = 0 }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="relative flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200 active:scale-95"
    >
      <span className={`relative grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${active ? "bg-volt-400/15 text-volt-300" : "text-mist-500"}`}>
        {icon}
        {badge > 0 && (
          <span className="absolute -end-0.5 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-night-950 tnum">{badge}</span>
        )}
      </span>
      <span className={`text-[10px] font-extrabold tracking-wide ${active ? "text-volt-300" : "text-mist-500"}`}>{label}</span>
      <span className={`h-1 w-1 rounded-full transition-all duration-200 ${active ? "bg-volt-400" : "bg-transparent"}`} />
    </button>
  );
}

/* ---------------- nutrition (weekly plan) ---------------- */

/* Isolated summary card: the count-up animation re-renders ONLY this card,
   never the meals list below it (was ~36 full-tab renders per day switch). */
function DailySummary({ meals, dayName, targets }: { meals: Meal[]; dayName: string; targets: Client["nutritionTargets"] }) {
  const totals = useMemo(
    () =>
      meals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fats: acc.fats + m.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 },
      ),
    [meals],
  );
  const animCalories = useCountUp(totals.calories, 600);
  const animProtein = useCountUp(totals.protein, 600);
  const animCarbs = useCountUp(totals.carbs, 600);
  const animFats = useCountUp(totals.fats, 600);

  return (
    <div className="rounded-xl border border-night-700 bg-night-850 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-warn-400/15 text-warn-300">
          <Flame className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[26px] font-bold leading-7 text-mist-100 tnum sm:text-[28px]">
            {Math.round(animCalories).toLocaleString("en-US")}
            <span className="ms-1.5 text-sm font-semibold text-mist-500">kcal</span>
          </p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-500">{dayName}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-night-700 pt-3">
        {([
          ["Protein", animProtein, "text-volt-300"],
          ["Carbs", animCarbs, "text-sky-300"],
          ["Fats", animFats, "text-warn-300"],
        ] as const).map(([label, v, tone]) => (
          <div key={label} className="rounded-xl bg-night-800 px-2 py-2 text-center">
            <p className={`font-display text-lg font-bold tnum ${tone}`}>{Math.round(v)}g</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
          </div>
        ))}
      </div>

      {targets && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-night-700 pt-3 sm:grid-cols-4">
          <div className="rounded-xl bg-night-800 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Target</p>
            <p className="mt-0.5 font-display text-lg font-bold text-mist-200 tnum">{targets.calories} kcal</p>
          </div>
          <div className="rounded-xl bg-night-800 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Protein</p>
            <p className={`mt-0.5 font-display text-lg font-bold tnum ${totals.protein >= targets.protein ? "text-volt-300" : "text-mist-400"}`}>
              {totals.protein}/{targets.protein}g
            </p>
          </div>
          <div className="rounded-xl bg-night-800 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Carbs</p>
            <p className={`mt-0.5 font-display text-lg font-bold tnum ${totals.carbs >= targets.carbs ? "text-sky-300" : "text-mist-400"}`}>
              {totals.carbs}/{targets.carbs}g
            </p>
          </div>
          <div className="rounded-xl bg-night-800 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Fat</p>
            <p className={`mt-0.5 font-display text-lg font-bold tnum ${totals.fats >= targets.fats ? "text-warn-300" : "text-mist-400"}`}>
              {totals.fats}/{targets.fats}g
            </p>
          </div>
        </div>
      )}

      {targets?.water && (
        <div className="mt-3 flex items-center gap-2 text-mist-400">
          <Droplets className="h-4 w-4 shrink-0 text-sky-300" />
          <span className="text-xs font-bold">Water target: {targets.water}L / day</span>
        </div>
      )}
    </div>
  );
}

/** Full-week menu list — every day with its meals, each pickable for today. */
function WeekMenuList({ meals, labelMode, current, onSelect }: {
  meals: Meal[];
  labelMode: DayLabelMode;
  current?: number | null;
  onSelect: (day: number) => void;
}) {
  const today = dayNum();
  const typeOrder: Record<MealType, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
  return (
    <div className="grid gap-2.5">
      {WEEK_ORDER_SAT_FIRST.map((d) => {
        const dm = [...meals.filter((m) => m.day === d)].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
        const kcal = dm.reduce((s, m) => s + m.calories, 0);
        const empty = dm.length === 0;
        const isCurrent = current === d;
        return (
          <div key={d} className={`rounded-xl border p-3 ${isCurrent ? "border-volt-400/50 bg-volt-400/[0.05]" : "border-night-700 bg-night-800"}`}>
            <div className="flex items-center gap-2.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ${isCurrent ? "bg-volt-400 text-night-950" : "bg-night-700 text-volt-300"}`}>
                {formatDayShort(d, labelMode)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-mist-100">
                  {formatDayName(d, labelMode)}
                  {d === today && <span className="ms-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-mist-400">today</span>}
                </span>
                <span className="mt-0.5 block text-[11px] font-semibold text-mist-500 tnum">
                  {empty ? "No plan" : `${dm.length} meal${dm.length === 1 ? "" : "s"} · ${kcal.toLocaleString("en-US")} kcal`}
                </span>
              </span>
              {isCurrent ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-volt-400 px-2.5 py-1 text-[11px] font-extrabold text-night-950">
                  <Check className="h-3 w-3" strokeWidth={3} /> Following
                </span>
              ) : !empty ? (
                <button onClick={() => onSelect(d)} className={`${btnVolt} h-9 shrink-0 !px-3.5 !text-[13px]`}>
                  Select for today
                </button>
              ) : null}
            </div>
            {dm.length > 0 && (
              <div className="mt-2 grid gap-2">
                {MEAL_TYPES.map((t) => {
                  const list = dm.filter((m) => m.type === t);
                  if (list.length === 0) return null;
                  return (
                    <div key={t}>
                      <p className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${MEAL_META[t].dot}`} />
                        {t} · {list.length}
                      </p>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {list.map((m) => (
                          <li key={m.id} className="rounded-lg bg-night-850 px-2.5 py-2">
                            <p className="truncate text-[13px] font-semibold text-mist-100">{m.description}</p>
                            <span className="mt-1 flex gap-2.5 text-[11px] font-bold tnum">
                              <span className="text-warn-300">{m.calories} kcal</span>
                              <span className="text-volt-300">P {m.protein}g</span>
                              <span className="text-sky-300">C {m.carbs}g</span>
                              <span className="text-warn-300">F {m.fats}g</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NutritionTab({ clientId, client, allMeals, planName }: { clientId: string; client: Client; allMeals: Meal[]; planName?: string }) {
  const { state, requestMealEdit, cancelMealRequest, setMealDayPick, toast } = useApp();
  const [selectedDay, setSelectedDay] = useState<number>(dayNum()); // Browsing day (stored numbering)
  const [labelMode] = useState<DayLabelMode>(() => getDayLabelMode()); // Follows the coach's label choice
  const [reqMeal, setReqMeal] = useState<Meal | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<number | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const meals = useMemo(() => allMeals.filter((m) => m.clientId === clientId), [allMeals, clientId]);
  const todayStr = todayISO();
  const todayPick = useMemo(
    () => (state.mealDayPicks ?? []).find((p) => p.clientId === clientId && p.date === todayStr),
    [state.mealDayPicks, clientId, todayStr],
  );
  const logsToday = useMemo(
    () => (state.mealLogs ?? []).some((l) => l.clientId === clientId && l.date === todayStr),
    [state.mealLogs, clientId, todayStr],
  );
  const myRequests = useMemo(
    () => (state.mealRequests ?? []).filter((r) => r.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt),
    [state.mealRequests, clientId],
  );
  const pendingFor = (mealId: string) => myRequests.filter((r) => r.mealId === mealId && r.status === "PENDING");

  // Follow the picked menu: whenever the pick changes, jump the view to it.
  const lastPickRef = useRef<number | null>(null);
  useEffect(() => {
    if (todayPick && lastPickRef.current !== todayPick.day) {
      lastPickRef.current = todayPick.day;
      setSelectedDay(todayPick.day);
    }
  }, [todayPick]);

  const doPick = (day: number, clearLogs: boolean) => {
    setMealDayPick({ date: todayStr, day, clearLogs, clientId });
    setPickOpen(false);
    setConfirmSwitch(null);
  };

  const chooseDay = (day: number) => {
    if (todayPick && todayPick.day === day) {
      setPickOpen(false);
      return;
    }
    // Switching menus wipes today's marks — warn first when marks exist.
    if (logsToday) setConfirmSwitch(day);
    else doPick(day, false);
  };

  // Filter meals for selected day
  const dayMeals = useMemo(() => meals.filter((m) => m.day === selectedDay), [meals, selectedDay]);

  // Sort meals by time then by type order
  const sortedMeals = useMemo(() => {
    const typeOrder: Record<MealType, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
    return [...dayMeals].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return typeOrder[a.type] - typeOrder[b.type];
    });
  }, [dayMeals]);

  // Export data — same poster renderer the coach uses ( Sat-first week ).
  const buildExportDay = (day: number) => {
    const typeOrder: Record<MealType, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
    const list = [...meals.filter((m) => m.day === day)].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return typeOrder[a.type] - typeOrder[b.type];
    });
    const totals = list.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fats: acc.fats + m.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
    return { day, dayName: WEEK_DAYS[day - 1], meals: list, totals };
  };

  const handleWeekPdf = async () => {
    const days = WEEK_ORDER_SAT_FIRST.map(buildExportDay);
    if (!days.some((d) => d.meals.length > 0)) {
      toast("No meals in your plan yet", "warn");
      return;
    }
    toast("Preparing PDF…");
    try {
      await exportWeekPdf({ clientName: client.name, planName, targets }, days);
    } catch {
      toast("Couldn't create the PDF", "warn");
    }
  };

  const handleDayImage = async () => {
    const d = buildExportDay(selectedDay);
    if (d.meals.length === 0) {
      toast("No meals planned for this day", "warn");
      return;
    }
    try {
      await exportDayImage(
        { clientName: client.name, planName, targets },
        {
          ...d,
          dayName:
            labelMode === "numbered" ? `${formatDayName(selectedDay, labelMode)} ${WEEK_DAYS[selectedDay - 1]}` : d.dayName,
        },
      );
    } catch {
      toast("Couldn't create the image", "warn");
    }
  };
  
  // Weekly overview data (displayed Sat-first)
  const weeklyOverview = useMemo(() => {
    const today = dayNum();
    const daysData = WEEK_ORDER_SAT_FIRST.map((day) => {
      const i = day - 1;
      const dayMeals = meals.filter((m) => m.day === day);
      return {
        day,
        name: WEEK_DAYS[i],
        short: WEEK_SHORT[i],
        mealCount: dayMeals.length,
        calories: dayMeals.reduce((s, m) => s + m.calories, 0),
        hasPlan: dayMeals.length > 0,
        isToday: day === today,
      };
    });
    return daysData;
  }, [meals]);
  
  // Nutrition targets
  const targets = client.nutritionTargets;
  // Logging (✓/✕) is only allowed on the picked menu — browsing other
  // days is just looking at the menu.
  const viewingPicked = !!todayPick && selectedDay === todayPick.day;
  
  // Group meals by type for display
  const mealsByType = useMemo(() => {
    const grouped: Record<string, Meal[]> = {};
    for (const meal of sortedMeals) {
      if (!grouped[meal.type]) grouped[meal.type] = [];
      grouped[meal.type].push(meal);
    }
    return grouped;
  }, [sortedMeals]);
  
  return (
    <div className="grid gap-3 sm:gap-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 sm:text-[11px]">Weekly nutrition plan{planName ? ` · ${planName}` : ""}</p>
          <h1 className="mt-1 font-display text-[30px] font-bold uppercase leading-[0.95] text-mist-100 sm:text-[44px]">
            {viewingPicked ? "TODAY" : formatDayName(selectedDay, labelMode)}{" "}
            <span className={viewingPicked ? "text-volt-400" : "text-mist-400"}>{WEEK_SHORT[selectedDay - 1]}</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-mist-400">
            {viewingPicked ? `Following ${formatDayName(selectedDay, labelMode)} menu` : `Browsing ${formatDayName(selectedDay, labelMode)} menu`} · {sortedMeals.length} meal{sortedMeals.length === 1 ? "" : "s"}
          </p>
          {viewingPicked && dayMeals.length > 0 && (
            <div className="mt-2.5">
              <DayAdherence clientId={clientId} date={todayISO()} total={dayMeals.length} />
            </div>
          )}
        </div>
      </div>

      {/* Following banner */}
      {todayPick && (
        <div className="flex items-center gap-3 rounded-2xl border border-volt-400/25 bg-volt-400/[0.07] p-3.5 sm:p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-volt-400 font-display text-base font-bold text-night-950">
            {formatDayShort(todayPick.day, labelMode)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-mist-100">Following {formatDayName(todayPick.day, labelMode)} menu today</span>
            <span className="mt-0.5 block text-xs font-semibold text-mist-400">Your ✓/✕ marks count on this menu only</span>
          </span>
          <button onClick={() => setPickOpen(true)} className={`${btnSecondary} h-10 shrink-0 !text-[13px]`}>
            Change
          </button>
        </div>
      )}

      {!todayPick ? (
        <SectionCard title="Which menu today?" description="Browse the full week, then pick the day you'll eat from" icon={<UtensilsCrossed className="h-4.5 w-4.5" />} bodyCls="p-3 sm:p-4">
          {meals.length === 0 ? (
            <EmptyState icon={<UtensilsCrossed className="h-6 w-6" />} title="No meals planned yet" sub="Your coach hasn't assigned any meals — check back soon." />
          ) : (
            <WeekMenuList meals={meals} labelMode={labelMode} current={null} onSelect={chooseDay} />
          )}
        </SectionCard>
      ) : (
      <>
      {/* Week Navigation — fixed 7-col grid, no scroll on mobile */}
      <div className="rounded-xl border border-night-700 bg-night-850 p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {weeklyOverview.map((d) => {
            const isSelected = selectedDay === d.day;
            const isCurrentDay = d.day === dayNum();
            return (
              <button
                key={d.day}
                onClick={() => setSelectedDay(d.day)}
                aria-pressed={isSelected}
                aria-label={`${labelMode === "numbered" ? `${formatDayName(d.day, labelMode)} (${d.name})` : d.name}${isCurrentDay ? ", today" : ""}${d.hasPlan ? `, ${d.mealCount} meals` : ", no plan"}`}
                className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center rounded-xl border px-0 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "border-volt-400 bg-volt-400/15 text-volt-300 shadow-[0_0_12px_-2px_rgba(205,241,75,0.3)]"
                    : d.hasPlan
                    ? "border-night-600 bg-night-800 text-mist-200 hover:border-night-500"
                    : "border-transparent bg-transparent text-mist-500 hover:border-night-600"
                }`}
              >
                <span className="text-[10px] leading-none sm:text-xs">{formatDayShort(d.day, labelMode)}</span>
                <span className={`mt-1 font-display text-[13px] leading-none tnum sm:text-sm ${d.hasPlan ? "" : "opacity-40"}`}>{d.mealCount}</span>
                <span className={`mt-1 h-1 w-1 rounded-full ${isSelected || isCurrentDay ? "bg-volt-400" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Summary — isolated so its count-up frames never re-render the meals list */}
      <DailySummary meals={dayMeals} dayName={formatDayName(selectedDay, labelMode)} targets={targets} />

      {/* Meals List — grouped by type like coach mode */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">Meals · {formatDayName(selectedDay, labelMode)}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {todayPick && todayPick.day !== selectedDay && dayMeals.length > 0 && (
              <button onClick={() => chooseDay(selectedDay)} className={`${btnVolt} h-9 shrink-0 !px-3.5 !text-[13px]`}>
                Select for today
              </button>
            )}
            <Dropdown
              open={exportOpen}
              onOpenChange={setExportOpen}
              align="end"
              label="Export plan"
              trigger={
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  title="Export your plan as PDF / image"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 text-xs font-bold text-mist-300 transition hover:border-warn-400 hover:text-warn-300"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export
                </button>
              }
              items={[
                { type: "item", label: "Week PDF (plan images)", hint: "7 pages", icon: FileText, onClick: () => void handleWeekPdf() },
                { type: "item", label: "Day JPG image", hint: WEEK_SHORT[selectedDay - 1], icon: ImageIcon, onClick: () => void handleDayImage() },
              ]}
            />
          </div>
        </div>

        {sortedMeals.length === 0 ? (
          <SectionCard title="No meals planned" icon={<UtensilsCrossed className="h-5 w-5" />} bodyCls="p-6">
            <div className="text-center py-8">
              <UtensilsCrossed className="mx-auto h-12 w-12 text-night-500" />
              <p className="mt-3 text-sm font-semibold text-mist-400">No nutrition plan for this day</p>
              <p className="mt-1 text-xs text-mist-500">Your coach hasn't assigned meals for {formatDayName(selectedDay, labelMode)} yet</p>
              {weeklyOverview.some((d) => d.hasPlan) && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  {weeklyOverview
                    .filter((d) => d.hasPlan)
                    .map((d) => (
                      <button
                        key={d.day}
                        onClick={() => setSelectedDay(d.day)}
                        className="cursor-pointer rounded-full border border-volt-400/40 bg-volt-400/10 px-3.5 py-1.5 text-xs font-bold text-volt-300 transition hover:bg-volt-400/20"
                      >
                        View {labelMode === "numbered" ? `${formatDayName(d.day, labelMode)} (${d.short})` : d.name} · {d.mealCount} meal{d.mealCount === 1 ? "" : "s"}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </SectionCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {MEAL_TYPES.map((t) => {
              const list = (mealsByType[t] ?? []) as Meal[];
              if (list.length === 0) return null;
              const totals = list.reduce(
                (acc, m) => ({
                  calories: acc.calories + m.calories,
                  protein: acc.protein + m.protein,
                  carbs: acc.carbs + m.carbs,
                  fats: acc.fats + m.fats,
                }),
                { calories: 0, protein: 0, carbs: 0, fats: 0 }
              );
              return (
                <SectionCard
                  key={t}
                  title={`${t} · ${list.length}`}
                  icon={<UtensilsCrossed className="h-5 w-5" />}
                  bodyCls="p-2.5 sm:p-3"
                  action={
                    <span className="text-[11px] font-bold text-mist-500">
                      {totals.calories.toLocaleString("en-US")} kcal
                    </span>
                  }
                >
                  <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[11px] font-bold text-mist-400">
                    <span className="font-display text-sm text-warn-300">{totals.calories.toLocaleString("en-US")} kcal</span>
                    <span className="text-volt-300">P {totals.protein}g</span>
                    <span className="text-sky-300">C {totals.carbs}g</span>
                    <span className="text-warn-300">F {totals.fats}g</span>
                  </p>
                  <ul className="grid gap-2">
                    {list.map((meal) => (
                      <li key={meal.id} className="rounded-lg border border-night-700 bg-night-800 p-3">
                        <div className="flex items-start gap-2">
                          <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-mist-100">{meal.description}</p>
                          {pendingFor(meal.id).length > 0 && (
                            <Badge className={`shrink-0 ${MEAL_REQ_META.PENDING.chip}`}>Pending{pendingFor(meal.id).length > 1 ? ` × ${pendingFor(meal.id).length}` : ""}</Badge>
                          )}
                          {viewingPicked && <MealLogButtons meal={meal} date={todayISO()} clientId={clientId} />}
                          <button
                            onClick={() => setReqMeal(meal)}
                            title="Request a change"
                            aria-label={`Request a change to ${meal.description}`}
                            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-night-700 hover:text-volt-300"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {meal.time && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-mist-500">
                            <span className="font-display text-xs tnum">{fmtTime(meal.time)}</span>
                          </span>
                        )}
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold">
                          <span className="font-display text-base text-warn-300">{meal.calories} kcal</span>
                          <span className="text-volt-300">P {meal.protein}g</span>
                          <span className="text-sky-300">C {meal.carbs}g</span>
                          <span className="text-warn-300">F {meal.fats}g</span>
                        </p>
                        {meal.notes && (
                          <p className="mt-1 text-[11px] italic text-mist-500">{meal.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>
      
      {/* My edit requests */}
      {myRequests.length > 0 && (
        <SectionCard title={`My edit requests · ${myRequests.filter((r) => r.status === "PENDING").length} pending`} icon={<Pencil className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3">
          <ul className="grid gap-2">
            {myRequests.slice(0, 10).map((r) => (
              <li key={r.id} className="rounded-xl border border-night-700 bg-night-800 p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-mist-500 tnum">{formatDayName(r.day, labelMode)} · {r.mealType}</span>
                  <Badge className={`ms-auto ${MEAL_REQ_META[r.status].chip}`}>{MEAL_REQ_META[r.status].label}</Badge>
                </div>
                <p className="mt-1 truncate text-[13px] font-bold text-mist-100">“{r.mealDescription}”</p>
                <p className="mt-1 text-xs leading-5 text-mist-300">{r.message}</p>
                {r.suggestion && <p className="mt-1 text-xs leading-5 text-volt-200/90">Suggestion: {r.suggestion}</p>}
                {r.coachNote && <p className="mt-1.5 rounded-lg bg-night-850 px-2.5 py-1.5 text-[11px] italic leading-5 text-mist-400">Coach: {r.coachNote}</p>}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-mist-600">{relTime(r.createdAt)}</span>
                  {r.status === "PENDING" && (
                    <button onClick={() => cancelMealRequest(r.id)} className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-bold text-mist-500 transition hover:bg-danger-500/10 hover:text-danger-300">
                      Cancel request
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Weekly Overview */}
      <SectionCard title="Week Overview" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weeklyOverview.map((d) => (
              <button
              key={d.day}
              onClick={() => setSelectedDay(d.day)}
              className={`min-w-0 rounded-xl border p-1.5 text-center transition active:scale-95 sm:p-2 ${
                d.hasPlan
                  ? "border-night-600 bg-night-800"
                  : "border-night-700 bg-night-900"
              } ${selectedDay === d.day ? "ring-1 ring-volt-400" : ""}`}
            >
              <p className="truncate text-[10px] font-bold text-mist-500">{formatDayShort(d.day, labelMode)}</p>
              <p className={`mt-0.5 font-display text-[13px] font-bold tnum sm:text-sm ${d.hasPlan ? "text-mist-200" : "text-mist-600"}`}>
                {d.mealCount}
              </p>
              {d.isToday && (
                <span className="mx-auto mt-1 block h-1 w-1 rounded-full bg-volt-400" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-mist-500">
            {weeklyOverview.filter((d) => d.hasPlan).length} / 7 days planned
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-mist-500">
              <span className="h-2 w-2 rounded-full bg-volt-400" /> Has plan
            </span>
            <span className="flex items-center gap-1 text-mist-500">
              <span className="h-2 w-2 rounded-full bg-night-700" /> No plan
            </span>
          </div>
        </div>
      </SectionCard>
      </>
      )}

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Switch menu" description="Browse the full week, then pick the day you'll eat from.">
        <div className="max-h-[62vh] overflow-y-auto pe-0.5">
          <WeekMenuList meals={meals} labelMode={labelMode} current={todayPick?.day ?? null} onSelect={chooseDay} />
        </div>
      </Modal>

      <ConfirmModal
        open={confirmSwitch !== null}
        onClose={() => setConfirmSwitch(null)}
        title="Switch menu?"
        message="Switching days clears today's marks (✓/✕) and you start fresh on the new menu."
        confirmLabel="Switch & clear"
        onConfirm={() => confirmSwitch !== null && doPick(confirmSwitch, true)}
      />

      <MealRequestModal meal={reqMeal} dayLabel={reqMeal ? formatDayName(reqMeal.day, labelMode) : ""} clientId={clientId} onClose={() => setReqMeal(null)} />
    </div>
  );
}

function MealRequestModal({ meal, dayLabel, clientId, onClose }: {
  meal: Meal | null;
  dayLabel: string;
  clientId: string;
  onClose: () => void;
}) {
  const { requestMealEdit } = useApp();
  const [message, setMessage] = useState("");
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    setMessage("");
    setSuggestion("");
  }, [meal?.id]);

  const submit = () => {
    if (!meal) return;
    const req = requestMealEdit({ meal, message, suggestion, clientId });
    if (req) onClose();
  };

  return (
    <Modal open={!!meal} onClose={onClose} title="Request a change" description={meal ? `${dayLabel} · ${meal.type}` : undefined}>
      {meal && (
        <div className="rounded-xl border border-night-600 bg-night-800 px-3.5 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">Current meal</p>
          <p className="mt-0.5 text-sm font-bold text-mist-100">“{meal.description}”</p>
          <p className="mt-0.5 text-[11px] font-bold text-mist-500 tnum">{meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g</p>
        </div>
      )}
      <label className={`${labelCls} mt-3 block`}>What's the issue? *</label>
      <textarea
        className={`${textareaCls} mt-1.5 min-h-20`}
        placeholder="e.g. I don't like oats — they upset my stomach…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
      />
      <label className={`${labelCls} mt-3 block`}>Your suggested alternative (optional)</label>
      <textarea
        className={`${textareaCls} mt-1.5 min-h-16`}
        placeholder="e.g. Replace with 80g whole-wheat bread + cheese…"
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value)}
        rows={2}
      />
      <div className="mt-4 flex gap-2">
        <button onClick={submit} disabled={!message.trim()} className={`${btnVolt} h-11 flex-1 disabled:opacity-40`}>
          <Send className="h-4 w-4" /> Request for edit
        </button>
        <button onClick={onClose} className={`${btnSecondary} h-11`}>Cancel</button>
      </div>
    </Modal>
  );
}

/* ---------------- today ---------------- */

function TodayTab({
  clientId,
  todayPickDay,
  plans,
  meals,
  exercises,
  onCheckIn,
  onOpenTraining,
  onOpenNutrition,
  sessionsToday,
}: {
  clientId: string;
  todayPickDay: number | null;
  plans: { id: string; day: number; exerciseId: string; sets: number; reps: number; rest: number; notes: string }[];
  meals: Meal[];
  exercises: { id: string; name: string; category: "Chest" | "Back" | "Legs" | "Arms" | "Core" | "Cardio"; videoUrl: string }[];
  onCheckIn: () => void;
  onOpenTraining: () => void;
  onOpenNutrition: () => void;
  sessionsToday: { id: string; time: string; type: string; status: string }[];
}) {
  const dn = dayNum();
  const todayPlan = plans.filter((p) => p.day === dn);
  const { state: appState, toast: appToast } = useApp();
  const [workoutExportOpen, setWorkoutExportOpen] = useState(false);
  const clientName = appState.clients.find((c) => c.id === clientId)?.name ?? "My workout";
  // Flexible menus: today shows the picked plan-day, not the calendar day.
  const todayMeals = meals.filter((m) => m.day === (todayPickDay ?? dn));
  const plannedDayNames = useMemo(
    () =>
      WEEK_ORDER_SAT_FIRST.filter((d) => d !== dn && meals.some((m) => m.day === d)).map(
        (d) => WEEK_DAYS[d - 1]
      ),
    [meals, dn]
  );
  const kcal = todayMeals.reduce((s, m) => s + m.calories, 0);
  const exOf = (id: string) => exercises.find((e) => e.id === id);

  /* Workout plan export — same poster system the nutrition tab uses. */
  const buildWorkoutExportDay = (day: number) => {
    const list = plans
      .filter((p) => p.day === day)
      .map((p) => {
        const ex = exOf(p.exerciseId);
        return {
          name: ex?.name ?? "Exercise",
          category: ex?.category,
          sets: p.sets,
          reps: p.reps,
          rest: p.rest,
          notes: p.notes || undefined,
          hasVideo: !!ex?.videoUrl,
        };
      });
    return {
      day,
      dayName: `Day ${day} · ${WEEK_DAYS[day - 1]}`,
      items: list,
      totals: {
        exercises: list.length,
        sets: list.reduce((s, x) => s + x.sets, 0),
        reps: list.reduce((s, x) => s + x.sets * x.reps, 0),
      },
    };
  };

  const handleWorkoutWeekPdf = async () => {
    const days = WEEK_ORDER_SAT_FIRST.map(buildWorkoutExportDay);
    if (!days.some((d) => d.items.length > 0)) {
      appToast("No workout planned yet", "warn");
      return;
    }
    appToast("Preparing PDF…");
    try {
      await exportWorkoutWeekPdf({ clientName, planName: "Weekly split" }, days);
    } catch {
      appToast("Couldn't create the PDF", "warn");
    }
  };

  const handleWorkoutDayImage = async () => {
    const d = buildWorkoutExportDay(dn);
    if (d.items.length === 0) {
      appToast("No workout programmed for today", "warn");
      return;
    }
    try {
      await exportWorkoutDayImage({ clientName, planName: "Weekly split" }, d);
    } catch {
      appToast("Couldn't create the image", "warn");
    }
  };

  return (
    <div className="grid gap-3 sm:gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 sm:text-[11px]">Your program</p>
            <span className="rounded-full bg-volt-400/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-volt-300">{WEEK_DAYS[dn - 1]}</span>
          </div>
          <h1 className="mt-1.5 font-display text-[30px] font-bold uppercase leading-[0.95] text-mist-100 sm:text-[44px]">
            Day {dn}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <Dumbbell className="h-3.5 w-3.5 text-volt-300" />
              {todayPlan.length > 0 ? `${todayPlan.length} exercise${todayPlan.length > 1 ? "s" : ""}` : "Recovery day"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <Flame className="h-3.5 w-3.5 text-warn-300" />
              {kcal > 0 ? `${kcal.toLocaleString("en-US")} kcal` : "No meals yet"}
            </span>
            {todayPickDay && todayMeals.length > 0 && <DayAdherence clientId={clientId} date={todayISO()} total={todayMeals.length} />}
            {sessionsToday.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
                <ClipboardList className="h-3.5 w-3.5 text-sky-300" />
                {sessionsToday.length} session{sessionsToday.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button className={`${btnPrimary} mt-4 h-12 w-full text-[15px] active:scale-[0.98] sm:w-auto`} onClick={onCheckIn}>
            <Camera className="h-5 w-5" /> Submit daily check-in
          </button>
        </div>
      </div>

      <button
        onClick={onOpenTraining}
        className="group flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-volt-400/25 bg-gradient-to-r from-volt-400/[0.12] to-transparent p-4 text-start transition active:scale-[0.99] hover:border-volt-400/45 sm:p-5"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-volt-400 text-night-950 shadow-[0_8px_24px_-8px_rgba(205,241,75,0.6)]">
          <Dumbbell className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-extrabold text-mist-100">Log today's weights</span>
          <span className="mt-0.5 block truncate text-xs font-semibold text-mist-400">Strength tracker · last weights + PR celebration</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-volt-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
      </button>

      {sessionsToday.length > 0 && (
        <SectionCard title="Today's sessions" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3">
          <ul className="grid gap-2">
            {sessionsToday.map((s) => (
              <li key={s.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
                <span className="shrink-0 font-display text-lg font-bold text-mist-100 tnum">{fmtTime(s.time)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-300">{s.type}</span>
                <Badge className="shrink-0 border-night-600 bg-night-700 text-mist-300">{s.status}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        title="Today's workout"
        icon={<Dumbbell className="h-4.5 w-4.5" />}
        bodyCls="p-2.5 sm:p-3"
        action={
          todayPlan.length > 0 ? (
            <Dropdown
              open={workoutExportOpen}
              onOpenChange={setWorkoutExportOpen}
              align="end"
              label="Export workout plan"
              trigger={
                <button
                  onClick={() => setWorkoutExportOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={workoutExportOpen}
                  title="Export your workout as PDF / image"
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 text-xs font-bold text-mist-300 transition hover:border-warn-400 hover:text-warn-300"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export
                </button>
              }
              items={[
                { type: "item", label: "Week PDF (plan images)", hint: "7 pages", icon: FileText, onClick: () => void handleWorkoutWeekPdf() },
                { type: "item", label: "Day JPG image", hint: WEEK_SHORT[dn - 1], icon: ImageIcon, onClick: () => void handleWorkoutDayImage() },
              ]}
            />
          ) : undefined
        }
      >
        {todayPlan.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="Rest day" sub="No session programmed today. Sleep well, eat well, come back stronger tomorrow." />
        ) : (
          <ul className="grid gap-2">
            {todayPlan.map((item, i) => {
              const ex = exOf(item.exerciseId);
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3 transition active:scale-[0.99] hover:border-night-500">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-night-700 font-display text-lg font-bold text-volt-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[15px] font-bold text-mist-100">{ex?.name ?? "Exercise"}</p>
                      {ex && (
                        <Badge className={CAT_META[ex.category].chip}>
                          <span className={`h-1.5 w-1.5 rounded-full ${CAT_META[ex.category].dot}`} />
                          {ex.category}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-mist-400">
                      <span className="font-display text-base text-mist-200 tnum">
                        {item.sets} × {item.reps} <span className="text-mist-500">reps</span>
                      </span>
                      <span>{item.rest > 0 ? `${item.rest}s rest` : "no rest"}</span>
                    </p>
                    {item.notes && <p className="mt-1 line-clamp-2 text-[11px] italic text-mist-500">Coach: "{item.notes}"</p>}
                  </div>
                  {ex?.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noreferrer" aria-label={`Watch ${ex.name} video`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-night-700 text-volt-300 transition hover:bg-night-600 active:scale-95">
                      <Play className="h-4 w-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Today's meals"
        icon={<UtensilsCrossed className="h-4.5 w-4.5" />}
        bodyCls="p-2.5 sm:p-3"
        action={todayPickDay ? (
          <button onClick={onOpenNutrition} className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-volt-300 transition hover:text-volt-200">
            {WEEK_DAYS[todayPickDay - 1]} menu · Change
          </button>
        ) : undefined}
      >
        {!todayPickDay ? (
          <button onClick={onOpenNutrition} className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed border-night-500 p-4 text-start transition hover:border-volt-400/50">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-night-700 text-volt-300">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-mist-100">Choose today's menu</span>
              <span className="mt-0.5 block text-xs font-semibold text-mist-500">Pick which day you'll eat from</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-volt-300 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" />
          </button>
        ) : todayMeals.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed className="h-6 w-6" />} title="No meal plan yet" sub="Your coach hasn't assigned meals — check back soon.">
            {plannedDayNames.length > 0 && (
              <p className="text-xs font-semibold text-mist-500">
                You do have plans on {plannedDayNames.join(", ")} — open the Nutrition tab to see them.
              </p>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {MEAL_TYPES.map((t) => {
                const list = todayMeals.filter((m) => m.type === t);
                if (list.length === 0) return null;
                const totals = list.reduce((s, m) => s + m.calories, 0);
                return (
                  <div key={t} className="rounded-xl border border-night-700 bg-night-800 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge className={MEAL_META[t].chip}>{t} · {list.length}</Badge>
                      <span className="font-display text-sm font-bold text-warn-300 tnum">{totals.toLocaleString("en-US")} kcal</span>
                    </div>
                    <div className="grid gap-2">
                      {list.map((m) => (
                        <div key={m.id} className="rounded-xl border border-night-700 bg-night-850 p-2.5">
                          <div className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-mist-100">{m.description}</p>
                            <MealLogButtons meal={m} date={todayISO()} clientId={clientId} />
                          </div>
                          <p className="mt-1.5 flex gap-3 text-[11px] font-bold tnum">
                            <span className="text-warn-300">{m.calories} kcal</span>
                            <span className="text-volt-300">P {m.protein}g</span>
                            <span className="text-sky-300">C {m.carbs}g</span>
                            <span className="text-warn-300">F {m.fats}g</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-center text-xs font-bold text-mist-500">
              Daily total: <span className="font-display text-base text-warn-300 tnum">{kcal.toLocaleString("en-US")} kcal</span>
            </p>
          </>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------------- check-in ---------------- */

function CheckInTab({ clientId, onDone, alreadyToday }: { clientId: string; onDone: () => void; alreadyToday: boolean }) {
  const { state, addCheckIn } = useApp();
  const last = useMemo(
    () => [...state.checkIns].filter((c) => c.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts)[0],
    [state.checkIns, clientId],
  );

  const [weight, setWeight] = useState(last ? String(last.weight) : "");
  const [waist, setWaist] = useState(last?.waist !== undefined ? String(last.waist) : "");
  const [mood, setMood] = useState(last?.mood ?? 3);
  const [water, setWater] = useState("2");
  const [done, setDone] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    const w = Number(weight);
    if (!weight || Number.isNaN(w) || w <= 0) {
      setError("Enter your weight — it's the core of the check-in.");
      return;
    }
    addCheckIn({
      clientId,
      date: todayISO(),
      weight: round1(w),
      waist: waist && !Number.isNaN(Number(waist)) ? round1(Number(waist)) : undefined,
      mood,
      water: Math.max(0, Number(water) || 0),
      workoutDone: done,
      notes: notes.trim() || undefined,
    });
    onDone();
  };

  return (
    <div className="grid gap-3 sm:gap-4">
      <div className="rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 tnum">{todayISO()}</p>
        <h1 className="mt-1 font-display text-[30px] font-bold uppercase leading-[0.95] text-mist-100 sm:text-[44px]">
          Daily <span className="text-volt-400">check-in</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-mist-400">Sixty honest seconds. Your coach sees this instantly.</p>
        {alreadyToday && (
          <p className="mt-3 rounded-xl border border-warn-400/25 bg-warn-400/10 px-3 py-2 text-xs font-semibold text-warn-300">
            You already checked in today — logging again is fine, the latest numbers count.
          </p>
        )}
      </div>

      <SectionCard title="Numbers" icon={<Scale className="h-4.5 w-4.5" />} bodyCls="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Weight (kg) *</label>
            <input className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3.5 text-base font-semibold text-mist-100 outline-none transition focus:border-volt-400 sm:h-11 sm:text-sm tnum" type="number" step="0.1" min="0" placeholder={last ? `last: ${last.weight}` : "e.g. 74.5"} value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Waist (cm)</label>
            <input className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3.5 text-base font-semibold text-mist-100 outline-none transition focus:border-volt-400 sm:h-11 sm:text-sm tnum" type="number" step="0.1" min="0" placeholder={last?.waist !== undefined ? `last: ${last.waist}` : "optional"} value={waist} onChange={(e) => setWaist(e.target.value)} inputMode="decimal" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Mood</label>
            <MoodPicker value={mood} onChange={setMood} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Water intake (liters)</label>
            <input className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3.5 text-base font-semibold text-mist-100 outline-none transition focus:border-volt-400 sm:h-11 sm:text-sm tnum" type="number" step="0.1" min="0" value={water} onChange={(e) => setWater(e.target.value)} inputMode="decimal" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[1.5, 2, 2.5, 3].map((v) => (
                <button key={v} type="button" onClick={() => setWater(String(v))} aria-pressed={water === String(v)} className={`min-h-[40px] min-w-[52px] cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${water === String(v) ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"}`}>
                  {v}L
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <Toggle checked={done} onChange={setDone} label="Workout completed" />
            <p className="text-[11px] text-mist-500">Be honest — skipped days are part of the process.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Notes for your coach" icon={<MessageCircle className="h-4.5 w-4.5" />} bodyCls="p-4 sm:p-5">
        <div>
          <textarea className="min-h-20 w-full resize-y rounded-xl border border-night-600 bg-night-800 px-3.5 py-3 text-[15px] text-mist-100 outline-none transition focus:border-volt-400 sm:text-sm" placeholder="Energy, sleep, soreness, PRs…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        {error && <p className="mt-3 text-xs font-bold text-danger-400">{error}</p>}
        <div className="sticky bottom-[92px] z-10 mt-4 lg:static">
          <button className={`${btnPrimary} h-12 w-full text-base shadow-[0_10px_28px_-10px_rgba(205,241,75,0.65)]`} onClick={submit}>
            <Check className="h-5 w-5" strokeWidth={2.4} /> Submit check-in
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

/* ---------------- progress ---------------- */

function ProgressTab({ checkIns, sessionsCount }: { checkIns: Parameters<typeof progressOf>[0]; sessionsCount: ReturnType<typeof attendance> }) {
  const prog = progressOf(checkIns);
  const sorted = useMemo(() => [...checkIns].sort((a, b) => a.date.localeCompare(a.date) || a.ts - b.ts), [checkIns]);

  const streak = useMemo(() => {
    const dates = new Set(checkIns.map((c) => c.date));
    let s = 0;
    let cursor = todayISO();
    if (!dates.has(cursor)) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      cursor = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
    }
    while (dates.has(cursor)) {
      s += 1;
      const d = new Date(cursor + "T12:00:00");
      d.setDate(d.getDate() - 1);
      cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    return s;
  }, [checkIns]);

  return (
    <div className="grid gap-3 sm:gap-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <MiniKpi icon={<Scale className="h-3.5 w-3.5" />} label="Weight" value={prog.currentWeight !== null ? `${prog.currentWeight}` : "—"} unit="kg" />
        <MiniKpi icon={<Droplets className="h-3.5 w-3.5" />} label="Change" value={prog.weightChange !== null ? signed(prog.weightChange) : "—"} unit="kg" tone={prog.weightChange !== null && prog.weightChange <= 0 ? "text-moss-300" : "text-warn-300"} />
        <MiniKpi icon={<Flame className="h-3.5 w-3.5" />} label="Streak" value={String(streak)} unit={streak === 1 ? "day" : "days"} tone="text-volt-300" />
      </div>

      <SectionCard title="Weight trend" icon={<Scale className="h-4.5 w-4.5" />} bodyCls="p-3 sm:p-4">
        <WeightLine entries={sorted} />
      </SectionCard>

      <SectionCard title="Attendance" icon={<Check className="h-4.5 w-4.5" />} bodyCls="p-4 sm:p-5">
        <p className="text-sm text-mist-300">
          You've completed <span className="font-display text-xl font-bold text-volt-300 tnum">{sessionsCount.completed}</span> of{" "}
          <span className="font-bold tnum">{sessionsCount.countable}</span> sessions ({sessionsCount.pct}%).
        </p>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-night-700">
          <div className="grow-x h-full rounded-full bg-volt-400" style={{ width: `${sessionsCount.pct}%` }} />
        </div>
      </SectionCard>

      {sorted.length > 0 && (
        <SectionCard title="Recent check-ins" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3">
          <ul className="grid gap-2">
            {[...sorted].reverse().slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-night-700 font-display text-sm font-bold text-volt-300 tnum">{c.weight}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-mist-200 tnum">{fmtDate(c.date)}</p>
                  <p className="truncate text-[11px] text-mist-500">
                    {c.workoutDone ? "Workout done" : "Rest"} · Mood {c.mood}/5{c.waist !== undefined ? ` · ${c.waist} cm` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function MiniKpi({ icon, label, value, unit, tone }: { icon: ReactNode; label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-night-700 bg-night-850 p-2.5 sm:p-4">
      <p className="flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-mist-500">
        <span className="shrink-0 text-volt-400">{icon}</span> <span className="truncate">{label}</span>
      </p>
      <p className={`mt-0.5 truncate font-display text-[22px] font-bold leading-7 tnum sm:text-[30px] sm:leading-8 ${tone ?? "text-mist-100"}`}>
        {value}
        <span className="ms-1 text-[11px] font-semibold text-mist-500 sm:text-sm"> {unit}</span>
      </p>
    </div>
  );
}

/* ---------------- chat ---------------- */

function ChatTab({ clientId }: { clientId: string }) {
  const { state, sendMessage, markNotificationRead } = useApp();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const thread = useMemo(
    () => state.messages.filter((m) => m.clientId === clientId).sort((a, b) => a.createdAt - b.createdAt),
    [state.messages, clientId],
  );

  // Mark unread message-notifications as read while the thread is open.
  useEffect(() => {
    state.notifications
      .filter((n) => n.clientId === clientId && n.kind === "message" && !n.read)
      .forEach((n) => markNotificationRead(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, thread.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread.length]);

  const submit = () => {
    if (!draft.trim()) return;
    sendMessage(clientId, draft);
    setDraft("");
  };

  return (
    <div className="flex h-[calc(100dvh-215px)] min-h-[380px] flex-col overflow-hidden rounded-2xl border border-night-700 bg-night-850 sm:h-[calc(100vh-230px)] sm:min-h-96">
      <header className="flex items-center gap-2.5 border-b border-night-700 px-4 py-3 sm:px-5 sm:py-3.5">
        <MessageCircle className="h-4.5 w-4.5 shrink-0 text-volt-400" />
        <h2 className="truncate font-display text-base font-semibold uppercase tracking-wide text-mist-100 sm:text-lg">Chat with your coach</h2>
        <span className="ms-auto shrink-0 text-[11px] font-semibold text-mist-500 tnum">{thread.length}</span>
      </header>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4">
        {thread.length === 0 && (
          <p className="grid h-full place-items-center px-6 text-center text-[13px] leading-6 text-mist-500">
            No messages yet.<br />Ask your coach anything — it goes straight to their dashboard.
          </p>
        )}
        {thread.map((m) => {
          const mine = m.senderRole === "client";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 sm:max-w-[85%] ${mine ? "rounded-ee-md bg-volt-400 text-night-950" : "rounded-es-md border border-night-600 bg-night-800 text-mist-100"}`}>
                {!mine && <p className="text-[10px] font-bold uppercase tracking-wider text-volt-300">Coach</p>}
                <p className="text-[15px] font-medium leading-6 sm:text-sm sm:font-semibold sm:leading-5">{m.text}</p>
                <p className={`mt-0.5 text-[10px] font-bold ${mine ? "text-night-950/60" : "text-mist-500"}`}>{relTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t border-night-700 bg-night-850 p-2.5 sm:p-3">
        <input
          className="h-12 min-w-0 flex-1 rounded-xl border border-night-600 bg-night-800 px-4 text-[15px] text-mist-100 outline-none transition focus:border-volt-400 sm:h-11 sm:text-sm"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={!draft.trim()} className={`${btnPrimary} h-12 w-12 shrink-0 !px-0`} aria-label="Send">
          <Send className="h-[18px] w-[18px] rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- subscription (read-only) ---------------- */

function SubscriptionTab({ clientId, onLogout }: { clientId: string; onLogout: () => void }) {
  const { state } = useApp();
  const subs = useMemo(() => state.subscriptions.filter((s) => s.clientId === clientId), [state.subscriptions, clientId]);
  const payments = useMemo(
    () => state.payments.filter((p) => p.clientId === clientId && p.status === "Paid").sort((a, b) => b.date.localeCompare(a.date)),
    [state.payments, clientId],
  );
  const info = subscriptionState(currentSubscription(subs));
  const sub = info.sub;
  const meta = SUB_STATE_META[info.state];

  const pctElapsed = useMemo(() => {
    if (!sub) return 0;
    const start = new Date(sub.startDate + "T12:00:00").getTime();
    const end = new Date(sub.endDate + "T12:00:00").getTime();
    const now = Date.now();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  }, [sub]);

  return (
    <div className="grid gap-3 sm:gap-4">
      <SectionCard title="My subscription" icon={<CreditCard className="h-4.5 w-4.5" />} bodyCls="p-4 sm:p-5">
        {!sub ? (
          <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No active subscription" sub="Your coach hasn't assigned a plan yet. Reach out in the chat." />
        ) : (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-mist-500">Current plan</p>
                <p className="mt-1 font-display text-3xl font-bold uppercase leading-none text-mist-100">{sub.planName}</p>
              </div>
              <Badge className={meta.chip}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${info.state === "Expiring Soon" ? "tick-pulse" : ""}`} />
                {info.state}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ReadOnly k="Price" v={`${fmtMoney(sub.price)} EGP`} />
              <ReadOnly k="Starts" v={fmtDate(sub.startDate)} />
              <ReadOnly k="Ends" v={fmtDate(sub.endDate)} />
              <div className="rounded-xl border border-night-700 bg-night-800 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">Payment</p>
                <Badge className={`${SUB_PAYMENT_META[sub.paymentStatus].chip} mt-1.5`}>{sub.paymentStatus}</Badge>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <p className={`font-display text-2xl font-bold ${info.state === "Expired" ? "text-danger-300" : info.state === "Expiring Soon" ? "text-warn-300" : "text-moss-300"}`}>
                  {remainingLabel(info.daysLeft)}
                </p>
                <p className="text-[11px] font-semibold text-mist-500 tnum">{Math.round(pctElapsed)}% of period elapsed</p>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-night-700">
                <div className={`grow-x h-full rounded-full ${meta.bar}`} style={{ width: `${pctElapsed}%` }} />
              </div>
            </div>

            <p className="rounded-xl border border-night-700 bg-night-800/60 px-3.5 py-2.5 text-[11px] leading-5 text-mist-400">
              To renew or change your plan, message your coach — renewals are handled on their side.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Payment history" icon={<CreditCard className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3">
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-night-600 px-4 py-6 text-center text-xs text-mist-500">No payments recorded yet.</p>
        ) : (
          <ul className="grid gap-2">
            {payments.map((p) => (
              <li key={p.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-3 py-2.5 sm:gap-3 sm:px-3.5">
                <span className="shrink-0 text-xs font-bold text-mist-300 tnum">{fmtDate(p.date)}</span>
                <span className="min-w-0 flex-1 truncate font-display text-lg font-bold text-mist-100 tnum">
                  {fmtMoney(p.amount)} <span className="text-xs font-semibold text-mist-500">EGP</span>
                </span>
                <span className="hidden shrink-0 text-xs font-semibold text-mist-400 sm:inline">{p.method}</span>
                <Badge className="shrink-0 border-moss-400/25 bg-moss-400/10 text-moss-300">Paid</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* sign out lives here on mobile (header logout is desktop-only) */}
      <button
        onClick={onLogout}
        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.07] text-sm font-bold text-danger-300 transition active:scale-[0.99] hover:bg-danger-500/[0.12] lg:hidden"
      >
        <LogOut className="h-[18px] w-[18px]" /> Sign out
      </button>
    </div>
  );
}

function ReadOnly({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-800 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">{k}</p>
      <p className="mt-1 font-display text-lg font-bold text-mist-100 tnum">{v}</p>
    </div>
  );
}
