/* ================================================================
   VERRAA — progress photos (Before / After galleries).
   Shared by client mode (own gallery) and coach mode (per-client
   gallery): view, upload, download. Deleting is limited to photos
   you uploaded yourself.
   ================================================================ */

import { useMemo, useState, type ChangeEvent } from "react";
import { Camera, Download, ImagePlus, Trash2, X } from "lucide-react";
import type { ProgressPhoto, ProgressPhotoKind } from "../types";
import { PHOTO_KINDS } from "../types";
import { fileToDataUrl, fmtDate } from "../lib";
import { useApp } from "../store";
import { Badge, EmptyState, SectionCard, btnSecondary, btnVolt, inputCls } from "./ui";

const KIND_META: Record<ProgressPhotoKind, { label: string; hint: string }> = {
  BEFORE: { label: "Before", hint: "Starting point — front, side, back" },
  AFTER: { label: "After", hint: "Latest shape — same poses, same light" },
};

function fileNameOf(p: ProgressPhoto): string {
  return `${p.kind.toLowerCase()}-${p.date}-${p.id.slice(0, 6)}.jpg`;
}

export function PhotoGallery({ clientId, role }: { clientId: string; role: "client" | "coach" }) {
  const { state, addProgressPhoto, deleteProgressPhoto } = useApp();
  const [notes, setNotes] = useState<Partial<Record<ProgressPhotoKind, string>>>({});
  const [busy, setBusy] = useState<ProgressPhotoKind | null>(null);
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<ProgressPhoto | null>(null);

  const photos = useMemo(
    () => (state.progressPhotos ?? []).filter((p) => p.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts),
    [state.progressPhotos, clientId],
  );
  const ofKind = (k: ProgressPhotoKind) => photos.filter((p) => p.kind === k);

  const upload = async (kind: ProgressPhotoKind, e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(kind);
    setErr("");
    try {
      const dataUrl = await fileToDataUrl(f, 1024);
      const note = (notes[kind] ?? "").trim();
      const created = addProgressPhoto({ clientId, kind, photo: dataUrl, note: note || undefined });
      if (created) setNotes((n) => ({ ...n, [kind]: "" }));
    } catch {
      setErr("Could not read that image — try another one.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-3 sm:gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-night-700 bg-night-850 p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "repeating-linear-gradient(-45deg, transparent 0 14px, rgba(205,241,75,0.04) 14px 15px)" }} />
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-mist-500 sm:text-[11px]">Progress photos</p>
          <h1 className="mt-1 font-display text-[30px] font-bold uppercase leading-[0.95] text-mist-100 sm:text-[44px]">
            Before <span className="text-volt-400">&</span> after
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <ImagePlus className="h-3.5 w-3.5 text-volt-300" />
              {ofKind("BEFORE").length} before
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-bold text-mist-200">
              <ImagePlus className="h-3.5 w-3.5 text-moss-300" />
              {ofKind("AFTER").length} after
            </span>
          </div>
          {err && <p className="mt-2 text-xs font-bold text-danger-400">{err}</p>}
        </div>
      </div>

      {PHOTO_KINDS.map((kind) => {
        const list = ofKind(kind);
        const meta = KIND_META[kind];
        return (
          <SectionCard
            key={kind}
            title={`${meta.label} · ${list.length}`}
            description={meta.hint}
            icon={<Camera className="h-4.5 w-4.5" />}
            bodyCls="p-2.5 sm:p-3"
            action={
              <label className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-volt-400 px-3.5 text-[13px] font-bold text-night-950 transition hover:bg-volt-300 ${busy === kind ? "pointer-events-none opacity-50" : ""}`}>
                <Camera className="h-3.5 w-3.5" />
                {busy === kind ? "Adding…" : "Add photo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void upload(kind, e)} />
              </label>
            }
          >
            <div className="mb-2">
              <input
                className={`${inputCls} h-10 !text-[13px]`}
                placeholder="Note for this upload (optional — e.g. week 4, same light)…"
                value={notes[kind] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [kind]: e.target.value }))}
              />
            </div>
            {list.length === 0 ? (
              <EmptyState
                icon={<ImagePlus className="h-6 w-6" />}
                title={`No ${meta.label.toLowerCase()} photos yet`}
                sub={kind === "BEFORE" ? "Upload your starting point — you'll thank yourself later." : "Upload your latest shape in the same poses."}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list.map((p) => (
                  <li key={p.id} className="group relative overflow-hidden rounded-xl border border-night-700 bg-night-800">
                    <button onClick={() => setLightbox(p)} className="block w-full cursor-pointer" aria-label={`View ${meta.label.toLowerCase()} photo from ${p.date}`}>
                      <img src={p.photo} alt={`${meta.label} progress photo from ${p.date}`} loading="lazy" className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" />
                    </button>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-night-950/90 to-transparent px-2 pb-1.5 pt-6">
                      <span className="truncate text-[10px] font-bold text-mist-300 tnum">{fmtDate(p.date)}</span>
                      {p.by === "coach" && (
                        <Badge className="shrink-0 border-sky-400/25 bg-sky-400/10 text-sky-300">coach</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        );
      })}

      {/* lightbox: view + download (+ delete own uploads) */}
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-night-950/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-night-900" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.photo} alt={`${lightbox.kind} progress photo from ${lightbox.date}`} className="max-h-[68dvh] w-full object-contain bg-black" />
            <div className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-mist-100">
                  {KIND_META[lightbox.kind].label} · {fmtDate(lightbox.date)}
                </p>
                {lightbox.note && <p className="truncate text-xs text-mist-400">{lightbox.note}</p>}
              </div>
              <a
                href={lightbox.photo}
                download={fileNameOf(lightbox)}
                className={`${btnVolt} h-10 !px-3.5 !text-[13px]`}
                aria-label="Download photo"
              >
                <Download className="h-4 w-4" /> Download
              </a>
              {lightbox.by === role && (
                <button
                  onClick={() => {
                    deleteProgressPhoto(lightbox.id);
                    setLightbox(null);
                  }}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-danger-500/30 text-danger-300 transition hover:bg-danger-500/10"
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setLightbox(null)}
                className={`${btnSecondary} h-10 w-10 !px-0`}
                aria-label="Close viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
