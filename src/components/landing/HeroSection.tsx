/* ================================================================
   VERRAA — landing hero. 5-second rule: who / what / why / how.
   ================================================================ */

import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Camera, LogIn } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { DashboardMockup } from "./DashboardMockup";
import { Reveal } from "./Reveal";

export function HeroSection() {
  return (
    <section aria-labelledby="landing-hero-title" className="relative overflow-x-clip px-5 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="min-w-0 text-center lg:text-start">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-volt-400/25 bg-volt-400/[0.07] px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-volt-300">
              <span className="h-1.5 w-1.5 rounded-full bg-volt-400" aria-hidden="true" />
              The operating system for modern coaches
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1
              id="landing-hero-title"
              className="text-balance mt-5 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-tight text-mist-100 sm:text-[60px] lg:text-[68px]"
            >
              Run your coaching business.{" "}
              <span className="text-volt-400">Not your spreadsheets.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-balance mx-auto mt-5 max-w-xl text-[15px] leading-7 text-mist-400 sm:text-base sm:leading-8 lg:mx-0">
              VERRAA gives personal trainers one powerful platform to manage clients, track
              progress, organize subscriptions, and grow their coaching business.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-7 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link to="/signup" className={`${btnPrimary} h-12 px-7 text-[15px]`} aria-label="Get started — create your VERRAA account">
                Get Started <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </Link>
              <Link to="/login" className={`${btnSecondary} h-12 px-7 text-[15px]`} aria-label="Sign in to VERRAA">
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
            </div>
            <p className="mt-3.5 text-[13px] font-semibold text-mist-500">
              Built for modern personal trainers.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200} className="min-w-0">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 rounded-[28px] bg-[radial-gradient(60%_60%_at_50%_20%,rgba(205,241,75,0.09),transparent_70%)]"
            />
            <DashboardMockup />
            {/* Floating "caught" alerts — the problems VERRAA surfaces for you. */}
            <div
              aria-hidden="true"
              className="absolute -right-3 -top-5 hidden rotate-2 rounded-2xl border border-danger-500/25 bg-night-900/95 px-3.5 py-2.5 shadow-xl backdrop-blur-xl md:block lg:-right-8"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-danger-300">
                <AlertTriangle className="h-3.5 w-3.5" /> Payment overdue
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-mist-400 tnum">2,500 EGP · flagged automatically</p>
            </div>
            <div
              aria-hidden="true"
              className="absolute -bottom-5 -left-3 hidden -rotate-2 rounded-2xl border border-warn-400/25 bg-night-900/95 px-3.5 py-2.5 shadow-xl backdrop-blur-xl md:block lg:-left-8"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-warn-300">
                <Camera className="h-3.5 w-3.5" /> Check-in waiting 3 days
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-mist-400">reviewed oldest-first, never buried</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
