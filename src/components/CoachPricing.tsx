/* ================================================================
   VERRAA — Coach Pricing: Current Plan card + Plans & Pricing page.
   All values come from the real backend (coachPlans + subscription);
   never hardcoded, never demo data.
   ================================================================ */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, Check, Crown, PauseCircle, XCircle } from "lucide-react";
import type { CoachPlan, CoachView } from "../types";
import { useApp } from "../store";
import { todayISO } from "../lib";
import {
  COACH_PLAN_ORDER,
  DEFAULT_COACH_PLANS,
  effectiveCoachStatus,
  formatEGP,
  getPlanById,
  normalizeCoachPlanId,
  planRenewalLabel,
  validatePlanChange,
} from "../coachPricing";
import { Badge, Modal, SectionCard, btnPrimary, btnSecondary, btnSm } from "./ui";

/* ---------------- Current Plan card (Coach Dashboard) ---------------- */

export function CurrentPlanCard({ onViewPlans }: { onViewPlans?: () => void }) {
  const { coachPlans, myCoachSubscription, myCoachPlan, myClientCount, myClientLimit } = useApp();

  const plans = coachPlans.length > 0 ? coachPlans : DEFAULT_COACH_PLANS;
  void plans;
  const sub = myCoachSubscription;
  const plan = myCoachPlan;
  const status = effectiveCoachStatus(sub, todayISO());
  const limit = myClientLimit;
  const count = myClientCount;
  const pct = limit === null ? 0 : Math.min(100, Math.round((count / Math.max(1, limit)) * 100));
  const nearLimit = limit !== null && count >= limit;
  const almostFull = limit !== null && !nearLimit && count / limit >= 0.8;

  const statusBadge = () => {
    if (status === "ACTIVE")
      return (
        <Badge className="border-moss-400/25 bg-moss-400/10 text-moss-300">
          <span className="h-1.5 w-1.5 rounded-full bg-moss-400" /> Active
        </Badge>
      );
    if (status === "EXPIRED")
      return (
        <Badge className="border-danger-500/25 bg-danger-500/10 text-danger-300">
          <span className="h-1.5 w-1.5 rounded-full bg-danger-400" /> Expired
        </Badge>
      );
    if (status === "SUSPENDED")
      return (
        <Badge className="border-danger-500/25 bg-danger-500/10 text-danger-300">
          <span className="h-1.5 w-1.5 rounded-full bg-danger-400" /> Suspended
        </Badge>
      );
    return (
      <Badge className="border-warn-400/25 bg-warn-400/10 text-warn-300">
        <span className="h-1.5 w-1.5 rounded-full bg-warn-400" /> {sub ? sub.status : "No subscription"}
      </Badge>
    );
  };

  return (
    <SectionCard
      title="Current Plan"
      icon={<Crown className="h-4 w-4" />}
      description="Your subscription & client usage"
      action={
        onViewPlans ? (
          <button className={`${btnSecondary} ${btnSm}`} onClick={onViewPlans}>
            View plans <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </button>
        ) : undefined
      }
    >
      {(status === "EXPIRED" || status === "SUSPENDED") && (
        <div
          role="alert"
          className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold leading-5 ${
            status === "EXPIRED"
              ? "border-warn-400/25 bg-warn-400/[0.08] text-warn-300"
              : "border-danger-500/25 bg-danger-500/[0.08] text-danger-300"
          }`}
        >
          {status === "EXPIRED" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <PauseCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {status === "EXPIRED"
              ? "Your subscription has expired. Please contact the administrator to renew your plan."
              : "Your subscription is suspended. Please contact the administrator to restore access."}
          </span>
        </div>
      )}
      {!sub && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn-400/25 bg-warn-400/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-warn-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>No active plan found. Please contact the administrator to activate your subscription.</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-mist-100">{plan.name}</p>
          <p className="mt-1.5 text-sm font-bold text-mist-300 tnum">
            {formatEGP(plan.price)} <span className="text-xs font-semibold text-mist-500">/ month</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {statusBadge()}
          <p className="text-[11px] font-semibold text-mist-500">
            Renews <span className="font-bold text-mist-300">{planRenewalLabel(sub?.endDate)}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-night-700 bg-night-800 p-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Clients</p>
          <p className="mt-1 font-display text-xl font-bold text-mist-100 tnum">
            {limit === null ? count : `${count} / ${limit}`}
          </p>
        </div>
        <div className="rounded-xl border border-night-700 bg-night-800 p-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-mist-500">Client Limit</p>
          <p className="mt-1 font-display text-xl font-bold text-mist-100 tnum">{limit === null ? "Unlimited" : limit}</p>
        </div>
      </div>

      {limit !== null ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className={nearLimit ? "text-danger-300" : almostFull ? "text-warn-300" : "text-mist-400"}>
              {nearLimit ? "Limit reached — upgrade to add more clients" : almostFull ? "Almost full" : "Client usage"}
            </span>
            <span className="text-mist-500 tnum">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-night-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Client usage ${count} of ${limit}`}>
            <div
              className={`h-full rounded-full transition-all ${nearLimit ? "bg-danger-400" : almostFull ? "bg-warn-400" : "bg-volt-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {nearLimit && onViewPlans && (
            <button className={`${btnPrimary} ${btnSm} mt-3 w-full`} onClick={onViewPlans}>
              Upgrade Plan <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-moss-400/20 bg-moss-400/[0.07] px-3.5 py-2.5 text-xs font-semibold text-moss-300">
          Unlimited client capacity — keep growing.
        </p>
      )}
    </SectionCard>
  );
}

/* ---------------- Plans & Pricing page (Coach Mode only) ---------------- */

export function CoachPricingView({ go }: { go: (v: CoachView) => void }) {
  const { coachPlans, myCoachSubscription, myClientCount, changeMyPlan, toast } = useApp();
  const [pending, setPending] = useState<CoachPlan | null>(null);
  const [confirm, setConfirm] = useState<CoachPlan | null>(null);
  const [error, setError] = useState("");

  const plans = useMemo(
    () => (coachPlans.length > 0 ? [...coachPlans].sort((a, b) => a.price - b.price) : [...DEFAULT_COACH_PLANS]),
    [coachPlans],
  );
  const currentId = normalizeCoachPlanId(myCoachSubscription?.planName);
  const status = effectiveCoachStatus(myCoachSubscription, todayISO());

  const startChange = (id: CoachPlan) => {
    setError("");
    if (id === currentId) return;
    const target = getPlanById(plans, id);
    const check = validatePlanChange(myCoachSubscription?.planName ?? null, id, myClientCount, plans);
    if (!check.ok) {
      setError(check.message ?? "You cannot switch to this plan yet.");
      setConfirm(id);
      return;
    }
    // Downgrade to a tighter plan within limits still deserves an explicit confirm.
    const order = (p: CoachPlan | null) => COACH_PLAN_ORDER.indexOf(p as CoachPlan);
    if (currentId && order(id) < order(currentId)) {
      setConfirm(id);
      return;
    }
    void doChange(id);
    void target;
  };

  const doChange = async (id: CoachPlan) => {
    setPending(id);
    setError("");
    try {
      await changeMyPlan(id);
      setConfirm(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't change the plan.";
      setError(msg);
      toast(msg, "warn");
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <header className="rise flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          <p className="eyebrow">Subscription</p>
          <h1 className="text-balance mt-1 text-[28px] font-extrabold leading-[1.05] tracking-tight text-mist-100 sm:text-[34px]">
            Plans &amp; <span className="text-volt-400">Pricing</span>
          </h1>
          <p className="text-balance mt-2 max-w-xl text-sm leading-6 text-mist-400">
            {myClientCount} client{myClientCount === 1 ? "" : "s"} on your roster
            {currentId ? (
              <>
                {" "}· currently on <span className="font-bold text-mist-200">{getPlanById(plans, currentId).name}</span>
              </>
            ) : null}
            . Prices in EGP, billed monthly.
          </p>
        </div>
        <button className={`${btnSecondary} ${btnSm} !min-h-[38px]`} onClick={() => go("dashboard")}>
          Back to dashboard
        </button>
      </header>

      {(status === "EXPIRED" || status === "SUSPENDED") && (
        <div role="alert" className="rise mt-4 flex items-start gap-2.5 rounded-2xl border border-warn-400/25 bg-warn-400/[0.07] px-4 py-3 text-[13px] font-semibold text-warn-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {status === "EXPIRED"
              ? "Your subscription has expired. Please contact the administrator to renew your plan."
              : "Your subscription is suspended. Please contact the administrator to restore access."}
          </span>
        </div>
      )}

      {error && confirm && (
        <div role="alert" className="rise mt-4 flex items-start gap-2.5 rounded-2xl border border-danger-500/25 bg-danger-500/[0.07] px-4 py-3 text-[13px] font-semibold leading-6 text-danger-300">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-3">
        {COACH_PLAN_ORDER.map((id, i) => {
          const plan = getPlanById(plans, id);
          const isCurrent = currentId === id;
          const isPopular = id === "PROFESSIONAL";
          const busy = pending === id;
          return (
            <article
              key={id}
              aria-label={`${plan.name} plan`}
              className={`rise relative flex flex-col overflow-hidden rounded-[20px] border bg-night-900/60 p-6 shadow-sm backdrop-blur-xl ${
                isCurrent ? "border-volt-400/50 ring-1 ring-volt-400/30" : "border-white/[0.07]"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {isPopular && !isCurrent && (
                <span className="absolute end-4 top-4 rounded-full bg-volt-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-night-950">
                  Most Popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute end-4 top-4 inline-flex items-center gap-1 rounded-full border border-volt-400/40 bg-volt-400/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-volt-300">
                  <BadgeCheck className="h-3 w-3" /> Current Plan
                </span>
              )}
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-mist-500">{plan.name}</p>
              <p className="mt-2 font-display text-4xl font-extrabold tracking-tight text-mist-100 tnum">
                {plan.price.toLocaleString("en-US")}
                <span className="ms-1.5 align-middle text-sm font-bold text-mist-500">EGP / month</span>
              </p>
              <p className="mt-1 text-[13px] font-semibold text-mist-400">
                {plan.maxClients === null ? "100+ Clients · Unlimited capacity" : `Up to ${plan.maxClients} Clients`}
              </p>
              {isCurrent && (
                <p className="mt-1 text-xs font-bold text-volt-300 tnum">
                  {plan.maxClients === null ? `${myClientCount} clients` : `${myClientCount} / ${plan.maxClients} Clients`}
                </p>
              )}
              <ul className="mt-5 grid flex-1 content-start gap-2.5">
                {(plan.features ?? []).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] font-semibold text-mist-300">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-volt-400/10 text-volt-300 ring-1 ring-volt-400/25">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <span className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2.5 text-sm font-bold text-volt-300" aria-current="true">
                    <BadgeCheck className="h-4 w-4" /> Current Plan
                  </span>
                ) : (
                  <button
                    className={`${isPopular ? btnPrimary : btnSecondary} w-full`}
                    disabled={busy}
                    onClick={() => startChange(id)}
                    aria-label={`Choose ${plan.name}`}
                  >
                    {busy ? "Switching…" : `Choose ${plan.name}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs text-mist-500">
        Plan changes validate your current client count. Downgrades below your roster size are blocked — no clients are ever deleted automatically.
      </p>

      <Modal open={confirm !== null} onClose={() => { setConfirm(null); setError(""); }} title={error ? "Cannot switch plan" : "Switch plan?"}>
        {error ? (
          <div className="grid gap-4">
            <p className="whitespace-pre-line text-sm font-semibold leading-6 text-mist-200">{error}</p>
            <p className="text-xs text-mist-500">Remove or reassign clients first, then try again — or contact the administrator.</p>
            <div className="flex gap-2">
              <button className={`${btnSecondary} flex-1`} onClick={() => { setConfirm(null); setError(""); }}>Close</button>
              <button className={`${btnPrimary} flex-1`} onClick={() => go("clients")}>Open clients</button>
            </div>
          </div>
        ) : (
          confirm && (
            <div className="grid gap-4">
              <p className="text-sm leading-6 text-mist-300">
                Switch from <span className="font-bold text-mist-100">{currentId ? getPlanById(plans, currentId).name : "—"}</span> to{" "}
                <span className="font-bold text-volt-300">{getPlanById(plans, confirm).name}</span> ({formatEGP(getPlanById(plans, confirm).price)} / month)?
              </p>
              <p className="text-xs text-mist-500">Your client roster ({myClientCount}) fits within the new limit{getPlanById(plans, confirm).maxClients === null ? " (unlimited)" : ` (${getPlanById(plans, confirm).maxClients})`}.</p>
              <div className="flex gap-2">
                <button className={`${btnSecondary} flex-1`} onClick={() => setConfirm(null)}>Keep my plan</button>
                <button className={`${btnPrimary} flex-1`} disabled={pending !== null} onClick={() => void doChange(confirm)}>
                  {pending ? "Switching…" : "Confirm switch"}
                </button>
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
