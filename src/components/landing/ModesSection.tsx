/* ================================================================
   VERRAA — modes hub: a mind-map straight from the whiteboard.
   VERRAA node in the center, two curved branches out to Coach Mode
   and Client Mode. Each branch is a link to its full feature page.
   Desktop: diagonal diagram stage. Mobile: vertical tree.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, Dumbbell, Smartphone, Zap } from "lucide-react";
import { Reveal, SectionShell } from "./Reveal";

interface Side {
  to: string;
  icon: typeof Zap;
  mode: string;
  discover: string;
  points: readonly string[];
  cta: string;
  accent: boolean;
}

const COACH_SIDE: Side = {
  to: "/coach-mode",
  icon: Zap,
  mode: "Coach Mode",
  discover: "Discover what you'll get in your space.",
  points: ["Command-center dashboard", "Check-ins, plans & payments", "Your full client roster"],
  cta: "Explore Coach Mode",
  accent: false,
};

const CLIENT_SIDE: Side = {
  to: "/client-mode",
  icon: Smartphone,
  mode: "Client Mode",
  discover: "Discover what your client will get.",
  points: ["Daily training & meals", "60-second check-ins", "A direct line to you"],
  cta: "Explore Client Mode",
  accent: true,
};

export function ModesSection() {
  return (
    <SectionShell
      id="modes"
      step="01"
      eyebrow="Two modes, one system"
      title="One VERRAA. Two Spaces."
      labelledBy="modes-title"
      sub="You run the business from Coach Mode. Your clients live the program in Client Mode. Follow a branch to see exactly what's inside."
    >
      {/* -------- desktop mind-map stage -------- */}
      <div className="relative mx-auto hidden h-[560px] max-w-5xl lg:block" aria-hidden="false">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="branch-left" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#cdf14b" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="branch-right" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#cdf14b" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#cdf14b" stopOpacity="0.12" />
            </linearGradient>
          </defs>
          <path
            d="M 43.5 50 C 40 47, 38.6 40, 38 32"
            fill="none"
            stroke="url(#branch-left)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <path
            d="M 56.5 50 C 60 53, 61.4 60, 62 68"
            fill="none"
            stroke="url(#branch-right)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        </svg>
        {/* endpoint nodes where branches meet the cards */}
        <span aria-hidden="true" className="absolute left-[38%] top-[32%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt-400 shadow-[0_0_16px_2px_rgba(205,241,75,0.55)]" />
        <span aria-hidden="true" className="absolute left-[62%] top-[68%] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt-400 shadow-[0_0_16px_2px_rgba(205,241,75,0.55)]" />

        <Reveal className="absolute left-0 top-0 h-[350px] w-[37%]" delay={0}>
          <ModeBranchCard side={COACH_SIDE} />
        </Reveal>

        <Reveal delay={120} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <HubNode size="lg" />
        </Reveal>

        <Reveal className="absolute bottom-0 right-0 h-[350px] w-[37%]" delay={200}>
          <ModeBranchCard side={CLIENT_SIDE} />
        </Reveal>
      </div>

      {/* -------- mobile vertical tree -------- */}
      <div className="mx-auto grid max-w-md justify-items-center lg:hidden">
        <Reveal>
          <HubNode size="sm" />
        </Reveal>
        <span aria-hidden="true" className="h-10 w-px bg-gradient-to-b from-volt-400/60 to-volt-400/10" />
        <Reveal className="w-full" delay={80}>
          <ModeBranchCard side={COACH_SIDE} />
        </Reveal>
        <span aria-hidden="true" className="h-10 w-px bg-gradient-to-b from-volt-400/60 to-volt-400/10" />
        <Reveal className="w-full" delay={160}>
          <ModeBranchCard side={CLIENT_SIDE} />
        </Reveal>
      </div>
    </SectionShell>
  );
}

/* ---------------- center VERRAA node ---------------- */

function HubNode({ size }: { size: "lg" | "sm" }) {
  const dim = size === "lg" ? "h-36 w-36" : "h-24 w-24";
  const icon = size === "lg" ? "h-7 w-7" : "h-5 w-5";
  const word = size === "lg" ? "text-[22px]" : "text-[16px]";
  return (
    <div className={`relative grid ${dim} shrink-0 place-items-center`} aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-volt-400/10 blur-2xl" />
      <span className="spin-slower absolute inset-0 rounded-full border border-dashed border-volt-400/40" />
      <span className="absolute inset-2.5 rounded-full border border-volt-400/50 bg-night-900 shadow-[0_0_56px_-8px_rgba(205,241,75,0.5)]" />
      <span className="relative text-center leading-none">
        <Dumbbell className={`mx-auto ${icon} text-volt-400`} strokeWidth={2.4} />
        <span className={`mt-1.5 block font-display font-bold uppercase tracking-wide text-mist-100 ${word}`}>
          Verraa
        </span>
      </span>
    </div>
  );
}

/* ---------------- clickable branch card ---------------- */

function ModeBranchCard({ side }: { side: Side }) {
  return (
    <Link
      to={side.to}
      aria-label={`${side.cta} — ${side.discover}`}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-[24px] border bg-night-900/75 p-6 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 sm:p-7 ${
        side.accent
          ? "border-volt-400/35 shadow-[0_16px_48px_-20px_rgba(205,241,75,0.45)] hover:border-volt-400/60"
          : "border-white/[0.09] hover:border-volt-400/35"
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <span className="flex items-center gap-3">
        <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl" aria-hidden="true">
          <side.icon className="h-5 w-5" />
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-volt-300">
          Discover
        </span>
      </span>
      <span className="mt-3 block font-display text-[34px] font-bold uppercase leading-[0.95] tracking-wide text-mist-100">
        {side.mode}
      </span>
      <span className="mt-2 block text-[14px] font-bold leading-6 text-mist-300">{side.discover}</span>
      <span className="mt-4 grid flex-1 content-start gap-2">
        {side.points.map((p) => (
          <span key={p} className="flex items-center gap-2 text-[13px] font-semibold text-mist-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-volt-400" aria-hidden="true" />
            {p}
          </span>
        ))}
      </span>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-volt-300 transition group-hover:gap-3 group-hover:text-volt-200">
        {side.cta}
        <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </span>
    </Link>
  );
}
