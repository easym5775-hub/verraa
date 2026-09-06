/* ================================================================
   VERRAA — coach shell: sidebar, mobile nav and page frame.
   Premium-minimal: grouped nav, glass topbar, generous whitespace.
   ================================================================ */

import { useEffect, useState, type ReactNode } from "react";
import {
  Camera,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutGrid,
  Library,
  LogOut,
  Menu,
  Search,
  Settings as SettingsIcon,
  UtensilsCrossed,
  Users,
  X,
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
  const { state, me } = useApp();

  const isActive = (id: CoachView) => view === id || (view === "client" && id === "clients");
  const meta = VIEW_META[view] ?? VIEW_META.dashboard;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = view === "meals" || view === "library" || view === "pricing" || view === "settings";

  // Lock body scroll + close on Escape while the More sheet is open.
  useEffect(() => {
    if (!moreOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [moreOpen]);

  const go = (v: CoachView) => {
    setMoreOpen(false);
    setView(v);
    // Mobile-only: desktop keeps its exact current behavior (no scroll jump).
    if (typeof window !== "undefined" && window.innerWidth < 1024) window.scrollTo(0, 0);
  };

  return (
    <div className="coach-shell noise relative flex min-h-screen">
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
              Verraa
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-mist-500">
              Coaching OS
            </p>
          </div>
          <span
            className="ms-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider border-moss-400/20 bg-moss-400/[0.08] text-moss-300"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-moss-400" />
            Live
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
                      onClick={() => go(item.id)}
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
              <Avatar name={me?.name ?? "Coach"} className="h-10 w-10 text-xs" status="online" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-mist-100">{me?.name ?? "Coach"}</p>
                <p className="truncate text-xs text-mist-500">{me?.email ?? "Coach workspace"}</p>
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
            Verraa v1 · crafted for coaches
          </p>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        {/* desktop topbar */}
        <div className="sticky top-0 z-30 hidden border-b border-white/[0.06] bg-night-950/75 backdrop-blur-xl lg:block">
          <div className="mx-auto flex h-[64px] w-full max-w-[1440px] items-center gap-4 px-6 lg:px-8">
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
                onClick={() => go("clients")}
                className="hidden h-10 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 text-[13px] text-mist-500 transition hover:border-white/[0.12] hover:text-mist-300 md:flex md:w-64"
                aria-label="Search clients"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-start">Search clients…</span>
                <span className="kbd">⌘K</span>
              </button>
              <span className="hidden items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-mist-300 xl:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-moss-400" />
                {state.clients.length} clients
              </span>
              <Avatar name={me?.name ?? "Coach"} className="h-9 w-9 text-[11px]" />
            </div>
          </div>
        </div>

        {/* mobile top bar — single compact row (nav moved to bottom bar) */}
        <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-night-950/85 backdrop-blur-xl lg:hidden">
          <div className="flex h-16 items-center gap-2.5 px-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt-400 text-night-950 shadow-[0_8px_20px_-8px_rgba(205,241,75,0.5)]">
              <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold tracking-tight text-mist-100">{meta.label}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-mist-500">
                {meta.section}
              </p>
            </div>
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="Open profile and more sections"
              className="shrink-0 cursor-pointer rounded-xl transition active:scale-95"
            >
              <Avatar name={me?.name ?? "Coach"} className="h-9 w-9 text-[11px]" />
            </button>
          </div>
        </div>

        <main
          id="main-content"
          className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-4 pb-28 sm:px-6 lg:px-8 lg:py-8"
        >
          {/* Cheap opacity fade on mobile only — desktop keeps its exact animation behavior. */}
          <div key={view} className="animate-fade lg:animate-none">
            <div className="flex flex-col gap-4 sm:gap-6 lg:gap-8">{children}</div>
          </div>
        </main>

        {/* ── mobile bottom navigation ── */}
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-night-950/90 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto grid w-full max-w-md grid-cols-5 items-center px-2 pb-2 pt-1.5">
            <CoachBottomItem active={view === "dashboard"} onClick={() => go("dashboard")} icon={<LayoutGrid className="h-5 w-5" />} label="Home" />
            <CoachBottomItem active={isActive("clients")} onClick={() => go("clients")} icon={<Users className="h-5 w-5" />} label="Clients" />
            <CoachBottomItem active={view === "plans"} onClick={() => go("plans")} icon={<ClipboardList className="h-5 w-5" />} label="Plans" />
            <CoachBottomItem active={view === "checkins"} onClick={() => go("checkins")} icon={<Camera className="h-5 w-5" />} label="Check-ins" />
            <CoachBottomItem active={moreActive} onClick={() => setMoreOpen(true)} icon={<Menu className="h-5 w-5" />} label="More" />
          </div>
        </nav>

        {/* ── More sheet (mobile only) ── */}
        {moreOpen && (
          <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true" aria-label="More sections">
            <div className="animate-fade absolute inset-0 bg-night-950/70 backdrop-blur-sm" onClick={() => setMoreOpen(false)} aria-hidden="true" />
            <div
              className="animate-modal absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-y-auto rounded-t-[24px] border-t border-white/10 bg-night-900 px-4 pt-3"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
              <div className="mx-auto w-full max-w-md">
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                  <Avatar name={me?.name ?? "Coach"} className="h-11 w-11 text-xs" status="online" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-mist-100">{me?.name ?? "Coach"}</p>
                    <p className="truncate text-xs text-mist-500">{me?.email ?? "Coach workspace"}</p>
                  </div>
                  <button
                    onClick={() => setMoreOpen(false)}
                    aria-label="Close menu"
                    className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/[0.08] text-mist-400 transition active:scale-95"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {SECTIONS.map((section) => (
                  <div key={section.label} className="mt-4">
                    <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-mist-500">
                      {section.label}
                    </p>
                    <div className="grid gap-1">
                      {section.items.map((item) => {
                        const active = isActive(item.id);
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => go(item.id)}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-start transition active:scale-[0.99] ${active ? "bg-white/[0.06] ring-1 ring-white/[0.08]" : "hover:bg-white/[0.03]"}`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${active ? "border-volt-400/25 bg-volt-400/10 text-volt-300" : "border-white/[0.06] bg-white/[0.03] text-mist-400"}`}>
                              <Icon className="h-[18px] w-[18px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm font-bold ${active ? "text-mist-100" : "text-mist-200"}`}>{item.label}</span>
                              <span className="block truncate text-[11px] text-mist-500">{item.hint}</span>
                            </span>
                            {item.id === "clients" && (
                              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 font-display text-[11px] font-bold leading-4 text-mist-400 tnum">
                                {state.clients.length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button
                  onClick={onLogout}
                  className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.07] text-sm font-bold text-danger-300 transition active:scale-[0.99]"
                >
                  <LogOut className="h-[18px] w-[18px]" /> Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CoachBottomItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 transition-all duration-200 active:scale-95"
    >
      <span className={`grid h-7 w-12 place-items-center rounded-full transition-all duration-200 ${active ? "bg-volt-400/15 text-volt-300" : "text-mist-500"}`}>
        {icon}
      </span>
      <span className={`text-[10px] font-extrabold tracking-wide ${active ? "text-volt-300" : "text-mist-500"}`}>{label}</span>
      <span className={`h-1 w-1 rounded-full transition-all duration-200 ${active ? "bg-volt-400" : "bg-transparent"}`} />
    </button>
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
