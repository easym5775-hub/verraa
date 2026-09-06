/* ================================================================
   VERRAA — client mode: Today, Daily check-in, My progress, Chat,
   Subscription + the notification bell.
   ================================================================ */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Bell,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Droplets,
  Flame,
  Image as ImageIcon,
  LogOut,
  MessageCircle,
  Play,
  Scale,
  Send,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { AppNotification, Client, Meal, MealType, NutritionTargets } from "../types";
import { CAT_META, GOAL_META, MEAL_META, MEAL_TYPES, NOTIFICATION_META, SUB_PAYMENT_META, SUB_STATE_META, WEEK_DAYS, WEEK_SHORT } from "../types";
import { dayNum, fileToDataUrl, fmtDate, fmtMoney, fmtTime, relTime, round1, signed, todayISO } from "../lib";
import { attendance, currentSubscription, progressOf, remainingLabel, subscriptionState } from "../logic";
import { useApp } from "../store";
import { Avatar, Badge, EmptyState, MoodPicker, SectionCard, Toggle, btnPrimary, btnSecondary, btnSm, chip, useCountUp } from "./ui";
import { WeightLine } from "./Chart";

type Tab = "today" | "nutrition" | "checkin" | "progress" | "chat" | "subscription";

export function ClientApp({ onLogout }: { onLogout: () => void }) {
  const { state, me, markAllNotificationsRead } = useApp();
  const [tab, setTab] = useState<Tab>("today");
  const [bellOpen, setBellOpen] = useState(false);

  const clientId = me?.userId ?? "";
  const client = state.clients.find((c) => c.id === clientId);
  const plans = useMemo(() => state.plans.filter((p) => p.clientId === clientId), [state.plans, clientId]);
  const meals = useMemo(() => state.meals.filter((m) => m.clientId === clientId), [state.meals, clientId]);
  const checkIns = useMemo(() => state.checkIns.filter((c) => c.clientId === clientId), [state.checkIns, clientId]);
  const sessions = useMemo(() => state.sessions.filter((s) => s.clientId === clientId), [state.sessions, clientId]);
  const notifications = useMemo(
    () => state.notifications.filter((n) => n.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt),
    [state.notifications, clientId],
  );
  const unread = notifications.filter((n) => !n.read).length;

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "nutrition", label: "Nutrition" },
    { id: "checkin", label: "Check-in" },
    { id: "progress", label: "Progress" },
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

  return (
    <div className="noise relative min-h-screen">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-40" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-night-950/80 backdrop-blur-xl">
        <span aria-hidden="true" className="absolute inset-x-8 bottom-[-1px] h-px bg-gradient-to-r from-transparent via-volt-400/30 to-transparent" />
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <Avatar name={client.name} photo={client.photo} className="h-11 w-11 text-xs" status="online" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-mist-100">{client.name}</p>
            <span className={`${chip} mt-1 !border-white/[0.08] ${GOAL_META[client.goal].chip}`}>{client.goal}</span>
          </div>
          <nav aria-label="Client sections" className="ms-auto hidden items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.02] p-1 md:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
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
          {/* bell */}
          <div className="relative ms-auto md:ms-0">
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
                <div role="dialog" aria-label="Notifications" className="animate-dropdown absolute end-0 top-12 z-50 w-[320px] overflow-hidden rounded-[20px] border border-white/10 bg-night-900/95 shadow-xl backdrop-blur-xl">
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
          <button onClick={onLogout} className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-mist-400 transition-all duration-200 hover:border-danger-500/30 hover:text-danger-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50" aria-label="Sign out">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
        <nav aria-label="Client sections" className="no-scrollbar mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined} className={`relative h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-all duration-200 ${tab === t.id ? "bg-volt-400 text-night-950" : "border border-white/[0.07] bg-white/[0.03] text-mist-400"}`}>
              {t.label}
              {t.id === "chat" && unread > 0 && tab !== "chat" && (
                <span className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-night-950 tnum">{unread}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main id="main-content" className="relative z-10 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
        {tab === "today" && <TodayTab plans={plans} meals={meals} exercises={state.exercises} onCheckIn={() => setTab("checkin")} sessionsToday={sessions.filter((s) => s.date === todayISO())} />}
        {tab === "nutrition" && <NutritionTab clientId={clientId} client={client} allMeals={state.meals} />}
        {tab === "checkin" && <CheckInTab clientId={clientId} onDone={() => setTab("progress")} alreadyToday={checkIns.some((c) => c.date === todayISO())} />}
        {tab === "progress" && <ProgressTab checkIns={checkIns} sessionsCount={attendance(sessions)} />}
        {tab === "chat" && <ChatTab clientId={clientId} />}
        {tab === "subscription" && <SubscriptionTab clientId={clientId} />}
      </main>
    </div>
  );
}

/* ---------------- nutrition (weekly plan) ---------------- */

function NutritionTab({ clientId, client, allMeals }: { clientId: string; client: Client; allMeals: Meal[] }) {
  const [selectedDay, setSelectedDay] = useState<number>(dayNum()); // Default to today's day
  const autoJumped = useRef(false);
  const meals = useMemo(() => allMeals.filter((m) => m.clientId === clientId), [allMeals, clientId]);

  // If today has no plan but another day does (the coach usually builds
  // Monday first), jump once to the first planned day so the client
  // actually lands on their meals instead of an empty day.
  useEffect(() => {
    if (autoJumped.current || meals.length === 0) return;
    autoJumped.current = true;
    if (!meals.some((m) => m.day === dayNum())) {
      const first = [1, 2, 3, 4, 5, 6, 7].find((d) => meals.some((m) => m.day === d));
      if (first) setSelectedDay(first);
    }
  }, [meals]);
  
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
  
  // Calculate daily totals
  const dailyTotals = useMemo(
    () =>
      dayMeals.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          protein: acc.protein + m.protein,
          carbs: acc.carbs + m.carbs,
          fats: acc.fats + m.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [dayMeals]
  );
  
  // Get animated values for totals
  const animCalories = useCountUp(dailyTotals.calories, 600);
  const animProtein = useCountUp(dailyTotals.protein, 600);
  const animCarbs = useCountUp(dailyTotals.carbs, 600);
  const animFats = useCountUp(dailyTotals.fats, 600);
  
  // Weekly overview data
  const weeklyOverview = useMemo(() => {
    const today = dayNum();
    const daysData = Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
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
  const isToday = selectedDay === dayNum();
  
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
    <div className="grid gap-4">
      {/* Header with TODAY indicator */}
      <div className="rise relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-mist-500">Weekly Nutrition Plan</p>
          <h1 className="mt-1 font-display text-[36px] font-bold uppercase leading-[0.92] text-mist-100 sm:text-[44px]">
            {isToday ? "TODAY" : WEEK_DAYS[selectedDay - 1]}{" "}
            <span className={isToday ? "text-volt-400" : "text-mist-400"}>· {WEEK_DAYS[selectedDay - 1]}</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">
            {isToday ? "This is your nutrition plan for today" : `Your assigned meals for ${WEEK_DAYS[selectedDay - 1]}`}
          </p>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="rise rounded-xl border border-night-700 bg-night-850 p-3" style={{ animationDelay: "60ms" }}>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {weeklyOverview.map((d) => {
            const isSelected = selectedDay === d.day;
            const isCurrentDay = d.day === dayNum();
            return (
              <button
                key={d.day}
                onClick={() => setSelectedDay(d.day)}
                className={`flex min-w-[3.25rem] flex-col items-center justify-center rounded-lg border px-2 py-2.5 text-xs font-bold transition-all duration-200 ${
                  isSelected
                    ? "border-volt-400 bg-volt-400/15 text-volt-300 shadow-[0_0_12px_-2px_rgba(205,241,75,0.3)]"
                    : d.hasPlan
                    ? "border-night-600 bg-night-800 text-mist-200 hover:border-night-500 hover:bg-night-750"
                    : "border-night-700 bg-night-900 text-mist-500 hover:border-night-600"
                }`}
              >
                <span>{d.short}</span>
                {isCurrentDay && !isSelected && <span className="mt-0.5 h-1 w-1 rounded-full bg-volt-400" />}
                {isSelected && <span className="mt-0.5 h-1 w-1 rounded-full bg-volt-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Summary */}
      <div className="rise rounded-xl border border-night-700 bg-night-850 p-5" style={{ animationDelay: "100ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-warn-400/15 text-warn-300">
              <Flame className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-[28px] font-bold leading-7 text-mist-100">
                {Math.round(animCalories).toLocaleString("en-US")}
                <span className="ms-1.5 text-sm font-semibold text-mist-500">kcal</span>
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mist-500">{WEEK_DAYS[selectedDay - 1]}</p>
            </div>
          </div>
          <div className="flex gap-5">
            {([
              ["Protein", animProtein, "text-volt-300"],
              ["Carbs", animCarbs, "text-sky-300"],
              ["Fats", animFats, "text-warn-300"],
            ] as const).map(([label, v, tone]) => (
              <div key={label} className="text-center">
                <p className={`font-display text-xl font-bold ${tone}`}>{Math.round(v)}g</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Targets Comparison */}
        {targets && (
          <div className="mt-4 grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4 sm:gap-4 border-t border-night-700">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Target</p>
              <p className="font-display text-base font-bold text-mist-300">{targets.calories} kcal</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Protein</p>
              <p className={`font-display text-base font-bold ${dailyTotals.protein >= targets.protein ? "text-volt-300" : "text-mist-400"}`}>
                {dailyTotals.protein} / {targets.protein}g
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Carbs</p>
              <p className={`font-display text-base font-bold ${dailyTotals.carbs >= targets.carbs ? "text-sky-300" : "text-mist-400"}`}>
                {dailyTotals.carbs} / {targets.carbs}g
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Fat</p>
              <p className={`font-display text-base font-bold ${dailyTotals.fats >= targets.fats ? "text-warn-300" : "text-mist-400"}`}>
                {dailyTotals.fats} / {targets.fats}g
              </p>
            </div>
          </div>
        )}
        
        {/* Water target if available */}
        {targets?.water && (
          <div className="mt-3 flex items-center gap-2 text-mist-400">
            <Droplets className="h-4 w-4" />
            <span className="text-xs font-bold">Water target: {targets.water}L / day</span>
          </div>
        )}
      </div>

      {/* Meals List — grouped by type like coach mode */}
      <div className="rise" style={{ animationDelay: "140ms" }}>
        <h2 className="mb-3 text-lg font-bold uppercase tracking-wider text-mist-300">Meals · {WEEK_DAYS[selectedDay - 1]}</h2>

        {sortedMeals.length === 0 ? (
          <SectionCard title="" icon={<UtensilsCrossed className="h-5 w-5" />} bodyCls="p-6">
            <div className="text-center py-8">
              <UtensilsCrossed className="mx-auto h-12 w-12 text-night-500" />
              <p className="mt-3 text-sm font-semibold text-mist-400">No nutrition plan for this day</p>
              <p className="mt-1 text-xs text-mist-500">Your coach hasn't assigned meals for {WEEK_DAYS[selectedDay - 1]} yet</p>
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
                        View {d.name} · {d.mealCount} meal{d.mealCount === 1 ? "" : "s"}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </SectionCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
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
                  bodyCls="p-3"
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
                        <p className="text-sm font-semibold leading-5 text-mist-100">{meal.description}</p>
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
      
      {/* Weekly Overview */}
      <SectionCard title="Week Overview" icon={<ClipboardList className="h-4.5 w-4.5" />} delay={200} bodyCls="p-3">
        <div className="grid grid-cols-7 gap-2">
          {weeklyOverview.map((d) => (
            <div
              key={d.day}
              className={`rounded-lg border p-2 text-center transition ${
                d.hasPlan
                  ? "border-night-600 bg-night-800"
                  : "border-night-700 bg-night-900"
              } ${selectedDay === d.day ? "ring-1 ring-volt-400" : ""}`}
            >
              <p className="text-[10px] font-bold text-mist-500">{d.short}</p>
              <p className={`mt-1 font-display text-sm font-bold ${d.hasPlan ? "text-mist-200" : "text-mist-600"}`}>
                {d.mealCount}
              </p>
              {d.isToday && (
                <span className="mt-0.5 block h-1 w-1 rounded-full bg-volt-400 mx-auto" />
              )}
            </div>
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
    </div>
  );
}

/* ---------------- today ---------------- */

function TodayTab({
  plans,
  meals,
  exercises,
  onCheckIn,
  sessionsToday,
}: {
  plans: { id: string; day: number; exerciseId: string; sets: number; reps: number; rest: number; notes: string }[];
  meals: Meal[];
  exercises: { id: string; name: string; category: "Chest" | "Back" | "Legs" | "Arms" | "Core" | "Cardio"; videoUrl: string }[];
  onCheckIn: () => void;
  sessionsToday: { id: string; time: string; type: string; status: string }[];
}) {
  const dn = dayNum();
  const todayPlan = plans.filter((p) => p.day === dn);
  // Filter meals for today's day only
  const todayMeals = meals.filter((m) => m.day === dn);
  const plannedDayNames = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7]
        .filter((d) => d !== dn && meals.some((m) => m.day === d))
        .map((d) => WEEK_DAYS[d - 1]),
    [meals, dn]
  );
  const kcal = todayMeals.reduce((s, m) => s + m.calories, 0);
  const exOf = (id: string) => exercises.find((e) => e.id === id);

  return (
    <div className="grid gap-4">
      <div className="rise relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-mist-500">Your program</p>
            <h1 className="mt-1 font-display text-[44px] font-bold uppercase leading-[0.92] text-mist-100 sm:text-[54px]">
              Day {dn} <span className="text-volt-400">· {WEEK_DAYS[dn - 1]}</span>
            </h1>
            <p className="mt-2 text-sm text-mist-400">
              {todayPlan.length > 0 ? `${todayPlan.length} exercise${todayPlan.length > 1 ? "s" : ""} today` : "Recovery day"} · {kcal > 0 ? `${kcal.toLocaleString("en-US")} kcal planned` : "no meals assigned"}
            </p>
          </div>
          <button className={`${btnPrimary} h-12`} onClick={onCheckIn}>
            <Camera className="h-5 w-5" /> Submit daily check-in
          </button>
        </div>
      </div>

      {sessionsToday.length > 0 && (
        <SectionCard title="Today's sessions" icon={<ClipboardList className="h-4.5 w-4.5" />} bodyCls="p-3">
          <ul className="grid gap-2">
            {sessionsToday.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
                <span className="font-display text-lg font-bold text-mist-100 tnum">{s.time}</span>
                <span className="text-sm font-semibold text-mist-300">{s.type}</span>
                <Badge className="ms-auto border-night-600 bg-night-700 text-mist-300">{s.status}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Today's workout" icon={<Dumbbell className="h-4.5 w-4.5" />} delay={80} bodyCls="p-3">
        {todayPlan.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="Rest day" sub="No session programmed today. Sleep well, eat well, come back stronger tomorrow." />
        ) : (
          <ul className="grid gap-2">
            {todayPlan.map((item, i) => {
              const ex = exOf(item.exerciseId);
              return (
                <li key={item.id} className="rise flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-night-700 font-display text-lg font-bold text-volt-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-mist-100">{ex?.name ?? "Exercise"}</p>
                      {ex && (
                        <Badge className={CAT_META[ex.category].chip}>
                          <span className={`h-1.5 w-1.5 rounded-full ${CAT_META[ex.category].dot}`} />
                          {ex.category}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs font-semibold text-mist-400">
                      <span className="font-display text-base text-mist-200 tnum">
                        {item.sets} × {item.reps} <span className="text-mist-500">reps</span>
                      </span>
                      <span>{item.rest > 0 ? `${item.rest}s rest` : "no rest"}</span>
                    </p>
                    {item.notes && <p className="mt-1 text-[11px] italic text-mist-500">Coach: "{item.notes}"</p>}
                  </div>
                  {ex?.videoUrl && (
                    <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-night-700 px-2.5 py-2 text-[11px] font-bold text-volt-300 transition hover:bg-night-600">
                      <Play className="h-3 w-3" /> Video
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Today's meals" icon={<UtensilsCrossed className="h-4.5 w-4.5" />} delay={160} bodyCls="p-3">
        {todayMeals.length === 0 ? (
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
                  <div key={t} className="rounded-lg border border-night-700 bg-night-800 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge className={MEAL_META[t].chip}>{t} · {list.length}</Badge>
                      <span className="font-display text-sm font-bold text-warn-300 tnum">{totals.toLocaleString("en-US")} kcal</span>
                    </div>
                    <div className="grid gap-2">
                      {list.map((m) => (
                        <div key={m.id} className="rounded-lg border border-night-700 bg-night-850 p-2.5">
                          <p className="text-sm font-semibold leading-5 text-mist-100">{m.description}</p>
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
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [photoErr, setPhotoErr] = useState("");
  const [error, setError] = useState("");

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setPhotoErr("");
      setPhoto(await fileToDataUrl(f, 640));
    } catch {
      setPhotoErr("Could not read that image.");
    }
  };

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
      photo,
    });
    onDone();
  };

  return (
    <div className="grid gap-4">
      <div className="rise rounded-xl border border-night-700 bg-night-850 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-mist-500">{todayISO()}</p>
        <h1 className="mt-1 font-display text-4xl font-bold uppercase leading-none text-mist-100 sm:text-5xl">
          Daily <span className="text-volt-400">check-in</span>
        </h1>
        <p className="mt-2 text-sm text-mist-400">Sixty honest seconds. Your coach sees this instantly.</p>
        {alreadyToday && (
          <p className="mt-3 rounded-lg border border-warn-400/25 bg-warn-400/10 px-3 py-2 text-xs font-semibold text-warn-300">
            You already checked in today — logging again is fine, the latest numbers count.
          </p>
        )}
      </div>

      <SectionCard title="Numbers" icon={<Scale className="h-4.5 w-4.5" />} delay={80} bodyCls="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Weight (kg) *</label>
            <input className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-3 text-sm text-mist-100 outline-none transition focus:border-volt-400" type="number" step="0.1" min="0" placeholder={last ? `last: ${last.weight}` : "e.g. 74.5"} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Waist (cm)</label>
            <input className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-3 text-sm text-mist-100 outline-none transition focus:border-volt-400" type="number" step="0.1" min="0" placeholder={last?.waist !== undefined ? `last: ${last.waist}` : "optional"} value={waist} onChange={(e) => setWaist(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Mood</label>
            <MoodPicker value={mood} onChange={setMood} />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Water intake (liters)</label>
            <input className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-3 text-sm text-mist-100 outline-none transition focus:border-volt-400" type="number" step="0.1" min="0" value={water} onChange={(e) => setWater(e.target.value)} />
            <div className="mt-2 flex gap-1.5">
              {[1.5, 2, 2.5, 3].map((v) => (
                <button key={v} type="button" onClick={() => setWater(String(v))} className={`cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-bold transition ${water === String(v) ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"}`}>
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

      <SectionCard title="Photo & notes" icon={<Camera className="h-4.5 w-4.5" />} delay={160} bodyCls="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Progress photo (optional)</label>
            <div className="flex items-center gap-3">
              {photo ? (
                <div className="relative">
                  <img src={photo} alt="Progress" className="h-20 w-20 rounded-lg object-cover ring-1 ring-night-600" />
                  <button type="button" onClick={() => setPhoto(undefined)} className="absolute -end-2 -top-2 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-danger-500 text-white shadow" aria-label="Remove photo">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-night-500 text-night-400">
                  <ImageIcon className="h-7 w-7" />
                </span>
              )}
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-night-500 bg-night-700 px-3 text-xs font-bold text-mist-100 transition hover:bg-night-600">
                <Camera className="h-4 w-4" />
                {photo ? "Replace photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e)} />
              </label>
            </div>
            {photoErr && <p className="mt-1 text-xs font-semibold text-danger-400">{photoErr}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Notes for your coach</label>
            <textarea className="w-full min-h-20 resize-y rounded-lg border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-100 outline-none transition focus:border-volt-400" placeholder="Energy, sleep, soreness, PRs…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-xs font-bold text-danger-400">{error}</p>}
        <button className={`${btnPrimary} mt-5 h-12 w-full text-base`} onClick={submit}>
          <Check className="h-5 w-5" strokeWidth={2.4} /> Submit check-in
        </button>
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
    <div className="grid gap-4">
      <div className="rise grid grid-cols-3 gap-3">
        <MiniKpi icon={<Scale className="h-4 w-4" />} label="Latest weight" value={prog.currentWeight !== null ? `${prog.currentWeight}` : "—"} unit="kg" />
        <MiniKpi icon={<Droplets className="h-4 w-4" />} label="Total change" value={prog.weightChange !== null ? signed(prog.weightChange) : "—"} unit="kg" tone={prog.weightChange !== null && prog.weightChange <= 0 ? "text-moss-300" : "text-warn-300"} />
        <MiniKpi icon={<Flame className="h-4 w-4" />} label="Day streak" value={String(streak)} unit="days" tone="text-volt-300" />
      </div>

      <SectionCard title="Weight trend" icon={<Scale className="h-4.5 w-4.5" />} delay={80} bodyCls="p-4">
        <WeightLine entries={sorted} />
      </SectionCard>

      <SectionCard title="Attendance" icon={<Check className="h-4.5 w-4.5" />} delay={160} bodyCls="p-5">
        <p className="text-sm text-mist-300">
          You've completed <span className="font-display text-xl font-bold text-volt-300 tnum">{sessionsCount.completed}</span> of{" "}
          <span className="font-bold tnum">{sessionsCount.countable}</span> sessions ({sessionsCount.pct}%).
        </p>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-night-700">
          <div className="grow-x h-full rounded-full bg-volt-400" style={{ width: `${sessionsCount.pct}%` }} />
        </div>
      </SectionCard>
    </div>
  );
}

function MiniKpi({ icon, label, value, unit, tone }: { icon: ReactNode; label: string; value: string; unit: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-850 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-mist-500">
        <span className="text-volt-400">{icon}</span> {label}
      </p>
      <p className={`mt-1 font-display text-[30px] font-bold leading-8 tnum ${tone ?? "text-mist-100"}`}>
        {value}
        <span className="text-sm font-semibold text-mist-500"> {unit}</span>
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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length]);

  const submit = () => {
    if (!draft.trim()) return;
    sendMessage(clientId, draft);
    setDraft("");
  };

  return (
    <div className="rise flex h-[calc(100vh-230px)] min-h-96 flex-col overflow-hidden rounded-xl border border-night-700 bg-night-850">
      <header className="flex items-center gap-2.5 border-b border-night-700 px-5 py-3.5">
        <MessageCircle className="h-4.5 w-4.5 text-volt-400" />
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-mist-100">Chat with your coach</h2>
        <span className="ms-auto text-[11px] font-semibold text-mist-500 tnum">{thread.length} message{thread.length === 1 ? "" : "s"}</span>
      </header>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
        {thread.length === 0 && (
          <p className="grid h-full place-items-center text-center text-xs text-mist-500">
            No messages yet.<br />Ask your coach anything — it goes straight to their dashboard.
          </p>
        )}
        {thread.map((m) => {
          const mine = m.senderRole === "client";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3.5 py-2 ${mine ? "rounded-ee-sm bg-volt-400 text-night-950" : "rounded-es-sm border border-night-600 bg-night-800 text-mist-100"}`}>
                {!mine && <p className="text-[10px] font-bold uppercase tracking-wider text-volt-300">Coach</p>}
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
          className="h-11 min-w-0 flex-1 rounded-lg border border-night-600 bg-night-800 px-3.5 text-sm text-mist-100 outline-none transition focus:border-volt-400"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={!draft.trim()} className={`${btnPrimary} h-11 shrink-0 px-4`} aria-label="Send">
          <Send className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- subscription (read-only) ---------------- */

function SubscriptionTab({ clientId }: { clientId: string }) {
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
    <div className="grid gap-4">
      <SectionCard title="My subscription" icon={<CreditCard className="h-4.5 w-4.5" />} bodyCls="p-5">
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
              <div className="rounded-lg border border-night-700 bg-night-800 p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Payment</p>
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

            <p className="rounded-lg border border-night-700 bg-night-800/60 px-3.5 py-2.5 text-[11px] leading-5 text-mist-400">
              To renew or change your plan, message your coach — renewals are handled on their side.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Payment history" icon={<CreditCard className="h-4.5 w-4.5" />} delay={100} bodyCls="p-3">
        {payments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-night-600 px-4 py-6 text-center text-xs text-mist-500">No payments recorded yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 px-3.5 py-2.5">
                <span className="w-24 shrink-0 text-xs font-bold text-mist-300">{fmtDate(p.date)}</span>
                <span className="font-display text-lg font-bold text-mist-100 tnum">
                  {fmtMoney(p.amount)} <span className="text-xs font-semibold text-mist-500">EGP</span>
                </span>
                <span className="ms-auto text-xs font-semibold text-mist-400">{p.method}</span>
                <Badge className="border-moss-400/25 bg-moss-400/10 text-moss-300">Paid</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ReadOnly({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-night-700 bg-night-800 p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">{k}</p>
      <p className="mt-1 font-display text-lg font-bold text-mist-100 tnum">{v}</p>
    </div>
  );
}

void btnSecondary;
void btnSm;
