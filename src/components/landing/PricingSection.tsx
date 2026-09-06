/* ================================================================
   VERRAA — public pricing (marketing UI only).
   Values come from the centralized pricing config
   (DEFAULT_COACH_PLANS); subscription rules stay backend-controlled.
   Only safe public fields (name / price / capacity) are displayed.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Check } from "lucide-react";
import type { CoachPlanConfig } from "../../coachPricing";
import { DEFAULT_COACH_PLANS } from "../../coachPricing";
import { btnPrimary, btnSecondary } from "../ui";
import { Reveal, SectionShell } from "./Reveal";

const PUBLIC_PLAN_IDS = ["STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;
const POPULAR_ID = "PROFESSIONAL";

function capacityLabel(plan: CoachPlanConfig): string {
  if (plan.maxClients === null) return "100+ Clients / Unlimited";
  return `Up to ${plan.maxClients} Clients`;
}

function priceLabel(plan: CoachPlanConfig): { big: string; suffix: string } {
  return { big: plan.price.toLocaleString("en-US"), suffix: "EGP / month" };
}

export function PricingSection() {
  const plans = PUBLIC_PLAN_IDS.map(
    (id) => DEFAULT_COACH_PLANS.find((p) => p.id === id)!,
  ).filter(Boolean);

  return (
    <SectionShell
      id="pricing"
      step="05"
      eyebrow="Pricing"
      title="Plans That Scale With Your Coaching Business."
      labelledBy="pricing-title"
      sub="Choose the plan that fits the size of your coaching business."
    >
      <div className="mx-auto grid max-w-4xl items-stretch gap-3 sm:gap-4 lg:grid-cols-3">
        {plans.map((plan, i) => {
          const popular = plan.id === POPULAR_ID;
          const price = priceLabel(plan);
          return (
            <Reveal key={plan.id} delay={i * 90} className="h-full">
              <article
                aria-label={`${plan.name} plan — ${price.big} EGP per month, ${capacityLabel(plan)}`}
                className={`relative flex h-full flex-col overflow-hidden rounded-[20px] border p-6 backdrop-blur-xl sm:p-7 ${
                  popular
                    ? "border-volt-400/50 bg-night-900/85 shadow-[0_16px_48px_-20px_rgba(205,241,75,0.4)] ring-1 ring-volt-400/30 lg:-my-2 lg:py-9"
                    : "border-white/[0.07] bg-night-900/60"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-mist-400">
                    {plan.name}
                  </h3>
                  {popular && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-volt-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-night-950">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Most Popular
                    </span>
                  )}
                </div>
                <p className="mt-4 font-display text-[40px] font-bold leading-none tracking-tight text-mist-100 tnum">
                  {price.big}
                  <span className="ms-1.5 align-middle font-sans text-[13px] font-bold text-mist-500">
                    {price.suffix}
                  </span>
                </p>
                <p className="mt-2 text-sm font-extrabold text-volt-200">{capacityLabel(plan)}</p>
                <ul className="mt-5 grid flex-1 content-start gap-2.5">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] font-semibold text-mist-300">
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/25"
                        aria-hidden="true"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  aria-label={`Get started with the ${plan.name} plan`}
                  className={`${popular ? btnPrimary : btnSecondary} mt-6 w-full`}
                >
                  Get Started <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </article>
            </Reveal>
          );
        })}
      </div>
      <Reveal delay={140}>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-5 text-mist-500">
          Prices in EGP, billed monthly. Your subscription is managed from your coaching
          workspace after you sign up.
        </p>
      </Reveal>
    </SectionShell>
  );
}
