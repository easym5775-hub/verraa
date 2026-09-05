import { useEffect, useState } from "react";
import type { Meal, MealType } from "../types";
import { MEAL_META, MEAL_TYPES } from "../types";
import { useApp } from "../store";
import { Badge, ConfirmModal, EmptyState, SectionCard, inputCls, labelCls } from "./ui";
import { MealFormModal } from "./modals";
import { IconFlame, IconPencil, IconPlus, IconTrash, IconUtensils } from "../icons";

/**
 * Nutrition / Meals management (Coach Mode).
 * Meal *assignments* live here; the per-client nutrition *targets*
 * (calories / macros / water) are edited from the Client Profile.
 */
export function MealsView({ presetClientId }: { presetClientId: string | null }) {
  const { state, deleteMeal } = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? state.clients[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [defaultType, setDefaultType] = useState<MealType>("Breakfast");
  const [deleting, setDeleting] = useState<Meal | null>(null);

  useEffect(() => {
    if (presetClientId) setClientId(presetClientId);
  }, [presetClientId]);

  useEffect(() => {
    if (!clientId && state.clients.length) setClientId(state.clients[0].id);
  }, [clientId, state.clients]);

  const client = state.clients.find((c) => c.id === clientId);
  const meals = state.meals.filter((m) => m.clientId === clientId);
  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
  const kcalFrom = {
    protein: totals.protein * 4,
    carbs: totals.carbs * 4,
    fats: totals.fats * 9,
  };
  const kcalSum = kcalFrom.protein + kcalFrom.carbs + kcalFrom.fats;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            Meal <span className="text-volt-400">plans</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">Daily meals assigned per client — targets are set in the Client Profile</p>
        </div>
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
      </header>

      {!client ? (
        <div className="mt-6">
          <EmptyState icon={<IconUtensils className="h-6 w-6" />} title="No clients yet" sub="Add a client first, then assign their meals." />
        </div>
      ) : (
        <>
          {/* daily summary */}
          <div className="rise mt-6 rounded-xl border border-night-700 bg-night-850 p-5" style={{ animationDelay: "80ms" }}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-warn-400/15 text-warn-300">
                  <IconFlame className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-display text-[30px] font-bold leading-7 text-mist-100">
                    {totals.calories.toLocaleString("en-US")}
                    <span className="ms-1.5 text-sm font-semibold text-mist-500">kcal / day</span>
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-mist-500">{client.name}'s assigned meals</p>
                </div>
              </div>
              <div className="flex gap-5">
                {(
                  [
                    ["Protein", totals.protein, "text-volt-300"],
                    ["Carbs", totals.carbs, "text-sky-300"],
                    ["Fats", totals.fats, "text-warn-300"],
                  ] as const
                ).map(([label, v, tone]) => (
                  <div key={label} className="text-center">
                    <p className={`font-display text-2xl font-bold ${tone}`}>{v}g</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            {kcalSum > 0 && (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-night-700">
                  <div className="bar-grow h-full bg-volt-400" style={{ width: `${(kcalFrom.protein / kcalSum) * 100}%`, animationDelay: "100ms" }} title={`Protein ${kcalFrom.protein} kcal`} />
                  <div className="bar-grow h-full bg-sky-400" style={{ width: `${(kcalFrom.carbs / kcalSum) * 100}%`, animationDelay: "200ms" }} title={`Carbs ${kcalFrom.carbs} kcal`} />
                  <div className="bar-grow h-full bg-warn-400" style={{ width: `${(kcalFrom.fats / kcalSum) * 100}%`, animationDelay: "300ms" }} title={`Fats ${kcalFrom.fats} kcal`} />
                </div>
                <div className="mt-2 flex gap-4 text-[10.5px] font-bold text-mist-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-volt-400" />Protein {Math.round((kcalFrom.protein / kcalSum) * 100)}%</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-400" />Carbs {Math.round((kcalFrom.carbs / kcalSum) * 100)}%</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warn-400" />Fats {Math.round((kcalFrom.fats / kcalSum) * 100)}%</span>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {MEAL_TYPES.map((t, ti) => {
              const list = meals.filter((m) => m.type === t);
              return (
                <SectionCard
                  key={t}
                  title={t}
                  icon={<IconUtensils className="h-5 w-5" />}
                  delay={140 + ti * 60}
                  bodyCls="p-3"
                  action={
                    <button
                      className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-night-600 text-mist-400 transition hover:border-volt-400 hover:text-volt-300"
                      title={`Add ${t.toLowerCase()}`}
                      onClick={() => {
                        setEditing(null);
                        setDefaultType(t);
                        setModalOpen(true);
                      }}
                    >
                      <IconPlus className="h-4 w-4" />
                    </button>
                  }
                >
                  {list.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-night-600 px-4 py-6 text-center text-xs text-mist-500">
                      No {t.toLowerCase()} assigned
                    </p>
                  ) : (
                    <ul className="grid gap-2">
                      {list.map((m) => (
                        <li key={m.id} className="group rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500">
                          <div className="flex items-start gap-2">
                            <Badge className={MEAL_META[m.type].chip}>{m.type}</Badge>
                            <div className="ms-auto flex gap-1 opacity-60 transition group-hover:opacity-100">
                              <button
                                className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-night-700 hover:text-mist-100"
                                title="Edit"
                                onClick={() => {
                                  setEditing(m);
                                  setModalOpen(true);
                                }}
                              >
                                <IconPencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300"
                                title="Delete"
                                onClick={() => setDeleting(m)}
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-mist-100">{m.description}</p>
                          <p className="mt-1.5 flex items-center gap-3 text-[11px] font-bold text-mist-400">
                            <span className="font-display text-base text-warn-300">{m.calories} kcal</span>
                            <span className="text-volt-300">P {m.protein}g</span>
                            <span className="text-sky-300">C {m.carbs}g</span>
                            <span className="text-warn-300">F {m.fats}g</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              );
            })}
          </div>
        </>
      )}

      {client && (
        <MealFormModal open={modalOpen} clientId={client.id} initial={editing} defaultType={defaultType} onClose={() => setModalOpen(false)} />
      )}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove meal?"
        message={<>
          "{deleting?.description}" will be removed from the plan.
        </>}
        confirmLabel="Remove"
        onConfirm={() => deleting && deleteMeal(deleting.id)}
      />
    </div>
  );
}
