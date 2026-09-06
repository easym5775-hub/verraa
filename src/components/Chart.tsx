/* ================================================================
   VERRAA — inline SVG charts (no chart library needed).
   ================================================================ */

import { useState } from "react";
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

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Weight trend"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
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
      }}
    >
      <defs>
        <linearGradient id="wgArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#cdf14b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1 / 3, 2 / 3, 1].map((f) => {
        const v = min + (max - min) * f;
        const gy = y(v);
        return (
          <g key={f}>
            <line x1={padL} x2={W - padR + 6} y1={gy} y2={gy} stroke="#1a251d" strokeWidth="1" />
            <text x={W - padR + 12} y={gy + 4} fontSize="11" fill="#7c9486" fontFamily="var(--font-display)">
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}
      <path d={area} fill="url(#wgArea)" />
      <path d={line} fill="none" stroke="#cdf14b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((e, i) =>
        hover === i ? null : <circle key={e.id} cx={x(i)} cy={y(e.weight)} r="3" fill="#0f1611" stroke="#cdf14b" strokeWidth="2" />,
      )}
      {hover !== null && sorted[hover] && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#31443a" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(sorted[hover].weight)} r="10" fill="#cdf14b" opacity="0.18" className="ring-pulse" />
          <circle cx={x(hover)} cy={y(sorted[hover].weight)} r="4.5" fill="#cdf14b" stroke="#0f1611" strokeWidth="2" />
          <text
            x={Math.min(Math.max(x(hover), 40), W - 60)}
            y={Math.max(y(sorted[hover].weight) - 14, 14)}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#dcf770"
            fontFamily="var(--font-display)"
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
          fill="#dcf770"
          fontFamily="var(--font-display)"
        >
          {last.weight}
        </text>
      )}
      <text x={x(0)} y={H - 8} textAnchor="middle" fontSize="11" fill="#7c9486">
        {fmtShort(sorted[0].date)}
      </text>
      <text x={x(n - 1)} y={H - 8} textAnchor="middle" fontSize="11" fill="#7c9486">
        {fmtShort(last.date)}
      </text>
    </svg>
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
