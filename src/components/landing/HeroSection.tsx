/* ================================================================
   VERRAA — landing hero. 5-second rule: who / what / why / how.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, LogIn } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { DashboardMockup } from "./DashboardMockup";
import { Reveal } from "./Reveal";

export function HeroSection() {
  return (
    <section aria-labelledby="landing-hero-title" className="relative overflow-x-clip px-5 pb-14 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
        <div className="min-w-0 text-center lg:text-start">
          <Reveal>
            <p className="text-[13px] font-bold text-volt-400">For online coaches</p>
          </Reveal>
          <Reveal delay={80}>
            <h1
              id="landing-hero-title"
              className="text-balance mt-4 text-[34px] font-bold leading-[1.1] tracking-tight text-mist-100 sm:text-[44px] lg:text-[50px]"
            >
              Run your coaching business, not your spreadsheets.
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
