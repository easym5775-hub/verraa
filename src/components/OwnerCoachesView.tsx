/* ================================================================
   VERRAA — Owner Coaches Management View.
   Real data only: coach account status + subscription from coach_subscriptions.
   No fake fallbacks. Owner can assign/change plan, activate/suspend.
   ================================================================ */

import { useState, useMemo } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Search, Filter, MoreVertical, CheckCircle, XCircle, Clock, Shield, Users, UserPlus, UserCheck, UserX, Trash2, Eye, EyeOff, Settings, AlertCircle, PlusCircle, Copy, RefreshCw } from "lucide-react";
import { Avatar, btnPrimary, btnSecondary, Dropdown, DropdownItem, Modal } from "./ui";
import { backend } from "../services/backend";
import { DEFAULT_COACH_PLANS, formatEGP, getCoachPlanConfig, normalizeCoachPlanId, type CoachPlan } from "../coachPricing";
import { copyText, errorMessage, randomPassword } from "../lib";

export function OwnerCoachesView({ onOpenCoach }: { onOpenCoach: (coachId: string) => void }) {

  const { state, toast, reload } = useApp();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "suspended" | "pending">("all");
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  // Real coach creation (Edge Function) — credentials are shown once.
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
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
      // Full delete (Edge Function): coach login + all clients and their data.
      const { deletedClients } = await backend.deleteCoachAccount(confirmAction.coachId);
      toast(`Coach ${confirmAction.coachName} deleted permanently (${deletedClients} client${deletedClients === 1 ? "" : "s"} removed)`, "warn");
      await reload();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const openInviteModal = () => {
    setInviteName("");
    setInviteEmail("");
    setInvitePassword(randomPassword());
    setShowInvitePassword(false);
    setInviteError("");
    setCreatedCreds(null);
    setShowInviteModal(true);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteError("");
    setCreatedCreds(null);
  };

  const handleInviteCoach = async () => {
    setInviteError("");
    const cleanName = inviteName.trim();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanName) { setInviteError("Enter the coach's name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setInviteError("Enter a valid email address."); return; }
    if (invitePassword.length < 6) { setInviteError("Password must be at least 6 characters."); return; }
    setInviting(true);
    try {
      const { email } = await backend.createCoachAccount({ name: cleanName, email: cleanEmail, password: invitePassword });
      setCreatedCreds({ email, password: invitePassword });
      toast(`Coach account created for ${cleanName}`, "ok");
      await reload();
    } catch (e) {
      setInviteError(errorMessage(e));
    } finally {
      setInviting(false);
    }
  };

  const handleCopyCreds = async (text: string, label: string) => {
    const ok = await copyText(text);
    toast(ok ? `${label} copied` : "Copy failed — select the text manually", ok ? "ok" : "warn");
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
      { type: "item", label: "Open Coach Page", icon: Eye, onClick: () => { onOpenCoach(coach.id); setDropdownOpen(null); } },
      { type: "item", label: "Manage Subscription", icon: Settings, onClick: () => { onOpenCoach(coach.id); setDropdownOpen(null); } },
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

  // Real last activity per coach: latest check-in / session / message timestamp.
  const lastActivityByCoach = useMemo(() => {
    const map = new Map<string, number>();
    const touch = (coachId: string, ts: number) => {
      if (!coachId || !Number.isFinite(ts) || ts <= 0) return;
      map.set(coachId, Math.max(map.get(coachId) ?? 0, ts));
    };
    for (const ci of state.checkIns) touch(ci.coachId, Number(ci.ts) || 0);
    for (const s of state.sessions) {
      const t = Date.parse(`${s.date}T${s.time || "00:00"}`);
      touch(s.coachId, Number.isNaN(t) ? 0 : t);
    }
    for (const m of state.messages) touch(m.coachId, Number(m.createdAt) || 0);
    return map;
  }, [state.checkIns, state.sessions, state.messages]);

  const formatActivity = (ts: number | undefined): string => {
    if (!ts) return "—";
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (sameDay) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
        createdAt: coach.createdAt || null,
        lastActivity: formatActivity(lastActivityByCoach.get(coach.id)),
        hasSubscription,
        primarySub,
      };
    });
  }, [state.coaches, state.coachSubscriptions, state.clients, plans, lastActivityByCoach]);

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
        title: "Delete Coach Permanently?",
        icon: <AlertCircle className="h-5 w-5 text-warn-400" />,
        message: `Permanently delete ${coachName}? This removes their login, ALL of their clients, and every plan, check-in, meal, payment and message — it cannot be undone.`,
        confirmLabel: "Delete Everything",
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
              onClick={openInviteModal}
              className="cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-3 py-1.5 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 flex items-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              New Coach
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
                <tr
                  key={coach.id}
                  onClick={() => onOpenCoach(coach.id)}
                  title="Open coach page"
                  className="cursor-pointer border-b border-night-800 transition-colors hover:bg-night-800/30"
                >
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
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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

      {/* New Coach Modal — creates a real login (Edge Function) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={closeInviteModal}>
          <div className="w-full max-w-md rounded-2xl border border-night-700 bg-night-900 p-6" onClick={(e) => e.stopPropagation()}>
            {createdCreds ? (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-moss-400/10 text-moss-300">
                    <CheckCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase text-mist-100">Coach Created</h3>
                    <p className="text-xs text-mist-500">Share these credentials once — they won't be shown again.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    { k: "Email", v: createdCreds.email },
                    { k: "Password", v: createdCreds.password },
                  ].map((row) => (
                    <div key={row.k} className="flex items-center gap-2 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{row.k}</p>
                        <p className="truncate font-mono text-sm font-bold text-mist-100">{row.v}</p>
                      </div>
                      <button
                        onClick={() => void handleCopyCreds(row.v, row.k)}
                        className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-night-600 text-mist-400 transition hover:border-volt-400/40 hover:text-volt-300"
                        aria-label={`Copy ${row.k}`}
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={closeInviteModal}
                  className={`${btnPrimary} mt-5 w-full`}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold uppercase text-mist-100">New Coach</h3>
                <p className="mt-2 text-sm text-mist-400">Creates a real coach login with a STARTER subscription. The coach signs in with email + password.</p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Full Name</label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                      placeholder="John Smith"
                      autoComplete="off"
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
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Temporary Password</label>
                    <div className="relative mt-1">
                      <input
                        type={showInvitePassword ? "text" : "password"}
                        value={invitePassword}
                        onChange={(e) => setInvitePassword(e.target.value)}
                        className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 pe-20 font-mono text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
                        autoComplete="new-password"
                      />
                      <div className="absolute end-1.5 top-1/2 flex -translate-y-1/2 gap-1">
                        <button
                          type="button"
                          onClick={() => setInvitePassword(randomPassword())}
                          aria-label="Generate a new password"
                          title="Generate a new password"
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowInvitePassword((v) => !v)}
                          aria-label={showInvitePassword ? "Hide password" : "Show password"}
                          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                        >
                          {showInvitePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {inviteError && (
                  <p role="alert" className="mt-4 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-danger-300">
                    {inviteError}
                  </p>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => void handleInviteCoach()}
                    disabled={inviting}
                    className="flex-1 cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inviting ? "Creating…" : "Create Coach Login"}
                  </button>
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-4 py-2 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-mist-400/40 hover:bg-mist-400/10 hover:text-mist-300"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {renderConfirmationModal()}
      {renderAssignPlanModal()}
    </>
  );
}