/* ================================================================
   FORGE — 7-Day Nutrition Plan Builder (Coach Mode)
   ================================================================ */

import { useEffect, useState, useMemo, useRef } from "react";
import type { Meal, MealType, Client } from "../types";
import { MEAL_TYPES, WEEK_DAYS, WEEK_SHORT } from "../types";
import { useApp } from "../store";
import { Avatar, EmptyState, SectionCard, labelCls, btnPrimary, btnSecondary } from "./ui";
import { MealFormModal, CopyDayModal, NutritionTargetsModal } from "./modals";
import { IconFlame, IconPlus, IconTrash, IconPencil, IconUtensils, IconCopy, IconCalendar, IconWhatsapp, IconSearch, IconCheck } from "../icons";
import { Printer, Share2, Target, AlertTriangle, Droplets, Copy } from "lucide-react";

/* ---------- helpers ---------- */

function pct(actual: number, target: number) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

function statusTone(actual: number, target: number): "empty" | "low" | "good" | "over" {
  if (!target || target <= 0) return "empty";
  const r = actual / target;
  if (r > 1.1) return "over";
  if (r >= 0.9) return "good";
  return "low";
}

function MacroProgress({
  label,
  actual,
  target,
  unit,
  barClass,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
  barClass: string;
}) {
  const p = pct(actual, target);
  const tone = statusTone(actual, target);
  const diff = target - actual;
  const barTone =
    tone === "over" ? "bg-danger-400" : tone === "good" ? "bg-moss-400" : barClass;
  return (
    <div className="rounded-xl border border-night-700 bg-night-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            tone === "over"
              ? "bg-danger-500/15 text-danger-300"
              : tone === "good"
                ? "bg-moss-400/15 text-moss-300"
                : "bg-night-700 text-mist-400"
          }`}
        >
          {target > 0 ? `${p}%` : "no target"}
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-mist-100">
        {actual.toLocaleString("en-US")}
        <span className="text-mist-500"> / {target.toLocaleString("en-US")}{unit}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-night-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barTone}`}
          style={{ width: `${target > 0 ? p : 0}%` }}
        />
      </div>
      {target > 0 && (
        <p className={`mt-1.5 text-[11px] font-semibold ${tone === "over" ? "text-danger-300" : "text-mist-500"}`}>
          {tone === "over" ? `Over by ${(actual - target).toLocaleString("en-US")}${unit}` : diff === 0 ? "On target 🎯" : `${diff.toLocaleString("en-US")}${unit} remaining`}
        </p>
      )}
    </div>
  );
}

/* ---------- searchable client picker (replaces the plain dropdown) ---------- */

function ClientSearchPicker({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = clients.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? clients.filter((c) => `${c.name} ${c.username} ${c.email}`.toLowerCase().includes(needle))
    : clients;

  return (
    <div ref={ref} className="relative w-60">
      <label className={labelCls}>Client</label>
      <button
        type="button"
        onClick={() => {
          setQ("");
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-white/[0.08] bg-night-900/80 px-3 text-start shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-white/[0.14] focus:border-volt-400/60"
      >
        {selected ? (
          <>
            <Avatar name={selected.name} photo={selected.photo} className="h-7 w-7 !rounded-lg text-[10px]" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-mist-100">{selected.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-mist-500">Select client…</span>
        )}
        <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-mist-500 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="animate-dropdown absolute end-0 start-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 shadow-xl backdrop-blur-xl">
          <div className="border-b border-white/[0.07] p-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-night-800 px-3 transition-[border-color,box-shadow,background-color] duration-200 focus-within:border-volt-400/60 focus-within:bg-night-900 focus-within:shadow-[0_0_0_3px_rgba(205,241,75,0.12)]">
              <IconSearch className="h-4 w-4 shrink-0 text-mist-500" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or username…"
                className="client-search-field h-10 w-full bg-transparent text-sm text-mist-100 outline-none placeholder:text-mist-500"
                role="searchbox"
                aria-label="Search clients"
              />
              {q && (
                <button onClick={() => setQ("")} className="cursor-pointer text-xs font-bold text-mist-500 hover:text-mist-200" aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>
          </div>
          <ul role="listbox" aria-label="Clients" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs font-semibold text-mist-500">
                No client matches "{q.trim()}"
              </li>
            ) : (
              filtered.map((c) => {
                const active = c.id === value;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition ${
                        active ? "bg-volt-400/10" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <Avatar name={c.name} photo={c.photo} className="h-8 w-8 !rounded-lg text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] font-bold ${active ? "text-volt-300" : "text-mist-100"}`}>{c.name}</span>
                        <span className="block truncate text-[11px] font-semibold text-mist-500">{c.username} · {c.goal}</span>
                      </span>
                      {active && <IconCheck className="h-4 w-4 shrink-0 text-volt-300" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="border-t border-white/[0.07] px-3 py-2">
            <p className="text-[10.5px] font-semibold text-mist-500 tnum">{filtered.length} of {clients.length} clients</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function NutritionPlanView({ presetClientId }: { presetClientId: string | null }) {
  const { state, addMeal, updateMeal, deleteMeal, toast } = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? state.clients[0]?.id ?? "");
  const [selectedDay, setSelectedDay] = useState<number>(1); // 1 = Monday
  const [modalOpen, setModalOpen] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [deleting, setDeleting] = useState<Meal | null>(null);
  const [defaultType, setDefaultType] = useState<MealType>("Breakfast");

  useEffect(() => {
    if (presetClientId) setClientId(presetClientId);
  }, [presetClientId]);

  useEffect(() => {
    if (!clientId && state.clients.length) setClientId(state.clients[0].id);
  }, [clientId, state.clients]);

  const client = state.clients.find((c) => c.id === clientId);
  const allClientMeals = state.meals.filter((m) => m.clientId === clientId);
  
  // Filter meals for selected day
  const dayMeals = useMemo(() => 
    allClientMeals.filter((m) => m.day === selectedDay),
    [allClientMeals, selectedDay]
  );

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

  // Group day meals by type — Breakfast together, Lunch together, etc.
  const groupedMeals = useMemo(() => {
    const groups: Record<MealType, Meal[]> = { Breakfast: [], Lunch: [], Dinner: [], Snack: [] };
    for (const m of sortedMeals) groups[m.type].push(m);
    return groups;
  }, [sortedMeals]);

  // Calculate daily totals
  const dailyTotals = useMemo(() => 
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

  // Weekly completion status + per-day calories
  const { weeklyStatus, dayCalories } = useMemo(() => {
    const daysWithMeals = new Set(allClientMeals.map((m) => m.day));
    const cals: Record<number, number> = {};
    for (let d = 1; d <= 7; d++) {
      cals[d] = allClientMeals.filter((m) => m.day === d).reduce((s, m) => s + m.calories, 0);
    }
    return {
      weeklyStatus: {
        planned: daysWithMeals.size,
        total: 7,
        hasMeals: (day: number) => daysWithMeals.has(day),
      },
      dayCalories: cals,
    };
  }, [allClientMeals]);

  // Nutrition targets comparison
  const targets = client?.nutritionTargets;

  // Macro kcal split (protein*4 / carbs*4 / fats*9)
  const macroKcal = useMemo(() => {
    const p = dailyTotals.protein * 4;
    const c = dailyTotals.carbs * 4;
    const f = dailyTotals.fats * 9;
    const sum = p + c + f;
    return { p, c, f, sum };
  }, [dailyTotals]);

  const handleAddMeal = (type?: MealType) => {
    setEditing(null);
    setDefaultType(type ?? "Breakfast");
    setModalOpen(true);
  };

  const handleEditMeal = (meal: Meal) => {
    setEditing(meal);
    setModalOpen(true);
  };

  const handleDeleteMeal = (meal: Meal) => {
    setDeleting(meal);
  };

  const confirmDelete = () => {
    if (deleting) {
      deleteMeal(deleting.id);
      setDeleting(null);
    }
  };

  /* ---------- share / print ---------- */

  const buildDayText = (day: number) => {
    const typeOrder: Record<MealType, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };
    const list = [...allClientMeals.filter((m) => m.day === day)].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return typeOrder[a.type] - typeOrder[b.type];
    });
    const t = list.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fats: acc.fats + m.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    const lines = list.map(
      (m) => `• ${m.type}${m.time ? ` (${m.time})` : ""}: ${m.description} — ${m.calories} kcal (P${m.protein} C${m.carbs} F${m.fats})`
    );
    return { list, totals: t, lines };
  };

  const buildShareText = (dayOnly: boolean) => {
    if (!client) return "";
    const head = `*Nutrition Plan — ${client.name}*`;
    const targetLine = targets
      ? `Targets: ${targets.calories} kcal | P${targets.protein}g C${targets.carbs}g F${targets.fats}g${targets.water ? ` | Water ${targets.water}L` : ""}`
      : "";
    if (dayOnly) {
      const { lines, totals } = buildDayText(selectedDay);
      return [
        head,
        `*${WEEK_DAYS[selectedDay - 1]}*`,
        "",
        ...(lines.length ? lines : ["No meals planned for this day."]),
        "",
        `Total: ${totals.calories} kcal | P${totals.protein}g C${totals.carbs}g F${totals.fats}g`,
        targetLine,
      ]
        .filter(Boolean)
        .join("\n");
    }
    const parts: string[] = [head, targetLine, ""].filter(Boolean);
    for (let d = 1; d <= 7; d++) {
      const { lines, totals } = buildDayText(d);
      parts.push(`*${WEEK_DAYS[d - 1]}* — ${totals.calories} kcal`);
      if (lines.length) parts.push(...lines);
      else parts.push("— rest / no meals —");
      parts.push("");
    }
    return parts.join("\n").trim();
  };

  const handleWhatsAppShare = (dayOnly: boolean) => {
    const text = buildShareText(dayOnly);
    if (!text) return;
    const digits = (client?.phone ?? "").replace(/\D/g, "");
    const url =
      digits.length >= 8
        ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async (dayOnly: boolean) => {
    try {
      await navigator.clipboard.writeText(buildShareText(dayOnly));
      toast(dayOnly ? "Day plan copied — paste anywhere" : "Full week plan copied");
    } catch {
      toast("Couldn't copy — select & copy manually", "warn");
    }
  };

  const handlePrint = () => {
    if (!client) return;
    const rows = [1, 2, 3, 4, 5, 6, 7]
      .map((d) => {
        const { list, totals } = buildDayText(d);
        const mealsHtml = list.length
          ? list
              .map(
                (m) => `<tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;">${m.type}${m.time ? ` <span style="color:#888">(${m.time})</span>` : ""}<br/><strong>${m.description}</strong>${m.notes ? `<br/><span style="color:#666;font-size:12px">${m.notes}</span>` : ""}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${m.calories}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${m.protein}g</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${m.carbs}g</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${m.fats}g</td>
                </tr>`
              )
              .join("")
          : `<tr><td colspan="5" style="padding:12px;color:#888;">No meals — rest day</td></tr>`;
        return `<h2 style="margin:22px 0 6px;font-size:15px;">${WEEK_DAYS[d - 1]} — ${totals.calories} kcal (P${totals.protein} C${totals.carbs} F${totals.fats})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#f6f6f6;text-align:left;">
            <th style="padding:8px 10px;">Meal</th><th>Kcal</th><th>Protein</th><th>Carbs</th><th>Fats</th>
          </tr></thead><tbody>${mealsHtml}</tbody>
        </table>`;
      })
      .join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast("Allow popups to print the plan", "warn");
      return;
    }
    w.document.write(`<html><head><title>Nutrition Plan — ${client.name}</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111;max-width:800px;margin:auto;">
      <h1 style="margin:0;">Nutrition Plan — ${client.name}</h1>
      <p style="color:#555;margin:6px 0 0;">${targets ? `Targets: ${targets.calories} kcal | P${targets.protein}g C${targets.carbs}g F${targets.fats}g${targets.water ? ` | Water ${targets.water}L` : ""}` : "No targets set"} • Printed ${new Date().toLocaleDateString()}</p>
      ${rows}
      <p style="margin-top:24px;color:#888;font-size:12px;">Made with FORGE • Ask your coach before swapping meals</p>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    w.document.close();
  };

  if (!client) {
    return (
      <div>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
              Nutrition <span className="text-volt-400">Plan</span>
            </h1>
            <p className="mt-2 text-sm text-mist-400">Build complete weekly meal plans for your clients</p>
          </div>
        </header>
        <div className="mt-6">
          <EmptyState icon={<IconUtensils className="h-6 w-6" />} title="No clients yet" sub="Add a client first, then build their nutrition plan." />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            Nutrition <span className="text-volt-400">Plan</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">Build complete weekly meal plans — {client.name}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <ClientSearchPicker clients={state.clients} value={clientId} onChange={setClientId} />
          <button
            className="inline-flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-4 text-sm font-bold text-mist-200 transition hover:border-volt-400 hover:text-volt-300"
            onClick={() => setTargetsOpen(true)}
            title="Edit daily nutrition targets"
          >
            <Target className="h-4 w-4" />
            Targets
          </button>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="rise mt-6 rounded-xl border border-night-700 bg-night-850 p-4" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-mist-400">Week Overview</h2>
          <span className="text-xs font-semibold text-mist-500">
            {weeklyStatus.planned} / {weeklyStatus.total} days planned
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEK_DAYS.map((dayName, idx) => {
            const dayNum = idx + 1;
            const hasMeals = weeklyStatus.hasMeals(dayNum);
            const isSelected = selectedDay === dayNum;
            
            return (
              <button
                key={dayName}
                onClick={() => setSelectedDay(dayNum)}
                className={`flex min-w-[86px] flex-col items-center gap-0.5 rounded-lg border px-3 py-2 transition ${
                  isSelected
                    ? "border-volt-400 bg-volt-400/15 text-volt-300"
                    : hasMeals
                    ? "border-night-600 bg-night-800 text-mist-200 hover:border-night-500"
                    : "border-night-700 bg-night-900 text-mist-500 hover:border-night-600"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold">
                  {WEEK_SHORT[idx]}
                  {hasMeals && <span className="h-1.5 w-1.5 rounded-full bg-volt-400" />}
                </span>
                <span className={`text-[10px] font-semibold ${isSelected ? "text-volt-300/80" : "text-mist-500"}`}>
                  {hasMeals ? `${dayCalories[dayNum].toLocaleString("en-US")} kcal` : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily Summary */}
      <div className="rise mt-4 rounded-xl border border-night-700 bg-night-850 p-5" style={{ animationDelay: "120ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-warn-400/15 text-warn-300">
              <IconFlame className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-[30px] font-bold leading-7 text-mist-100">
                {dailyTotals.calories.toLocaleString("en-US")}
                <span className="ms-1.5 text-sm font-semibold text-mist-500">kcal</span>
                {targets && targets.calories > 0 && (
                  <span className="ms-2 align-middle text-xs font-bold text-mist-500">
                    / {targets.calories.toLocaleString("en-US")}
                  </span>
                )}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-mist-500">{WEEK_DAYS[selectedDay - 1]}</p>
            </div>
          </div>
          <div className="flex gap-5">
            {([
              ["Protein", dailyTotals.protein, "text-volt-300"],
              ["Carbs", dailyTotals.carbs, "text-sky-300"],
              ["Fats", dailyTotals.fats, "text-warn-300"],
            ] as const).map(([label, v, tone]) => (
              <div key={label} className="text-center">
                <p className={`font-display text-2xl font-bold ${tone}`}>{v}g</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Macro kcal split */}
        {macroKcal.sum > 0 && (
          <>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-night-700">
              <div className="h-full bg-volt-400" style={{ width: `${(macroKcal.p / macroKcal.sum) * 100}%` }} title={`Protein ${macroKcal.p} kcal`} />
              <div className="h-full bg-sky-400" style={{ width: `${(macroKcal.c / macroKcal.sum) * 100}%` }} title={`Carbs ${macroKcal.c} kcal`} />
              <div className="h-full bg-warn-400" style={{ width: `${(macroKcal.f / macroKcal.sum) * 100}%` }} title={`Fats ${macroKcal.f} kcal`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-[10.5px] font-bold text-mist-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-volt-400" />Protein {Math.round((macroKcal.p / macroKcal.sum) * 100)}%</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Carbs {Math.round((macroKcal.c / macroKcal.sum) * 100)}%</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn-400" />Fats {Math.round((macroKcal.f / macroKcal.sum) * 100)}%</span>
              {targets?.water ? (
                <span className="inline-flex items-center gap-1.5 text-sky-300"><Droplets className="h-3 w-3" />Water target {targets.water}L</span>
              ) : null}
            </div>
          </>
        )}
        
        {/* Targets Progress */}
        {targets ? (
          <div className="mt-4 border-t border-night-700 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">Vs daily targets</p>
              <button
                onClick={() => setTargetsOpen(true)}
                className="cursor-pointer text-[11px] font-bold text-volt-300 hover:underline"
              >
                Edit targets
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MacroProgress label="Calories" actual={dailyTotals.calories} target={targets.calories} unit=" kcal" barClass="bg-warn-400" />
              <MacroProgress label="Protein" actual={dailyTotals.protein} target={targets.protein} unit="g" barClass="bg-volt-400" />
              <MacroProgress label="Carbs" actual={dailyTotals.carbs} target={targets.carbs} unit="g" barClass="bg-sky-400" />
              <MacroProgress label="Fats" actual={dailyTotals.fats} target={targets.fats} unit="g" barClass="bg-warn-400" />
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-night-600 bg-night-900 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-mist-400">
              <AlertTriangle className="h-4 w-4 text-warn-300" />
              No nutrition targets set for {client.name} — progress bars need a target.
            </p>
            <button
              onClick={() => setTargetsOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-volt-400 px-3 py-1.5 text-xs font-bold text-night-950 transition hover:bg-volt-300"
            >
              <Target className="h-3.5 w-3.5" />
              Set Targets
            </button>
          </div>
        )}
      </div>

      {/* Meals List */}
      <div className="rise mt-4" style={{ animationDelay: "160ms" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold uppercase tracking-wider text-mist-300">{WEEK_DAYS[selectedDay - 1]}</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-volt-400 hover:text-volt-300"
              onClick={() => setCopyModalOpen(true)}
            >
              <IconCopy className="h-3.5 w-3.5" />
              Copy Day
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-moss-400 hover:text-moss-300"
              onClick={() => handleCopy(true)}
              title="Copy this day as text"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Text
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-moss-400 hover:text-moss-300"
              onClick={() => handleWhatsAppShare(true)}
              title={client.phone ? `Send to ${client.phone} via WhatsApp` : "Share via WhatsApp"}
            >
              <IconWhatsapp className="h-3.5 w-3.5" />
              Day
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-sky-400 hover:text-sky-300"
              onClick={() => handleWhatsAppShare(false)}
              title="Share full week via WhatsApp"
            >
              <Share2 className="h-3.5 w-3.5" />
              Week
            </button>
            <button
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-warn-400 hover:text-warn-300"
              onClick={handlePrint}
              title="Print full week plan"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              className={`${btnPrimary} inline-flex items-center gap-1.5 !min-h-[32px] !py-1.5`}
              onClick={() => handleAddMeal()}
            >
              <IconPlus className="h-4 w-4" />
              Add Meal
            </button>
          </div>
        </div>

        {sortedMeals.length === 0 ? (
          <SectionCard
            title=""
            icon={<IconUtensils className="h-5 w-5" />}
            bodyCls="p-6"
          >
            <div className="text-center py-8">
              <IconUtensils className="mx-auto h-12 w-12 text-night-500" />
              <p className="mt-3 text-sm font-semibold text-mist-400">No meals planned for {WEEK_DAYS[selectedDay - 1]}</p>
              <p className="mt-1 text-xs text-mist-500">Start building this day's nutrition plan</p>
              <button className={`${btnPrimary} mt-4`} onClick={() => handleAddMeal()}>
                <IconPlus className="h-4 w-4" />
                Add First Meal
              </button>
            </div>
          </SectionCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {MEAL_TYPES.map((t, ti) => {
              const list = groupedMeals[t];
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
                  icon={<IconUtensils className="h-5 w-5" />}
                  delay={ti * 60}
                  bodyCls="p-3"
                  action={
                    <div className="flex items-center gap-2">
                      {list.length > 0 && (
                        <span className="hidden text-[11px] font-bold text-mist-500 sm:inline">
                          {totals.calories.toLocaleString("en-US")} kcal
                        </span>
                      )}
                      <button
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-night-600 text-mist-400 transition hover:border-volt-400 hover:text-volt-300"
                        title={`Add ${t.toLowerCase()}`}
                        onClick={() => handleAddMeal(t)}
                      >
                        <IconPlus className="h-4 w-4" />
                      </button>
                    </div>
                  }
                >
                  {list.length === 0 ? (
                    <button
                      onClick={() => handleAddMeal(t)}
                      className="w-full cursor-pointer rounded-lg border border-dashed border-night-600 px-4 py-6 text-center text-xs font-semibold text-mist-500 transition hover:border-volt-400/60 hover:text-volt-300"
                    >
                      + Add {t.toLowerCase()}
                    </button>
                  ) : (
                    <>
                      <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-[11px] font-bold text-mist-400">
                        <span className="font-display text-sm text-warn-300">{totals.calories.toLocaleString("en-US")} kcal</span>
                        <span className="text-volt-300">P {totals.protein}g</span>
                        <span className="text-sky-300">C {totals.carbs}g</span>
                        <span className="text-warn-300">F {totals.fats}g</span>
                      </p>
                      <ul className="grid gap-2">
                        {list.map((meal) => (
                          <li key={meal.id} className="group rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold leading-5 text-mist-100">{meal.description}</p>
                                </div>
                                {meal.time && (
                                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-mist-500">
                                    <IconCalendar className="h-3 w-3" />
                                    {meal.time}
                                  </span>
                                )}
                                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-mist-400">
                                  <span className="font-display text-base text-warn-300">{meal.calories} kcal</span>
                                  <span className="text-volt-300">P {meal.protein}g</span>
                                  <span className="text-sky-300">C {meal.carbs}g</span>
                                  <span className="text-warn-300">F {meal.fats}g</span>
                                </p>
                                {meal.notes && (
                                  <p className="mt-1 truncate text-[11px] italic text-mist-500">{meal.notes}</p>
                                )}
                              </div>
                              <div className="flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100">
                                <button
                                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-night-700 hover:text-mist-100"
                                  title="Edit"
                                  onClick={() => handleEditMeal(meal)}
                                >
                                  <IconPencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300"
                                  title="Delete"
                                  onClick={() => handleDeleteMeal(meal)}
                                >
                                  <IconTrash className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </SectionCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <MealFormModal
        open={modalOpen}
        clientId={client.id}
        initial={editing}
        defaultType={defaultType}
        defaultDay={editing?.day ?? selectedDay}
        onClose={() => setModalOpen(false)}
      />

      <NutritionTargetsModal open={targetsOpen} clientId={client.id} onClose={() => setTargetsOpen(false)} />
      
      <CopyDayModal
        open={copyModalOpen}
        clientId={client.id}
        sourceDay={selectedDay}
        meals={allClientMeals}
        onClose={() => setCopyModalOpen(false)}
      />

      {/* Delete Confirmation */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-night-700 bg-night-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-mist-100">Remove meal?</h3>
            <p className="mt-2 text-sm text-mist-400">
              "{deleting.description}" will be removed from the plan.
            </p>
            <div className="mt-5 flex gap-2">
              <button className={`${btnPrimary} flex-1 bg-danger-500 hover:bg-danger-600`} onClick={confirmDelete}>
                Remove
              </button>
              <button className={btnSecondary} onClick={() => setDeleting(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
