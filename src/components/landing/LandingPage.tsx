/* ================================================================
   VERRAA — public landing page (no auth required, no private data).
   Pain-led narrative: hero → modes hub → outcomes → pains + fixes →
   fix cards → product preview → how it works → pricing → why →
   final CTA → footer.
   Handles SEO metadata + deep-hash scrolling (/#pricing etc.).
   ================================================================ */

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Seo } from "../Seo";
import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./HeroSection";
import { ModesSection } from "./ModesSection";
import { OutcomesSection } from "./OutcomesSection";
import { ProblemSolutionSection } from "./ProblemSolutionSection";
import { BenefitsSection } from "./BenefitsSection";
import { ProductPreviewSection } from "./ProductPreviewSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { PricingSection } from "./PricingSection";
import { FinalCTA, WhyVerraa } from "./FinalCTA";
import { LandingFooter } from "./LandingFooter";

const PAGE_TITLE = "VERRAA — Personal Trainer Software & Coaching Client Management Platform";
const PAGE_DESC =
  "VERRAA is the operating system for modern coaches: manage clients, workout plans, nutrition, check-ins, subscriptions & payments from one powerful platform.";

export function LandingPage() {
  const location = useLocation();

  // Support /#features, /#how-it-works, /#pricing deep links from other routes.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [location.hash]);

  return (
    <div className="noise relative flex min-h-screen flex-col overflow-x-clip">
      <Seo page="home" titleOverride={PAGE_TITLE} descOverride={PAGE_DESC} pathOverride="/" />
      <div className="app-glow pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="dot-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="orb orb-a -right-32 -top-40" />
        <div className="orb orb-b -left-24 bottom-1/4" />
      </div>

      <LandingHeader />
      <main id="main-content" className="relative z-10 flex-1">
        <HeroSection />
        <ModesSection />
        <OutcomesSection />
        <ProblemSolutionSection />
        <BenefitsSection />
        <ProductPreviewSection />
        <HowItWorksSection />
        <PricingSection />
        <WhyVerraa />
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
}
