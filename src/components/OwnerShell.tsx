/* ================================================================
   VERRAA — Owner/Admin shell: sidebar, mobile nav and page frame.
   Premium-minimal match for the coach shell.
   ================================================================ */

import type { ReactNode } from "react";
import {
  BarChart3,
  Dumbbell,
  FileText,
  Inbox,
  LayoutGrid,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  Users,
} from "lucide-react";
import { Avatar } from "./ui";
import { useApp } from "../store";

export type OwnerView = "dashboard" | "coaches" | "subscriptions" | "requests" | "analytics" | "audit" | "settings";

type NavItem = { id: OwnerView; label: string; hint: string; icon: (p: { className?: string }) => ReactNode };

const SECTIONS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ id: "dashboard", label: "Dashboard", hint: "Business at a glance", icon: LayoutGrid }] },
  {
    label: "Business",
    items: [
      { id: "coaches", label: "Coaches", hint: "Team management", icon: Users },
      { id: "subscriptions", label: "Subscriptions", hint: "Plans & billing", icon: Shield },
      { id: "requests", label: "Plan Requests", hint: "Approve or reject", icon: Inbox },
      { id: "analytics", label: "Analytics", hint: "Growth insights", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { id: "audit", label: "Audit Log", hint: "Activity history", icon: FileText },
      { id: "settings", label: "Settings", hint: "Workspace prefs", icon: SettingsIcon },
    ],
  },
];

const VIEW_META: Record<OwnerView, { section: string; label: string }> = {
  dashboard: { section: "Overview", label: "Dashboard" },
  coaches: { section: "Business", label: "Coaches" },
  subscriptions: { section: "Business", label: "Subscriptions" },
  requests: { section: "Business", label: "Plan Requests" },
  analytics: { section: "Business", label: "Analytics" },
  audit: { section: "System", label: "Audit Log" },
  settings: { section: "System", label: "Settings" },
};

const FLAT = SECTIONS.flatMap((s) => s.items);

export function OwnerShell({
  view,
  setView,
  onLogout,
  children,
}: {
  view: OwnerView;
  setView: (v: OwnerView) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const isActive = (id: OwnerView) => view === id;
  const meta = VIEW_META[view];
  const { me, state } = useApp();
  const pendingRequests = (state.planRequests ?? []).filter((r) => r.status === "PENDING").length;

  return (
    <div className="noise relative flex min-h-screen">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0 opacity-40" />

      {/* sidebar */}
      <aside
        aria-label="Owner navigation"
        className="sticky top-0 z-30 hidden h-screen w-[272px] shrink-0 flex-col border-e border-white/[0.06] bg-night-950/70 backdrop-blur-xl lg:flex"
      >
        <div className="group flex items-center gap-3 px-5 pb-5 pt-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_8px_24px_-10px_rgba(205,241,75,0.55)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-[1.03]">
            <Shield className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-[22px] font-bold uppercase leading-none tracking-wide text-mist-100">
              Verraa
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-volt-300">
              Owner console
            </p>
          </div>
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
                      className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 text-start text-[13.5px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950 ${
                        active
                          ? "bg-white/[0.06] font-bold text-mist-100 ring-1 ring-white/[0.08]"
                          : "font-semibold text-mist-400 hover:bg-white/[0.04] hover:text-mist-100"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border ${
                          active
                            ? "border-volt-400/25 bg-volt-400/10 text-volt-300"
                            : "border-white/[0.06] bg-white/[0.03] text-mist-500"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="truncate">{item.label}</span>
                      {item.id === "requests" && pendingRequests > 0 && (
                        <span className="ms-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-warn-400 px-1.5 text-[10px] font-extrabold text-night-950 tnum">
                          {pendingRequests}
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
                <Avatar name={me?.name ?? "Owner"} className="h-10 w-10 text-xs" status="online" />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-mist-100">{me?.name ?? "Owner Admin"}</p>
                  <p className="truncate text-xs text-mist-500">{me?.email ?? "SaaS control center"}</p>
                </div>
              </div>
            <button
              onClick={onLogout}
              className="mt-3 flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] py-1.5 text-xs font-bold text-mist-400 transition hover:border-danger-500/30 hover:bg-danger-500/[0.08] hover:text-danger-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* content */}
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 hidden border-b border-white/[0.06] bg-night-950/75 backdrop-blur-xl lg:block">
          <div className="mx-auto flex h-[64px] w-full max-w-[1280px] items-center gap-4 px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
              <span className="font-semibold text-mist-500">{meta.section}</span>
              <span aria-hidden="true" className="text-mist-500/50">
                /
              </span>
              <span className="font-bold text-mist-100">{meta.label}</span>
            </nav>
            <div className="ms-auto flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-volt-400/20 bg-volt-400/[0.07] px-3 py-1.5 text-xs font-bold text-volt-300">
                <Dumbbell className="h-3.5 w-3.5" />
                Owner mode
              </span>
              <Avatar name="Owner" className="h-9 w-9 text-[11px]" />
            </div>
          </div>
        </div>

        {/* mobile top bar */}
        <div className="sticky top-0 z-30 border-b border-white/[0.06] bg-night-950/85 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5 px-4 pt-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400 text-night-950">
              <Shield className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-display text-lg font-bold uppercase leading-none text-mist-100">Verraa</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-volt-300">Owner</p>
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
            {FLAT.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={isActive(item.id) ? "page" : undefined}
                className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-bold transition-all duration-200 ${
                  isActive(item.id)
                    ? "bg-volt-400 text-night-950"
                    : "border border-white/[0.07] bg-white/[0.03] text-mist-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <main
          id="main-content"
          className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
        >
          <div className="flex flex-col gap-6 lg:gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- shared page header ---------------- */

export function OwnerPageHeader({
  title,
  accent,
  sub,
  action,
}: {
  title: string;
  accent?: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-balance text-[28px] font-extrabold leading-[1.05] tracking-tight text-mist-100 sm:text-[34px]">
          {title} {accent && <span className="text-volt-400">{accent}</span>}
        </h1>
        {sub && <p className="text-balance mt-2 max-w-xl text-sm leading-6 text-mist-400">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div>}
    </header>
  );
}
