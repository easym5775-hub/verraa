/* ================================================================
   VERRAA — Owner Subscriptions Management View.
   Real database data only: plan, price (EGP), client count/limit,
   status, start/end dates. All controls persist + record history.
   ================================================================ */

import { useState, useMemo } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Shield, Calendar, DollarSign, MoreVertical, CheckCircle, Clock, XCircle, Users, RotateCcw, CreditCard, Trash2, History, PauseCircle, PlayCircle, ChevronDown } from "lucide-react";
import { Dropdown, Modal } from "./ui";
import { backend } from "../services/backend";
import { DEFAULT_COACH_PLANS, formatEGP, getCoachPlanConfig, normalizeCoachPlanId, resolveCoachSubscription } from "../coachPricing";
import type { CoachPlan } from "../types";
import { errorMessage, todayISO } from "../lib";

type StatusFilter = "all" | "active" | "expired" | "pending" | "suspended";

interface HistoryRow {
  id: string;
  action: string;
  old_value?: unknown;
  new_value?: unknown;
  performed_by?: string | null;
  performed_at?: string;
}

export function OwnerSubscriptionsView() {
  const { state, reload, toast } = useApp();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<{ subId: string | null; coachId: string } | null>(null);
  const [planError, setPlanError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");

  const plans = state.coachPlans && state.coachPlans.length > 0 ? state.coachPlans : DEFAULT_COACH_PLANS;
  const today = todayISO();

  // Real subscription rows: one per coach (latest subscription), with live client counts + plan limits.
  const subscriptions = useMemo(() => {
    const allCoaches = state.coaches ?? [];
    const allCoachSubs = state.coachSubscriptions ?? [];
    return allCoaches.map((coach) => {
      const primarySub = resolveCoachSubscription(allCoachSubs as never[], coach.id);
      const clientCount = state.clients.filter((c) => c.coachId === coach.id).length;
      if (!primarySub) {
        const fallback = plans.find((p) => p.id === "STARTER") ?? DEFAULT_COACH_PLANS[0];
        return {
          id: `none-${coach.id}`,
          subId: null as string | null,
          coachId: coach.id,
          coachName: coach.name || "Unknown Coach",
          coachEmail: coach.email || "No email",
          planName: "No Plan",
          planId: null as CoachPlan | null,
          status: "PENDING" as const,
          startDate: null as string | null,
          endDate: null as string | null,
          price: 0,
          autoRenew: false,
          clientCount,
          clientLimit: fallback.maxClients,
          daysRemaining: 0,
        };
      }
      const rawStatus = (primarySub.status ?? "").toUpperCase();
      const endDate = primarySub.endDate || null;
      const daysRemaining = endDate ? Math.ceil((new Date(endDate + "T12:00:00").getTime() - Date.now()) / 86_400_000) : 0;
      let status: "ACTIVE" | "EXPIRED" | "PENDING" | "SUSPENDED" | "CANCELLED" = "PENDING";
      if (rawStatus === "ACTIVE") status = endDate && endDate < today ? "EXPIRED" : "ACTIVE";
      else if (rawStatus === "SUSPENDED") status = "SUSPENDED";
      else if (rawStatus === "EXPIRED") status = "EXPIRED";
      else if (rawStatus === "CANCELLED" || rawStatus === "CANCELED") status = "CANCELLED";
      else status = "PENDING";
      const planId = normalizeCoachPlanId(primarySub.planName);
      const cfg = getCoachPlanConfig(plans, primarySub.planName);
      return {
        id: primarySub.id,
        subId: primarySub.id,
        coachId: coach.id,
        coachName: coach.name || "Unknown Coach",
        coachEmail: coach.email || "No email",
        planName: cfg ? cfg.name : primarySub.planName || "No Plan",
        planId,
        status,
        startDate: primarySub.startDate || null,
        endDate,
        price: Number(primarySub.price || cfg?.price || 0),
        autoRenew: Boolean(primarySub.autoRenew),
        clientCount,
        clientLimit: cfg ? cfg.maxClients : null,
        daysRemaining: Math.max(0, daysRemaining),
      };
    });
  }, [state.coaches, state.coachSubscriptions, state.clients, plans, today]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((sub) => {
      if (statusFilter === "all") return true;
      return sub.status.toLowerCase() === statusFilter;
    });
  }, [subscriptions, statusFilter]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      EXPIRED: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      PENDING: "bg-warn-400/10 text-warn-300 border-warn-400/20",
      SUSPENDED: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      CANCELLED: "bg-night-600/30 text-mist-400 border-night-500/40",
    };
    const icons: Record<string, React.ReactNode> = {
      ACTIVE: <CheckCircle className="h-3 w-3" />,
      EXPIRED: <XCircle className="h-3 w-3" />,
      PENDING: <Clock className="h-3 w-3" />,
      SUSPENDED: <PauseCircle className="h-3 w-3" />,
      CANCELLED: <XCircle className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.PENDING}`}>
        {icons[status] || <Clock className="h-3 w-3" />}
        {status}
      </span>
    );
  };

  const mutate = async (label: string, fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
      toast(label, "ok");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setLoading(false);
      setOpenMenu(null);
    }
  };

  const handleExtendSubscription = (subscriptionId: string | null, days: number) => {
    if (!subscriptionId) {
      toast("This coach has no subscription to extend.", "warn");
      return;
    }
    const sub = (state.coachSubscriptions ?? []).find((s) => s.id === subscriptionId);
    const base = sub?.endDate && sub.endDate >= today ? new Date(sub.endDate + "T12:00:00") : new Date();
    base.setDate(base.getDate() + days);
    const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
    // Extending an EXPIRED subscription reactivates it; SUSPENDED/CANCELLED stay as-is.
    const patch: Record<string, string> =
      sub && (sub.status ?? "").toUpperCase() === "EXPIRED" ? { end_date: iso, status: "ACTIVE" } : { end_date: iso };
    void mutate(`Subscription extended by ${days} days`, () => backend.updateCoachSubscription(subscriptionId, patch));
  };

  const handleSetStatus = (subscriptionId: string | null, status: string, label: string) => {
    if (!subscriptionId) {
      toast("This coach has no subscription yet.", "warn");
      return;
    }
    void mutate(label, () => backend.updateCoachSubscription(subscriptionId, { status }));
  };

  const handleChangePlan = (subscriptionId: string | null, coachId: string) => {
    setSelectedSubscription({ subId: subscriptionId, coachId });
    setPlanError("");
    setPlanModalOpen(true);
    setOpenMenu(null);
  };

  const handlePlanChange = async (planId: CoachPlan) => {
    const target = selectedSubscription;
    if (!target) return;
    setLoading(true);
    setPlanError("");
    try {
      // Works for coaches with no subscription yet: the server creates one.
      await backend.changeCoachPlan(target.coachId, planId);
      toast(`Plan changed to ${planId.charAt(0) + planId.slice(1).toLowerCase()}`, "ok");
      setPlanModalOpen(false);
      setSelectedSubscription(null);
      await reload();
    } catch (e) {
      const msg = errorMessage(e);
      setPlanError(msg);
      toast(msg, "warn");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      await backend.deleteCoachSubscription(deleteTarget.id);
      toast("Subscription deleted", "ok");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setLoading(false);
    }
  };

  const historyPerformerName = (performedBy: unknown): string => {
    const by = performedBy ? String(performedBy) : "";
    if (!by) return "system";
    // Only coaches and the (single) admin can produce these rows.
    const coach = (state.coaches ?? []).find((c) => c.id === by);
    return coach ? coach.name : "Admin";
  };

  const handleViewHistory = async (sub: { subId: string | null; coachName: string }) => {
    setOpenMenu(null);
    setHistoryTitle(`Subscription history · ${sub.coachName}`);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await backend.loadSubscriptionHistory(sub.subId ?? undefined);
      setHistoryRows(rows as unknown as HistoryRow[]);
    } catch (e) {
      toast(errorMessage(e), "warn");
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      <OwnerPageHeader
        title="Subscriptions"
        sub="Manage coach subscriptions and billing"
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-mist-500">
              {filteredSubscriptions.length} subscription{filteredSubscriptions.length !== 1 ? "s" : ""}
            </span>
          </div>
        }
      />

      {/* Filters */}
      <div className="rise mt-6 flex items-center gap-2">
        <Shield className="h-4 w-4 text-mist-500" />
        <select
          className="rounded-xl border border-night-600 bg-night-850 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Subscriptions Grid */}
      <div className="rise mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSubscriptions.map((sub) => (
          <div
            key={sub.id}
            className="group relative overflow-hidden rounded-2xl border border-night-700 bg-night-850/50 p-5 backdrop-blur-md transition-all duration-200 hover:border-volt-400/30 hover:bg-night-800/60"
          >
            <div className="absolute end-4 top-4">{getStatusBadge(sub.status)}</div>

            <div className="mb-4">
              <h3 className="font-display text-lg font-bold uppercase text-mist-100">{sub.coachName}</h3>
              <p className="text-xs text-mist-500">{sub.coachEmail}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-volt-400" />
                <span className="text-sm font-semibold text-mist-300">{sub.planName}</span>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-mist-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-mist-500">Price</span>
                    <span className="font-bold text-mist-300 tnum">{formatEGP(sub.price)} / month</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-mist-500" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-mist-500">Clients</span>
                    <span className="font-bold text-mist-300 tnum">
                      {sub.clientLimit === null ? `${sub.clientCount} · Unlimited` : `${sub.clientCount} / ${sub.clientLimit}`}
                    </span>
                  </div>
                  {sub.clientLimit !== null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-night-700">
                      <div
                        className={`h-full rounded-full ${sub.clientCount >= (sub.clientLimit ?? 0) ? "bg-danger-400" : "bg-volt-400"}`}
                        style={{ width: `${Math.min(100, Math.round((sub.clientCount / Math.max(1, sub.clientLimit ?? 1)) * 100))}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {(sub.startDate || sub.endDate) && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-mist-500" />
                  <div className="flex-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-mist-500">Start</span>
                      <span className="text-mist-300">{sub.startDate ?? "—"}</span>
                    </div>
                    <div className="mt-0.5 flex justify-between">
                      <span className="text-mist-500">End</span>
                      <span className="text-mist-300">{sub.endDate ?? "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              {sub.daysRemaining > 0 && sub.status === "ACTIVE" && (
                <div className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${
                  sub.daysRemaining <= 7
                    ? "bg-warn-400/10 text-warn-300"
                    : sub.daysRemaining <= 30
                      ? "bg-sky-400/10 text-sky-300"
                      : "bg-moss-400/10 text-moss-300"
                }`}>
                  {sub.daysRemaining} days remaining
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Dropdown
                open={openMenu === sub.id}
                onOpenChange={(open) => setOpenMenu(open ? sub.id : null)}
                items={[
                  { type: "item" as const, label: "Extend +30 Days", icon: RotateCcw, onClick: () => handleExtendSubscription(sub.subId, 30) },
                  { type: "item" as const, label: "Extend +90 Days", icon: RotateCcw, onClick: () => handleExtendSubscription(sub.subId, 90) },
                  { type: "divider" as const },
                  { type: "item" as const, label: "Change Plan", icon: CreditCard, onClick: () => handleChangePlan(sub.subId, sub.coachId) },
                  { type: "divider" as const },
                  ...(sub.status === "SUSPENDED"
                    ? [{ type: "item" as const, label: "Activate", icon: PlayCircle, onClick: () => handleSetStatus(sub.subId, "ACTIVE", "Subscription activated") }]
                    : [{ type: "item" as const, label: "Suspend", icon: PauseCircle, onClick: () => handleSetStatus(sub.subId, "SUSPENDED", "Subscription suspended"), danger: true }]),
                  ...(sub.status === "ACTIVE"
                    ? [{ type: "item" as const, label: "Cancel Subscription", icon: Trash2, onClick: () => handleSetStatus(sub.subId, "CANCELLED", "Subscription cancelled"), danger: true }]
                    : []),
                  ...(sub.subId
                    ? [{ type: "item" as const, label: "Delete Row", icon: Trash2, onClick: () => { setDeleteTarget({ id: sub.subId as string, label: `${sub.coachName} · ${sub.planName}` }); setOpenMenu(null); }, danger: true }]
                    : []),
                  { type: "item" as const, label: "View History", icon: History, onClick: () => void handleViewHistory(sub) },
                ]}
                trigger={
                  <button
                    onClick={() => setOpenMenu(openMenu === sub.id ? null : sub.id)}
                    disabled={loading}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl border border-night-600 bg-night-800 py-2 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 hover:text-volt-300 disabled:opacity-50"
                  >
                    <MoreVertical className="h-3 w-3" /> Actions <ChevronDown className="ml-1 h-3 w-3" />
                  </button>
                }
              />
            </div>
          </div>
        ))}

        {filteredSubscriptions.length === 0 && (
          <div className="col-span-full rounded-2xl border border-night-700 bg-night-850/30 p-8 text-center">
            <Shield className="mx-auto h-12 w-12 text-mist-600" />
            <p className="mt-3 text-sm font-bold text-mist-500">No subscriptions found</p>
            <p className="mt-1 text-xs text-mist-600">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Expiring Soon Alert */}
      {subscriptions.some((s) => s.daysRemaining <= 7 && s.daysRemaining > 0 && s.status === "ACTIVE") && (
        <div className="rise mt-6 rounded-2xl border border-warn-400/20 bg-warn-400/5 p-5">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 shrink-0 text-warn-400" />
            <div>
              <h4 className="font-display text-sm font-bold uppercase text-warn-300">Expiring Soon</h4>
              <p className="mt-1 text-xs text-mist-400">
                {subscriptions.filter((s) => s.daysRemaining <= 7 && s.daysRemaining > 0 && s.status === "ACTIVE").length} subscription(s) expiring within 7 days. Consider reaching out to coaches for renewal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Change Modal — real plans, real prices, downgrade-safe */}
      <Modal open={planModalOpen} onClose={() => { setPlanModalOpen(false); setSelectedSubscription(null); setPlanError(""); }} title="Change Subscription Plan" description="Downgrades below the current roster size are blocked.">
        <div className="grid gap-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => void handlePlanChange(p.id)}
              disabled={loading}
              className="w-full rounded-xl border border-night-600 bg-night-800 p-4 text-left transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 disabled:opacity-50"
            >
              <p className="font-bold text-mist-200">{p.name} Plan</p>
              <p className="mt-0.5 text-xs text-mist-500 tnum">
                {formatEGP(p.price)}/month · {p.maxClients === null ? "Unlimited clients" : `Up to ${p.maxClients} clients`}
              </p>
            </button>
          ))}
        </div>
        {planError && (
          <p role="alert" className="mt-3 whitespace-pre-line rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-xs font-bold leading-5 text-danger-300">
            {planError}
          </p>
        )}
        <button
          onClick={() => { setPlanModalOpen(false); setSelectedSubscription(null); setPlanError(""); }}
          className="mt-4 w-full cursor-pointer rounded-xl border border-night-600 bg-night-800 py-2 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-mist-400/40 hover:bg-mist-400/10 hover:text-mist-300"
        >
          Cancel
        </button>
      </Modal>

      {/* Delete Row Confirm — the row's history goes with it */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Delete Subscription Row?">
        {deleteTarget && (
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-mist-300">
              Delete the subscription row for <span className="font-bold text-mist-100">{deleteTarget.label}</span>?
              Its history entries are deleted with it. Use this to clean up duplicate or mistaken rows — to stop
              service, prefer Suspend or Cancel instead.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-xs font-bold text-mist-400 transition hover:border-mist-400/40 hover:text-mist-200">
                Keep it
              </button>
              <button
                onClick={() => void handleDeleteSubscription()}
                disabled={loading}
                className="flex-1 cursor-pointer rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-2 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50"
              >
                Delete row
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Subscription History Modal — real rows, no placeholders */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Subscription History" description={historyTitle} wide>
        {historyLoading ? (
          <p className="py-6 text-center text-sm text-mist-500">Loading history…</p>
        ) : historyRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-mist-500">No history entries yet. Changes made from now on will appear here.</p>
        ) : (
          <ul className="grid gap-2">
            {historyRows.map((h) => (
              <li key={h.id} className="rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-volt-400/25 bg-volt-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-300">
                    {(h.action ?? "updated").replace(/_/g, " ")}
                  </span>
                  <span className="ms-auto text-[11px] font-semibold text-mist-500">
                    {h.performed_at ? new Date(h.performed_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                </div>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-mist-500">by {historyPerformerName(h.performed_by)}</p>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
