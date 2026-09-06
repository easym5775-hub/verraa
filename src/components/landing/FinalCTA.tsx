/* ================================================================
   VERRAA — positioning ("why") + final conversion CTA.
   Customer language only: no stack, API, DB or infra mentions.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, Dumbbell, LogIn } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { Reveal } from "./Reveal";

const PILLARS = [
  "Clients",
  "Progress",
  "Coaching",
  "Subscriptions",
  "Organization",
  "Business growth",
] as const;

export function WhyVerraa() {
  return (
    <section aria-labelledby="why-title" className="px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <p className="eyebrow">Positioning</p>
          <h2 id="why-title" className="text-balance mt-3 text-[28px] font-extrabold leading-[1.08] tracking-tight text-mist-100 sm:text-[36px]">
            Built for Coaches. <span className="text-volt-400">Not Adapted From Generic Business Software.</span>
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-7 text-mist-400">
            VERRAA is designed around the daily workflow of a personal trainer — the
            clients you coach, the progress you track, and the business you are growing.
            Nothing generic, nothing bolted on.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ul aria-label="What VERRAA is built around" className="flex flex-wrap gap-2">
            {PILLARS.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-mist-200"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/25" aria-hidden="true">
                  <Dumbbell className="h-3.5 w-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section aria-labelledby="final-cta-title" className="px-5 pb-16 pt-4 sm:px-6 sm:pb-20 lg:pb-24">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="relative overflow-hidden rounded-[24px] border border-volt-400/25 bg-night-900/80 px-6 py-12 text-center shadow-[0_24px_64px_-28px_rgba(205,241,75,0.35)] backdrop-blur-xl sm:px-10 sm:py-16">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-16 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/70 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-10 bg-[radial-gradient(50%_60%_at_50%_0%,rgba(205,241,75,0.1),transparent_70%)]"
          />
          <div className="relative">
            <p className="eyebrow !text-volt-300">Get started today</p>
            <h2 id="final-cta-title" className="text-balance mx-auto mt-3 max-w-xl font-display text-[38px] font-bold uppercase leading-[0.95] tracking-tight text-mist-100 sm:text-[52px]">
              Ready to build a better coaching business?
            </h2>
            <p className="text-balance mx-auto mt-4 max-w-lg text-[15px] leading-7 text-mist-400">
              Stop managing your clients manually. Start coaching with VERRAA.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
              <Link to="/signup" className={`${btnPrimary} h-12 px-8 text-[15px]`} aria-label="Get started — create your VERRAA account">
                Get Started <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </Link>
              <Link to="/login" className={`${btnSecondary} h-12 px-8 text-[15px]`} aria-label="Sign in to VERRAA">
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
