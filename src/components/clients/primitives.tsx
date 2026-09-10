import type { ReactNode } from "react";
import { useApp } from "../../store";
import { PRIORITIES, PRIORITY_META, normalizePriority, type Client, type ClientPriority } from "../../types";
import type { DropdownItem } from "../ui";

export function KV({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-night-700 bg-night-800 p-2.5">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">{k}</p>
      <p className={`mt-0.5 font-display text-[17px] font-bold tnum ${tone ?? "text-mist-100"}`}>{v}</p>
    </div>
  );
}

/* Compact KPI tile for the profile priority strip. */
export function Kpi({
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warn" | "bad";
  onClick?: () => void;
}) {
  const cls =
    "rise rounded-2xl border border-white/[0.07] bg-night-900/60 px-3 py-2.5 text-start backdrop-blur-xl transition";
  const interactive = onClick ? "cursor-pointer hover:border-volt-400/30" : "";
  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{label}</p>
      <p className={`mt-0.5 truncate text-[17px] font-extrabold leading-6 ${tone === "good" ? "text-moss-300" : tone === "warn" ? "text-warn-300" : tone === "bad" ? "text-danger-300" : "text-mist-100"}`}>
        {value}
      </p>
      {sub && <p className="truncate text-[11px] font-semibold text-mist-500">{sub}</p>}
    </>
  );
  return onClick ? (
    <button className={`${cls} ${interactive}`} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/* Compact label/value pair for the header's basic-info block. */
export function HeaderFact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">{label}</dt>
      <dd title={title ?? value} className="mt-0.5 truncate text-xs font-bold text-mist-200">
        {value}
      </dd>
    </div>
  );
}

/* Priority badge — hidden for Normal (and unknown) to reduce noise. */
export function PriorityBadge({ priority, className = "" }: { priority: Client["priority"]; className?: string }) {
  const normalized = normalizePriority(priority);
  if (normalized === "Normal") return null;
  const meta = PRIORITY_META[normalized];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[9.5px] font-extrabold uppercase tracking-wide ${meta.chip} ${className}`}>
      <span className={`h-1 w-1 rounded-full ${meta.dot}`} />
      {normalized}
    </span>
  );
}

/* Priority picker items for any client "More" menu — Critical / Medium / Normal. */
export function usePriorityItems(client: Client): DropdownItem[] {
  const { updateClient } = useApp();
  return PRIORITIES.map((p: ClientPriority) => ({
    type: "item" as const,
    label: `${p} priority`,
    hint: client.priority === p ? "✓" : undefined,
    onClick: () => {
      if (client.priority !== p) updateClient({ ...client, priority: p });
    },
  }));
}

/* Compact empty state for small cards — replaces the tall hero EmptyState
   inside grid tiles so columns stay balanced. */
export function MiniEmpty({
  icon,
  title,
  sub,
  action,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-5 text-center">
      <span className="icon-tile h-9 w-9" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-1 text-[13px] font-bold text-mist-200">{title}</p>
      {sub && <p className="max-w-[220px] text-xs leading-5 text-mist-500">{sub}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
