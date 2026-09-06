/* ================================================================
   VERRAA — Coach Pricing: Current Plan card + Plans & Pricing page.
   New coaches start on the Free trial (1 client). Paid plans are
   REQUESTED here and activated by the admin after review — coaches
   never switch plans themselves.
   All values come from the real backend; never hardcoded.
   ================================================================ */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Crown,
  Hourglass,
  PauseCircle,
  Send,
  Sparkles,
} from "lucide-react";
import type { CoachPlan, CoachPlanConfig, CoachView } from "../types";
import { useApp } from "../store";
import { errorMessage, todayISO } from "../lib";
import {
  COACH_PLAN_ORDER,
  DEFAULT_COACH_PLANS,
  effectiveCoachStatus,
  formatEGP,
  getPlanById,
  normalizeCoachPlanId,
  planRenewalLabel,
} from "../coachPricing";
import { Badge, Modal, SectionCard, btnPrimary, btnSecondary, btnSm, labelCls, textareaCls } from "./ui";

/** Merge live DB row with the canonical feature list (DB rows carry no features). */
function withFeatures(plan: CoachPlanConfig): CoachPlanConfig {
  if (plan.features && plan.features.length > 0) return plan;
  const fallback = DEFAULT_COACH_PLANS.find((d) => d.id === plan.id);
  return fallback?.features ? { ...plan, features: fallback.features } : plan;
}

function planPriceLabel(plan: CoachPlanConfig): { big: string; suffix: string } {
  if (plan.price <= 0) return { big: "Free", suffix: "forever trial" };
  return { big: plan.price.toLocaleString("en-US"), suffix: "EGP / month" };
}

/* ---------------- Current Plan card (Coach Dashboard) ---------------- */

export function CurrentPlanCard({ onViewPlans }: { onViewPlans?: () => void }) {
  const { coachPlans, myCoachSubscription, myCoachPlan, myClientCount, myClientLimit, myPendingRequest } = useApp();

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
  const isTrial = plan.id === "FREE";

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
      {isTrial && status === "ACTIVE" && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-sky-300">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <span>You&apos;re on the Free trial — add your first client, then request a paid plan when you&apos;re ready to grow.</span>
        </div>
      )}
      {myPendingRequest && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn-400/25 bg-warn-400/[0.07] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-warn-200">
          <Hourglass className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Plan request pending admin review — we&apos;ll activate it as soon as it&apos;s approved.</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-display text-3xl font-bold uppercase leading-none tracking-tight text-mist-100">{plan.name}</p>
          <p className="mt-1.5 text-sm font-bold text-mist-300 tnum">
            {plan.price <= 0 ? (
              "Free trial"
            ) : (
              <>
                {formatEGP(plan.price)} <span className="text-xs font-semibold text-mist-500">/ month</span>
              </>
            )}
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
              {nearLimit ? "Limit reached — request a bigger plan" : almostFull ? "Almost full" : "Client usage"}
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
              Request a bigger plan <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
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
  const { coachPlans, myCoachSubscription, myClientCount, myPendingRequest, requestPlan, toast } = useApp();
  const [target, setTarget] = useState<CoachPlan | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const plans = useMemo(
    () => (coachPlans.length > 0 ? [...coachPlans].sort((a, b) => a.price - b.price) : [...DEFAULT_COACH_PLANS]),
    [coachPlans],
  );
  const currentId = normalizeCoachPlanId(myCoachSubscription?.planName);
  const status = effectiveCoachStatus(myCoachSubscription, todayISO());
  const pendingPlanId = normalizeCoachPlanId(myPendingRequest?.requestedPlan);

  const openRequest = (id: CoachPlan) => {
    if (id === currentId || id === pendingPlanId) return;
    setTarget(id);
    setNote("");
    setError("");
  };

  const submitRequest = async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      await requestPlan(target, note);
      setTarget(null);
      setNote("");
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      toast(msg, "warn");
    } finally {
      setBusy(false);
    }
  };

  const targetPlan = target ? withFeatures(getPlanById(plans, target)) : null;
  const targetTooSmall =
    targetPlan && targetPlan.maxClients !== null && myClientCount > targetPlan.maxClients;

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
            . Paid plans activate after admin approval — prices in EGP, billed monthly.
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

      {myPendingRequest && pendingPlanId && (
        <div role="status" className="rise mt-4 flex items-start gap-3 rounded-2xl border border-warn-400/30 bg-warn-400/[0.07] px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warn-400/15 text-warn-300 ring-1 ring-warn-400/25">
            <Hourglass className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-warn-200">
              Requested {getPlanById(plans, pendingPlanId).name} — pending review
            </p>
            <p className="mt-0.5 text-[13px] font-medium leading-5 text-mist-400">
              The admin has your request and will activate the plan once approved. You can keep working meanwhile.
            </p>
          </div>
        </div>
      )}

      {currentId === "FREE" && !myPendingRequest && (
        <div role="status" className="rise mt-4 flex items-start gap-3 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/25">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-sky-200">You&apos;re on the Free trial — 1 client included</p>
            <p className="mt-0.5 text-[13px] font-medium leading-5 text-mist-400">
              Add your first client to try everything out. When you&apos;re ready to grow, request a paid plan below.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COACH_PLAN_ORDER.map((id, i) => {
          const plan = withFeatures(getPlanById(plans, id));
          const isCurrent = currentId === id;
          const isPending = pendingPlanId === id;
          const isFree = id === "FREE";
          const isPopular = id === "PROFESSIONAL";
          const price = planPriceLabel(plan);
          return (
            <article
              key={id}
              aria-label={`${plan.name} plan`}
              className={`rise relative flex flex-col overflow-hidden rounded-[20px] border bg-night-900/60 p-6 shadow-sm backdrop-blur-xl transition-colors ${
                isCurrent ? "border-volt-400/50 ring-1 ring-volt-400/30" : "border-white/[0.07] hover:border-white/[0.14]"
              }`}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
              />
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-mist-500">{plan.name}</p>
                {isCurrent ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-volt-400/40 bg-volt-400/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-volt-300">
                    <BadgeCheck className="h-3 w-3" /> Current
                  </span>
                ) : isFree ? (
                  <span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-300">
                    Trial
                  </span>
                ) : isPopular ? (
                  <span className="shrink-0 rounded-full bg-volt-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-night-950">
                    Most Popular
                  </span>
                ) : null}
              </div>

              <p className="mt-3 font-display text-4xl font-extrabold tracking-tight text-mist-100 tnum">
                {price.big}
                <span className="ms-1.5 align-middle font-sans text-sm font-bold text-mist-500">{price.suffix}</span>
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-mist-400">
                {plan.maxClients === null ? "100+ Clients · Unlimited capacity" : plan.maxClients === 1 ? "1 Client · try everything" : `Up to ${plan.maxClients} Clients`}
              </p>
              {isCurrent && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold text-mist-400">
                    <span>Your usage</span>
                    <span className="tnum">{plan.maxClients === null ? `${myClientCount}` : `${myClientCount} / ${plan.maxClients}`}</span>
                  </div>
                  {plan.maxClients !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuenow={Math.min(100, Math.round((myClientCount / Math.max(1, plan.maxClients)) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label="Current plan usage">
                      <div
                        className="h-full rounded-full bg-volt-400"
                        style={{ width: `${Math.min(100, Math.round((myClientCount / Math.max(1, plan.maxClients)) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <ul className="mt-5 grid flex-1 content-start gap-2.5">
                {plan.features?.map((f) => (
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
                ) : isPending ? (
                  <span className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-warn-400/30 bg-warn-400/[0.08] px-4 py-2.5 text-sm font-bold text-warn-200" role="status">
                    <Hourglass className="h-4 w-4" /> Requested — pending review
                  </span>
                ) : isFree ? (
                  <span className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-mist-500">
                    Trial plan
                  </span>
                ) : (
                  <button
                    className={`${isPopular ? btnPrimary : btnSecondary} w-full`}
                    onClick={() => openRequest(id)}
                    aria-label={`Request ${plan.name}`}
                  >
                    <Send className="h-4 w-4" /> Request {plan.name}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-night-900/50 px-4 py-3 text-center text-xs leading-5 text-mist-500">
        Requests go to the admin for review — approved plans activate immediately. Downgrades below your roster size can&apos;t be approved, and no clients are ever deleted automatically.
      </div>

      <Modal open={target !== null} onClose={() => { if (!busy) { setTarget(null); setError(""); } }} title={targetPlan ? `Request ${targetPlan.name}?` : "Request plan"}>
        {targetPlan && (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-night-800 px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-mist-100">{targetPlan.name}</p>
                <p className="mt-0.5 text-xs font-semibold text-mist-500">
                  {targetPlan.maxClients === null ? "Unlimited clients" : targetPlan.maxClients === 1 ? "1 client" : `Up to ${targetPlan.maxClients} clients`}
                </p>
              </div>
              <p className="font-display text-2xl font-extrabold text-mist-100 tnum">
                {targetPlan.price <= 0 ? "Free" : <>{targetPlan.price.toLocaleString("en-US")} <span className="text-xs font-bold text-mist-500">EGP/mo</span></>}
              </p>
            </div>
            {targetTooSmall && (
              <p role="alert" className="rounded-xl border border-warn-400/25 bg-warn-400/[0.07] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-warn-200">
                Heads up: you have {myClientCount} clients but {targetPlan.name} allows {targetPlan.maxClients} — the admin can&apos;t approve until your roster fits.
              </p>
            )}
            <div>
              <label className={labelCls} htmlFor="plan-request-note">Note for the admin (optional)</label>
              <textarea
                id="plan-request-note"
                className={textareaCls}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything they should know…"
                rows={3}
                maxLength={500}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-danger-300">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button className={`${btnSecondary} flex-1`} disabled={busy} onClick={() => { setTarget(null); setError(""); }}>
                Cancel
              </button>
              <button className={`${btnPrimary} flex-1`} disabled={busy} onClick={() => void submitRequest()}>
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
