import { useMemo, useState } from "react";
import type { Exercise, ExerciseCategory } from "../types";
import { CATEGORIES, CAT_META } from "../types";
import { useApp } from "../store";
import { Badge, ConfirmModal, EmptyState, SectionCard, btnVolt, inputCls } from "./ui";
import { ExerciseFormModal } from "./modals";
import { IconDumbbell, IconImage, IconPencil, IconPlay, IconPlus, IconSearch, IconTrash } from "../icons";

export function LibraryView() {
  const { state, deleteExercise } = useApp();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<ExerciseCategory | "All">("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.exercises
      .filter((e) => (cat === "All" ? true : e.category === cat))
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.description.toLowerCase().includes(needle));
  }, [state.exercises, q, cat]);

  const usedIn = (id: string) => state.plans.filter((p) => p.exerciseId === id).length;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-tight text-mist-100 sm:text-5xl">
            Exercise <span className="text-volt-400">library</span>
          </h1>
          <p className="mt-2 text-sm text-mist-400">
            {state.exercises.length} movements with cues and video links — reusable across every plan
          </p>
        </div>
        <button
          className={`${btnVolt} h-11`}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <IconPlus className="h-4 w-4" strokeWidth={2.4} />
          Add exercise
        </button>
      </header>

      <div className="rise mt-5 flex flex-wrap items-center gap-3" style={{ animationDelay: "80ms" }}>
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input className={`${inputCls} ps-9!`} placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                cat === c ? "bg-volt-400 text-night-950" : "bg-night-800 text-mist-400 hover:text-mist-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <SectionCard title={`Library (${filtered.length})`} icon={<IconDumbbell className="h-5 w-5" />} className="mt-4" delay={140} bodyCls="p-4">
        {filtered.length === 0 ? (
          <EmptyState icon={<IconDumbbell className="h-6 w-6" />} title="No exercises found" sub={q ? `Nothing matches "${q}".` : "Add your first movement to start building plans."}>
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((e, i) => (
              <article key={e.id} className="rise card-lift group overflow-hidden rounded-xl border border-night-700 bg-night-800" style={{ animationDelay: `${Math.min(i, 9) * 45}ms` }}>
                <div className="relative h-36 overflow-hidden bg-night-700">
                  <div className="grid h-full place-items-center text-night-500">
                    <IconImage className="h-8 w-8" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-night-950/90 to-transparent" />
                  <Badge className={`absolute start-2 top-2 ${CAT_META[e.category].chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${CAT_META[e.category].dot}`} />
                    {e.category}
                  </Badge>
                  {usedIn(e.id) > 0 && (
                    <span className="absolute end-2 top-2 rounded-md bg-night-950/80 px-2 py-0.5 text-[10px] font-bold text-mist-300 backdrop-blur">
                      in {usedIn(e.id)} plan item{usedIn(e.id) > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="truncate font-display text-xl font-semibold text-mist-100">{e.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-mist-400">{e.description || "No coaching cues yet."}</p>
                  <div className="mt-3 flex items-center gap-1.5">
                    {e.videoUrl && (
                      <a
                        href={e.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-night-700 px-2.5 py-1.5 text-[11px] font-bold text-volt-300 transition hover:bg-night-600"
                      >
                        <IconPlay className="h-3 w-3" />
                        Watch video
                      </a>
                    )}
                    <div className="ms-auto flex gap-1">
                      <button
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-night-700 hover:text-mist-100"
                        title="Edit"
                        onClick={() => {
                          setEditing(e);
                          setModalOpen(true);
                        }}
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300"
                        title="Delete"
                        onClick={() => setDeleting(e)}
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <ExerciseFormModal open={modalOpen} initial={editing} onClose={() => setModalOpen(false)} />
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete exercise?"
        message={
          <>
            <strong className="text-mist-100">{deleting?.name}</strong> will be removed from the library
            {deleting && usedIn(deleting.id) > 0 && <> and from <strong className="text-warn-300">{usedIn(deleting.id)} plan item(s)</strong></>}.
          </>
        }
        confirmLabel="Delete"
        onConfirm={() => deleting && deleteExercise(deleting.id)}
      />
    </div>
  );
}
