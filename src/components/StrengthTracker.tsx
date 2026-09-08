/* ================================================================
   VERRAA — strength tracker (client mode).
   One top weight per exercise per session (kg + reps + sets).
   Last weight + all-time max (PR) are derived from workoutEntries.
   ================================================================ */

import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import {
  Check,
  ChevronDown,
  Dumbbell,
  History,
  Medal,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import type { ExerciseCategory, PlanItem, WorkoutEntry } from "../types";
import { CATEGORIES, CAT_META, workoutExerciseKey } from "../types";
import { dayNum, fmtDate, relDay, todayISO, uid } from "../lib";
import { useApp } from "../store";
import { Badge, ConfirmModal, EmptyState, Modal, SectionCard, btnPrimary, btnSecondary, btnDanger, btnVolt, inputCls, labelCls } from "./ui";

/* ---------------- draft types ---------------- */

interface DraftRow {
  key: string;
  exerciseId?: string;
  clientExerciseId?: string;
  name: string;
  category?: ExerciseCategory;
  weight: string;
  reps: string;
  sets: string;
}

function firePRConfetti() {
  try {
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.3 }, colors: ["#CDF14B", "#ffffff", "#FFC53D"] });
    window.setTimeout(() => {
      try {
        confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.5 } });
        confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.5 } });
      } catch {
        /* non-fatal */
      }
    }, 350);
  } catch {
    /* confetti unavailable — non-fatal */
  }
}

/* ================================================================
   Main component
   ================================================================ */

export function StrengthTracker({ clientId }: { clientId: string }) {
  const { state, addClientExercise, deleteClientExercise, logWorkoutSession, updateWorkoutEntry, deleteWorkoutEntry, deleteWorkoutSession } = useApp();

  const [workoutName, setWorkoutName] = useState("");
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[] | null>(null); // null = home view
  const [exerciseModal, setExerciseModal] = useState(false);
  const [exerciseTargetRow, setExerciseTargetRow] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<{ name: string; prs: string[]; count: number } | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<WorkoutEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<{ id: string; weight: string; reps: string; sets: string } | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const active = rows !== null;

  /* ----- scoped data ----- */
  const myEntries = useMemo(() => state.workoutEntries.filter((e) => e.clientId === clientId), [state.workoutEntries, clientId]);
  const mySessions = useMemo(
    () => state.workoutSessions.filter((s) => s.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [state.workoutSessions, clientId],
  );
  const myCustom = useMemo(() => state.clientExercises.filter((e) => e.clientId === clientId), [state.clientExercises, clientId]);
  const todayPlan: PlanItem[] = useMemo(() => state.plans.filter((p) => p.clientId === clientId && p.day === dayNum()), [state.plans, clientId]);

  const exNameOf = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? "Exercise";
  const exCatOf = (id: string) => state.exercises.find((e) => e.id === id)?.category;

  /* ----- history maps: key -> { last, max } ----- */
  const history = useMemo(() => {
    const map = new Map<string, { last: WorkoutEntry; max: number; count: number }>();
    const asc = [...myEntries].sort((a, b) => a.createdAt - b.createdAt);
    for (const e of asc) {
      const k = workoutExerciseKey(e);
      const cur = map.get(k);
      map.set(k, { last: e, max: Math.max(cur?.max ?? -Infinity, e.weight), count: (cur?.count ?? 0) + 1 });
    }
    return map;
  }, [myEntries]);

  const prCount = useMemo(() => myEntries.filter((e) => e.isPR).length, [myEntries]);

  /* ----- combined exercise options (library + custom) ----- */
  const options = useMemo(() => {
    const lib = state.exercises.map((e) => ({ id: `lib:${e.id}`, label: e.name, category: e.category, exerciseId: e.id as string | undefined, clientExerciseId: undefined as string | undefined }));
    const custom = myCustom.map((e) => ({ id: `custom:${e.id}`, label: `${e.name} (mine)`, category: e.category, exerciseId: undefined as string | undefined, clientExerciseId: e.id as string | undefined }));
    return [...lib, ...custom];
  }, [state.exercises, myCustom]);

  const hintFor = (r: DraftRow): string | null => {
    const h = history.get(workoutExerciseKey({ exerciseId: r.exerciseId, clientExerciseId: r.clientExerciseId, exerciseName: r.name }));
    if (!h) return null;
    return `Last: ${h.last.weight}kg × ${h.last.reps}`;
  };
  const isPRRow = (r: DraftRow): boolean => {
    const w = Number(r.weight);
    if (!w || w <= 0) return false;
    const h = history.get(workoutExerciseKey({ exerciseId: r.exerciseId, clientExerciseId: r.clientExerciseId, exerciseName: r.name }));
    return !!h && w > h.max;
  };

  /* ----- starters ----- */
  const startBlank = () => {
    setWorkoutName("");
    setWorkoutNotes("");
    setRows([{ key: uid(), name: "", weight: "", reps: "8", sets: "3" }]);
    window.scrollTo(0, 0);
  };

  const startFromPlan = () => {
    setWorkoutName("Today's plan");
    setWorkoutNotes("");
    setRows(
      todayPlan.map((p) => ({
        key: uid(),
        exerciseId: p.exerciseId,
        name: exNameOf(p.exerciseId),
        category: exCatOf(p.exerciseId),
        weight: "",
        reps: String(p.reps || 8),
        sets: String(p.sets || 3),
      })),
    );
    window.scrollTo(0, 0);
  };

  /* ----- active workout mutations ----- */
  const patchRow = (key: string, patch: Partial<DraftRow>) => setRows((rs) => (rs ?? []).map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const pickExercise = (key: string, optId: string) => {
    // "Add new" lives INSIDE the dropdown — creates a saved custom exercise
    // and attaches it straight to this row.
    if (optId === "__new__") {
      setExerciseTargetRow(key);
      setExerciseModal(true);
      return;
    }
    const opt = options.find((o) => o.id === optId);
    if (!opt) return;
    patchRow(key, { exerciseId: opt.exerciseId, clientExerciseId: opt.clientExerciseId, name: opt.label.replace(/ \(mine\)$/, ""), category: opt.category });
  };

  const addRow = () => setRows((rs) => [...(rs ?? []), { key: uid(), name: "", weight: "", reps: "8", sets: "3" }]);
  const removeRow = (key: string) => setRows((rs) => (rs ?? []).filter((r) => r.key !== key));

  const filledCount = (rows ?? []).filter((r) => r.name.trim() && Number(r.weight) > 0).length;

  const finishWorkout = () => {
    if (!rows) return;
    const result = logWorkoutSession({
      name: workoutName || "Workout",
      notes: workoutNotes || undefined,
      date: todayISO(),
      clientId,
      entries: rows
        .filter((r) => r.name.trim() && Number(r.weight) > 0)
        .map((r) => ({
          exerciseId: r.exerciseId,
          clientExerciseId: r.clientExerciseId,
          exerciseName: r.name,
          category: r.category,
          weight: Number(r.weight),
          reps: Math.max(1, Math.floor(Number(r.reps) || 8)),
          sets: Math.max(1, Math.floor(Number(r.sets) || 3)),
        })),
    });
    if (!result) return;
    // The store update is optimistic but async — recompute PR names locally
    // from the draft against pre-save history instead.
    const prs = rows
      .filter((r) => {
        const w = Number(r.weight);
        if (!w || w <= 0 || !r.name.trim()) return false;
        const h = history.get(workoutExerciseKey({ exerciseId: r.exerciseId, clientExerciseId: r.clientExerciseId, exerciseName: r.name }));
        return !!h && w > h.max;
      })
      .map((r) => `${r.name} · ${Number(r.weight)}kg`);
    if (result.prCount > 0) firePRConfetti();
    setSummary({ name: workoutName || "Workout", prs, count: rows.filter((r) => r.name.trim() && Number(r.weight) > 0).length });
    setRows(null);
    setWorkoutName("");
    setWorkoutNotes("");
    setHistoryOpen(true);
    window.scrollTo(0, 0);
  };

  /* ----- overview list (last weights) ----- */
  const overview = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const seen = new Map<string, { name: string; category?: ExerciseCategory; last: WorkoutEntry; max: number; count: number }>();
    // Seed from history (logged exercises)
    for (const [k, h] of history) {
      seen.set(k, { name: h.last.exerciseName, category: h.last.category, last: h.last, max: h.max, count: h.count });
    }
    // Seed today's plan exercises even without history (show "no log yet")
    for (const p of todayPlan) {
      const k = `lib:${p.exerciseId}`;
      if (!seen.has(k)) {
        seen.set(k, { name: exNameOf(p.exerciseId), category: exCatOf(p.exerciseId), last: null as unknown as WorkoutEntry, max: -Infinity, count: 0 });
      }
    }
    const list = [...seen.values()];
    return needle ? list.filter((x) => x.name.toLowerCase().includes(needle)) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, search, todayPlan, state.exercises]);

  /* ================================================================
     Render
     ================================================================ */

  if (active) {
    return (
      <div className="grid gap-3 sm:gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 sm:text-[11px]">Logging workout</p>
            <input
              className="mt-1.5 w-full bg-transparent font-display text-[26px] font-bold uppercase leading-none text-mist-100 outline-none placeholder:text-mist-600 sm:text-[34px]"
              placeholder="Workout name"
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
                <Dumbbell className="h-3.5 w-3.5 text-volt-300" />
                {filledCount} / {rows?.length ?? 0} logged
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          {rows?.map((r, i) => {
            const hint = hintFor(r);
            const pr = isPRRow(r);
            return (
              <div key={r.key} className={`rounded-xl border bg-night-850 p-3 transition sm:p-4 ${pr ? "border-volt-400/60 shadow-[0_0_18px_-6px_rgba(205,241,75,0.5)]" : "border-night-700"}`}>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-night-700 font-display text-base font-bold text-volt-300">{i + 1}</span>
                  <select
                    aria-label={`Exercise ${i + 1}`}
                    className="h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-3 text-sm font-bold text-mist-100 outline-none transition focus:border-volt-400"
                    value={r.exerciseId ? `lib:${r.exerciseId}` : r.clientExerciseId ? `custom:${r.clientExerciseId}` : ""}
                    onChange={(e) => pickExercise(r.key, e.target.value)}
                  >
                    <option value="">Choose exercise…</option>
                    <option value="__new__">＋ Add new exercise…</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {(rows?.length ?? 0) > 1 && (
                    <button onClick={() => removeRow(r.key)} aria-label="Remove exercise" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-night-600 text-mist-500 transition hover:border-danger-500/40 hover:text-danger-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {!r.name && (
                  <button onClick={() => setExerciseModal(true)} className="mt-2 cursor-pointer text-xs font-bold text-volt-300 hover:text-volt-200">
                    + New custom exercise
                  </button>
                )}
                {r.name && (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {hint ? (
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-mist-300 tnum">{hint}</span>
                      ) : (
                        <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-mist-500">First time — set the baseline</span>
                      )}
                      {pr && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-volt-400 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-night-950">
                          <Trophy className="h-3 w-3" /> New PR
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-mist-500">kg *</label>
                        <input type="number" min="0" step="0.5" inputMode="decimal" placeholder="60" value={r.weight} onChange={(e) => patchRow(r.key, { weight: e.target.value })}
                          className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3 text-center font-display text-lg font-bold text-mist-100 outline-none transition focus:border-volt-400 tnum" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-mist-500">reps</label>
                        <input type="number" min="1" step="1" inputMode="numeric" value={r.reps} onChange={(e) => patchRow(r.key, { reps: e.target.value })}
                          className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3 text-center font-display text-lg font-bold text-mist-100 outline-none transition focus:border-volt-400 tnum" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-mist-500">sets</label>
                        <input type="number" min="1" step="1" inputMode="numeric" value={r.sets} onChange={(e) => patchRow(r.key, { sets: e.target.value })}
                          className="h-12 w-full rounded-xl border border-night-600 bg-night-800 px-3 text-center font-display text-lg font-bold text-mist-100 outline-none transition focus:border-volt-400 tnum" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={addRow} className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-night-500 text-sm font-bold text-mist-300 transition hover:border-volt-400/50 hover:text-volt-300">
          <Plus className="h-4 w-4" /> Add exercise
        </button>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-mist-400">Session notes (optional)</label>
          <input className={`${inputCls} h-11`} placeholder="Energy, sleep, felt strong…" value={workoutNotes} onChange={(e) => setWorkoutNotes(e.target.value)} />
        </div>

        <div className="sticky bottom-[92px] z-10 grid gap-2 lg:static">
          <button onClick={finishWorkout} disabled={filledCount === 0} className={`${btnPrimary} h-12 w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-40`}>
            <Check className="h-5 w-5" strokeWidth={2.4} /> Finish workout · {filledCount} exercise{filledCount === 1 ? "" : "s"}
          </button>
          <div className="flex gap-2">
            <button onClick={() => setRows(null)} className={`${btnSecondary} h-11 flex-1 text-[13px]`}>
              <X className="h-4 w-4" /> Discard
            </button>
          </div>
        </div>

        <ExerciseModal open={exerciseModal} onClose={() => { setExerciseModal(false); setExerciseTargetRow(null); }} clientId={clientId} onCreated={(id, name, category) => {
          setExerciseModal(false);
          const target = exerciseTargetRow;
          setExerciseTargetRow(null);
          // The exercise is already saved (client_exercises) so it stays in
          // "Choose exercise…" for every future session. Attach it to the row
          // the user came from, else the first empty row, else append.
          setRows((rs) => {
            const list = rs ?? [];
            const filled = (key: string): DraftRow => ({ key, clientExerciseId: id, name, category, weight: "", reps: "8", sets: "3" });
            if (target && list.some((r) => r.key === target)) return list.map((r) => (r.key === target ? filled(r.key) : r));
            const emptyIdx = list.findIndex((r) => !r.name);
            if (emptyIdx >= 0) return list.map((r, i) => (i === emptyIdx ? filled(r.key) : r));
            return [...list, filled(uid())];
          });
        }} />
      </div>
    );
  }

  /* ----- home view ----- */
  return (
    <div className="grid gap-3 sm:gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 sm:text-[11px]">Strength tracker</p>
          <h1 className="mt-1 font-display text-[30px] font-bold uppercase leading-[0.95] text-mist-100 sm:text-[44px]">
            Lift <span className="text-volt-400">heavier</span>
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <History className="h-3.5 w-3.5 text-sky-300" /> {mySessions.length} workout{mySessions.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <Trophy className="h-3.5 w-3.5 text-volt-300" /> {prCount} PR{prCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className={`mt-4 grid gap-2 ${todayPlan.length > 0 ? "sm:grid-cols-2" : ""}`}>
            <button onClick={startBlank} className={`${btnPrimary} h-12 text-[15px]`}>
              <Play className="h-5 w-5" /> Start workout
            </button>
            {todayPlan.length > 0 && (
              <button onClick={startFromPlan} className={`${btnSecondary} h-12 text-sm`}>
                <Dumbbell className="h-4 w-4 text-volt-300" /> From today's plan · {todayPlan.length}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* last weights */}
      <SectionCard title="My lifts" icon={<TrendingUp className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3"
        action={
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-mist-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" aria-label="Search lifts"
              className="h-9 w-32 rounded-lg border border-night-600 bg-night-800 ps-8 pe-2 text-xs font-semibold text-mist-100 outline-none transition focus:border-volt-400 sm:w-40" />
          </div>
        }
      >
        {overview.length === 0 ? (
          <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="No lifts yet" sub="Start your first workout above — every exercise will remember its last weight here." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {overview.map((x) => (
              <li key={x.last ? x.last.id : x.name} className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 p-3">
                <span className="grid h-11 min-w-11 shrink-0 place-items-center rounded-xl bg-night-700 px-2 font-display text-base font-bold text-volt-300 tnum">
                  {x.count > 0 ? x.last.weight : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-mist-100">{x.name}</p>
                  {x.count > 0 ? (
                    <p className="mt-0.5 text-[11px] font-semibold text-mist-500 tnum">
                      last {x.last.weight}kg × {x.last.reps} · {relDay(x.last ? sessionDateOf(x.last.sessionId, mySessions) : todayISO())} · best {x.max}kg
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] font-semibold text-mist-500">in today's plan — not logged yet</p>
                  )}
                </div>
                {x.count > 0 && x.last.isPR && <Medal className="h-4 w-4 shrink-0 text-volt-300" aria-label="Personal record" />}
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => setExerciseModal(true)} className="mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-night-500 text-[13px] font-bold text-mist-300 transition hover:border-volt-400/50 hover:text-volt-300">
          <Plus className="h-4 w-4" /> New custom exercise
        </button>
        {myCustom.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {myCustom.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-night-600 bg-night-800 py-1 pe-1.5 ps-3 text-[11px] font-bold text-mist-300">
                {c.name}
                <button onClick={() => deleteClientExercise(c.id)} aria-label={`Delete ${c.name}`} className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-mist-500 transition hover:bg-danger-500/15 hover:text-danger-300">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* history */}
      <SectionCard title={`History · ${mySessions.length}`} icon={<History className="h-4.5 w-4.5" />} bodyCls="p-2.5 sm:p-3"
        action={mySessions.length > 0 ? <button onClick={() => setHistoryOpen(!historyOpen)} className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-volt-300 hover:text-volt-200">{historyOpen ? "Hide" : "Show"}</button> : undefined}
      >
        {mySessions.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No workouts logged" sub="Your finished workouts will live here with every weight." />
        ) : historyOpen ? (
          <ul className="grid gap-2">
            {mySessions.map((s) => {
              const entries = myEntries.filter((e) => e.sessionId === s.id);
              const expanded = expandedSession === s.id;
              const prs = entries.filter((e) => e.isPR);
              return (
                <li key={s.id} className="overflow-hidden rounded-xl border border-night-700 bg-night-800">
                  <button onClick={() => setExpandedSession(expanded ? null : s.id)} className="flex w-full cursor-pointer items-center gap-3 p-3 text-start">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-night-700 text-volt-300">
                      <Dumbbell className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-mist-100">{s.name}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-mist-500">
                        {fmtDate(s.date)} · {entries.length} exercise{entries.length === 1 ? "" : "s"}
                        {prs.length > 0 && <span className="ms-1.5 font-extrabold text-volt-300">· {prs.length} PR{prs.length === 1 ? "" : "s"}</span>}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mist-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                  {expanded && (
                    <div className="border-t border-night-700 p-2.5">
                      <ul className="grid gap-1.5">
                        {entries.map((e) => (
                          <li key={e.id} className="rounded-lg bg-night-850 p-2.5">
                            {editingEntry?.id === e.id ? (
                              <div className="grid grid-cols-3 gap-1.5">
                                <div>
                                  <label className="mb-0.5 block text-[10px] font-bold uppercase text-mist-500">kg</label>
                                  <input type="number" min="0" step="0.5" inputMode="decimal" value={editingEntry.weight} onChange={(ev) => setEditingEntry({ ...editingEntry, weight: ev.target.value })}
                                    className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-2 text-center text-sm font-bold text-mist-100 outline-none focus:border-volt-400 tnum" />
                                </div>
                                <div>
                                  <label className="mb-0.5 block text-[10px] font-bold uppercase text-mist-500">reps</label>
                                  <input type="number" min="1" inputMode="numeric" value={editingEntry.reps} onChange={(ev) => setEditingEntry({ ...editingEntry, reps: ev.target.value })}
                                    className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-2 text-center text-sm font-bold text-mist-100 outline-none focus:border-volt-400 tnum" />
                                </div>
                                <div>
                                  <label className="mb-0.5 block text-[10px] font-bold uppercase text-mist-500">sets</label>
                                  <input type="number" min="1" inputMode="numeric" value={editingEntry.sets} onChange={(ev) => setEditingEntry({ ...editingEntry, sets: ev.target.value })}
                                    className="h-10 w-full rounded-lg border border-night-600 bg-night-800 px-2 text-center text-sm font-bold text-mist-100 outline-none focus:border-volt-400 tnum" />
                                </div>
                                <div className="col-span-3 mt-1 flex gap-1.5">
                                  <button
                                    onClick={() => {
                                      const w = Number(editingEntry.weight);
                                      if (!w || w <= 0) return;
                                      updateWorkoutEntry({ ...e, weight: Math.round(w * 10) / 10, reps: Math.max(1, Math.floor(Number(editingEntry.reps) || e.reps)), sets: Math.max(1, Math.floor(Number(editingEntry.sets) || e.sets)) });
                                      setEditingEntry(null);
                                    }}
                                    className={`${btnVolt} h-9 flex-1 !text-xs`}
                                  >
                                    <Check className="h-3.5 w-3.5" /> Save
                                  </button>
                                  <button onClick={() => setEditingEntry(null)} className={`${btnSecondary} h-9 !text-xs`}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5">
                                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-mist-100">{e.exerciseName}</span>
                                {e.isPR && (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-volt-400/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-volt-300">
                                    <Trophy className="h-2.5 w-2.5" /> PR
                                  </span>
                                )}
                                <span className="shrink-0 font-display text-sm font-bold text-mist-200 tnum">{e.weight}kg × {e.reps}{e.sets > 1 ? ` × ${e.sets}` : ""}</span>
                                <button onClick={() => setEditingEntry({ id: e.id, weight: String(e.weight), reps: String(e.reps), sets: String(e.sets) })} aria-label={`Edit ${e.exerciseName}`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-night-700 hover:text-mist-100">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => setConfirmDeleteEntry(e)} aria-label={`Delete ${e.exerciseName}`} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-danger-500/15 hover:text-danger-300">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                      <button onClick={() => setConfirmDeleteSession(s.id)} className={`${btnDanger} mt-2 h-9 w-full !text-xs`}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete workout
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </SectionCard>

      <ExerciseModal open={exerciseModal} onClose={() => setExerciseModal(false)} clientId={clientId} onCreated={() => setExerciseModal(false)} />

      <ConfirmModal open={!!confirmDeleteSession} onClose={() => setConfirmDeleteSession(null)} title="Delete workout?"
        message="This workout and all its logged weights will be removed." confirmLabel="Delete"
        onConfirm={() => confirmDeleteSession && deleteWorkoutSession(confirmDeleteSession)} />
      <ConfirmModal open={!!confirmDeleteEntry} onClose={() => setConfirmDeleteEntry(null)} title="Delete entry?"
        message={<><strong className="text-mist-100">{confirmDeleteEntry?.exerciseName}</strong> will be removed from this workout.</>} confirmLabel="Delete"
        onConfirm={() => confirmDeleteEntry && deleteWorkoutEntry(confirmDeleteEntry.id)} />

      {/* post-workout summary */}
      <Modal open={!!summary} onClose={() => setSummary(null)} title={summary ? `${summary.name} — saved` : "Saved"}>
        <div className="text-center">
          {summary && summary.prs.length > 0 ? (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_10px_32px_-10px_rgba(205,241,75,0.6)]">
                <Trophy className="h-8 w-8" strokeWidth={2.2} />
              </span>
              <p className="mt-3 font-display text-2xl font-bold uppercase text-mist-100">
                {summary.prs.length} new PR{summary.prs.length === 1 ? "" : "s"}
              </p>
              <ul className="mx-auto mt-3 grid max-w-xs gap-1.5">
                {summary.prs.map((p) => (
                  <li key={p} className="rounded-xl border border-volt-400/30 bg-volt-400/10 px-3 py-2 text-sm font-bold text-volt-200 tnum">{p}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-night-700 text-volt-300">
                <Check className="h-8 w-8" strokeWidth={2.4} />
              </span>
              <p className="mt-3 font-display text-2xl font-bold uppercase text-mist-100">Workout saved</p>
              <p className="mt-1 text-[13px] text-mist-400">{summary?.count ?? 0} exercises logged. Keep pushing — the next PR is close.</p>
            </>
          )}
          <button onClick={() => setSummary(null)} className={`${btnPrimary} mt-4 h-11 w-full`}>Done</button>
        </div>
      </Modal>
    </div>
  );
}

function sessionDateOf(sessionId: string, sessions: { id: string; date: string }[]): string {
  return sessions.find((s) => s.id === sessionId)?.date ?? todayISO();
}

/* ---------------- custom exercise modal ---------------- */

export function ExerciseModal({ open, onClose, clientId, onCreated }: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onCreated: (id: string, name: string, category: ExerciseCategory) => void;
}) {
  const { addClientExercise } = useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("Chest");
  const [notes, setNotes] = useState("");

  const submit = () => {
    const ex = addClientExercise({ name, category, notes, clientId });
    if (ex) {
      onCreated(ex.id, ex.name, ex.category);
      setName("");
      setNotes("");
      setCategory("Chest");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New custom exercise" description="Only you see it — it lives next to your coach's library.">
      <label className={labelCls}>Name *</label>
      <input className={`${inputCls} mt-1.5`} placeholder="e.g. Cable Fly" value={name} onChange={(e) => setName(e.target.value)} />
      <label className={`${labelCls} mt-3 block`}>Muscle group</label>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} aria-pressed={category === c}
            className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${category === c ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"}`}>
            {c}
          </button>
        ))}
      </div>
      <label className={`${labelCls} mt-3 block`}>Notes (optional)</label>
      <input className={`${inputCls} mt-1.5`} placeholder="Machine, grip, cues…" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="mt-4 flex gap-2">
        <button onClick={submit} disabled={!name.trim()} className={`${btnVolt} h-11 flex-1 disabled:opacity-40`}><Plus className="h-4 w-4" /> Add exercise</button>
        <button onClick={onClose} className={`${btnSecondary} h-11`}>Cancel</button>
      </div>
    </Modal>
  );
}

/* ---------------- coach read-only strength view ----------------
   Drop-in section for the coach's ClientProfile. */

export function CoachStrengthView({ clientId }: { clientId: string }) {
  const { state } = useApp();
  const entries = useMemo(() => state.workoutEntries.filter((e) => e.clientId === clientId), [state.workoutEntries, clientId]);
  const sessions = useMemo(
    () => state.workoutSessions.filter((s) => s.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [state.workoutSessions, clientId],
  );

  const rows = useMemo(() => {
    const map = new Map<string, { name: string; category?: ExerciseCategory; last: WorkoutEntry; max: number; count: number }>();
    for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) {
      const k = workoutExerciseKey(e);
      const cur = map.get(k);
      map.set(k, { name: e.exerciseName, category: e.category, last: e, max: Math.max(cur?.max ?? -Infinity, e.weight), count: (cur?.count ?? 0) + 1 });
    }
    return [...map.values()].sort((a, b) => b.last.createdAt - a.last.createdAt);
  }, [entries]);

  const prs = entries.filter((e) => e.isPR).length;

  return (
    <SectionCard
      title={`Strength · ${sessions.length} workout${sessions.length === 1 ? "" : "s"} · ${prs} PR${prs === 1 ? "" : "s"}`}
      icon={<Dumbbell className="h-4.5 w-4.5" />}
      bodyCls="p-3"
      description={sessions.length > 0 ? `Last session ${fmtDate(sessions[0].date)}` : undefined}
    >
      {rows.length === 0 ? (
        <div className="grid place-items-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-5 text-center">
          <span className="icon-tile h-9 w-9" aria-hidden="true">
            <Dumbbell className="h-4 w-4" />
          </span>
          <p className="mt-1 text-[13px] font-bold text-mist-200">No strength logs yet</p>
          <p className="max-w-[220px] text-xs leading-5 text-mist-500">Last weights and PRs appear here once logged.</p>
        </div>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={`${r.name}-${r.last.id}`} className="flex items-center gap-2.5 rounded-xl border border-night-700 bg-night-800 px-2.5 py-2">
              <span className="grid h-9 min-w-10 shrink-0 place-items-center rounded-lg bg-night-700 px-1.5 font-display text-sm font-bold text-volt-300 tnum">{r.last.weight}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-[13px] font-bold text-mist-100">{r.name}</p>
                  {r.category && (
                    <Badge className={CAT_META[r.category].chip}>
                      <span className={`h-1.5 w-1.5 rounded-full ${CAT_META[r.category].dot}`} />
                      {r.category}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-mist-500 tnum">
                  last {r.last.weight}kg × {r.last.reps} · best {r.max}kg · {r.count} log{r.count === 1 ? "" : "s"}
                </p>
              </div>
              {r.last.isPR && <Trophy className="h-3.5 w-3.5 shrink-0 text-volt-300" aria-label="Personal record" />}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
