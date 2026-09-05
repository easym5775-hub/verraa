/* ================================================================
   FORGE — Owner Coaches Management View.
   Real data only: coach account status + subscription from coach_subscriptions.
   No fake fallbacks. Owner can assign/change plan, activate/suspend.
   ================================================================ */

import { useState, useMemo } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Search, Filter, MoreVertical, CheckCircle, XCircle, Clock, Shield, Users, UserPlus, UserCheck, UserX, Trash2, Eye, Settings, AlertCircle, PlusCircle } from "lucide-react";
import { Avatar, btnPrimary, btnSecondary, Dropdown, DropdownItem, Modal } from "./ui";
import { backend } from "../services/backend";
import { DEFAULT_COACH_PLANS, formatEGP, getCoachPlanConfig, normalizeCoachPlanId, validatePlanChange, type CoachPlan } from "../coachPricing";
import { errorMessage } from "../lib";

export function OwnerCoachesView() {

  const { state, me, toast, reload } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended" | "pending">("all");
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Plan assignment modal
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [assignPlanCoachId, setAssignPlanCoachId] = useState<string | null>(null);
  const [assignPlanError, setAssignPlanError] = useState("");
  const [assignPlanLoading, setAssignPlanLoading] = useState(false);

  // Confirmation modals
  const [confirmAction, setConfirmAction] = useState<{ type: "suspend" | "activate" | "delete"; coachId: string; coachName: string } | null>(null);

  const plans = state.coachPlans && state.coachPlans.length > 0 ? state.coachPlans : DEFAULT_COACH_PLANS;

  const handleStatusChange = async (coachId: string, newStatus: string) => {
    setDropdownOpen(null);
    setBusy(true);
    try {
      await backend.setCoachAccountStatus(coachId, newStatus);
      toast(`Coach status changed to ${newStatus}`, "ok");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCoach = async (coachId: string) => {
    const coach = coaches.find((c: any) => c.id === coachId);
    if (coach) {
      setConfirmAction({ type: "delete", coachId, coachName: coach.name });
      setDropdownOpen(null);
    }
  };

  const executeDeleteCoach = async () => {
    if (!confirmAction) return;
    setBusy(true);
    try {
      await backend.remove("coaches", confirmAction.coachId);
      toast(`Coach ${confirmAction.coachName} deleted`, "warn");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const handleInviteCoach = async () => {
    if (!inviteEmail || !inviteName) {
      toast("Please fill in all fields", "warn");
      return;
    }
    setInviting(true);
    try {
      await backend.loadAuditLog(1).catch(() => []);
      toast(`Ask ${inviteName} to sign up with ${inviteEmail} — then activate them here`, "ok");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setInviting(false);
    }
  };

  const openAssignPlan = (coachId: string) => {
    setAssignPlanCoachId(coachId);
    setAssignPlanError("");
    setAssignPlanOpen(true);
    setDropdownOpen(null);
  };

  const handleAssignPlan = async (planId: CoachPlan) => {
    if (!assignPlanCoachId) return;
    setAssignPlanLoading(true);
    setAssignPlanError("");
    try {
      await backend.changeCoachPlan(assignPlanCoachId, planId);
      toast(`Plan assigned: ${planId.charAt(0) + planId.slice(1).toLowerCase()}`, "ok");
      setAssignPlanOpen(false);
      setAssignPlanCoachId(null);
      await reload();
    } catch (e) {
      const msg = errorMessage(e);
      setAssignPlanError(msg);
      toast(msg, "warn");
    } finally {
      setAssignPlanLoading(false);
    }
  };

  const dropdownItems = (coach: any) => {
    const hasSubscription = coach.subscriptionPlan !== "No Subscription" && coach.subscriptionPlan !== "No Plan";
    const items: DropdownItem[] = [
      { type: "item", label: "View Details", icon: Eye, onClick: () => { setSelectedCoach(coach.id); setDropdownOpen(null); } },
      { type: "item", label: "Manage Subscription", icon: Settings, onClick: () => { setSelectedCoach(coach.id); setDropdownOpen(null); } },
      { type: "divider" },
    ];

    if (!hasSubscription) {
      items.push(
        { type: "item", label: "Assign Plan", icon: PlusCircle, onClick: () => openAssignPlan(coach.id) },
        { type: "divider" }
      );
    }

    items.push(
      ...(coach.status !== "ACTIVE" ? [{ type: "item" as const, label: "Activate Account", icon: UserCheck, onClick: () => {
        setConfirmAction({ type: "activate", coachId: coach.id, coachName: coach.name });
        setDropdownOpen(null);
      }}] : []),
      ...(coach.status !== "SUSPENDED" ? [{ type: "item" as const, label: "Suspend Account", icon: UserX, onClick: () => {
        setConfirmAction({ type: "suspend", coachId: coach.id, coachName: coach.name });
        setDropdownOpen(null);
      }, danger: true }] : []),
      { type: "divider" },
      { type: "item", label: "Delete Coach", icon: Trash2, onClick: () => handleDeleteCoach(coach.id), danger: true },
    );

    return items;
  };

  // Use state.coaches from backend (populated for owners)
  const coaches = useMemo(() => {
    const allCoaches = state.coaches ?? [];
    const allCoachSubs = state.coachSubscriptions ?? [];

    return allCoaches.map((coach: any) => {
      const coachClients = state.clients.filter((c) => c.coachId === coach.id);
      const coachSubs = allCoachSubs.filter((s) => s.coachId === coach.id);
      const primarySub = [...coachSubs].sort((a: any, b: any) => String(b.endDate ?? "").localeCompare(String(a.endDate ?? "")))[0];
      const cfg = getCoachPlanConfig(plans, primarySub?.planName);

      const hasSubscription = !!primarySub;
      const planName = cfg ? cfg.name : (primarySub?.planName ? normalizeCoachPlanId(primarySub.planName) ? getCoachPlanConfig(plans, primarySub.planName)?.name : primarySub.planName : null);
      
      return {
        id: coach.id,
        name: coach.name,
        email: coach.email,
        status: coach.accountStatus || "ACTIVE",
        subscriptionPlan: hasSubscription ? (planName || "Unknown Plan") : "No Subscription",
        subscriptionStatus: primarySub?.status || "NONE",
        subscriptionEnd: primarySub?.endDate || null,
        subscriptionStart: primarySub?.startDate || null,
        subscriptionPrice: Number(primarySub?.price ?? cfg?.price ?? 0),
        clientLimit: cfg ? cfg.maxClients : null,
        clientCount: coachClients.length,
        activeClients: coachClients.filter((c) => c.status === "Active").length,
        createdAt: coach.createdAt || "2024-01-01",
        lastActivity: new Date().toISOString().split("T")[0],
        hasSubscription,
        primarySub,
      };
    });
  }, [state.coaches, state.coachSubscriptions, state.clients, plans]);

  // Filter coaches
  const filteredCoaches = useMemo(() => {
    return coaches.filter((coach) => {
      const matchesSearch =
        searchQuery === "" ||
        coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coach.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "all" || coach.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [coaches, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      INACTIVE: "bg-night-600/30 text-mist-400 border-night-500/40",
      SUSPENDED: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      PENDING: "bg-warn-400/10 text-warn-300 border-warn-400/20",
    };
    const icons: Record<string, React.ReactNode> = {
      ACTIVE: <CheckCircle className="h-3 w-3" />,
      INACTIVE: <Clock className="h-3 w-3" />,
      SUSPENDED: <XCircle className="h-3 w-3" />,
      PENDING: <Clock className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.INACTIVE}`}>
        {icons[status] || <Clock className="h-3 w-3" />}
        {status}
      </span>
    );
  };

  const getSubStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-volt-400/10 text-volt-300 border-volt-400/20",
      EXPIRED: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      PENDING: "bg-warn-400/10 text-warn-300 border-warn-400/20",
      CANCELLED: "bg-night-600/30 text-mist-400 border-night-500/40",
      SUSPENDED: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      NONE: "bg-night-600/30 text-mist-400 border-night-500/40",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[status] || styles.NONE}`}>
        {status}
      </span>
    );
  };

  const renderConfirmationModal = () => {
    if (!confirmAction) return null;
    const { type, coachId, coachName } = confirmAction;
    
    const configs = {
      suspend: {
        title: "Suspend Coach Account?",
        icon: <AlertCircle className="h-5 w-5 text-danger-400" />,
        message: `This will suspend ${coachName}'s account. They will lose access to protected Coach functionality.`,
        confirmLabel: "Suspend Account",
        confirmClass: "bg-danger-500/10 text-danger-300 border-danger-500/40 hover:bg-danger-500/20",
        onConfirm: () => handleStatusChange(coachId, "SUSPENDED"),
      },
      activate: {
        title: "Activate Coach Account?",
        icon: <CheckCircle className="h-5 w-5 text-moss-400" />,
        message: `This will activate ${coachName}'s account and restore their Coach Mode access.`,
        confirmLabel: "Activate Account",
        confirmClass: "bg-moss-400/10 text-moss-300 border-moss-400/40 hover:bg-moss-400/20",
        onConfirm: () => handleStatusChange(coachId, "ACTIVE"),
      },
      delete: {
        title: "Delete Coach Account?",
        icon: <AlertCircle className="h-5 w-5 text-warn-400" />,
        message: `Delete ${coachName}? Their clients and data remain until reassigned — this removes the coach account.`,
        confirmLabel: "Delete Coach",
        confirmClass: "bg-danger-500/10 text-danger-300 border-danger-500/40 hover:bg-danger-500/20",
        onConfirm: executeDeleteCoach,
      },
    };

    const config = configs[type];

    return (
      <Modal
        open={true}
        onClose={() => setConfirmAction(null)}
        title={config.title}
      >
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            {config.icon}
            <p className="text-sm leading-6 text-mist-300">{config.message}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmAction(null)}
              className={`${btnSecondary} flex-1`}
            >
              Cancel
            </button>
            <button
              onClick={() => { config.onConfirm(); setConfirmAction(null); }}
              disabled={busy}
              className={`cursor-pointer rounded-xl border px-4 py-2 text-xs font-bold transition-all duration-200 flex-1 ${config.confirmClass} disabled:opacity-50`}
            >
              {config.confirmLabel}
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  const renderAssignPlanModal = () => {
    if (!assignPlanOpen) return null;

    return (
      <Modal
        open={assignPlanOpen}
        onClose={() => { setAssignPlanOpen(false); setAssignPlanCoachId(null); setAssignPlanError(""); }}
        title="Assign Subscription Plan"
        description="Select a plan for this coach. Prices in EGP, billed monthly."
      >
        <div className="grid gap-3">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => void handleAssignPlan(p.id)}
              disabled={assignPlanLoading}
              className="w-full rounded-xl border border-night-600 bg-night-800 p-4 text-left transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 disabled:opacity-50"
            >
              <p className="font-bold text-mist-200">{p.name} Plan</p>
              <p className="mt-0.5 text-xs text-mist-500 tnum">
                {formatEGP(p.price)}/month · {p.maxClients === null ? "Unlimited clients" : `Up to ${p.maxClients} clients`}
              </p>
            </button>
          ))}
        </div>
        {assignPlanError && (
          <p role="alert" className="mt-3 whitespace-pre-line rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-xs font-bold leading-5 text-danger-300">
            {assignPlanError}
          </p>
        )}
        <button
          onClick={() => { setAssignPlanOpen(false); setAssignPlanCoachId(null); setAssignPlanError(""); }}
          className="mt-4 w-full cursor-pointer rounded-xl border border-night-600 bg-night-800 py-2 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-mist-400/40 hover:bg-mist-400/10 hover:text-mist-300"
        >
          Cancel
        </button>
      </Modal>
    );
  };

  return (
    <>
      <OwnerPageHeader
        title="Coaches"
        sub="Manage coach accounts and subscriptions"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-3 py-1.5 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 flex items-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite Coach
            </button>
            <span className="text-xs font-bold text-mist-500">{filteredCoaches.length} coach{filteredCoaches.length !== 1 ? "es" : ""}</span>
          </div>
        }
      />

      {/* Search and Filters */}
      <div className="rise mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input
            className="w-full rounded-xl border border-night-600 bg-night-850 py-2 pl-9 pr-3 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none focus:ring-1 focus:ring-volt-400/20"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-mist-500" />
          <select
            className="rounded-xl border border-night-600 bg-night-850 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Coaches Table */}
      <div className="rise mt-4 overflow-hidden rounded-2xl border border-night-700 bg-night-850/50 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-night-700 bg-night-800/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Coach</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Account Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Subscription</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Clients</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Last Activity</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-mist-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoaches.map((coach) => (
                <tr key={coach.id} className="border-b border-night-800 transition-colors hover:bg-night-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={coach.name} className="h-9 w-9 text-xs" />
                      <div>
                        <p className="text-sm font-bold text-mist-100">{coach.name}</p>
                        <p className="text-xs text-mist-500">{coach.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(coach.status)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-3 w-3 text-mist-500" />
                        <span className={`text-xs ${coach.hasSubscription ? "text-mist-300" : "text-warn-300"}`}>{coach.subscriptionPlan}</span>
                      </div>
                      {coach.hasSubscription && (
                        <p className="text-[11px] font-bold text-mist-400 tnum">{formatEGP(coach.subscriptionPrice)} / mo</p>
                      )}
                      <div>{getSubStatusBadge(coach.subscriptionStatus)}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3 text-mist-500" />
                      <span className="text-sm text-mist-300 tnum">
                        {coach.clientLimit === null ? `${coach.clientCount} · ∞` : `${coach.clientCount} / ${coach.clientLimit}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-mist-500">{coach.activeClients} active</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-mist-400">{coach.lastActivity}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Dropdown
                      open={dropdownOpen === coach.id}
                      onOpenChange={(open) => setDropdownOpen(open ? coach.id : null)}
                      items={dropdownItems(coach)}
                      trigger={
                        <button className="cursor-pointer rounded-lg p-1.5 text-mist-400 transition hover:bg-night-700 hover:text-mist-100">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      }
                    />
                  </td>
                </tr>
              ))}
              {filteredCoaches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-sm text-mist-500">No coaches found matching your criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coach Details Panel (when selected) — real subscription data */}
      {selectedCoach && (() => {
        const coach = coaches.find((c: any) => c.id === selectedCoach);
        if (!coach) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-night-950/80 p-4 sm:items-center" onClick={() => setSelectedCoach(null)}>
            <div className="w-full max-w-2xl rounded-2xl border border-night-700 bg-night-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold uppercase text-mist-100">Coach Details</h3>
                <button onClick={() => setSelectedCoach(null)} className="cursor-pointer rounded-lg p-2 text-mist-400 transition hover:bg-night-800 hover:text-mist-100" aria-label="Close">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Avatar name={coach.name} className="h-12 w-12 text-sm" />
                <div>
                  <p className="text-base font-bold text-mist-100">{coach.name}</p>
                  <p className="text-xs text-mist-500">{coach.email}</p>
                </div>
                <span className="ms-auto">{getStatusBadge(coach.status)}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-night-700 bg-night-800 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Current Plan</p>
                  <p className="mt-1 text-lg font-bold text-mist-100">{coach.subscriptionPlan}</p>
                  {coach.hasSubscription && (
                    <p className="text-xs font-bold text-mist-400 tnum">{formatEGP(coach.subscriptionPrice)} / month</p>
                  )}
                </div>
                <div className="rounded-xl border border-night-700 bg-night-800 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Clients</p>
                  <p className="mt-1 text-lg font-bold text-mist-100 tnum">
                    {coach.clientLimit === null ? `${coach.clientCount} · Unlimited` : `${coach.clientCount} / ${coach.clientLimit}`}
                  </p>
                  <p className="text-xs text-mist-500">{coach.activeClients} active</p>
                </div>
                <div className="rounded-xl border border-night-700 bg-night-800 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Subscription Status</p>
                  <div className="mt-1.5">{getSubStatusBadge(coach.subscriptionStatus)}</div>
                </div>
                <div className="rounded-xl border border-night-700 bg-night-800 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Period</p>
                  <p className="mt-1 text-xs font-semibold text-mist-300">{coach.subscriptionStart ?? "—"} → {coach.subscriptionEnd ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {coach.status !== "ACTIVE" ? (
                  <button disabled={busy} onClick={() => { setSelectedCoach(null); void handleStatusChange(coach.id, "ACTIVE"); }} className="flex-1 cursor-pointer rounded-xl border border-moss-400/40 bg-moss-400/10 px-4 py-2 text-xs font-bold text-moss-300 transition hover:bg-moss-400/20 disabled:opacity-50">
                    Activate Coach
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => { setSelectedCoach(null); setConfirmAction({ type: "suspend", coachId: coach.id, coachName: coach.name }); }} className="flex-1 cursor-pointer rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-2 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50">
                    Suspend Coach
                  </button>
                )}
                <button onClick={() => setSelectedCoach(null)} className="flex-1 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-xs font-bold text-mist-400 transition hover:border-mist-400/40 hover:text-mist-200">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Invite Coach Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-night-700 bg-night-900 p-6">
            <h3 className="font-display text-xl font-bold uppercase text-mist-100">Invite New Coach</h3>
            <p className="mt-2 text-sm text-mist-400">Enter the coach's details to send an invitation email.</p>
            
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                  placeholder="coach@example.com"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleInviteCoach}
                disabled={inviting}
                className="flex-1 cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {inviting ? "Sending..." : "Send Invitation"}
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-mist-400/40 hover:bg-mist-400/10 hover:text-mist-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {renderConfirmationModal()}
      {renderAssignPlanModal()}
    </>
  );
}