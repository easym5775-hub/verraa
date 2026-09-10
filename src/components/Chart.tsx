/* ================================================================
   VERRAA — inline SVG charts (no chart library needed).
   ================================================================ */

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { CheckIn } from "../types";
import { fmtShort } from "../lib";

/* ---------------- weight trend line ---------------- */

export function WeightLine({ entries }: { entries: CheckIn[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts);

  if (sorted.length < 2) {
    return (
      <div className="grid h-44 place-items-center rounded-xl border border-night-700 bg-night-800/50 px-6 text-center text-xs text-mist-500">
        Log at least two check-ins to draw your trend.
      </div>
    );
  }

  const W = 620;
  const H = 240;
  const padT = 18;
  const padB = 30;
  const padL = 16;
  const padR = 46;
  const ws = sorted.map((e) => e.weight);
  const min = Math.min(...ws) - 1.2;
  const max = Math.max(...ws) + 1.2;
  const n = sorted.length;
  const x = (i: number) => padL + (W - padL - padR) * (1 - i / (n - 1));
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min || 1));

  const pts = sorted.map((e, i) => `${x(i).toFixed(1)},${y(e.weight).toFixed(1)}`);
  const line = `M${pts.join(" L")}`;
  const area = `${line} L${x(n - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;
  const last = sorted[n - 1];

  const pickAt = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    sorted.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full touch-pan-y"
      role="img"
      aria-label="Weight trend"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => pickAt(e.clientX, e.currentTarget)}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) pickAt(t.clientX, e.currentTarget);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) pickAt(t.clientX, e.currentTarget);
      }}
      onTouchEnd={() => setHover(null)}
    >
      <defs>
        <linearGradient id="wgArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopOpacity="0.18" style={{ stopColor: "var(--chart-line)" }} />
          <stop offset="100%" stopOpacity="0" style={{ stopColor: "var(--chart-line)" }} />
        </linearGradient>
      </defs>
      {[0, 1 / 3, 2 / 3, 1].map((f) => {
        const v = min + (max - min) * f;
        const gy = y(v);
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR + 6} y1={gy} y2={gy} strokeWidth="1" style={{ stroke: "var(--chart-grid)" }} />
            <text x={W - padR + 12} y={gy + 4} fontSize="11" fontFamily="var(--font-display)" style={{ fill: "var(--chart-tick)" }}>
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#wgArea)" />
      <path d={line} fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--chart-line)" }} />
      {sorted.map((e, i) =>
        hover === i ? null : <circle key={e.id} cx={x(i)} cy={y(e.weight)} r="3" strokeWidth="2" style={{ fill: "var(--chart-dot)", stroke: "var(--chart-line)" }} />,
      )}
      {hover !== null && sorted[hover] && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} strokeWidth="1" strokeDasharray="3 3" style={{ stroke: "var(--chart-guide)" }} />
          <circle cx={x(hover)} cy={y(sorted[hover].weight)} r="10" opacity="0.18" className="ring-pulse" style={{ fill: "var(--chart-line)" }} />
          <circle cx={x(hover)} cy={y(sorted[hover].weight)} r="4.5" strokeWidth="2" style={{ fill: "var(--chart-line)", stroke: "var(--chart-dot)" }} />
          <text
            x={Math.min(Math.max(x(hover), 40), W - 60)}
            y={Math.max(y(sorted[hover].weight) - 14, 14)}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fontFamily="var(--font-display)"
            style={{ fill: "var(--chart-label)" }}
          >
            {sorted[hover].weight} kg
          </text>
        </g>
      )}
      {hover === null && (
        <text
          x={x(n - 1)}
          y={y(last.weight) - 12}
          textAnchor="middle"
          fontSize="14"
          fontWeight="700"
          fontFamily="var(--font-display)"
          style={{ fill: "var(--chart-label)" }}
        >
          {last.weight}
        </text>
      )}
      <text x={x(0)} y={H - 8} textAnchor="middle" fontSize="11" style={{ fill: "var(--chart-tick)" }}>
        {fmtShort(sorted[0].date)}
      </text>
      <text x={x(n - 1)} y={H - 8} textAnchor="middle" fontSize="11" style={{ fill: "var(--chart-tick)" }}>
        {fmtShort(last.date)}
      </text>
    </svg>
  );
}

/* ---------------- diet adherence trend (last 7 days) ----------------
   rate is 0..1 per day, null on rest days (gaps in the line).
   Hover / tap a point and the panel below shows that day's story:
   what was eaten, and exactly which meals broke the diet. */

export interface AdherenceDay {
  date: string;
  weekday: string; // "Monday"
  letter: string; // "M"
  planned: number;
  eaten: number;
  skipped: { mealType: string; mealDescription: string }[];
  rate: number | null;
  followed: string | null; // e.g. "Wednesday" — the menu the client picked that day
}

function rateColor(rate: number): string {
  if (rate >= 1) return "#4ade80"; // moss-400
  if (rate >= 0.5) return "#ffc53d"; // warn-400
  return "#f87171"; // danger-400
}

export function AdherenceTrend({ days }: { days: AdherenceDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const defaultIdx = (() => {
    for (let i = n - 1; i >= 0; i--) if (days[i]?.rate !== null) return i;
    return n - 1;
  })();
  const sel = hover ?? defaultIdx;
  const day = days[sel];

  if (n === 0 || days.every((d) => d.rate === null)) {
    return (
      <div className="grid h-44 place-items-center rounded-xl border border-night-700 bg-night-800/50 px-6 text-center text-xs text-mist-500">
        No planned meals in this window — assign meals to track adherence.
      </div>
    );
  }

  const W = 620;
  const H = 230;
  const padT = 22;
  const padB = 32;
  const padL = 30;
  const padR = 48;
  const x = (i: number) => padL + ((W - padL - padR) * i) / Math.max(1, n - 1);
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.min(1, Math.max(0, v)));

  // Line segments — rest days (null) break the line so dips and climbs
  // always reflect real marked days.
  const segs: { line: string; area: string; color: string }[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1) {
      const line = `M${run.map((i) => `${x(i).toFixed(1)},${y(days[i]!.rate!).toFixed(1)}`).join(" L")}`;
      segs.push({
        line,
        area: `${line} L${x(run[run.length - 1]).toFixed(1)},${H - padB} L${x(run[0]).toFixed(1)},${H - padB} Z`,
        color: "#cdf14b",
      });
    }
    run = [];
  };
  days.forEach((d, i) => {
    if (d.rate === null) flush();
    else run.push(i);
  });
  flush();

  const pickAt = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    days.forEach((_, i) => {
      const d = Math.abs(x(i) - px);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const unlogged = day && day.rate !== null ? Math.max(0, day.planned - day.eaten - day.skipped.length) : 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair touch-pan-y"
        role="img"
        aria-label="Diet adherence trend"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => pickAt(e.clientX, e.currentTarget)}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) pickAt(t.clientX, e.currentTarget);
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) pickAt(t.clientX, e.currentTarget);
        }}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="adArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#cdf14b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR + 6} y1={y(f)} y2={y(f)} strokeWidth="1" style={{ stroke: "var(--chart-grid)" }} />
            <text x={W - padR + 12} y={y(f) + 4} fontSize="11" fontFamily="var(--font-display)" style={{ fill: "var(--chart-tick)" }}>
              {Math.round(f * 100)}%
            </text>
          </g>
        ))}
        {segs.map((s, i) => (
          <g key={i}>
            <path d={s.area} fill="url(#adArea)" />
            <path d={s.line} fill="none" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--chart-line)" }} />
          </g>
        ))}
        {days.map((d, i) =>
          d.rate === null ? (
            <circle key={d.date} cx={x(i)} cy={H - padB} r="3" fill="none" strokeWidth="1.5" style={{ stroke: "var(--chart-tick)" }} opacity="0.5" />
          ) : hover === i ? null : (
            <circle key={d.date} cx={x(i)} cy={y(d.rate)} r="4" strokeWidth="2" style={{ fill: rateColor(d.rate), stroke: "var(--chart-dot)" }} />
          ),
        )}
        {day && day.rate !== null && (
          <g>
            <line x1={x(sel)} x2={x(sel)} y1={padT} y2={H - padB} strokeWidth="1" strokeDasharray="3 3" style={{ stroke: "var(--chart-guide)" }} />
            <circle cx={x(sel)} cy={y(day.rate)} r="11" opacity="0.18" className="ring-pulse" style={{ fill: rateColor(day.rate) }} />
            <circle cx={x(sel)} cy={y(day.rate)} r="5" strokeWidth="2" style={{ fill: rateColor(day.rate), stroke: "var(--chart-dot)" }} />
            <text
              x={Math.min(Math.max(x(sel), 48), W - 56)}
              y={Math.max(y(day.rate) - 14, 14)}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fontFamily="var(--font-display)"
              style={{ fill: "var(--chart-label)" }}
            >
              {Math.round(day.rate * 100)}%
            </text>
          </g>
        )}
        {days.map((d, i) => (
          <text key={d.date} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fontWeight={i === sel ? "700" : "400"} style={{ fill: i === sel ? "var(--chart-label)" : "var(--chart-tick)" }}>
            {d.letter}
          </text>
        ))}
      </svg>

      {/* day inspector — follows hover / tap */}
      {day && (
        <div className="mt-1 rounded-xl border border-night-700 bg-night-800/70 p-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-[13px] font-extrabold text-mist-100">
              {day.weekday} <span className="font-semibold text-mist-500">· {fmtShort(day.date)}</span>
            </p>
            {day.rate === null ? (
              <span className="text-[11px] font-bold text-mist-500">Rest day — no meals planned</span>
            ) : (
              <span className="text-[11px] font-bold text-mist-400 tnum">
                {day.eaten}/{day.planned} on track{day.followed ? ` · ${day.followed} menu` : ""}
              </span>
            )}
          </div>
          {day.rate !== null && (
            <div className="mt-1.5 grid gap-1">
              {day.skipped.length === 0 && unlogged === 0 && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-moss-300">
                  <Check className="h-3.5 w-3.5" /> Perfect day — everything on track
                </p>
              )}
              {day.skipped.map((s, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs leading-5 text-danger-300">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.8} />
                  <span>
                    <span className="font-bold">{s.mealType}</span>
                    <span className="text-danger-300/80"> — {s.mealDescription}</span>
                  </span>
                </p>
              ))}
              {unlogged > 0 && (
                <p className="text-[11px] font-semibold text-mist-500">
                  {unlogged} meal{unlogged === 1 ? "" : "s"} not logged yet
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- macro split bar ---------------- */

export function MacroSplit({ protein, carbs, fats }: { protein: number; carbs: number; fats: number }) {
  const total = protein + carbs + fats;
  if (total <= 0) return null;
  const p = (protein / total) * 100;
  const c = (carbs / total) * 100;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-2xl bg-night-700">
        <div className="grow-x h-full bg-volt-400" style={{ width: `${p}%` }} />
        <div className="grow-x h-full bg-sky-400" style={{ width: `${c}%`, animationDelay: "120ms" }} />
        <div className="grow-x h-full bg-warn-400" style={{ width: `${100 - p - c}%`, animationDelay: "240ms" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
        <span className="flex items-center gap-1.5 text-volt-300"><span className="h-1.5 w-1.5 rounded-2xl bg-volt-400" />Protein {protein}g</span>
        <span className="flex items-center gap-1.5 text-sky-300"><span className="h-1.5 w-1.5 rounded-2xl bg-sky-400" />Carbs {carbs}g</span>
        <span className="flex items-center gap-1.5 text-warn-300"><span className="h-1.5 w-1.5 rounded-2xl bg-warn-400" />Fats {fats}g</span>
      </div>
    </div>
  );
}
