import { useState } from "react";
import { useApp } from "../store";
import { relDay, signed } from "../lib";
import { Avatar, Badge, EmptyState, MoodDots, SectionCard, chip } from "./ui";
import { PhotoModal } from "./modals";
import { IconCamera, IconCheck, IconDrop, IconScale, IconX } from "../icons";

export function CheckInsView() {
  const { state } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const [photo, setPhoto] = useState<string | null>(null);

  const nameOf = (id: string) => state.clients.find((c) => c.id === id);

  const sorted = [...state.checkIns]
    .filter((c) => filter === "all" || c.clientId === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);

  const deltaFor = (clientId: string, id: string, weight: number) => {
    const mine = state.checkIns
      .filter((x) => x.clientId === clientId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);
    const idx = mine.findIndex((x) => x.id === id);
    return idx > 0 ? weight - mine[idx - 1].weight : null;
  };

  return (
    <div>
      <header>
        <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
          Check-ins
        </h1>
        <p className="mt-2 text-sm text-mist-400">
          {state.checkIns.length} logged in total — weight, mood, water and workout completion
        </p>
      </header>

      <div className="rise mt-5 flex flex-wrap gap-1.5" style={{ animationDelay: "80ms" }}>
        <button
          onClick={() => setFilter("all")}
          className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
            filter === "all" ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"
          }`}
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
            <Avatar name={c.name} photo={c.photo} className="h-6 w-6 rounded-full text-[9px]" />
            {c.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <SectionCard title={`Log (${sorted.length})`} icon={<IconCamera className="h-5 w-5" />} className="mt-4" delay={140} bodyCls="p-3">
        {sorted.length === 0 ? (
          <EmptyState icon={<IconCamera className="h-6 w-6" />} title="Nothing here yet" sub="When clients submit daily check-ins, the full feed appears here." />
        ) : (
          <ul className="grid gap-2">
            {sorted.map((ci, i) => {
              const c = nameOf(ci.clientId);
              const delta = deltaFor(ci.clientId, ci.id, ci.weight);
              return (
                <li key={ci.id} className="rise flex items-center gap-3 rounded-lg border border-night-700 bg-night-800 p-3 transition hover:border-night-500" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <Avatar name={c?.name ?? "?"} photo={c?.photo} className="h-10 w-10 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-mist-100">
                      {c?.name ?? "Former client"}
                      <span className="ms-2 text-[11px] font-semibold text-mist-500">{relDay(ci.date)}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-mist-400">
                      <span className="inline-flex items-center gap-1 text-mist-200">
                        <IconScale className="h-3.5 w-3.5 text-volt-400" />
                        {ci.weight} kg
                        {delta !== null && (
                          <span className={delta <= 0 ? "text-moss-300" : "text-warn-300"}>({signed(delta)})</span>
                        )}
                      </span>
                      {ci.waist !== undefined && (
                        <span className="text-mist-400">waist {ci.waist} cm</span>
                      )}
                      <MoodDots mood={ci.mood} />
                      <span className="inline-flex items-center gap-1">
                        <IconDrop className="h-3.5 w-3.5 text-sky-400" />
                        {ci.water}L
                      </span>
                    </div>
                    {ci.notes && <p className="mt-1 truncate text-[11px] italic text-mist-500">"{ci.notes}"</p>}
                  </div>
                  {ci.photo && (
                    <button onClick={() => setPhoto(ci.photo ?? null)} className="shrink-0 cursor-zoom-in" aria-label="View photo">
                      <img src={ci.photo} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-night-600 transition hover:ring-volt-400" />
                    </button>
                  )}
                  <Badge className={ci.workoutDone ? "border-volt-400/25 bg-volt-400/10 text-volt-300" : "border-danger-500/25 bg-danger-500/10 text-danger-300"}>
                    {ci.workoutDone ? <IconCheck className="h-3 w-3" strokeWidth={2.6} /> : <IconX className="h-3 w-3" strokeWidth={2.6} />}
                    {ci.workoutDone ? "Workout done" : "Skipped"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <PhotoModal src={photo} onClose={() => setPhoto(null)} />
    </div>
  );
}

void chip;
