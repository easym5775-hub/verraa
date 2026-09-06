/* ================================================================
   VERRAA — minimal public footer (+ tiny static Privacy / Terms pages
   so footer links never dead-end; no fake socials, no extra links).
   ================================================================ */

import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { LandingHeader } from "./LandingHeader";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/[0.06] bg-night-950/70 px-5 py-10 backdrop-blur-xl sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <p className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-400 text-night-950">
                <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </span>
              <span className="font-display text-[21px] font-bold uppercase tracking-wide text-mist-100">
                Verraa
              </span>
            </p>
            <p className="mt-3 text-sm leading-6 text-mist-400">
              The operating system for modern coaches.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-mist-500">Product</p>
              <ul className="mt-3 grid gap-1">
                <li><FooterLink to="/#features" label="Features" /></li>
                <li><FooterLink to="/#pricing" label="Pricing" /></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-mist-500">Account</p>
              <ul className="mt-3 grid gap-1">
                <li><FooterLink to="/login" label="Sign In" /></li>
                <li><FooterLink to="/signup" label="Get Started" /></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-mist-500">Legal</p>
              <ul className="mt-3 grid gap-1">
                <li><FooterLink to="/privacy" label="Privacy" /></li>
                <li><FooterLink to="/terms" label="Terms" /></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold text-mist-500">© {year} VERRAA. All rights reserved.</p>
          <p className="text-xs font-semibold text-mist-500">Built for modern personal trainers.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, label }: { to: string; label: string }) {
  if (to.startsWith("/#")) {
    const id = to.slice(2);
    return (
      <button
        onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="cursor-pointer rounded-lg px-1 py-1.5 text-sm font-semibold text-mist-400 transition hover:text-volt-300"
      >
        {label}
      </button>
    );
  }
  return (
    <Link
      to={to}
      className="inline-block rounded-lg px-1 py-1.5 text-sm font-semibold text-mist-400 transition hover:text-volt-300"
    >
      {label}
    </Link>
  );
}

/* ---------------- minimal static legal pages ---------------- */

function LegalShell({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="noise relative flex min-h-screen flex-col overflow-x-clip">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <LandingHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-6">
        <p className="eyebrow">VERRAA</p>
        <h1 className="mt-2 text-[30px] font-extrabold tracking-tight text-mist-100 sm:text-[36px]">{title}</h1>
        <p className="mt-1 text-[13px] font-semibold text-mist-500">Last updated: {updated}</p>
        <div className="mt-6 grid gap-5 text-[14.5px] leading-7 text-mist-300">{children}</div>
        <p className="mt-8">
          <Link to="/" className="text-sm font-bold text-volt-300 hover:text-volt-200">
            ← Back to home
          </Link>
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="2026">
      <p>
        VERRAA is a coaching workspace for personal trainers. Account information you provide
        when signing up (such as your name and email) is used to operate your workspace and
        keep your account secure.
      </p>
      <p>
        Client information entered by a coach into their workspace belongs to that coaching
        business and is only visible to the coach and the relevant client after sign-in. Public
        marketing pages never expose private coach, client, or subscription data.
      </p>
      <p>
        VERRAA does not sell personal information. Authentication and data storage are handled
        through secured infrastructure with role-based access controls.
      </p>
    </LegalShell>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="2026">
      <p>
        VERRAA provides personal trainers with a workspace to manage clients, track progress,
        and organize subscriptions. Coach accounts are created through the sign-up flow and
        are subject to the plan limits of their subscription.
      </p>
      <p>
        Subscription plans are billed monthly in EGP. Plan capacity (for example Starter up to
        20 clients, Professional up to 100 clients, Enterprise for 100+ clients) is enforced by
        the platform; downgrades below the current client count cannot be completed until the
        roster fits the target plan.
      </p>
      <p>
        Coaches are responsible for the accuracy of the client information they enter and for
        keeping their sign-in credentials confidential. VERRAA may suspend accounts that abuse
        the service or violate applicable law.
      </p>
    </LegalShell>
  );
}
