/* ================================================================
   VERRAA — static product-preview mockup (marketing only).
   Purely illustrative sample content: it never reads real app state,
   never queries Supabase, and is labelled as a preview for AT + SEO.
   ================================================================ */

import { Activity, Bell, CalendarDays, CheckCircle2, Clock, Search, Wallet } from "lucide-react";
import { Avatar } from "../ui";

interface PreviewClient {
  name: string;
  goal: string;
  status: "Active" | "Expiring soon";
  progress: number;
  note: string;
}

/* Generic sample rows — illustrative preview content, not real data. */
const SAMPLE_CLIENTS: PreviewClient[] = [
  { name: "Omar K.", goal: "Strength · Hypertrophy", status: "Active", progress: 82, note: "−2.4 kg · on track" },
  { name: "Sara M.", goal: "Fat loss · Nutrition", status: "Expiring soon", progress: 64, note: "Check-in waiting" },
  { name: "Karim A.", goal: "Performance · Conditioning", status: "Active", progress: 91, note: "+12.5 kg squat" },
];

const KPIS = [
  { label: "Total Clients", value: "24", sub: "across all plans" },
  { label: "Active Clients", value: "18", sub: "training this week" },
  { label: "Upcoming Renewals", value: "4", sub: "in the next 7 days" },
] as const;

export function DashboardMockup({ detailed = false }: { detailed?: boolean }) {
  return (
    <div
      role="img"
      aria-label="Illustrative preview of the VERRAA coach dashboard with sample data"
      className="relative overflow-hidden rounded-[20px] border border-white/10 bg-night-900/90 shadow-xl backdrop-blur-xl"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/50 to-transparent"
      />
      {/* window bar */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-volt-400/70" />
        </span>
        <p className="ms-2 truncate text-xs font-bold text-mist-300">Coach overview</p>
        <span className="ms-auto hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-mist-400 sm:inline-flex">
          <Search className="h-3 w-3" aria-hidden="true" /> Search clients…
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-mist-400" aria-hidden="true">
          <Bell className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:p-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-hidden="true">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-xl border border-white/[0.07] bg-night-950/60 px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-mist-500 sm:text-[10px]">
                {k.label}
              </p>
              <p className="mt-0.5 font-display text-xl font-bold leading-none text-mist-100 tnum sm:text-2xl">
                {k.value}
              </p>
              <p className="mt-1 hidden truncate text-[11px] font-medium text-mist-500 sm:block">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* client rows */}
        <ul className="grid gap-2" aria-hidden="true">
          {SAMPLE_CLIENTS.map((c) => (
            <li
              key={c.name}
              className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
            >
              <Avatar name={c.name} className="h-9 w-9 !rounded-xl text-[11px]" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[13px] font-bold text-mist-100">{c.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-extrabold ring-1 ${
                      c.status === "Active"
                        ? "bg-moss-400/10 text-moss-300 ring-moss-400/25"
                        : "bg-warn-400/10 text-warn-300 ring-warn-400/25"
                    }`}
                  >
                    {c.status === "Active" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                    {c.status}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <span className="block h-full rounded-full bg-volt-400" style={{ width: `${c.progress}%` }} />
                </span>
                <span className="mt-1 block truncate text-[11px] font-medium text-mist-500">
                  {c.goal} · {c.note}
                </span>
              </span>
              <span className="hidden shrink-0 font-display text-lg font-bold text-mist-200 tnum sm:block">
                {c.progress}%
              </span>
            </li>
          ))}
        </ul>

        {detailed && (
          <div className="grid gap-2.5 sm:grid-cols-2" aria-hidden="true">
            <div className="rounded-xl border border-white/[0.06] bg-night-950/60 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">
                <Wallet className="h-3.5 w-3.5 text-volt-300" /> Subscription overview
              </p>
              <div className="mt-2.5 flex items-center justify-between text-xs font-bold">
                <span className="text-mist-300">Plan usage</span>
                <span className="text-mist-500 tnum">18 / 20</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full w-[90%] rounded-full bg-volt-400" />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-mist-500">
                <CalendarDays className="h-3.5 w-3.5" /> 4 renewals due this week
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-night-950/60 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">
                <Activity className="h-3.5 w-3.5 text-volt-300" /> Recent activity
              </p>
              <ul className="mt-2.5 grid gap-2 text-[11.5px] font-semibold text-mist-400">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-moss-400" /> Check-in reviewed — progress updated
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-volt-400" /> New subscription recorded
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mist-500" /> Session completed
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <p className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-2 text-center text-[10.5px] font-semibold text-mist-500 sm:px-5">
        Illustrative preview — sample data, not real client information.
      </p>
    </div>
  );
}
