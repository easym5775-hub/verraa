/* ================================================================
   VERRAA — how it works (3 steps + CTA to the real signup flow).
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, ClipboardList, Rocket, UserPlus } from "lucide-react";
import { btnPrimary } from "../ui";
import { Reveal, SectionShell } from "./Reveal";

const STEPS = [
  {
    n: "01",
    icon: UserPlus,
    title: "Create Your Account",
    text: "Sign up and create your coaching workspace.",
  },
  {
    n: "02",
    icon: ClipboardList,
    title: "Add Your Clients",
    text: "Organize your clients and keep their information in one place.",
  },
  {
    n: "03",
    icon: Rocket,
    title: "Coach & Grow",
    text: "Track progress, manage subscriptions, and run your coaching business from VERRAA.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <SectionShell
      id="how-it-works"
      step="04"
      eyebrow="Getting started"
      title="Start Coaching Smarter in 3 Steps."
      labelledBy="how-title"
    >
      <ol className="mx-auto grid max-w-4xl gap-3 sm:gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 90} className="h-full">
            <li className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 backdrop-blur-xl">
              <span aria-hidden="true" className="font-display text-[44px] font-bold leading-none text-white/[0.08]">
                {s.n}
              </span>
              <span className="icon-tile -mt-3 h-11 w-11 !rounded-2xl" aria-hidden="true">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-mist-100">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-mist-400">{s.text}</p>
            </li>
          </Reveal>
        ))}
      </ol>
      <Reveal delay={120} className="mt-8 text-center">
        <Link to="/signup" className={`${btnPrimary} h-12 px-8 text-[15px]`} aria-label="Get started with VERRAA">
          Get Started <ArrowRight className="h-5 w-5 rtl:rotate-180" />
        </Link>
      </Reveal>
    </SectionShell>
  );
}
