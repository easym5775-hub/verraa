import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Shared dashboard card frame — header + bordered body. Supports collapsible mode. */
export function CardShell({
  label,
  icon,
  count,
  countTone,
  action,
  children,
  delay = 0,
  className = "",
  collapsible = false,
  open = true,
  onToggle,
}: {
  label: string;
  icon?: ReactNode;
  count?: ReactNode;
  countTone?: string;
  action?: ReactNode;
  children: ReactNode;
  delay?: number;
  className?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <section
      aria-label={label}
      className={`rise flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        {collapsible ? (
          <button
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${label} — ${open ? "collapse" : "expand"}`}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
          >
            {icon && (
              <span className="icon-tile h-8 w-8 shrink-0" aria-hidden="true">
                {icon}
              </span>
            )}
            <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">{label}</h2>
            {count !== undefined && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold leading-5 tnum ring-1 ${countTone ?? "bg-white/[0.05] text-mist-400 ring-white/10"}`}>
                {count}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-mist-500 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <>
            {icon && (
              <span className="icon-tile h-8 w-8 shrink-0" aria-hidden="true">
                {icon}
              </span>
            )}
            <h2 className="truncate text-sm font-bold tracking-tight text-mist-100">{label}</h2>
            {count !== undefined && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold leading-5 tnum ring-1 ${countTone ?? "bg-white/[0.05] text-mist-400 ring-white/10"}`}>
                {count}
              </span>
            )}
          </>
        )}
        {action && <div className="ms-auto flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      {collapsible ? (
        <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
      ) : (
        <>{children}</>
      )}
    </section>
  );
}
