import { useEffect, useRef, useState } from "react";
import { IconDatabase, IconExternal, IconSettings } from "../icons";

export function SyncIndicator({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Local storage only - no Google Sheets sync
  const label = "Local";
  const dotCls = "bg-volt-400";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Data storage status: local only"
        className="fixed bottom-4 left-4 z-50 flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-night-900/90 py-1.5 pl-3 pr-3.5 text-xs font-bold text-mist-200 shadow-lg backdrop-blur-xl transition hover:border-white/[0.14] hover:text-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only">— local only</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Data storage"
          className="animate-dropdown fixed bottom-16 left-4 z-50 w-72 overflow-hidden rounded-[20px] border border-white/10 bg-night-900/95 p-2 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between px-2.5 py-2">
            <h4 className="text-[13px] font-bold uppercase tracking-[0.12em] text-mist-100">Data storage</h4>
            <button
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
              aria-label="Close storage panel"
            >
              <IconExternal className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1.5 px-1 pb-1 text-sm">
            <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
              <span className="icon-tile h-9 w-9 shrink-0" aria-hidden="true">
                <IconDatabase className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-mist-100">Local storage</p>
                <p className="text-xs text-mist-500">Data stored in this browser</p>
              </div>
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotCls}`} aria-hidden="true" />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">Status</p>
                <p className="mt-0.5 text-[13px] font-bold text-mist-100">Local only</p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">Last sync</p>
                <p className="mt-0.5 text-[13px] font-bold text-mist-100">Never</p>
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-2">
              <button
                onClick={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
                className="flex min-h-[40px] w-full cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] font-bold text-mist-200 transition hover:border-white/[0.14] hover:text-mist-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
              >
                <IconSettings className="h-4 w-4" />
                Open settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
