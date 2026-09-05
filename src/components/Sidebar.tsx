import type { ReactNode } from "react";
import type { CoachView } from "../types";
import { useApp } from "../store";
import {
  IconCamera,
  IconClipboard,
  IconDumbbell,
  IconGrid,
  IconLibrary,
  IconLogOut,
  IconSettings,
  IconUtensils,
  IconUsers,
} from "../icons";

const NAV: { id: CoachView; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: IconGrid },
  { id: "clients", label: "Clients", icon: IconUsers },
  { id: "plans", label: "Workout Plans", icon: IconClipboard },
  { id: "meals", label: "Meals", icon: IconUtensils },
  { id: "library", label: "Exercise Library", icon: IconLibrary },
  { id: "checkins", label: "Check-ins", icon: IconCamera },
  { id: "settings", label: "Settings", icon: IconSettings },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-6 pt-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-volt-400 text-night-950">
        <IconDumbbell className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div>
        <p className="font-display text-xl font-bold uppercase leading-none tracking-wide text-mist-100">Forge</p>
        <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.28em] text-mist-500">Coaching OS</p>
      </div>
    </div>
  );
}

export function CoachShell({
  view,
  setView,
  onLogout,
  children,
}: {
  view: CoachView;
  setView: (v: CoachView) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { state } = useApp();
  const pending = state.checkIns.filter((c) => c.date >= todayMinus(6)).length;

  return (
    <div className="relative flex min-h-screen">
      <div className="app-glow pointer-events-none fixed inset-0" />

      {/* sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-[232px] shrink-0 flex-col border-e border-night-700 bg-night-900/80 backdrop-blur lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active =
              view === item.id || (item.id === "clients" && view === "client");
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  active ? "bg-night-700/80 text-volt-300" : "text-mist-400 hover:bg-night-800 hover:text-mist-100"
                }`}
              >
                {active && <span className="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full bg-volt-400" />}
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
                {item.id === "clients" && (
                  <span className={`ms-auto rounded-md px-1.5 py-0.5 font-display text-[11px] leading-4 ${active ? "bg-night-600 text-volt-300" : "bg-night-800 text-mist-500"}`}>
                    {state.clients.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="mx-3 mb-3 rounded-xl border border-night-700 bg-night-850 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-moss-700 font-display text-sm font-bold text-moss-300">C</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-mist-100">Coach Dana</p>
              <p className="text-[10.5px] text-mist-500">
                {pending} check-ins this week
              </p>
            </div>
          </div>
          <button
            onClick={() => setView("settings")}
            className="mt-2.5 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-night-600 px-2.5 py-1.5 text-[11px] font-bold text-mist-300 transition hover:border-night-500 hover:text-mist-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-volt-400" />
            Local Storage
            <IconSettings className="ms-auto h-3.5 w-3.5 text-mist-500" />
          </button>
          <button
            onClick={onLogout}
            className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-night-600 py-1.5 text-[11px] font-bold text-mist-400 transition hover:border-night-500 hover:text-mist-100"
          >
            <IconLogOut className="h-3.5 w-3.5" />
            Switch role
          </button>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        {/* mobile top bar */}
        <div className="sticky top-0 z-30 border-b border-night-700 bg-night-900/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5 px-4 pt-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-400 text-night-950">
              <IconDumbbell className="h-4.5 w-4.5" strokeWidth={2.2} />
            </span>
            <p className="font-display text-lg font-bold uppercase leading-none text-mist-100">Forge</p>
            <button onClick={onLogout} className="ms-auto cursor-pointer rounded-lg border border-night-600 p-1.5 text-mist-400 transition hover:text-mist-100" aria-label="Switch role">
              <IconLogOut className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-4 py-3">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  view === item.id || (item.id === "clients" && view === "client")
                    ? "bg-volt-400 text-night-950"
                    : "bg-night-800 text-mist-400 hover:text-mist-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function todayMinus(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}