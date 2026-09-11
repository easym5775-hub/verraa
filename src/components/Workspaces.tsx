/* ================================================================
   VERRAA — Plans, Exercise Library and Check-ins views.
   NOTE: Nutrition/Meals has a single source of truth in
   NutritionPlan.tsx (NutritionPlanView). Do not re-add a
   MealsView here — it was removed as duplicated dead code.
   ================================================================ */

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Check,
  ClipboardList,
  Copy,
  FileDown,
  FileText,
  Image as ImageIcon,
  Library as LibraryIcon,
  Pencil,
  Play,
  Plus,
  Printer,
  Search,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import type { CheckIn, CoachView, Exercise, PlanItem } from "../types";
import { CAT_META, CATEGORIES, WEEK_DAYS, WEEK_ORDER_SAT_FIRST, WEEK_SHORT } from "../types";
import { dayNum, fmtDate, relDay, signed } from "../lib";
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
  btnPrimary,
  btnSecondary,
  btnSm,
  inputCls,
  labelCls,
} from "./ui";
import { IconWhatsapp } from "../icons";
import { exportWorkoutDayImage, exportWorkoutWeekPdf } from "./workoutExport";
import { ExerciseFormModal, PhotoModal, PlanItemFormModal } from "./modals";
import { PageHeader } from "./Shell";
import { CheckInsSkeleton, LibrarySkeleton, PlansSkeleton, useViewReady } from "./skeletons";

/* ================================================================
   Workout Plans
   ================================================================ */

export function PlansView({ presetClientId }: { presetClientId: string | null }) {
  const { state, me, toast, deletePlanItem } = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? state.clients[0]?.id ?? "");
  const [day, setDay] = useState(dayNum());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [deleting, setDeleting] = useState<PlanItem | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const ready = useViewReady(clientId);

  useEffect(() => {
    if (presetClientId) setClientId(presetClientId);
  }, [presetClientId]);
  useEffect(() => {
    // recover from a stale/deleted client id (deep links, deletions)
    if (clientId && !state.clients.some((c) => c.id === clientId)) setClientId(state.clients[0]?.id ?? "");
    else if (!clientId && state.clients.length) setClientId(state.clients[0].id);
  }, [clientId, state.clients]);

  const client = state.clients.find((c) => c.id === clientId);
  const items = state.plans.filter((p) => p.clientId === clientId && p.day === day);
  const countFor = (d: number) => state.plans.filter((p) => p.clientId === clientId && p.day === d).length;
  const exOf = (id: string) => state.exercises.find((e) => e.id === id);

  /* ---------- export / share (same system as nutrition plan) ---------- */

  const buildExportDay = (d: number) => {
    const list = state.plans
      .filter((p) => p.clientId === clientId && p.day === d)
      .map((p) => {
        const ex = state.exercises.find((e) => e.id === p.exerciseId);
        return {
          name: ex?.name ?? "Removed exercise",
          category: ex?.category,
          sets: p.sets,
          reps: p.reps,
          rest: p.rest,
          notes: p.notes || undefined,
          hasVideo: !!ex?.videoUrl,
        };
      });
    const totals = {
      exercises: list.length,
      sets: list.reduce((s, x) => s + x.sets, 0),
      reps: list.reduce((s, x) => s + x.sets * x.reps, 0),
    };
    return { day: d, dayName: `Day ${d} · ${WEEK_DAYS[d - 1]}`, items: list, totals };
  };

  const buildDayText = (d: number) => {
    const { items, totals } = buildExportDay(d);
    const lines = items.map((it, i) => {
      const base = `${i + 1}. ${it.name}${it.category ? ` (${it.category})` : ""}: ${it.sets}×${it.reps}${it.rest > 0 ? `, ${it.rest}s rest` : ""}`;
      return it.notes ? `${base} — ${it.notes}` : base;
    });
    return { list: items, totals, lines };
  };

  const buildShareText = (dayOnly: boolean) => {
    if (!client) return "";
    const head = `*Workout Plan — ${client.name}*`;
    if (dayOnly) {
      const { lines, totals } = buildDayText(day);
      return [
        head,
        `*Day ${day} · ${WEEK_DAYS[day - 1]}*`,
        "",
        ...(lines.length ? lines.map((l) => `• ${l}`) : ["No exercises — rest day."]),
        "",
        `Total: ${totals.exercises} exercises · ${totals.sets} sets · ${totals.reps} reps`,
      ].join("\n");
    }
    const parts: string[] = [head, ""];
    for (const d of WEEK_ORDER_SAT_FIRST) {
      const { lines, totals } = buildDayText(d);
      parts.push(`*Day ${d} · ${WEEK_DAYS[d - 1]}* — ${totals.exercises} ex · ${totals.sets} sets`);
      if (lines.length) parts.push(...lines.map((l) => `• ${l}`));
      else parts.push("— rest / no session —");
      parts.push("");
    }
    return parts.join("\n").trim();
  };

  const handleWeekPdf = async () => {
    if (!client) return;
    const days = WEEK_ORDER_SAT_FIRST.map(buildExportDay);
    if (!days.some((d) => d.items.length > 0)) {
      toast("Add at least one exercise before exporting", "warn");
      return;
    }
    toast("Preparing PDF…");
    try {
      await exportWorkoutWeekPdf(
        { clientName: client.name, coachName: me?.name, planName: "Weekly split" },
        days,
      );
    } catch {
      toast("Couldn't create the PDF", "warn");
    }
  };

  const handleDayImage = async () => {
    if (!client) return;
    const d = buildExportDay(day);
    if (d.items.length === 0) {
      toast("No exercises programmed for this day", "warn");
      return;
    }
    try {
      await exportWorkoutDayImage(
        { clientName: client.name, coachName: me?.name, planName: "Weekly split" },
        d,
      );
    } catch {
      toast("Couldn't create the image", "warn");
    }
  };

  const handleCopy = async (dayOnly: boolean) => {
    try {
      await navigator.clipboard.writeText(buildShareText(dayOnly));
      toast(dayOnly ? "Day workout copied — paste anywhere" : "Full week workout copied");
    } catch {
      toast("Couldn't copy — select & copy manually", "warn");
    }
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

  const handlePrint = () => {
    if (!client) return;
    const rows = WEEK_ORDER_SAT_FIRST.map((d) => {
      const { list, totals } = buildDayText(d);
      const exHtml = list.length
        ? list
            .map(
              (it, i) => `<tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;"><strong>${i + 1}. ${it.name}</strong>${it.category ? ` <span style="color:#888">(${it.category})</span>` : ""}${it.notes ? `<br/><span style="color:#666;font-size:12px">${it.notes}</span>` : ""}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${it.sets} × ${it.reps}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center;">${it.rest > 0 ? `${it.rest}s` : "—"}</td>
                </tr>`,
            )
            .join("")
        : `<tr><td colspan="3" style="padding:12px;color:#888;">No session — rest day</td></tr>`;
      return `<h2 style="margin:22px 0 6px;font-size:15px;">Day ${d} · ${WEEK_DAYS[d - 1]} — ${totals.exercises} ex · ${totals.sets} sets · ${totals.reps} reps</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <thead><tr style="background:#f6f6f6;text-align:left;">
            <th style="padding:8px 10px;">Exercise</th><th>Sets × Reps</th><th>Rest</th>
          </tr></thead><tbody>${exHtml}</tbody>
        </table>`;
    }).join("");
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast("Allow popups to print the plan", "warn");
      return;
    }
    w.document.write(`<html><head><title>Workout Plan — ${client.name}</title></head><body style="font-family:Arial,sans-serif;padding:28px;color:#111;max-width:800px;margin:auto;">
      <h1 style="margin:0;">Workout Plan — ${client.name}</h1>
      <p style="color:#555;margin:6px 0 0;">Weekly split • Printed ${new Date().toLocaleDateString()}</p>
      ${rows}
      <p style="margin-top:24px;color:#888;font-size:12px;">Made with VERRAA • Ask your coach before swapping exercises</p>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
    w.document.close();
  };

  if (!ready) return <PlansSkeleton />;

  return (
    <div>
      <PageHeader
        title="Workout"
        accent="plans"
        sub="Day 1 = Monday · build a weekly split per client"
        action={
          <div className="w-full sm:w-64">
            <label className={labelCls}>Client</label>
            <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.goal}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!client ? (
        <div className="mt-6">
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No clients yet" sub="Add a client first, then build their weekly plan here." />
        </div>
      ) : (
        <>
          <div className="rise mt-6 grid grid-cols-4 gap-1.5 sm:grid-cols-7" style={{ animationDelay: "80ms" }}>
            {WEEK_DAYS.map((wd, i) => {
              const d = i + 1;
              const active = day === d;
              const isToday = dayNum() === d;
              const n = countFor(d);
              return (
                <button
                  key={wd}
                  onClick={() => setDay(d)}
                  className={`cursor-pointer rounded-xl border px-1 py-2.5 text-center transition ${active ? "border-volt-400 bg-volt-400/10" : "border-night-600 bg-night-850 hover:border-night-500"}`}
                >
                  <span className={`block font-display text-lg font-bold leading-5 ${active ? "text-volt-300" : "text-mist-100"}`}>Day {d}</span>
                  <span className={`block text-[10px] font-bold uppercase ${active ? "text-volt-400/80" : "text-mist-500"}`}>
                    {WEEK_SHORT[i]}
                    {isToday && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-volt-400 align-middle tick-pulse" />}
                  </span>
                  <span className={`mt-1 block text-[10px] font-semibold tnum ${n > 0 ? "text-mist-400" : "text-night-500"}`}>
                    {n > 0 ? `${n} exercise${n > 1 ? "s" : ""}` : "rest"}
                  </span>
                </button>
              );
            })}
          </div>

          <SectionCard
            title={`${client.name} — Day ${day} · ${WEEK_DAYS[day - 1]}`}
            icon={<ClipboardList className="h-4.5 w-4.5" />}
            className="mt-4"
            delay={140}
            bodyCls="p-3"
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-volt-400 hover:text-volt-300"
                  onClick={() => void handleCopy(true)}
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
                <Dropdown
                  open={exportOpen}
                  onOpenChange={setExportOpen}
                  align="end"
                  label="Export workout plan"
                  trigger={
                    <button
                      onClick={() => setExportOpen((v) => !v)}
                      aria-haspopup="menu"
                      aria-expanded={exportOpen}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-warn-400 hover:text-warn-300"
                      title="Export the workout plan as PDF / image / print"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Export
                    </button>
                  }
                  items={[
                    { type: "item", label: "Week PDF (plan images)", hint: "7 pages", icon: FileText, onClick: () => void handleWeekPdf() },
                    { type: "item", label: "Day JPG image", hint: WEEK_SHORT[day - 1], icon: ImageIcon, onClick: () => void handleDayImage() },
                    { type: "divider" },
                    { type: "item", label: "Print week", icon: Printer, onClick: handlePrint },
                  ]}
                />
                <button className={`${btnPrimary} ${btnSm}`} onClick={() => { setEditing(null); setModalOpen(true); }}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.6} /> Add exercise
                </button>
              </div>
            }
          >
            {items.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title="Rest day — or a blank page"
                sub={`Nothing programmed for ${WEEK_DAYS[day - 1]}. Add exercises from the library, or leave it for recovery.`}
              >
                <button className={`${btnPrimary} mt-2`} onClick={() => { setEditing(null); setModalOpen(true); }}>
                  <Plus className="h-4 w-4" strokeWidth={2.4} /> Add exercise
                </button>
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {items.map((item, idx) => {
                  const ex = exOf(item.exerciseId);
                  return (
                    <li key={item.id} className="rise group flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3 transition-all duration-200 hover:border-night-500" style={{ animationDelay: `${idx * 50}ms` }}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-night-700 font-display text-lg font-bold text-volt-300">{idx + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-mist-100">{ex?.name ?? "Removed exercise"}</p>
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
                          {item.notes && <span className="italic text-mist-500">"{item.notes}"</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100">
                        {ex?.videoUrl && (
                          <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Watch video">
                            <Play className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100" title="Edit" onClick={() => { setEditing(item); setModalOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Remove" onClick={() => setDeleting(item)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      {client && <PlanItemFormModal open={modalOpen} clientId={client.id} day={day} initial={editing} onClose={() => setModalOpen(false)} />}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove from plan?"
        message={<>This exercise will be removed from Day {day}. The exercise itself stays in the library.</>}
        confirmLabel="Remove"
        onConfirm={() => deleting && deletePlanItem(deleting.id)}
      />
    </div>
  );
}

/* ================================================================
   Exercise Library
   ================================================================ */

export function LibraryView() {
  const { state, deleteExercise } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<Exercise | null>(null);
  const ready = useViewReady("library");

  const filtered = useMemo(
    () =>
      state.exercises
        .filter((e) => (cat === "All" ? true : e.category === cat))
        .filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.exercises, q, cat],
  );

  const usedIn = (id: string) => state.plans.filter((p) => p.exerciseId === id).length;

  if (!ready) return <LibrarySkeleton />;

  return (
    <div>
      <PageHeader
        title="Exercise"
        accent="library"
        sub={`${state.exercises.length} movements · shared across every plan`}
        action={
          <button className={`${btnPrimary} h-11`} onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" strokeWidth={2.6} /> Add exercise
          </button>
        }
      />

      <div className="rise mt-5 flex flex-wrap items-center gap-3" style={{ animationDelay: "80ms" }}>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input className={`${inputCls} ps-9`} placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["All", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${cat === c ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<LibraryIcon className="h-6 w-6" />} title={q ? `No matches for "${q}"` : "The library is empty"} sub={q ? "Try another search." : "Add your first movement to start building plans."}>
            {!q && (
              <button className={`${btnPrimary} mt-2`} onClick={() => { setEditing(null); setModalOpen(true); }}>
                <Plus className="h-4 w-4" strokeWidth={2.6} /> Add exercise
              </button>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ex, i) => (
            <div key={ex.id} className="rise card-lift group rounded-2xl border border-night-700 bg-night-850 p-4" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <Badge className={CAT_META[ex.category].chip}>
                  <span className={`h-1.5 w-1.5 rounded-full ${CAT_META[ex.category].dot}`} />
                  {ex.category}
                </Badge>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100" title="Edit" onClick={() => { setEditing(ex); setModalOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={() => setDeleting(ex)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 font-display text-2xl font-bold uppercase leading-6 text-mist-100">{ex.name}</p>
              {ex.description && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-mist-400">{ex.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-mist-500 tnum">used in {usedIn(ex.id)} plan item{usedIn(ex.id) === 1 ? "" : "s"}</span>
                {ex.videoUrl && (
                  <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-night-700 px-2.5 py-1.5 text-[11px] font-bold text-volt-300 transition hover:bg-night-600">
                    <Play className="h-3 w-3" /> Video
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ExerciseFormModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete exercise?"
        message={
          <>
            <strong className="text-mist-100">{deleting?.name}</strong> will be removed from the library and from{" "}
            {deleting ? usedIn(deleting.id) : 0} plan item(s).
          </>
        }
        onConfirm={() => deleting && deleteExercise(deleting.id)}
      />
    </div>
  );
}

/* ================================================================
   Check-ins feed
   ================================================================ */

export function CheckInsView({ go }: { go?: (v: CoachView, id?: string) => void }) {
  const { state, deleteCheckIn } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const [photo, setPhoto] = useState<string | null>(null);
  const [detail, setDetail] = useState<CheckIn | null>(null);
  const [deleting, setDeleting] = useState<CheckIn | null>(null);
  const ready = useViewReady("checkins");

  const nameOf = (id: string) => state.clients.find((c) => c.id === id);

  const sorted = useMemo(
    () =>
      [...state.checkIns]
        .filter((c) => filter === "all" || c.clientId === filter)
        .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [state.checkIns, filter],
  );

  const deltaFor = (clientId: string, id: string, weight: number) => {
    const mine = state.checkIns.filter((x) => x.clientId === clientId).sort((a, b) => a.date.localeCompare(a.date) || a.ts - b.ts);
    const idx = mine.findIndex((x) => x.id === id);
    return idx > 0 ? weight - mine[idx - 1].weight : null;
  };

  if (!ready) return <CheckInsSkeleton />;

  return (
    <div>
      <PageHeader title="Client" accent="check-ins" sub={`${state.checkIns.length} logged in total — weight, mood, water and workout completion`} />

      <div className="rise mt-5 flex flex-wrap gap-1.5" style={{ animationDelay: "80ms" }}>
        <button
          onClick={() => setFilter("all")}
          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${filter === "all" ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"}`}
        >
          All clients
        </button>
        {state.clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-full py-1 pe-3.5 ps-1 text-xs font-bold transition ${
              filter === c.id ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"
            }`}
          >
            <Avatar name={c.name} photo={c.photo} className="h-6 w-6 text-[9px]" />
            {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <SectionCard title={`Log (${sorted.length})`} icon={<Camera className="h-4.5 w-4.5" />} className="mt-4" delay={140} bodyCls="p-3">
        {sorted.length === 0 ? (
          <EmptyState icon={<Camera className="h-6 w-6" />} title="Nothing here yet" sub="When clients submit daily check-ins, the full feed appears here." />
        ) : (
          <ul className="grid gap-2">
            {sorted.map((ci, i) => {
              const c = nameOf(ci.clientId);
              const delta = deltaFor(ci.clientId, ci.id, ci.weight);
              return (
                <li key={ci.id} className="rise group flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3 transition-all duration-200 hover:border-night-500" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <Avatar name={c?.name ?? "?"} photo={c?.photo} className="h-10 w-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-mist-100">
                      <button className="cursor-pointer transition-all duration-200 hover:text-volt-300" onClick={() => go?.("client", ci.clientId)}>
                        {c?.name ?? "Former client"}
                      </button>
                      <span className="ms-2 text-[11px] font-semibold text-mist-500">{relDay(ci.date)}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-mist-400">
                      <span className="tnum text-mist-200">
                        {ci.weight} kg
                        {delta !== null && <span className={`ms-1.5 ${delta <= 0 ? "text-moss-300" : "text-warn-300"}`}>({signed(delta)})</span>}
                      </span>
                      {ci.waist !== undefined && <span className="tnum">waist {ci.waist} cm</span>}
                      <MoodDots mood={ci.mood} />
                      <span>{ci.water}L water</span>
                    </div>
                    {ci.notes && <p className="mt-1 truncate text-[11px] italic text-mist-500">"{ci.notes}"</p>}
                  </div>
                  {ci.photo && (
                    <button onClick={() => setPhoto(ci.photo ?? null)} className="shrink-0 cursor-zoom-in" aria-label="View photo">
                      <img src={ci.photo} alt={`Check-in progress photo from ${ci.date}`} loading="lazy" className="h-12 w-12 rounded-xl object-cover ring-1 ring-night-600 transition hover:ring-volt-400" />
                    </button>
                  )}
                  <Badge className={ci.workoutDone ? "border-moss-400/25 bg-moss-400/10 text-moss-300" : "border-danger-500/25 bg-danger-500/10 text-danger-300"}>
                    {ci.workoutDone ? <Check className="h-3 w-3" strokeWidth={2.6} /> : <X className="h-3 w-3" strokeWidth={2.6} />}
                    {ci.workoutDone ? "Done" : "Skipped"}
                  </Badge>
                  <button className={`${btnSecondary} ${btnSm} opacity-0 transition group-hover:opacity-100`} onClick={() => setDetail(ci)}>
                    View
                  </button>
                  <button className="cursor-pointer text-mist-500 opacity-0 transition hover:text-danger-300 group-hover:opacity-100" onClick={() => setDeleting(ci)} aria-label="Delete check-in">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Check-in · ${fmtDate(detail.date)}`} description={nameOf(detail.clientId)?.name ?? "Former client"}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="Weight" value={`${detail.weight} kg`} />
            <MiniStat label="Waist" value={detail.waist !== undefined ? `${detail.waist} cm` : "—"} />
            <MiniStat label="Water" value={`${detail.water} L`} />
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Mood</p>
              <div className="mt-2"><MoodDots mood={detail.mood} /></div>
            </div>
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Workout</p>
              <p className={`mt-1 font-display text-lg font-bold ${detail.workoutDone ? "text-moss-300" : "text-danger-300"}`}>{detail.workoutDone ? "Completed" : "Skipped"}</p>
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
                <img src={detail.photo} alt="Check-in progress photo detail" loading="lazy" className="h-32 rounded-xl object-cover ring-1 ring-night-600 transition hover:ring-volt-400" />
              </button>
            </div>
          )}
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
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-800 p-3">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-mist-100 tnum">{value}</p>
    </div>
  );
}
