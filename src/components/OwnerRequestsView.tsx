/* ================================================================
   VERRAA — Owner Plan Requests: approve (activates plan) or reject.
   Real database data only (coach_plan_requests + coaches + plans).
   ================================================================ */

import { useMemo, useState } from "react";
import { CheckCircle2, Hourglass, Inbox, XCircle } from "lucide-react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Badge, Modal, btnPrimary, btnSecondary, btnSm, labelCls, textareaCls } from "./ui";
import { DEFAULT_COACH_PLANS, formatEGP, getPlanById, normalizeCoachPlanId } from "../coachPricing";
import { errorMessage } from "../lib";
import type { CoachPlanRequest } from "../types";

export function OwnerRequestsView() {
  const { state, reviewPlanRequest, toast } = useApp();
  const [rejectTarget, setRejectTarget] = useState<CoachPlanRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const plans = state.coachPlans && state.coachPlans.length > 0 ? state.coachPlans : DEFAULT_COACH_PLANS;
  const requests = useMemo(
    () => [...(state.planRequests ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    [state.planRequests],
  );
  const pending = useMemo(() => requests.filter((r) => r.status === "PENDING"), [requests]);
  const history = useMemo(() => requests.filter((r) => r.status !== "PENDING"), [requests]);

  const coachOf = (coachId: string) => (state.coaches ?? []).find((c) => c.id === coachId);
  const currentPlanOf = (coachId: string) => {
    const subs = (state.coachSubscriptions ?? []).filter((s) => s.coachId === coachId);
    const latest = [...subs].sort(
      (a, b) => String(b.endDate ?? "").localeCompare(String(a.endDate ?? "")) || String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    )[0];
    return latest ? (normalizeCoachPlanId(latest.planName) ?? null) : null;
  };

  const approve = async (r: CoachPlanRequest) => {
    setBusyId(r.id);
    try {
      await reviewPlanRequest(r.id, true);
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await reviewPlanRequest(rejectTarget.id, false, reviewNote);
      setRejectTarget(null);
      setReviewNote("");
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusyId(null);
    }
  };

  const planLabel = (raw: string) => {
    const id = normalizeCoachPlanId(raw);
    if (!id) return raw;
    const p = getPlanById(plans, id);
    const cap = p.maxClients === null ? "unlimited" : p.maxClients === 1 ? "1 client" : `up to ${p.maxClients}`;
    const price = p.price <= 0 ? "Free" : `${formatEGP(p.price)} EGP/mo`;
    return `${p.name} · ${cap} · ${price}`;
  };

  return (
    <div>
      <OwnerPageHeader
        title="Plan"
        accent="Requests"
        sub={`${pending.length} pending · ${history.length} reviewed. Approving activates the plan immediately; rejecting keeps the coach on their current plan.`}
      />

      {/* pending */}
      <section aria-label="Pending requests">
        <h2 className="eyebrow">Pending review</h2>
        {pending.length === 0 ? (
          <div className="rise mt-3 flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-night-900/50 px-4 py-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-moss-400/10 text-moss-300 ring-1 ring-moss-400/25">
              <Inbox className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-mist-100">All caught up</p>
              <p className="mt-0.5 text-[13px] text-mist-500">New plan requests from coaches will appear here.</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {pending.map((r, i) => {
              const coach = coachOf(r.coachId);
              const current = currentPlanOf(r.coachId);
              const busy = busyId === r.id;
              return (
                <article
                  key={r.id}
                  className="rise rounded-2xl border border-warn-400/20 bg-night-900/60 p-4 backdrop-blur-xl sm:p-5"
                  style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-extrabold text-mist-100">{coach?.name ?? "Unknown coach"}</p>
                        <Badge className="border-warn-400/25 bg-warn-400/10 text-warn-300">
                          <Hourglass className="h-3 w-3" /> Pending
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-semibold text-mist-500">{coach?.email ?? r.coachId}</p>
                      <p className="mt-2 text-[13px] font-semibold leading-5 text-mist-300">
                        {current ? <>{getPlanById(plans, current).name} <span className="text-mist-500">→</span> </> : null}
                        <span className="font-extrabold text-volt-300">{planLabel(r.requestedPlan)}</span>
                      </p>
                      {r.note && (
                        <p className="mt-1.5 rounded-xl bg-white/[0.03] px-3 py-2 text-[13px] leading-5 text-mist-400 ring-1 ring-white/[0.06]">
                          “{r.note}”
                        </p>
                      )}
                      <p className="mt-1.5 text-[11px] font-semibold text-mist-500">
                        Requested {r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button className={`${btnSecondary} ${btnSm} !border-danger-500/25 !text-danger-300 hover:!bg-danger-500/10`} disabled={busy} onClick={() => { setRejectTarget(r); setReviewNote(""); }}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                      <button className={`${btnPrimary} ${btnSm}`} disabled={busy} onClick={() => void approve(r)}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> {busy ? "Approving…" : "Approve & activate"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* history */}
      {history.length > 0 && (
        <section aria-label="Reviewed requests" className="mt-8">
          <h2 className="eyebrow">Reviewed</h2>
          <div className="mt-3 grid gap-2.5">
            {history.slice(0, 30).map((r) => {
              const coach = coachOf(r.coachId);
              const ok = r.status === "APPROVED";
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.06] bg-night-900/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-mist-200">
                      {coach?.name ?? "Unknown coach"} <span className="font-semibold text-mist-500">→ {planLabel(r.requestedPlan)}</span>
                    </p>
                    {r.reviewNote && <p className="mt-0.5 truncate text-xs text-mist-500">Note: {r.reviewNote}</p>}
                  </div>
                  <Badge className={ok ? "border-moss-400/25 bg-moss-400/10 text-moss-300" : "border-night-500/40 bg-night-600/25 text-mist-400"}>
                    {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {ok ? "Approved" : "Rejected"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Modal open={rejectTarget !== null} onClose={() => { if (!busyId) { setRejectTarget(null); setReviewNote(""); } }} title="Reject request?">
        <div className="grid gap-4">
          <p className="text-sm leading-6 text-mist-300">
            The coach stays on their current plan. Optionally tell them why:
          </p>
          <div>
            <label className={labelCls} htmlFor="reject-note">Reason (optional)</label>
            <textarea
              id="reject-note"
              className={textareaCls}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. roster exceeds this plan's limit…"
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            <button className={`${btnSecondary} flex-1`} disabled={!!busyId} onClick={() => { setRejectTarget(null); setReviewNote(""); }}>
              Cancel
            </button>
            <button className={`${btnPrimary} flex-1`} disabled={!!busyId} onClick={() => void reject()}>
              {busyId ? "Rejecting…" : "Confirm reject"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
