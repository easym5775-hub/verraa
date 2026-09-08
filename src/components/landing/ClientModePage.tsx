/* ================================================================
   VERRAA — public Client Mode page (/client-mode).
   Describes what the coach's clients get, mapped to the real client
   app tabs. Static marketing content only: no auth, no private data.
   ================================================================ */

import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  Check,
  Dumbbell,
  Home,
  KeyRound,
  LogIn,
  MessageCircle,
  Receipt,
  Smartphone,
  TrendingUp,
  UserPlus,
  UtensilsCrossed,
} from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { ModeCrossLink, ModePageShell } from "./ModePageShell";
import { Reveal, SectionShell } from "./Reveal";

const TITLE = "Client Mode — The VERRAA App Your Clients Get";
const DESC =
  "See what your clients experience in VERRAA Client Mode: today's training, meals, 60-second check-ins, strength tracking, progress charts and direct coach chat.";

const FEATURES = [
  {
    icon: Home,
    title: "A Today Screen",
    text: "Clients open the app to today's sessions, today's meals and their check-in nudge — one glance, zero confusion about what to do.",
  },
  {
    icon: Dumbbell,
    title: "Training + Strength Tracker",
    text: "Today's plan loads automatically. They log sets, reps and weight, watch history per lift, and celebrate real PRs.",
  },
  {
    icon: UtensilsCrossed,
    title: "Meals & Targets",
    text: "Daily meals with clear nutrition targets — and when they want a swap, they request it in-app instead of calling you.",
  },
  {
    icon: Camera,
    title: "60-Second Check-Ins",
    text: "Weight, waist, mood, water, workout-done, a progress photo and a note — submitted in a minute, on your desk instantly.",
  },
  {
    icon: TrendingUp,
    title: "Progress They Can See",
    text: "Weight trends, attendance and session history, charted. Visible progress is what keeps clients paying month after month.",
  },
  {
    icon: MessageCircle,
    title: "A Direct Line to You",
    text: "Built-in chat with their coach — guidance stays connected to their program instead of drowning in WhatsApp.",
  },
  {
    icon: Receipt,
    title: "Subscription Clarity",
    text: "Their plan and status, always visible in their own space. No awkward money talk, no surprises.",
  },
] as const;

const JOIN_STEPS = [
  {
    icon: UserPlus,
    title: "You add them",
    text: "Create their account in seconds — their login works right away.",
  },
  {
    icon: KeyRound,
    title: "They sign in",
    text: "Username + password. No email needed, nothing to configure.",
  },
  {
    icon: Smartphone,
    title: "Their app is ready",
    text: "Plans, meals and check-ins appear instantly. They just start.",
  },
] as const;

export function ClientModePage() {
  return (
    <ModePageShell page="client-mode" title={TITLE} desc={DESC} path="/client-mode">
      {/* hero */}
      <section aria-labelledby="client-mode-title" className="relative overflow-x-clip px-5 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="min-w-0 text-center lg:text-start">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-volt-400/25 bg-volt-400/[0.07] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-volt-300">
                <span className="h-1.5 w-1.5 rounded-full bg-volt-400" aria-hidden="true" />
                Client Mode · Their space
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1
                id="client-mode-title"
                className="text-balance mt-5 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-tight text-mist-100 sm:text-[60px] lg:text-[64px]"
              >
                Give Clients an App. <span className="text-volt-400">Not a Chat Thread.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-balance mx-auto mt-5 max-w-xl text-[15px] leading-7 text-mist-400 sm:text-base sm:leading-8 lg:mx-0">
                Every client you add gets their own VERRAA space — today's training, meals,
                60-second check-ins, visible progress and a direct line to you. Effortless
                for them, premium positioning for you.
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
                Clients join free through you — no extra seats, no extra logins to manage.
              </p>
            </Reveal>
          </div>
          <Reveal delay={200} className="min-w-0">
            <div className="relative mx-auto w-fit">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 rounded-[36px] bg-[radial-gradient(60%_60%_at_50%_20%,rgba(205,241,75,0.09),transparent_70%)]"
              />
              <ClientPhoneMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* feature grid */}
      <SectionShell
        eyebrow="Inside Client Mode"
        title="Everything Your Clients Touch Daily."
        labelledBy="client-features-title"
        sub="This is the experience that keeps them consistent — and keeps them subscribed."
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" role="list" aria-label="Client Mode features">
          {FEATURES.slice(0, 6).map((f, i) => (
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
        <Reveal delay={100}>
          <div className="mx-auto mt-3 flex max-w-2xl items-start gap-3 rounded-[20px] border border-volt-400/25 bg-volt-400/[0.05] p-5 text-start sm:mt-4 sm:items-center">
            <span className="icon-tile h-11 w-11 shrink-0 !rounded-2xl" aria-hidden="true">
              <Receipt className="h-5 w-5" />
            </span>
            <p className="text-sm leading-6 text-mist-300">
              <span className="font-extrabold text-mist-100">Plus subscription clarity — </span>
              {FEATURES[6].text}
            </p>
          </div>
        </Reveal>
      </SectionShell>

      {/* how clients join */}
      <section aria-labelledby="join-title" className="px-5 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-6xl rounded-[24px] border border-white/[0.07] bg-night-900/50 px-6 py-10 backdrop-blur-xl sm:px-10">
          <Reveal className="mx-auto max-w-xl text-center">
            <p className="eyebrow">Zero onboarding friction</p>
            <h2 id="join-title" className="text-balance mt-3 text-[24px] font-extrabold tracking-tight text-mist-100 sm:text-[30px]">
              Your Clients Are Training in 60 Seconds.
            </h2>
          </Reveal>
          <ol className="mx-auto mt-8 grid max-w-4xl gap-3 sm:gap-4 md:grid-cols-3">
            {JOIN_STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="h-full">
                <li className="flex h-full items-start gap-3.5 rounded-[18px] border border-white/[0.07] bg-night-950/60 p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt-400 font-display text-lg font-bold text-night-950" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[15px] font-extrabold text-mist-100">
                      <s.icon className="h-4 w-4 text-volt-300" aria-hidden="true" />
                      {s.title}
                    </span>
                    <span className="mt-1 block text-[13px] leading-5 text-mist-400">{s.text}</span>
                  </span>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* coach side */}
      <div className="pt-10">
        <ModeCrossLink
          to="/coach-mode"
          eyebrow="The other side"
          title="Now see your command center — Coach Mode."
          text="The dashboard, roster, check-in inbox, plans, payments and everything you run the business on."
          cta="Explore Coach Mode"
        />
      </div>

      <section aria-label="Client Mode summary" className="px-5 py-14 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-moss-400/25 bg-moss-400/[0.07] px-3.5 py-1.5 text-[12px] font-bold text-moss-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            When clients feel guided every day, they stay. Retention is the business.
          </p>
        </Reveal>
      </section>
    </ModePageShell>
  );
}

/* ---------------- static phone mockup (illustrative, aria-hidden) ---------------- */

function ClientPhoneMockup() {
  return (
    <div
      role="img"
      aria-label="Illustrative preview of the VERRAA client app on a phone, with sample data"
      className="relative w-[270px] overflow-hidden rounded-[2.2rem] border border-white/15 bg-night-950 shadow-xl sm:w-[290px]"
    >
      {/* notch */}
      <div className="flex justify-center pt-2.5" aria-hidden="true">
        <span className="h-5 w-24 rounded-full bg-white/10" />
      </div>
      <div className="grid gap-2.5 p-3.5" aria-hidden="true">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-mist-500">Today</p>
          <p className="font-display text-[22px] font-bold uppercase leading-none text-mist-100">
            Evening, <span className="text-volt-400">Omar</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-night-900/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">Next session</p>
          <p className="mt-1 text-[13px] font-extrabold text-mist-100">Upper Body · 6:00 PM</p>
          <div className="mt-2 flex gap-1.5">
            {["Bench", "Row", "Press"].map((e) => (
              <span key={e} className="rounded-lg bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-mist-300">
                {e}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-night-900/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist-500">Today's meals · 3/4</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full w-3/4 rounded-full bg-volt-400" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl border border-volt-400/30 bg-volt-400/[0.07] p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-volt-400 text-night-950">
            <Camera className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[12px] font-extrabold text-mist-100">Daily check-in ready</span>
            <span className="block text-[10.5px] font-semibold text-mist-400">60 seconds · coach sees it instantly</span>
          </span>
        </div>
        {/* bottom nav */}
        <div className="mt-1 flex items-end justify-between rounded-2xl border border-white/[0.08] bg-night-900/90 px-2.5 pb-2 pt-2">
          <NavDot icon={<Home className="h-4 w-4" />} label="Today" active />
          <NavDot icon={<UtensilsCrossed className="h-4 w-4" />} label="Meals" />
          <span className="flex flex-col items-center gap-0.5">
            <span className="-mt-6 grid h-12 w-12 place-items-center rounded-full border-4 border-night-950 bg-volt-400 text-night-950 shadow-[0_8px_24px_-8px_rgba(205,241,75,0.6)]">
              <Camera className="h-5 w-5" />
            </span>
            <span className="text-[8px] font-extrabold text-volt-300">Check-in</span>
          </span>
          <NavDot icon={<TrendingUp className="h-4 w-4" />} label="Progress" />
          <NavDot icon={<MessageCircle className="h-4 w-4" />} label="Chat" />
        </div>
      </div>
      <p className="border-t border-white/[0.06] bg-white/[0.015] px-3 py-1.5 text-center text-[9px] font-semibold text-mist-500">
        Illustrative preview — sample data.
      </p>
    </div>
  );
}

function NavDot({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <span className="flex flex-col items-center gap-0.5 px-1">
      <span className={active ? "text-volt-300" : "text-mist-500"}>{icon}</span>
      <span className={`text-[8px] font-extrabold ${active ? "text-volt-300" : "text-mist-500"}`}>{label}</span>
    </span>
  );
}
