/* ================================================================
   VERRAA — core benefits (4 premium cards, no tech jargon).
   ================================================================ */

import { Clock3, CreditCard, LineChart, Users } from "lucide-react";
import { Reveal, SectionShell } from "./Reveal";

const CARDS = [
  {
    icon: Users,
    title: "Manage Clients",
    text: "Keep your clients' information organized and accessible from one place.",
    fixes: "Ends scattered chats, notes & sheets",
  },
  {
    icon: LineChart,
    title: "Track Progress",
    text: "Monitor client progress, measurements, goals, and important coaching data over time.",
    fixes: "Ends buried check-ins & lost measurements",
  },
  {
    icon: CreditCard,
    title: "Manage Subscriptions",
    text: "Keep track of active subscriptions, upcoming renewals, and client status.",
    fixes: "Ends silent expiries & slipped payments",
  },
  {
    icon: Clock3,
    title: "Save Time",
    text: "Reduce repetitive administrative work so you can focus more on coaching and growing your business.",
    fixes: "Ends forgotten follow-ups & admin chaos",
  },
] as const;

export function BenefitsSection() {
  return (
    <SectionShell
      id="features"
      step="02"
      eyebrow="The fix"
      title="Everything You Need to Coach Better."
      labelledBy="benefits-title"
      sub="Four tools. Each one kills a specific daily headache."
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {CARDS.map((c, i) => (
          <Reveal key={c.title} delay={i * 80} className="h-full">
            <article className="card-lift flex h-full flex-col rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 backdrop-blur-xl">
              <span className="icon-tile h-11 w-11 !rounded-2xl" aria-hidden="true">
                <c.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-mist-100">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-mist-400">{c.text}</p>
              <p className="mt-3 border-t border-white/[0.06] pt-3 text-[12px] font-bold leading-5 text-volt-300">
                {c.fixes}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </SectionShell>
  );
}
