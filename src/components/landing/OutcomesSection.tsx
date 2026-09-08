/* ================================================================
   VERRAA — outcomes as a pro bento (Linear/Stripe pattern language):
   one dominant tile for the money message + supporting tiles, smooth
   analytics-style curves (green up / red down), sharp statements with
   zero fabricated numbers, and a CTA path into the product.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Crown, HeartHandshake, Users } from "lucide-react";
import { btnSecondary } from "../ui";
import { Reveal } from "./Reveal";

const UP = "#4ade80";
const DOWN = "#f87171";

export function OutcomesSection() {
  return (
    <section aria-labelledby="outcomes-title" className="relative scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">
              <span className="me-2 inline-block font-display text-[13px] font-bold tracking-[0.1em] text-volt-400" aria-hidden="true">
                02
              </span>
              <span className="me-2 text-mist-500" aria-hidden="true">
                /
              </span>
              The outcomes
            </p>
            <h2 id="outcomes-title" className="text-balance mt-3 text-[28px] font-extrabold leading-[1.08] tracking-tight text-mist-100 sm:text-[36px]">
              What Changes When You Switch.
            </h2>
            <p className="text-balance mt-3 max-w-xl text-[15px] leading-7 text-mist-400">
              VERRAA doesn't just organize your work — it changes what your business feels like, for you and your clients.
            </p>
          </Reveal>
          <Reveal delay={120} className="shrink-0">
            <Link to="/coach-mode" className={btnSecondary} aria-label="See these outcomes inside Coach Mode">
              See it in the product <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={100}>
          <div
            className="mt-10 grid gap-3 rounded-[24px] border border-white/[0.07] bg-night-900/40 p-3 backdrop-blur-xl sm:mt-12 sm:gap-3.5 sm:p-3.5 lg:grid-cols-3"
            role="list"
            aria-label="Outcomes coaches get with VERRAA"
          >
            <SmallTile
              icon={Users}
              pill="↗ Capacity"
              tone="up"
              titleA="More clients."
              titleB="Same hours."
              text="The system absorbs the admin, so your roster grows without your hours growing with it."
              direction="up"
              chartId="oc-0"
            />
            <SmallTile
              icon={Crown}
              pill="↗ Positioning"
              tone="up"
              titleA="Premium"
              titleB="feel."
              text="Clients open their own app with their name on it — you look like the premium coach you are."
              direction="up"
              chartId="oc-1"
            />
            <SmallTile
              icon={HeartHandshake}
              pill="↗ Retention"
              tone="up"
              titleA="No one feels"
              titleB="ignored."
              text="Quiet clients get flagged before they drift. Everyone feels guided, every single day."
              direction="up"
              chartId="oc-2"
            />
            <WideTile
              icon={Clock3}
              pill="↘ Admin load"
              tone="down"
              titleA="Less time"
              titleB="wasted."
              text="Follow-ups, check-ins and renewals surface on their own instead of eating your day — coaches get hours back every single week."
              direction="down"
              chartId="oc-3"
              span="lg:col-span-3"
              hero
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- tiles ---------------- */

function TileShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <article
      role="listitem"
      aria-label={label}
      className="group relative flex h-full flex-col overflow-hidden rounded-[18px] border border-white/[0.07] bg-night-950/70 p-6 transition-colors duration-200 hover:border-white/[0.14] sm:p-7"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      {children}
    </article>
  );
}

function Pill({ text, tone }: { text: string; tone: "up" | "down" }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] ${
        tone === "up"
          ? "border-green-400/25 bg-green-400/[0.08] text-green-300"
          : "border-red-400/25 bg-red-400/[0.08] text-red-300"
      }`}
    >
      {text}
    </span>
  );
}

function WideTile({
  icon: Icon,
  pill,
  tone,
  titleA,
  titleB,
  text,
  direction,
  chartId,
  flip = false,
  span = "lg:col-span-2",
  hero = false,
}: {
  icon: typeof Users;
  pill: string;
  tone: "up" | "down";
  titleA: string;
  titleB: string;
  text: string;
  direction: "up" | "down";
  chartId: string;
  flip?: boolean;
  span?: string;
  hero?: boolean;
}) {
  return (
    <div className={span}>
      <TileShell label={`${titleA} ${titleB}`}>
        <div className="grid flex-1 items-center gap-6 md:grid-cols-2">
          <div className={flip ? "md:order-2" : ""}>
            <Pill text={pill} tone={tone} />
            <h3 className={`text-balance mt-3 font-display font-bold uppercase leading-[0.95] tracking-tight text-mist-100 ${hero ? "text-[38px] sm:text-[48px]" : "text-[34px] sm:text-[40px]"}`}>
              {titleA} <span className="text-volt-400">{titleB}</span>
            </h3>
            <p className={`mt-3 max-w-sm leading-6 text-mist-400 ${hero ? "text-[15px]" : "text-sm"}`}>{text}</p>
          </div>
          <div className={`min-w-0 ${flip ? "md:order-1" : ""}`}>
            <SmoothChart direction={direction} id={chartId} size={hero ? "lg" : "md"} />
          </div>
        </div>
      </TileShell>
    </div>
  );
}

function SmallTile({
  icon: Icon,
  pill,
  tone,
  titleA,
  titleB,
  text,
  direction,
  chartId,
}: {
  icon: typeof Users;
  pill: string;
  tone: "up" | "down";
  titleA: string;
  titleB: string;
  text: string;
  direction: "up" | "down";
  chartId: string;
}) {
  return (
    <TileShell label={`${titleA} ${titleB}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="icon-tile h-10 w-10 !rounded-xl" aria-hidden="true">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <Pill text={pill} tone={tone} />
      </div>
      <h3 className="text-balance mt-4 font-display text-[30px] font-bold uppercase leading-[0.95] tracking-tight text-mist-100">
        {titleA} <span className="text-volt-400">{titleB}</span>
      </h3>
      <p className="mt-2.5 text-[13px] leading-6 text-mist-400">{text}</p>
      <div className="mt-4 min-w-0 flex-1">
        <SmoothChart direction={direction} id={chartId} size="sm" />
      </div>
    </TileShell>
  );
}

/* ---------------- smooth analytics curve (decorative) ---------------- */

function SmoothChart({ direction, id, size = "md" }: { direction: "up" | "down"; id: string; size?: "sm" | "md" | "lg" }) {
  const up = direction === "up";
  const stroke = up ? UP : DOWN;
  const height = size === "lg" ? "h-40 sm:h-48" : size === "md" ? "h-32 sm:h-36" : "h-24";
  const line = up
    ? "M 6 74 C 48 70, 72 60, 100 48 C 128 36, 150 24, 186 10"
    : "M 6 16 C 48 20, 72 30, 100 42 C 128 54, 150 66, 186 80";
  const area = `${line} L 186 90 L 6 90 Z`;
  const tip = up ? { x: 186, y: 10 } : { x: 186, y: 80 };

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-night-900/60 px-3 pb-1.5 pt-3" aria-hidden="true">
      <svg viewBox="0 0 200 90" className={`w-full ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[18, 38, 58, 78].map((y) => (
          <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="rgba(233,240,235,0.055)" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className="transition-all duration-300 group-hover:brightness-125"
        />
        <circle cx={tip.x} cy={tip.y} r="7" fill={stroke} opacity="0.18" />
        <circle cx={tip.x} cy={tip.y} r="3.2" fill={stroke} />
      </svg>
    </div>
  );
}
