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
import { StepsSection, FeatureBlocks } from "./StepsAndFeatures";
import { ModesSection } from "./ModesSection";
import { PricingSection } from "./PricingSection";
import { FinalCTA } from "./FinalCTA";
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
    <div className="landing-calm relative flex min-h-screen flex-col overflow-x-clip">
      <Seo page="home" titleOverride={PAGE_TITLE} descOverride={PAGE_DESC} pathOverride="/" />
      <LandingHeader />
      <main id="main-content" className="relative z-10 flex-1">
        <HeroSection />
        <FeatureBlocks />
        <StepsSection />
        <PricingSection />
        <ModesSection />
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
}
