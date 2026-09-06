/* ================================================================
   VERRAA — problem → solution, told through the coach's real day.
   Six concrete pains (scenario + what it costs), then the VERRAA fix
   for each — mapped to real product surfaces, no generic filler.
   ================================================================ */

import {
  AlarmClock,
  BellRing,
  CalendarX,
  Camera,
  Check,
  FileText,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { Reveal, SectionShell } from "./Reveal";

interface Pain {
  icon: typeof MessageCircle;
  title: string;
  scenario: string;
  cost: string;
}

const PAINS: Pain[] = [
  {
    icon: MessageCircle,
    title: "Check-ins drown in WhatsApp",
    scenario: "Progress photos, weights and “coach, look” messages buried under 200 unread chats.",
    cost: "Clients feel ignored — the quiet ones just leave.",
  },
  {
    icon: BellRing,
    title: "Follow-ups live in your head",
    scenario: "No system for who you contacted last, so the clients going quiet slip away unnoticed.",
    cost: "Churn you never saw coming.",
  },
  {
    icon: Wallet,
    title: "Money slips through the cracks",
    scenario: "“Did he pay? Was that transfer for last month?” You chase payments awkwardly — or not at all.",
    cost: "Uncollected revenue, every single month.",
  },
  {
    icon: CalendarX,
    title: "Subscriptions expire silently",
    scenario: "No renewal radar: clients keep training for free, or lapse without a word.",
    cost: "Free sessions you never agreed to give.",
  },
  {
    icon: FileText,
    title: "Plans live in screenshots",
    scenario: "Workouts sent as PDFs and voice notes can't be tracked, updated, or look professional.",
    cost: "You look replaceable — premium coaches don't.",
  },
  {
    icon: AlarmClock,
    title: "Sessions, no-shows and chaos",
    scenario: "The schedule lives in your head. Missed sessions go unlogged, no-shows unbilled.",
    cost: "Hours leak — and nobody's accountable.",
  },
];

const FIXES = [
  {
    icon: Camera,
    fix: "A check-in inbox — every submission in one place, oldest first. Nothing gets buried.",
  },
  {
    icon: BellRing,
    fix: "A follow-up radar — VERRAA flags who's gone quiet before they churn.",
  },
  {
    icon: Wallet,
    fix: "Payment clarity — who paid, who owes, what's outstanding. No awkward guessing.",
  },
  {
    icon: CalendarX,
    fix: "A renewal radar — expiring subscriptions surface days ahead, never after.",
  },
  {
    icon: FileText,
    fix: "Real plans, not screenshots — structured workouts you update in seconds.",
  },
] as const;

export function ProblemSolutionSection() {
  return (
    <SectionShell
      step="01"
      eyebrow="The problem"
      title="Stop Managing Your Coaching Business Manually."
      labelledBy="problem-title"
      sub="If any of these cost you money, time, or a client last month — that's exactly the problem VERRAA was built to kill."
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" role="list" aria-label="Problems coaches face without VERRAA">
        {PAINS.map((p, i) => (
          <Reveal key={p.title} delay={(i % 3) * 90} className="h-full">
            <article
              role="listitem"
              className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-danger-500/[0.14] bg-night-900/60 p-6 backdrop-blur-xl"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-danger-400/40 to-transparent"
              />
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl border border-danger-500/25 bg-danger-500/[0.08] text-danger-300"
                aria-hidden="true"
              >
                <p.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-mist-100">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-mist-400">{p.scenario}</p>
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-[13px] font-bold leading-5 text-danger-300">
                <span className="me-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-danger-400/80">
                  Costs you
                </span>
                {p.cost}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={100}>
        <p className="mx-auto mt-10 max-w-xl text-center text-[15px] font-bold leading-7 text-mist-100 sm:mt-12">
          VERRAA brings your coaching business into{" "}
          <span className="text-volt-300">one organized workspace</span> — and catches
          every one of these before it costs you:
        </p>
      </Reveal>

      <Reveal delay={140}>
        <div className="relative mx-auto mt-6 max-w-3xl overflow-hidden rounded-[20px] border border-volt-400/30 bg-night-900/80 p-6 shadow-[0_10px_36px_-16px_rgba(205,241,75,0.35)] backdrop-blur-xl sm:p-7">
          <span aria-hidden="true" className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/60 to-transparent" />
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-volt-300">
            With VERRAA
          </p>
          <ul className="mt-4 grid gap-3.5">
            {FIXES.map((f) => (
              <li key={f.fix} className="flex items-start gap-3 text-sm font-bold leading-6 text-mist-100">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-volt-400 text-night-950" aria-hidden="true">
                  <Check className="h-3.5 w-3.5" strokeWidth={3.4} />
                </span>
                {f.fix}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </SectionShell>
  );
}
