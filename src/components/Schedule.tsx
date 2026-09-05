import { useEffect, useState } from "react";
import type { PlanItem } from "../types";
import { CAT_META, WEEK_DAYS, WEEK_SHORT } from "../types";
import { dayNum } from "../lib";
import { useApp } from "../store";
import { Badge, ConfirmModal, EmptyState, SectionCard, btnVolt, inputCls, labelCls } from "./ui";
import { PlanItemFormModal } from "./modals";
import { IconClipboard, IconClock, IconPencil, IconPlay, IconPlus, IconTrash, IconZap } from "../icons";

export function PlansView({ presetClientId }: { presetClientId: string | null }) {
  const { state, deletePlanItem } = useApp();
  const [clientId, setClientId] = useState(presetClientId ?? state.clients[0]?.id ?? "");
  const [day, setDay] = useState(dayNum());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlanItem | null>(null);
  const [deleting, setDeleting] = useState<PlanItem | null>(null);

  useEffect(() => {
    if (presetClientId) setClientId(presetClientId);
  }, [presetClientId]);

  useEffect(() => {
    if (!clientId && state.clients.length) setClientId(state.clients[0].id);
  }, [clientId, state.clients]);

  const client = state.clients.find((c) => c.id === clientId);
  const items = state.plans.filter((p) => p.clientId === clientId && p.day === day);
  const countFor = (d: number) => state.plans.filter((p) => p.clientId === clientId && p.day === d).length;
  const exOf = (id: string) => state.exercises.find((e) => e.id === id);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            Workout <span className="text-volt-400">plans</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">Day 1 = Monday · build a weekly split per client</p>
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
          <EmptyState icon={<IconClipboard className="h-6 w-6" />} title="No clients yet" sub="Add a client first, then build their weekly plan here." />
        </div>
      ) : (
        <>
          <div className="rise mt-6 grid grid-cols-4 gap-1.5 sm:grid-cols-7" style={{ animationDelay: "80ms" }}>
            {WEEK_DAYS.map((wd, i) => {
              const d = i + 1;
              const active = day === d;
              const today = dayNum() === d;
              const n = countFor(d);
              return (
                <button
                  key={wd}
                  onClick={() => setDay(d)}
                  className={`cursor-pointer rounded-lg border px-1 py-2.5 text-center transition ${
                    active
                      ? "border-volt-400 bg-volt-400/10"
                      : "border-night-600 bg-night-850 hover:border-night-500"
                  }`}
                >
                  <span className={`block font-display text-lg font-bold leading-5 ${active ? "text-volt-300" : "text-mist-100"}`}>
                    Day {d}
                  </span>
                  <span className={`block text-[10px] font-bold uppercase ${active ? "text-volt-400/80" : "text-mist-500"}`}>
                    {WEEK_SHORT[i]}
                    {today && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-volt-400 align-middle tick-pulse" />}
                  </span>
                  <span className={`mt-1 block text-[10px] font-semibold ${n > 0 ? "text-mist-400" : "text-night-500"}`}>
                    {n > 0 ? `${n} exercise${n > 1 ? "s" : ""}` : "rest"}
                  </span>
                </button>
              );
            })}
          </div>

          <SectionCard
            title={`${client.name} — Day ${day} · ${WEEK_DAYS[day - 1]}`}
            icon={<IconZap className="h-5 w-5" />}
            className="mt-4"
            delay={140}
            bodyCls="p-3"
            action={
              <button
                className={`${btnVolt} px-3! py-1.5! text-xs`}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <IconPlus className="h-4 w-4" strokeWidth={2.4} />
                Add exercise
              </button>
            }
          >
            {items.length === 0 ? (
              <EmptyState
                icon={<IconClipboard className="h-6 w-6" />}
                title="Rest day — or a blank page"
                sub={`Nothing programmed for ${WEEK_DAYS[day - 1]}. Add exercises from the library, or leave it for recovery.`}
              >
                <button
                  className={`${btnVolt} mt-2`}
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                >
                  <IconPlus className="h-4 w-4" strokeWidth={2.4} />
                  Add exercise
                </button>
              </EmptyState>
            ) : (
              <ul className="grid gap-2">
                {items.map((item, idx) => {
                  const ex = exOf(item.exerciseId);
                  return (
                    <li key={item.id} className="rise group flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500" style={{ animationDelay: `${idx * 50}ms` }}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-night-700 font-display text-lg font-bold text-volt-300">
                        {idx + 1}
                      </span>
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
                          <span className="font-display text-base text-mist-200">
                            {item.sets} × {item.reps}
                            <span className="text-mist-500"> reps</span>
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <IconClock className="h-3.5 w-3.5" />
                            {item.rest > 0 ? `${item.rest}s rest` : "no rest"}
                          </span>
                          {item.notes && <span className="text-mist-500 italic">"{item.notes}"</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100">
                        {ex?.videoUrl && (
                          <a
                            href={ex.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="grid h-8 w-8 place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-volt-300"
                            title="Watch video"
                          >
                            <IconPlay className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-mist-100"
                          title="Edit"
                          onClick={() => {
                            setEditing(item);
                            setModalOpen(true);
                          }}
                        >
                          <IconPencil className="h-4 w-4" />
                        </button>
                        <button
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300"
                          title="Remove"
                          onClick={() => setDeleting(item)}
                        >
                          <IconTrash className="h-4 w-4" />
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

      {client && (
        <PlanItemFormModal open={modalOpen} clientId={client.id} day={day} initial={editing} onClose={() => setModalOpen(false)} />
      )}
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
