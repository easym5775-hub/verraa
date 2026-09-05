/* ================================================================
   FORGE — shared UI primitives (premium-minimal system).
   Backward-compatible recipes + polished, accessible components.
   ================================================================ */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  Loader2,
  Star,
  X,
  ChevronDown,
  UserCheck,
  UserX,
  Trash2,
  Eye,
  Settings,
  UserPlus,
} from "lucide-react";
import { hueOf, initials } from "../lib";
import { useApp } from "../store";

/* ---------------- class recipes ---------------- */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-night-950";

export const inputCls =
  "h-11 w-full rounded-xl border border-white/[0.08] bg-night-900/80 px-4 text-sm text-mist-100 placeholder:text-mist-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-white/[0.14] focus:border-volt-400/60 focus:bg-night-900 focus:shadow-[0_0_0_3px_rgba(205,241,75,0.12)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger-400/60 aria-[invalid=true]:focus:border-danger-400 aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgba(245,138,126,0.14)]";

export const textareaCls =
  "w-full min-h-24 resize-y rounded-xl border border-white/[0.08] bg-night-900/80 px-4 py-3 text-sm leading-6 text-mist-100 placeholder:text-mist-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-white/[0.14] focus:border-volt-400/60 focus:bg-night-900 focus:shadow-[0_0_0_3px_rgba(205,241,75,0.12)] disabled:cursor-not-allowed disabled:opacity-50";

export const labelCls =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-mist-400";

export const btnBase =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm transition-all duration-200 active:translate-y-px active:scale-[0.98] cursor-pointer disabled:pointer-events-none disabled:opacity-45";

export const btnPrimary = `${btnBase} bg-volt-400 px-5 py-2.5 min-h-[42px] font-bold text-night-950 shadow-[0_6px_20px_-8px_rgba(205,241,75,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-volt-300 hover:shadow-[0_10px_28px_-10px_rgba(205,241,75,0.65)] ${focusRing}`;

export const btnSecondary = `${btnBase} border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 min-h-[42px] font-semibold text-mist-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/[0.14] hover:bg-white/[0.07] ${focusRing}`;

export const btnDanger = `${btnBase} border border-danger-500/25 bg-danger-500/[0.08] px-4 py-2.5 min-h-[42px] font-semibold text-danger-300 hover:border-danger-500/50 hover:bg-danger-500/[0.14] ${focusRing}`;

export const btnSm = "!px-3 !py-1.5 !min-h-[32px] !text-[12.5px] !rounded-[10px] !gap-1.5";

export const btnGhost = `${btnBase} bg-transparent px-4 py-2.5 min-h-[42px] font-semibold text-mist-300 hover:bg-white/[0.05] hover:text-mist-100 ${focusRing}`;

export const btnVolt = `${btnBase} bg-volt-400 px-4 py-2.5 min-h-[42px] font-bold text-night-950 shadow-[0_6px_20px_-8px_rgba(205,241,75,0.5)] hover:bg-volt-300 ${focusRing}`;

export const chip =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-5";

/* ---------------- hooks ---------------- */

export function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      prev.current = target;
      setVal(target);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      prev.current = target;
      setVal(target);
      return;
    }
    const from = prev.current;
    if (from === target) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/* ---------------- primitives ---------------- */

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

export function Divider({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`border-t border-white/[0.07] ${className}`} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
        {required && (
          <span aria-hidden="true" className="ms-1 text-volt-300">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-danger-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-5 text-mist-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-danger-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function Badge({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`${chip} ${className}`}>{children}</span>;
}

export function Avatar({
  name,
  photo,
  className = "h-10 w-10 text-xs",
  status,
}: {
  name: string;
  photo?: string;
  className?: string;
  status?: "online" | "away" | "busy";
}) {
  const h = hueOf(name);
  const dot =
    status === "online"
      ? "bg-moss-400"
      : status === "away"
        ? "bg-warn-400"
        : status === "busy"
          ? "bg-danger-400"
          : null;
  const inner = photo ? (
    <img
      src={photo}
      alt={name}
      loading="lazy"
      className={`shrink-0 rounded-[12px] object-cover ring-1 ring-white/10 ${className}`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[12px] font-bold ring-1 ring-white/10 ${className}`}
      style={{
        background: `linear-gradient(180deg, hsl(${h} 28% 20%), hsl(${h} 32% 14%))`,
        color: `hsl(${h} 65% 74%)`,
      }}
    >
      {initials(name)}
    </div>
  );
  if (!dot) return inner;
  return (
    <span className="relative inline-flex shrink-0">
      {inner}
      <span
        aria-hidden="true"
        className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-night-950 ${dot}`}
      />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex min-h-[44px] cursor-pointer items-center gap-3 text-start disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} rounded-xl`}
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ${
          checked ? "border-volt-500/60 bg-volt-400" : "border-white/10 bg-night-700"
        }`}
      >
        <span
          className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full shadow-md transition-all duration-200 ${
            checked ? "start-[calc(100%-22px)] bg-night-950" : "start-[3px] bg-mist-300"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-mist-100">{label}</span>
        {hint && <span className="block text-xs text-mist-500">{hint}</span>}
      </span>
    </button>
  );
}

export function MoodDots({ mood }: { mood: number }) {
  const color = mood >= 4 ? "bg-volt-400" : mood === 3 ? "bg-warn-400" : "bg-danger-400";
  return (
    <span className="inline-flex items-center gap-1" title={`Mood ${mood}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= mood ? color : "bg-white/10"}`} />
      ))}
    </span>
  );
}

export function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["Rough", "Meh", "Okay", "Good", "Great"];
  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-1" role="radiogroup" aria-label="Mood">
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= value;
        const tone = value >= 4 ? "text-volt-400" : value === 3 ? "text-warn-400" : "text-danger-400";
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`Mood ${i} — ${labels[i - 1]}`}
            onClick={() => onChange(i)}
            className={`cursor-pointer rounded-lg p-1.5 transition hover:scale-110 active:scale-95 ${focusRing} ${on ? tone : "text-night-500 hover:text-mist-400"}`}
          >
            <Star className="h-6 w-6" fill={on ? "currentColor" : "none"} />
          </button>
        );
      })}
      <span className="ms-2 text-xs font-bold text-mist-300">{labels[Math.max(0, Math.min(4, value - 1))]}</span>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  footer,
  className = "",
  bodyCls = "p-6",
  delay = 0,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyCls?: string;
  delay?: number;
}) {
  return (
    <section
      aria-label={title}
      className={`rise overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 shadow-sm backdrop-blur-xl ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-4">
        {icon && (
          <span className="icon-tile h-9 w-9 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[13px] font-bold uppercase tracking-[0.14em] text-mist-100">{title}</h2>
          {description && <p className="mt-0.5 truncate text-xs text-mist-500">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={bodyCls}>{children}</div>
      {footer && <div className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-3.5">{footer}</div>}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  children,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center">
      <div className="icon-tile h-14 w-14 !rounded-2xl" aria-hidden="true">
        {icon}
      </div>
      <p className="text-balance text-[15px] font-bold text-mist-100">{title}</p>
      {sub && <p className="max-w-sm text-balance text-[13px] leading-6 text-mist-400">{sub}</p>}
      {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-xl ${className}`} />;
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  sub,
  action,
  back,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  sub?: string;
  action?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        {back && <div className="mb-3">{back}</div>}
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

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
  size,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog for keyboard + screen-reader users.
    const t = window.setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-3xl" : wide ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="animate-fade absolute inset-0 bg-night-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`animate-modal relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] border border-white/10 bg-night-900 shadow-xl outline-none sm:rounded-[22px] ${maxW}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-night-900/90 px-6 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <h3 id={titleId} className="truncate text-[15px] font-bold tracking-tight text-mist-100">
              {title}
            </h3>
            {description && (
              <p id={descId} className="mt-0.5 text-[13px] leading-5 text-mist-400">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            autoFocus={false}
            className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-transparent text-mist-400 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-mist-100 ${focusRing}`}
            aria-label="Close dialog"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-danger-500/25 bg-danger-500/10 text-danger-300">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 text-sm leading-6 text-mist-300">{message}</div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button className={`${btnSecondary} w-full`} onClick={onClose} autoFocus>
          Cancel
        </button>
        <button
          className={`${btnDanger} w-full !border-danger-500/40 !bg-danger-500 !text-white hover:!bg-danger-400`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export type DropdownItem =
  | { type: "item"; label: string; hint?: string; icon?: React.ComponentType<{ className?: string }>; onClick: () => void; danger?: boolean }
  | { type: "divider" };

export function Dropdown({
  open,
  onOpenChange,
  items,
  trigger,
  align = "start",
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DropdownItem[];
  trigger: ReactNode;
  align?: "start" | "end";
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(open);
  }, [open ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        onOpenChange(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        onOpenChange(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKey);
      // Focus first item for keyboard users.
      const t = window.setTimeout(() => {
        menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
      }, 20);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKey);
        window.clearTimeout(t);
      };
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      {trigger}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label ?? "Menu"}
          className={`animate-dropdown absolute top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-2xl border border-white/10 bg-night-900/95 p-1.5 shadow-xl backdrop-blur-xl ${
            align === "end" ? "end-0" : "start-0"
          }`}
        >
          {items.map((item, idx) =>
            item.type === "divider" ? (
              <div key={`divider-${idx}`} className="mx-2 my-1.5 border-t border-white/[0.07]" />
            ) : (
              <button
                key={idx}
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                  onOpenChange(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-[13px] font-semibold transition-colors ${focusRing} ${
                  item.danger ? "text-danger-300 hover:bg-danger-500/10" : "text-mist-200 hover:bg-white/[0.06] hover:text-mist-100"
                }`}
              >
                {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-80" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="shrink-0 text-[11px] font-medium text-mist-500">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Collapsible({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold text-mist-300 transition hover:text-mist-100 ${focusRing}`}
      >
        {label}
        <ChevronDown className={`h-4 w-4 shrink-0 text-mist-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-white/[0.06] px-3.5 py-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismiss } = useApp();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[120] flex w-full max-w-[380px] -translate-x-1/2 flex-col gap-2 px-4 sm:left-auto sm:right-6 sm:translate-x-0 sm:px-0"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/10 bg-night-900/95 px-4 py-3 shadow-xl backdrop-blur-xl"
        >
          <span
            className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
              t.kind === "ok" ? "bg-volt-400 text-night-950" : "bg-warn-400 text-night-950"
            }`}
            aria-hidden="true"
          >
            {t.kind === "ok" ? (
              <Check className="h-4 w-4" strokeWidth={2.8} />
            ) : (
              <AlertTriangle className="h-4 w-4" strokeWidth={2.4} />
            )}
          </span>
          <span className="min-w-0 flex-1 pt-0.5 text-[13px] font-semibold leading-5 text-mist-100">{t.msg}</span>
          <button
            onClick={() => dismiss(t.id)}
            className={`-me-1 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100 ${focusRing}`}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* Re-export a few icons so older imports keep working if they came via ui */
export { UserCheck, UserX, Trash2, Eye, Settings, UserPlus };
