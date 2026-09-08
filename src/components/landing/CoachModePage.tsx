/* ================================================================
   VERRAA — public Coach Mode page (/coach-mode).
   Every card maps to a real Coach Mode surface. Static marketing
   content only: no auth, no store reads, no private data.
   ================================================================ */

import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  ClipboardList,
  Dumbbell,
  LayoutGrid,
  Library,
  LogIn,
  MessageCircle,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { DashboardMockup } from "./DashboardMockup";
import { ModeCrossLink, ModePageShell } from "./ModePageShell";
import { Reveal, SectionShell } from "./Reveal";

const TITLE = "Coach Mode — VERRAA: Dashboard, Clients, Plans & Payments";
const DESC =
  "Explore VERRAA Coach Mode: a command-center dashboard, client roster, check-in inbox, workout plans, nutrition, sessions, payments and direct client chat.";

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Command-Center Dashboard",
    text: "Open your day to Needs Attention, today's schedule and live KPIs — the whole business read in one glance, computed from your real data.",
  },
  {
    icon: Users,
    title: "Clients & Full Profiles",
    text: "A real roster with rich profiles: goals, measurements, coach notes, follow-up tracking and complete history per client.",
  },
  {
    icon: Camera,
    title: "Check-In Inbox",
    text: "Every check-in lands oldest-first with photos, weight, mood and notes. Review in minutes — nothing rots in a chat thread.",
  },
  {
    icon: ClipboardList,
    title: "Workout Plans",
    text: "Build structured training plans per client, per day — assign, adjust and progress them without rebuilding from scratch.",
  },
  {
    icon: Library,
    title: "Exercise Library",
    text: "Your own movement bank with demos and categories. Reuse it across every plan instead of re-explaining the same lift.",
  },
  {
    icon: UtensilsCrossed,
    title: "Meals & Nutrition",
    text: "Daily meal plans with nutrition targets per client — and when they want a swap, their change request lands on your desk.",
  },
  {
    icon: CalendarDays,
    title: "Sessions & Schedule",
    text: "Book sessions, see today at a glance, and track completed, missed and upcoming training — attendance stops being a mystery.",
  },
  {
    icon: Wallet,
    title: "Payments & Subscriptions",
    text: "Record payments, spot outstanding balances instantly, and renew before expiry. The awkward money guessing ends here.",
  },
  {
    icon: MessageCircle,
    title: "Direct Client Chat",
    text: "Built-in messaging with every client, tied to their profile — coaching talk stays where the coaching data lives.",
  },
] as const;

export function CoachModePage() {
  return (
    <ModePageShell page="coach-mode" title={TITLE} desc={DESC} path="/coach-mode">
      {/* hero */}
      <section aria-labelledby="coach-mode-title" className="relative overflow-x-clip px-5 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 text-center lg:text-start">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-volt-400/25 bg-volt-400/[0.07] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-volt-300">
                <span className="h-1.5 w-1.5 rounded-full bg-volt-400" aria-hidden="true" />
                Coach Mode · Your space
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1
                id="coach-mode-title"
                className="text-balance mt-5 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-tight text-mist-100 sm:text-[60px] lg:text-[64px]"
              >
                Your Entire Business. <span className="text-volt-400">One Calm Screen.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-balance mx-auto mt-5 max-w-xl text-[15px] leading-7 text-mist-400 sm:text-base sm:leading-8 lg:mx-0">
                Coach Mode is your command center — clients, check-ins, plans, nutrition,
                sessions, payments and chat, organized around your day instead of
                scattered across five apps.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-7 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
                <Link to="/signup" className={`${btnPrimary} h-12 px-7 text-[15px]`} aria-label="Get started — create your VERRAA coach account">
                  Get Started <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                </Link>
                <Link to="/login" className={`${btnSecondary} h-12 px-7 text-[15px]`} aria-label="Sign in to VERRAA">
                  <LogIn className="h-4 w-4" /> Sign In
                </Link>
              </div>
              <p className="mt-3.5 text-[13px] font-semibold text-mist-500">
                You create the account — your clients join free through you.
              </p>
            </Reveal>
          </div>
          <Reveal delay={200} className="min-w-0">
            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_20%,rgba(205,241,75,0.09),transparent_70%)]"
              />
              <DashboardMockup detailed />
            </div>
          </Reveal>
        </div>
      </section>

      {/* feature grid */}
      <SectionShell
        eyebrow="Inside Coach Mode"
        title="Nine Tools. Zero Admin Chaos."
        labelledBy="coach-features-title"
        sub="Each one replaces a spreadsheet, a chat thread, or something you were keeping in your head."
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" role="list" aria-label="Coach Mode features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80} className="h-full">
              <article
                role="listitem"
                className="card-lift flex h-full flex-col rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 backdrop-blur-xl"
              >
                <span className="icon-tile h-11 w-11 !rounded-2xl" aria-hidden="true">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-mist-100">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-mist-400">{f.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      {/* your clients' side */}
      <ModeCrossLink
        to="/client-mode"
        eyebrow="The other side"
        title="Your clients get their own app — not another chat thread."
        text="Training, meals, 60-second check-ins, progress and a direct line to you. See what Client Mode delivers."
        cta="Explore Client Mode"
      />

      <section aria-label="Coach Mode summary" className="px-5 py-14 sm:px-6">
        <Reveal className="mx-auto flex w-full max-w-3xl items-start gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-6 text-center sm:items-center">
          <Dumbbell className="mx-auto h-6 w-6 shrink-0 text-volt-300" aria-hidden="true" />
          <p className="text-balance text-sm font-semibold leading-6 text-mist-300">
            Coach Mode is where you work. Client Mode is what your clients experience —
            and it's what makes you look like the premium coach you are.
          </p>
        </Reveal>
      </section>
    </ModePageShell>
  );
}
