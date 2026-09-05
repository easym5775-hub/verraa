/* ================================================================
   FORGE — coach shell: sidebar, mobile nav and page frame.
   Premium-minimal: grouped nav, glass topbar, generous whitespace.
   ================================================================ */

import type { ReactNode } from "react";
import {
  Camera,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutGrid,
  Library,
  LogOut,
  Search,
  Settings as SettingsIcon,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import type { CoachView } from "../types";
import { useApp } from "../store";
import { Avatar } from "./ui";

type NavItem = { id: CoachView; label: string; hint: string; icon: (p: { className?: string }) => ReactNode };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ id: "dashboard", label: "Dashboard", hint: "Command center", icon: LayoutGrid }] },
  {
    label: "Coaching",
    items: [
      { id: "clients", label: "Clients", hint: "Roster & profiles", icon: Users },
      { id: "plans", label: "Workout Plans", hint: "Training programs", icon: ClipboardList },
      { id: "meals", label: "Meals", hint: "Nutrition plans", icon: UtensilsCrossed },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "library", label: "Exercise Library", hint: "Movements & demos", icon: Library },
      { id: "checkins", label: "Check-ins", hint: "Progress reviews", icon: Camera },
      { id: "pricing", label: "Plans & Pricing", hint: "Subscription & limits", icon: CreditCard },
      { id: "settings", label: "Settings", hint: "Workspace prefs", icon: SettingsIcon },
    ],
  },
];

const VIEW_META: Record<string, { section: string; label: string }> = {
  dashboard: { section: "Overview", label: "Dashboard" },
  clients: { section: "Coaching", label: "Clients" },
  client: { section: "Coaching", label: "Client profile" },
  plans: { section: "Coaching", label: "Workout Plans" },
  meals: { section: "Coaching", label: "Meals" },
  library: { section: "Manage", label: "Exercise Library" },
  checkins: { section: "Manage", label: "Check-ins" },
  pricing: { section: "Manage", label: "Plans & Pricing" },
  settings: { section: "Manage", label: "Settings" },
};

const FLAT_NAV = SECTIONS.flatMap((s) => s.items);

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
  const { state, me, isDemo } = useApp();

  const isActive = (id: CoachView) => view === id || (view === "client" && id === "clients");
  const meta = VIEW_META[view] ?? VIEW_META.dashboard;

  return (
    <div className="noise relative flex min-h-screen">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-40" />

      {/* sidebar */}
      <aside
        aria-label="Coach navigation"
        className="sticky top-0 z-30 hidden h-screen w-[272px] shrink-0 flex-col border-e border-white/[0.06] bg-night-950/70 backdrop-blur-xl lg:flex"
      >
        <div className="group flex items-center gap-3 px-5 pb-5 pt-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_8px_24px_-10px_rgba(205,241,75,0.55)] transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-[1.03]">
            <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[22px] font-bold uppercase leading-none tracking-wide text-mist-100">
              Forge
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-mist-500">
              Coaching OS
            </p>
          </div>
          <span
            className={`ms-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isDemo
                ? "border-volt-400/20 bg-volt-400/[0.07] text-volt-300"
                : "border-moss-400/20 bg-moss-400/[0.08] text-moss-300"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isDemo ? "bg-volt-400" : "bg-moss-400"}`} />
            {isDemo ? "Demo" : "Live"}
          </span>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Primary">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-mist-500">
                {section.label}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = isActive(item.id);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setView(item.id)}
                      aria-current={active ? "page" : undefined}
                      title={item.hint}
                      className={`group flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 text-start text-[13.5px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 ${
                        active
                          ? "bg-white/[0.06] font-bold text-mist-100 ring-1 ring-white/[0.08] shadow-sm"
                          : "font-semibold text-mist-400 hover:bg-white/[0.04] hover:text-mist-100"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border transition-colors ${
                          active
                            ? "border-volt-400/25 bg-volt-400/10 text-volt-300"
                            : "border-white/[0.06] bg-white/[0.03] text-mist-500 group-hover:text-mist-200"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.id === "clients" && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-display text-[11px] font-bold leading-4 tnum ${
                            active ? "bg-volt-400/15 text-volt-200" : "bg-white/[0.05] text-mist-400"
                          }`}
                        >
                          {state.clients.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={me?.name ?? "Coach"} className="h-10 w-10 text-xs" status={isDemo ? "away" : "online"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-mist-100">{me?.name ?? "Coach"}</p>
                <p className="truncate text-xs text-mist-500">{me?.email ?? (isDemo ? "Demo workspace" : "Coach workspace")}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="mt-3 flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-transparent py-1.5 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-danger-500/30 hover:bg-danger-500/[0.08] hover:text-danger-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
          <p className="mt-2.5 px-1 text-center text-[10.5px] font-medium text-mist-500/70">
            Forge v1 · crafted for coaches
          </p>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        {/* desktop topbar */}
        <div className="sticky top-0 z-30 hidden border-b border-white/[0.06] bg-night-950/75 backdrop-blur-xl lg:block">
          <div className="mx-auto flex h-[64px] w-full max-w-[1200px] items-center gap-4 px-8">
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="font-semibold text-mist-500">{meta.section}</span>
              <span aria-hidden="true" className="text-mist-500/50">
                /
              </span>
              <span className="truncate font-bold text-mist-100">{meta.label}</span>
            </nav>
            <div className="ms-auto flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setView("clients")}
                className="hidden h-10 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 text-[13px] text-mist-500 transition hover:border-white/[0.12] hover:text-mist-300 md:flex md:w-64"
                aria-label="Search clients"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-start">Search clients…</span>
                <span className="kbd">⌘K</span>
              </button>
              <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-mist-300 xl:inline-flex">
                <span className={`h-1.5 w-1.5 rounded-full ${isDemo ? "bg-volt-400" : "bg-moss-400"}`} />
                {state.clients.length} clients
              </span>
              <Avatar name={me?.name ?? "Coach"} className="h-9 w-9 text-[11px]" />
            </div>
          </div>
        </div>

        {/* mobile top bar */}
        <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-night-950/85 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5 px-4 pt-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400 text-night-950 shadow-[0_8px_20px_-8px_rgba(205,241,75,0.5)]">
              <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold uppercase leading-none text-mist-100">Forge</p>
              <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.2em] text-mist-500">
                {meta.section} · {meta.label}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="ms-auto grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] text-mist-400 transition hover:border-danger-500/30 hover:text-danger-300"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav aria-label="Primary" className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
            {FLAT_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={isActive(item.id) ? "page" : undefined}
                className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-all duration-200 ${
                  isActive(item.id)
                    ? "bg-volt-400 text-night-950 shadow-[0_4px_14px_-4px_rgba(205,241,75,0.45)]"
                    : "border border-white/[0.07] bg-white/[0.03] text-mist-400 hover:text-mist-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <main
          id="main-content"
          className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
        >
          <div className="flex flex-col gap-6 lg:gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- shared page header ---------------- */

export function PageHeader({
  eyebrow,
  title,
  accent,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-balance mt-1 text-[28px] font-extrabold leading-[1.05] tracking-tight text-mist-100 sm:text-[34px]">
          {title} {accent && <span className="text-volt-400">{accent}</span>}
        </h1>
        {sub && <p className="text-balance mt-2 max-w-xl text-sm leading-6 text-mist-400">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div>}
    </header>
  );
}
