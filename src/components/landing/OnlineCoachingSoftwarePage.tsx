/* VERRAA public use-case page (/online-coaching-software).
   Every claim maps to a Coach Mode / Client Mode surface already described
   on /coach-mode and /client-mode. Static marketing content only. */

import { Link } from "react-router-dom";
import { ArrowRight, Camera, CalendarClock, ClipboardList, MessageCircle, Users, Wallet } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { ModePageShell } from "./ModePageShell";
import { Reveal, SectionShell } from "./Reveal";

const TITLE = "Online Coaching Software for Personal Trainers — Clients, Check-Ins & Payments | VERRAA";
const DESC =
  "Manage online coaching clients, check-ins, workout and nutrition plans, subscriptions and payments in one place instead of WhatsApp chats and spreadsheets. Built for personal trainers.";

const PROBLEMS = [
  {
    icon: Camera,
    title: "Check-ins buried in chat threads",
    text: "Progress photos, weights and notes get lost between messages. In VERRAA every check-in lands in one check-in feed, so you can review your clients quickly.",
  },
  {
    icon: Users,
    title: "Client details scattered across sheets",
    text: "Goals, measurements, coach notes and history live on one profile per client, so you stop hunting through spreadsheets before a session.",
  },
  {
    icon: ClipboardList,
    title: "Plans sent as screenshots",
    text: "Build structured workout plans per client and per day, plus daily meal plans with nutrition targets, and adjust them without starting over.",
  },
  {
    icon: Wallet,
    title: "Payments and renewals kept in your head",
    text: "Record payments, see outstanding balances and spot expiring subscriptions before they lapse.",
  },
  {
    icon: CalendarClock,
    title: "Sessions and attendance unclear",
    text: "Book sessions and track completed, missed and upcoming training in one schedule.",
  },
  {
    icon: MessageCircle,
    title: "Coaching talk mixed with everything else",
    text: "Message each client inside VERRAA, tied to their profile, so the conversation stays next to their data.",
  },
] as const;

const FAQ = [
  {
    q: "What is online coaching software?",
    a: "It is a workspace where a coach manages their clients in one place: profiles, training and nutrition plans, check-ins, sessions, subscriptions and payments, instead of using chat apps and spreadsheets.",
  },
  {
    q: "Who is VERRAA for?",
    a: "Personal trainers and online coaches who want one organized workspace for their clients. It includes a Coach Mode for you and a Client Mode for the people you coach.",
  },
  {
    q: "Where can I see the plans and prices?",
    a: "The pricing section on the VERRAA home page lists the plans.",
  },
] as const;

export function OnlineCoachingSoftwarePage() {
  return (
    <ModePageShell page="online-coaching-software" title={TITLE} desc={DESC} path="/online-coaching-software">
      <section aria-labelledby="ocs-title" className="relative overflow-x-clip px-5 pb-10 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
        <div className="mx-auto w-full max-w-3xl text-center">
          <Reveal>
            <p className="eyebrow">For personal trainers and online coaches</p>
          </Reveal>
          <Reveal delay={80}>
            <h1
              id="ocs-title"
              className="text-balance mt-4 font-display text-[38px] font-bold uppercase leading-[1] tracking-tight text-mist-100 sm:text-[52px]"
            >
              Online coaching software, <span className="text-volt-400">without the chaos.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-balance mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-mist-400 sm:text-base sm:leading-8">
              VERRAA brings your clients, check-ins, plans, sessions, subscriptions and payments into one
              workspace, so you spend less time chasing messages and more time coaching.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
              <Link to="/signup" className={`${btnPrimary} h-12 px-7 text-[15px]`} aria-label="Get started — create your VERRAA coach account">
                Get Started <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </Link>
              <Link to="/coach-mode" className={`${btnSecondary} h-12 px-7 text-[15px]`}>
                See Coach Mode
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SectionShell
        eyebrow="What it replaces"
        title="The daily problems of managing coaching clients"
        labelledBy="ocs-problems-title"
        sub="Each problem below maps to something you can do inside VERRAA today."
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" role="list" aria-label="Coaching problems VERRAA solves">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 3) * 80} className="h-full">
              <article
                role="listitem"
                className="card-lift flex h-full flex-col rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 backdrop-blur-xl"
              >
                <span className="icon-tile h-11 w-11 !rounded-2xl" aria-hidden="true">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[16px] font-extrabold tracking-tight text-mist-100">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-mist-400">{p.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        eyebrow="Common questions"
        title="Online coaching software FAQ"
        labelledBy="ocs-faq-title"
        sub="Short answers about what VERRAA does."
      >
        <div className="mx-auto grid w-full max-w-3xl gap-3">
          {FAQ.map((f) => (
            <Reveal key={f.q}>
              <article className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-6 backdrop-blur-xl">
                <h3 className="text-[16px] font-extrabold tracking-tight text-mist-100">{f.q}</h3>
                <p className="mt-1.5 text-sm leading-6 text-mist-400">{f.a}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-mist-400">
          Want to see both sides? Explore <Link to="/coach-mode" className="text-volt-300 underline">Coach Mode</Link> and{" "}
          <Link to="/client-mode" className="text-volt-300 underline">Client Mode</Link>.
        </p>
      </SectionShell>
    </ModePageShell>
  );
}
