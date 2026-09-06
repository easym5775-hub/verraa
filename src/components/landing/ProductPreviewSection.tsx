/* ================================================================
   VERRAA — product experience (large dashboard preview, static only).
   ================================================================ */

import { DashboardMockup } from "./DashboardMockup";
import { Reveal, SectionShell } from "./Reveal";

export function ProductPreviewSection() {
  return (
    <SectionShell
      step="03"
      eyebrow="The fix, on one screen"
      title="Your Coaching Business. At a Glance."
      labelledBy="product-title"
      sub="Every pain above has an answer here — renewals, check-ins, payments and progress, the moment you open VERRAA."
    >
      <Reveal>
        <div className="relative mx-auto max-w-4xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-8 rounded-[32px] bg-[radial-gradient(55%_55%_at_50%_30%,rgba(65,163,113,0.12),transparent_70%)]"
          />
          <DashboardMockup detailed />
        </div>
      </Reveal>
    </SectionShell>
  );
}
