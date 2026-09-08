import type { ReactNode } from "react";
import { ArrowRight, CalendarDays, Camera, Users, Wallet } from "lucide-react";
import { fmtMoney } from "../../lib";
import { useCountUp } from "../ui";

export function KpiCard({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  icon: ReactNode;
  tone?: "warn" | "danger";
  onClick?: () => void;
  actionLabel?: string;
}) {
  const valueTone = tone === "danger" ? "text-danger-300" : tone === "warn" ? "text-warn-300" : "text-mist-100";
  const inner = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist-500">{label}</span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] ${tone ? valueTone : "text-mist-400"}`}>
          {icon}
        </span>
      </span>
      <span className={`mt-2.5 block text-[30px] font-extrabold leading-8 tracking-tight tnum sm:text-[32px] ${valueTone}`}>
        {value}
        {unit && <span className="ms-1.5 text-[13px] font-bold text-mist-500">{unit}</span>}
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-mist-500">
        <span className="truncate">{sub}</span>
        {onClick && actionLabel && (
          <span className="ms-auto inline-flex shrink-0 items-center gap-0.5 font-bold text-volt-300">
            {actionLabel} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </span>
        )}
      </span>
    </>
  );
  const cls = "rise card-lift group relative min-h-[104px] rounded-2xl border border-white/[0.07] bg-night-900/60 p-5 text-start shadow-sm backdrop-blur-xl";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        role="listitem"
        aria-label={`${label}: ${value}${unit ? ` ${unit}` : ""}. ${sub}`}
        className={`${cls} cursor-pointer hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50`}
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
   never the dashboard above it (charts, lists). Visual output identical. */
export function KpiRow({
  pendingCount,
  overdueCount,
  sessionsCount,
  nextSessionLabel,
  activeCount,
  totalCount,
  attentionCount,
  outstandingTotal,
  outstandingCount,
  onReviewCheckins,
  onAddSession,
  onViewRoster,
  onCollect,
}: {
  pendingCount: number;
  overdueCount: number;
  sessionsCount: number;
  nextSessionLabel: string | null;
  activeCount: number;
  totalCount: number;
  attentionCount: number;
  outstandingTotal: number;
  outstandingCount: number;
  onReviewCheckins: () => void;
  onAddSession: () => void;
  onViewRoster: () => void;
  onCollect: () => void;
}) {
  const animPending = useCountUp(pendingCount);
  const animSessions = useCountUp(sessionsCount);
  const animActive = useCountUp(activeCount);
  const animOutstanding = useCountUp(outstandingTotal);

  return (
    <div className="rise grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "60ms" }} role="list" aria-label="Today's key numbers">
      <KpiCard
        label="Pending Check-ins"
        value={String(Math.round(animPending))}
        sub={pendingCount ? (overdueCount > 0 ? `${overdueCount} overdue · Review now` : "Review now") : "Inbox zero — nice"}
        icon={<Camera className="h-4 w-4" />}
        tone={pendingCount > 0 ? (overdueCount > 0 ? "danger" : "warn") : undefined}
        onClick={pendingCount ? onReviewCheckins : undefined}
        actionLabel="Review"
      />
      <KpiCard
        label="Sessions Today"
        value={String(Math.round(animSessions))}
        sub={sessionsCount ? (nextSessionLabel ? `Next at ${nextSessionLabel}` : `${sessionsCount} on the books`) : "Schedule is clear"}
        icon={<CalendarDays className="h-4 w-4" />}
        onClick={sessionsCount ? undefined : onAddSession}
        actionLabel={sessionsCount ? undefined : "Add session"}
      />
      <KpiCard
        label="Active Clients"
        value={String(Math.round(animActive))}
        sub={
          attentionCount > 0
            ? `${Math.min(attentionCount, activeCount)} need${Math.min(attentionCount, activeCount) === 1 ? "s" : ""} attention`
            : totalCount - activeCount > 0
              ? `${totalCount - activeCount} inactive`
              : "Roster healthy"
        }
        icon={<Users className="h-4 w-4" />}
        onClick={onViewRoster}
        actionLabel="View roster"
      />
      <KpiCard
        label="Outstanding Payments"
        value={fmtMoney(Math.round(animOutstanding))}
        unit="EGP"
        sub={outstandingCount ? `${outstandingCount} overdue payment${outstandingCount === 1 ? "" : "s"}` : "All settled"}
        icon={<Wallet className="h-4 w-4" />}
        tone={outstandingCount > 0 ? "danger" : undefined}
        onClick={outstandingCount ? onCollect : undefined}
        actionLabel={outstandingCount ? "Collect" : undefined}
      />
    </div>
  );
}
