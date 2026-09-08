/* ================================================================
   VERRAA — shared shell for the public mode pages (/coach-mode,
   /client-mode): SEO head + header + ambient bg + footer + final CTA.
   No auth, no private data — static marketing content only.
   ================================================================ */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { SeoPageKey } from "../../seo";
import { Seo } from "../Seo";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { FinalCTA } from "./FinalCTA";
import { Reveal } from "./Reveal";

export function ModePageShell({
  page,
  title,
  desc,
  path,
  children,
}: {
  page: SeoPageKey;
  title: string;
  desc: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <div className="noise relative flex min-h-screen flex-col overflow-x-clip">
      <Seo page={page} titleOverride={title} descOverride={desc} pathOverride={path} />
      <div className="app-glow pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="dot-grid pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="orb orb-a -right-32 -top-40" />
        <div className="orb orb-b -left-24 bottom-1/4" />
      </div>

      <LandingHeader />
      <main id="main-content" className="relative z-10 flex-1">
        {children}
        <FinalCTA />
      </main>
      <div className="relative z-10">
        <LandingFooter />
      </div>
    </div>
  );
}

/** Cross-link banner pointing at the other mode's page. */
export function ModeCrossLink({
  to,
  eyebrow,
  title,
  text,
  cta,
}: {
  to: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <section aria-label={title} className="px-5 pb-4 pt-2 sm:px-6">
      <Reveal className="mx-auto w-full max-w-6xl">
        <Link
          to={to}
          className="group flex flex-col gap-4 overflow-hidden rounded-[20px] border border-white/[0.08] bg-night-900/60 p-6 backdrop-blur-xl transition-colors hover:border-volt-400/30 sm:flex-row sm:items-center sm:gap-6 sm:p-7"
        >
          <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl" aria-hidden="true">
            <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1 rtl:rotate-180 group-hover:rtl:-translate-x-1" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold uppercase tracking-[0.18em] text-mist-500">
              {eyebrow}
            </span>
            <span className="mt-1 block text-balance text-lg font-extrabold tracking-tight text-mist-100 sm:text-xl">
              {title}
            </span>
            <span className="mt-1 block text-sm leading-6 text-mist-400">{text}</span>
          </span>
          <span className="inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-volt-400 px-5 text-sm font-bold text-night-950 transition group-hover:bg-volt-300">
            {cta} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </span>
        </Link>
      </Reveal>
    </section>
  );
}
