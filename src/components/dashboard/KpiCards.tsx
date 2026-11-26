import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { useCountUp } from "../ui";

const CHIP_TONE: Record<string, string> = {
  good: "bg-moss-400/10 text-moss-300 ring-moss-400/25",
  warn: "bg-warn-400/10 text-warn-300 ring-warn-400/25",
  danger: "bg-danger-500/10 text-danger-300 ring-danger-500/25",
  muted: "bg-white/[0.05] text-mist-400 ring-white/10",
};

export function KpiCard({
  label,
  value,
  unit,
  sub,
  chip,
  icon,
  tone,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  chip?: { text: string; tone: "good" | "warn" | "danger" | "muted" };
  icon: ReactNode;
  tone?: "warn" | "danger" | "accent";
  onClick?: () => void;
  actionLabel?: string;
}) {
  const isAccent = tone === "accent";
  const valueTone = tone === "danger" ? "text-danger-300" : tone === "warn" ? "text-warn-300" : isAccent ? "text-volt-300" : "text-mist-100";
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${isAccent ? "text-volt-200/80" : "text-mist-500"}`}>{label}</span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${isAccent ? "border-volt-400/30 bg-volt-400/10 text-volt-300" : `border-white/[0.07] bg-white/[0.03] ${tone ? valueTone : "text-mist-400"}`}`}>
          {icon}
        </span>
      </span>
      <span className={`mt-2.5 block text-[30px] font-extrabold leading-8 tracking-tight tnum sm:text-[32px] ${valueTone}`}>
        {value}
        {unit && <span className="ms-1.5 text-[13px] font-bold text-mist-500">{unit}</span>}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-mist-500">
        {chip ? (
          <span className={`inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] font-bold leading-4 ring-1 ${CHIP_TONE[chip.tone]}`}>
            {chip.text}
          </span>
        ) : (
          <span className="truncate">{sub}</span>
        )}
        {onClick && actionLabel && (
          <span className="ms-auto inline-flex shrink-0 items-center gap-0.5 font-bold text-volt-300">
            {actionLabel} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </span>
        )}
      </span>
    </>
  );
  const cls = isAccent
    ? "rise card-lift group relative min-h-[104px] rounded-2xl border border-volt-400/35 bg-volt-400/[0.06] p-5 text-start shadow-sm shadow-volt-400/10 backdrop-blur-xl"
    : "rise card-lift group relative min-h-[104px] rounded-2xl border border-white/[0.07] bg-night-900/60 p-5 text-start shadow-sm backdrop-blur-xl";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        role="listitem"
        aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${sub}`}
        className={`${cls} cursor-pointer ${isAccent ? "hover:bg-volt-400/[0.09]" : "hover:bg-white/[0.03]"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div role="listitem" aria-label={`${label}: ${value}. ${sub}`} className={cls}>
      {inner}
    </div>
  );
}

/* Isolated KPI row: the four count-up animations re-render only this grid,
   never the dashboard above it (charts, lists). Concept layout:
   Active clients → Checked in today → Need attention → Renewals this week. */
export function KpiRow({
  activeCount,
  planUsageLabel,
  todayCheckIns,
  activePct,
  attentionCount,
  topAttention,
  renewalsCount,
  renewalsSub,
  onViewRoster,
  onViewCheckins,
  onReviewAttention,
  onViewRenewals,
}: {
  activeCount: number;
  planUsageLabel: string;
  todayCheckIns: number;
  activePct: number;
  attentionCount: number;
  topAttention: string | null;
  renewalsCount: number;
  renewalsSub: string;
  onViewRoster: () => void;
  onViewCheckins: () => void;
  onReviewAttention: () => void;
  onViewRenewals: () => void;
}) {
  const animActive = useCountUp(activeCount);
  const animToday = useCountUp(todayCheckIns);
  const animAttention = useCountUp(attentionCount);
  const animRenewals = useCountUp(renewalsCount);

  return (
    <div className="rise grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "60ms" }} role="list" aria-label="Today's key numbers">
      <KpiCard
        label="Active Clients"
        value={String(Math.round(animActive))}
        sub={planUsageLabel}
        chip={{ text: planUsageLabel, tone: "muted" }}
        icon={<Users className="h-4 w-4" />}
        onClick={onViewRoster}
      />
      <KpiCard
        label="Checked in today"
        value={String(Math.round(animToday))}
        sub={activeCount > 0 ? `${activePct}% of active clients` : "No active clients yet"}
        chip={
          activeCount > 0
            ? { text: `${activePct}% of active`, tone: todayCheckIns > 0 ? "good" : "muted" }
            : { text: "No active clients", tone: "muted" }
        }
        icon={<CheckCircle2 className="h-4 w-4" />}
        onClick={onViewCheckins}
      />
      <KpiCard
        label="Need attention"
        value={String(Math.round(animAttention))}
        sub={topAttention ?? "All clear"}
        chip={attentionCount > 0 ? { text: topAttention ?? "Review", tone: "warn" } : { text: "All clear", tone: "good" }}
        icon={<AlertTriangle className="h-4 w-4" />}
        tone={attentionCount > 0 ? "warn" : undefined}
        onClick={onReviewAttention}
      />
      <KpiCard
        label="Renewals this week"
        value={String(Math.round(animRenewals))}
        sub={renewalsSub}
        chip={{ text: renewalsSub, tone: renewalsCount > 0 ? "danger" : "muted" }}
        icon={<CalendarClock className="h-4 w-4" />}
        tone={renewalsCount > 0 ? "danger" : undefined}
        onClick={onViewRenewals}
      />
    </div>
  );
}
