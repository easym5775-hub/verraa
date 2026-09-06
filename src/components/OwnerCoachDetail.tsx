/* ================================================================
   FORGE — Owner Coach Detail: full coach profile + every admin action.

   One page per coach: identity + stats, full subscription control
   (extend / change plan / activate / suspend / cancel / delete /
   create), the coach's clients, account actions (suspend / reset
   password / delete) and a merged activity timeline.
   ================================================================ */

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Users,
  Shield,
  Activity,
  CreditCard,
  Trash2,
  PlusCircle,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  History,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Ban,
  UserCheck,
  UserX,
} from "lucide-react";
import { useApp } from "../store";
import { backend } from "../services/backend";
import {
  DEFAULT_COACH_PLANS,
  formatEGP,
  getCoachPlanConfig,
  resolveCoachSubscription,
  effectiveCoachStatus,
  type CoachPlanConfig,
} from "../coachPricing";
import type { CoachPlan } from "../types";
import { copyText, errorMessage, randomPassword, todayISO, fmtDate } from "../lib";
import { Avatar, Modal, btnPrimary, btnSecondary } from "./ui";

type AnyRow = Record<string, unknown>;

interface TimeItem {
  id: string;
  ts: number;
  badge: string;
  tone: string;
  title: string;
  by: string;
}

const TONE: Record<string, string> = {
  moss: "bg-moss-400/10 text-moss-300 border-moss-400/20",
  volt: "bg-volt-400/10 text-volt-300 border-volt-400/20",
  sky: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  warn: "bg-warn-400/10 text-warn-300 border-warn-400/20",
  danger: "bg-danger-500/10 text-danger-300 border-danger-500/20",
  mute: "bg-night-600/30 text-mist-400 border-night-500/40",
};

const EXTEND_PRESETS = [30, 90, 180, 365];

export function OwnerCoachDetail({ coachId, onBack }: { coachId: string; onBack: () => void }) {
  const { state, me, toast, reload } = useApp();
  const today = todayISO();

  const coach = (state.coaches ?? []).find((c) => c.id === coachId);
  const plans = state.coachPlans && state.coachPlans.length > 0 ? state.coachPlans : DEFAULT_COACH_PLANS;

  const subs = useMemo(
    () => (state.coachSubscriptions ?? []).filter((s) => s.coachId === coachId),
    [state.coachSubscriptions, coachId],
  );
  const primary = useMemo(
    () => resolveCoachSubscription(state.coachSubscriptions, coachId),
    [state.coachSubscriptions, coachId],
  );
  const others = useMemo(() => subs.filter((s) => s.id !== primary?.id), [subs, primary]);
  const cfg = getCoachPlanConfig(plans, primary?.planName);
  const effStatus = effectiveCoachStatus(primary, today);

  const clients = useMemo(() => state.clients.filter((c) => c.coachId === coachId), [state.clients, coachId]);
  const activeClients = clients.filter((c) => c.status === "Active").length;
  const limit = cfg ? cfg.maxClients : null;
  const checkInCount = useMemo(
    () => state.checkIns.filter((c) => c.coachId === coachId).length,
    [state.checkIns, coachId],
  );
  const lastActivity = useMemo(() => {
    let max = 0;
    for (const ci of state.checkIns) if (ci.coachId === coachId) max = Math.max(max, Number(ci.ts) || 0);
    for (const s of state.sessions) {
      if (s.coachId !== coachId) continue;
      const t = Date.parse(`${s.date}T${s.time || "00:00"}`);
      if (!Number.isNaN(t)) max = Math.max(max, t);
    }
    for (const m of state.messages) if (m.coachId === coachId) max = Math.max(max, Number(m.createdAt) || 0);
    return max;
  }, [state.checkIns, state.sessions, state.messages, coachId]);

  const daysRemaining = primary?.endDate
    ? Math.max(0, Math.ceil((new Date(primary.endDate + "T12:00:00").getTime() - Date.now()) / 86_400_000))
    : null;

  const coachNameById = useMemo(
    () => new Map((state.coaches ?? []).map((c) => [c.id, c.name])),
    [state.coaches],
  );
  const performerName = (id: string | null): string => {
    if (!id) return "system";
    if (me && id === me.userId) return `${me.name || "Admin"} (you)`;
    return coachNameById.get(id) ?? `${id.slice(0, 8)}…`;
  };

  /* ---------------- timeline (subscription history + audit) ---------------- */

  const [histRows, setHistRows] = useState<AnyRow[]>([]);
  const [auditRows, setAuditRows] = useState<AnyRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  const fetchTimeline = async () => {
    setTimelineLoading(true);
    try {
      const [hist, audit] = await Promise.all([
        backend.loadSubscriptionHistory().catch(() => [] as AnyRow[]),
        backend.loadAuditLog(200).catch(() => [] as AnyRow[]),
      ]);
      setHistRows(hist as AnyRow[]);
      setAuditRows(audit as AnyRow[]);
    } catch {
      setHistRows([]);
      setAuditRows([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    void fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachId]);

  const timeline = useMemo<TimeItem[]>(() => {
    const subIds = new Set(subs.map((s) => s.id));
    const items: TimeItem[] = [];
    const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    const tsOf = (v: unknown) => {
      const t = Date.parse(str(v));
      return Number.isNaN(t) ? 0 : t;
    };

    for (const r of histRows) {
      if (!subIds.has(str(r.subscription_id))) continue;
      const action = str(r.action || "updated");
      const nv = (r.new_value ?? {}) as AnyRow;
      const plan = str(nv.plan_name || "");
      const title =
        action === "created"
          ? `Subscription created${plan ? ` · ${plan}` : ""}`
          : action === "extended"
            ? "Subscription extended"
            : action === "plan_changed"
              ? `Plan changed${plan ? ` to ${plan}` : ""}`
              : action === "suspended"
                ? "Subscription suspended"
                : action === "activated"
                  ? "Subscription activated"
                  : action === "cancelled"
                    ? "Subscription cancelled"
                    : action === "expired"
                      ? "Subscription expired"
                      : `Subscription ${action.replace(/_/g, " ")}`;
      items.push({
        id: `h-${str(r.id)}`,
        ts: tsOf(r.performed_at),
        badge: action.replace(/_/g, " "),
        tone: /suspend|cancel|expir|delet/.test(action) ? "danger" : /creat|activ/.test(action) ? "moss" : "volt",
        title,
        by: performerName(r.performed_by ? str(r.performed_by) : null),
      });
    }

    for (const r of auditRows) {
      const target = str(r.target_id);
      const ttype = str(r.target_type);
      const mine = target === coachId || (ttype === "subscription" && subIds.has(target));
      if (!mine) continue;
      const action = str(r.action || "updated");
      const nv = (r.new_value ?? {}) as AnyRow;
      const title =
        action === "coach_created"
          ? "Coach account created"
          : action === "coach_suspended"
            ? "Coach account suspended"
            : action === "coach_activated"
              ? "Coach account activated"
              : action === "coach_status_changed"
                ? "Coach status changed"
                : action === "coach_password_reset"
                  ? "Coach password reset"
                  : action === "coach_deleted"
                    ? "Coach account deleted"
                    : action === "plan_changed"
                      ? `Plan changed${nv.plan_name ? ` to ${str(nv.plan_name)}` : ""}`
                      : action === "subscription_created"
                        ? "Subscription created"
                        : action === "subscription_updated"
                          ? "Subscription updated"
                          : action === "subscription_deleted"
                            ? "Subscription deleted"
                            : action.replace(/_/g, " ");
      items.push({
        id: `a-${str(r.id)}`,
        ts: tsOf(r.performed_at),
        badge: action.replace(/_/g, " "),
        tone: /suspend|cancel|expir|delet/.test(action) ? "danger" : /creat|activ/.test(action) ? "moss" : "sky",
        title,
        by: performerName(r.performed_by ? str(r.performed_by) : null),
      });
    }

    return items.sort((a, b) => b.ts - a.ts).slice(0, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histRows, auditRows, subs, coachId, state.coaches, me]);

  /* ---------------- mutations ---------------- */

  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: "suspend" | "activate" }
    | { kind: "delete-sub"; id: string; label: string }
    | { kind: "delete-coach" }
    | null
  >(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planSaving, setPlanSaving] = useState(false);
  const [planError, setPlanError] = useState("");
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState("30");
  const [extendCustom, setExtendCustom] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  // Create-subscription form state
  const activePlans = plans.filter((p) => p.isActive);
  const [cPlan, setCPlan] = useState("STARTER");
  const [cStart, setCStart] = useState(today);
  const [cPreset, setCPreset] = useState("30");
  const [cCustom, setCCustom] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cAuto, setCAuto] = useState(false);
  const [cError, setCError] = useState("");

  const openCreate = () => {
    const def = plans.find((p) => p.id === "STARTER" && p.isActive) ?? activePlans[0] ?? plans[0];
    setCPlan(def?.id ?? "STARTER");
    setCStart(today);
    setCPreset("30");
    setCCustom("");
    setCPrice(def ? String(def.price) : "0");
    setCAuto(false);
    setCError("");
    setCreateOpen(true);
  };

  const refresh = async () => {
    await reload();
    await fetchTimeline();
  };

  const mutate = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      toast(label, "ok");
      await refresh();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const doAccountStatus = (status: string) =>
    mutate(`Coach ${status === "ACTIVE" ? "activated" : "suspended"}`, () =>
      backend.setCoachAccountStatus(coachId, status),
    );

  const doSubStatus = (subId: string, status: string, label: string) =>
    mutate(label, () => backend.updateCoachSubscription(subId, { status }));

  const doExtend = async () => {
    if (!primary) return;
    const days = extendDays === "custom" ? Number(extendCustom) : Number(extendDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      toast("Enter a duration between 1 and 3650 days.", "warn");
      return;
    }
    const base =
      primary.endDate && primary.endDate >= today ? new Date(primary.endDate + "T12:00:00") : new Date();
    base.setDate(base.getDate() + Math.floor(days));
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
    const patch: Record<string, string> =
      (primary.status ?? "").toUpperCase() === "EXPIRED" ? { end_date: iso, status: "ACTIVE" } : { end_date: iso };
    setBusy(true);
    try {
      await backend.updateCoachSubscription(primary.id, patch);
      toast(`Subscription extended by ${Math.floor(days)} days`, "ok");
      setExtendOpen(false);
      await refresh();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
    }
  };

  const doPlanChange = async (planId: CoachPlan) => {
    setPlanSaving(true);
    setPlanError("");
    try {
      await backend.changeCoachPlan(coachId, planId);
      toast(`Plan changed to ${planId.charAt(0) + planId.slice(1).toLowerCase()}`, "ok");
      setPlanOpen(false);
      await refresh();
    } catch (e) {
      const msg = errorMessage(e);
      setPlanError(msg);
      toast(msg, "warn");
    } finally {
      setPlanSaving(false);
    }
  };

  const doDeleteSub = (id: string) =>
    mutate("Subscription deleted", () => backend.deleteCoachSubscription(id));

  const doCreateSub = async () => {
    setCError("");
    const days = cPreset === "custom" ? Number(cCustom) : Number(cPreset);
    const price = Number(cPrice);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cStart)) { setCError("Enter a valid start date."); return; }
    if (!Number.isFinite(days) || days < 1 || days > 3650) { setCError("Duration must be between 1 and 3650 days."); return; }
    if (!Number.isFinite(price) || price < 0) { setCError("Enter a valid price (0 or more)."); return; }
    setBusy(true);
    try {
      await backend.createCoachSubscription(coachId, {
        planId: cPlan,
        startDate: cStart,
        days: Math.floor(days),
        price,
        autoRenew: cAuto,
      });
      toast("Subscription created and activated", "ok");
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      setCError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doResetPw = async () => {
    setResetError("");
    if (resetPw.length < 6) { setResetError("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await backend.resetCoachPassword(coachId, resetPw);
      setResetDone(true);
      toast("Password reset — share it with the coach", "ok");
      await fetchTimeline();
    } catch (e) {
      setResetError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doDeleteCoach = async () => {
    // Standalone (not via mutate): onBack unmounts this page, so navigate last.
    setBusy(true);
    try {
      const { deletedClients } = await backend.deleteCoachAccount(coachId);
      toast(`Coach deleted permanently (${deletedClients} client${deletedClients === 1 ? "" : "s"} removed)`, "warn");
      setConfirm(null);
      await reload();
      onBack();
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text);
    toast(ok ? `${label} copied` : "Copy failed — select the text manually", ok ? "ok" : "warn");
  };

  /* ---------------- render ---------------- */

  if (!coach) {
    return (
      <div className="rise rounded-2xl border border-night-700 bg-night-850/50 p-8 text-center">
        <p className="text-sm font-bold text-mist-300">Coach not found.</p>
        <p className="mt-1 text-xs text-mist-500">It may have been deleted.</p>
        <button onClick={onBack} className={`${btnSecondary} mt-4`}>
          Back to coaches
        </button>
      </div>
    );
  }

  const suspended = (coach.accountStatus ?? "").toUpperCase() === "SUSPENDED";
  const statusBadge = (s: string) => {
    const up = s.toUpperCase();
    const cls =
      up === "ACTIVE"
        ? TONE.moss
        : up === "SUSPENDED"
          ? TONE.danger
          : up === "EXPIRED"
            ? TONE.danger
            : up === "PENDING"
              ? TONE.warn
              : TONE.mute;
    const Icon = up === "ACTIVE" ? CheckCircle : up === "PENDING" ? Clock : XCircle;
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
        <Icon className="h-3 w-3" />
        {s}
      </span>
    );
  };

  const stat = (icon: React.ReactNode, label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-night-700 bg-night-850/50 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400/10 text-volt-300">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-mist-500">{label}</p>
          <p className="truncate font-display text-2xl font-bold leading-none text-mist-100">{value}</p>
          {sub && <p className="mt-0.5 truncate text-[10px] text-mist-400">{sub}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* header */}
      <div className="rise">
        <button
          onClick={onBack}
          className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-bold text-mist-400 transition hover:border-volt-400/30 hover:text-volt-300"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          Coaches
        </button>
        <div className="mt-4 flex flex-wrap items-start gap-4">
          <Avatar name={coach.name} className="h-14 w-14 text-base" />
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-tight text-mist-100 sm:text-[30px]">
              {coach.name}
            </h1>
            <p className="mt-0.5 truncate text-sm text-mist-400">{coach.email || "No email"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {statusBadge(coach.accountStatus || "ACTIVE")}
              <span className="inline-flex items-center gap-1 rounded-lg border border-volt-400/20 bg-volt-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-volt-300">
                <Shield className="h-3 w-3" />
                {cfg ? cfg.name : "No plan"}
              </span>
              <span className="text-[11px] font-semibold text-mist-500">
                Joined {coach.createdAt ? fmtDate(coach.createdAt) : "—"}
                {lastActivity ? ` · Active ${relActivity(lastActivity)}` : " · No activity yet"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {suspended ? (
              <button
                disabled={busy}
                onClick={() => setConfirm({ kind: "activate" })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-moss-400/40 bg-moss-400/10 px-3 py-2 text-xs font-bold text-moss-300 transition hover:bg-moss-400/20 disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" /> Activate
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => setConfirm({ kind: "suspend" })}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50"
              >
                <UserX className="h-3.5 w-3.5" /> Suspend
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => { setResetPw(randomPassword()); setShowResetPw(false); setResetError(""); setResetDone(false); setResetOpen(true); }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-xs font-bold text-mist-300 transition hover:border-volt-400/40 hover:text-volt-300 disabled:opacity-50"
            >
              <KeyRound className="h-3.5 w-3.5" /> Reset password
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirm({ kind: "delete-coach" })}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger-500/40 bg-danger-500/10 px-3 py-2 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="rise grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat(
          <Users className="h-5 w-5" />,
          "Clients",
          limit === null ? `${clients.length}` : `${clients.length} / ${limit}`,
          `${activeClients} active`,
        )}
        {stat(
          <CreditCard className="h-5 w-5" />,
          "Plan",
          cfg ? cfg.name : "No plan",
          primary ? `${formatEGP(Number(primary.price || 0))} / month` : "no subscription",
        )}
        {stat(
          <Clock className="h-5 w-5" />,
          "Subscription",
          effStatus === "NONE" ? "None" : effStatus.charAt(0) + effStatus.slice(1).toLowerCase(),
          daysRemaining !== null && effStatus === "ACTIVE" ? `${daysRemaining} days remaining` : primary?.endDate ? `ends ${primary.endDate}` : undefined,
        )}
        {stat(<Activity className="h-5 w-5" />, "Check-ins", String(checkInCount), `${clients.length} client${clients.length === 1 ? "" : "s"}`)}
      </div>

      {/* subscription */}
      <section className="rise rounded-2xl border border-night-700 bg-night-850/50 p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
            <Shield className="h-5 w-5 text-volt-400" />
            Subscription
          </h3>
          <div className="ms-auto flex flex-wrap gap-2">
            {primary && (
              <>
                <button disabled={busy} onClick={() => setExtendOpen(true)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-volt-400/40 hover:text-volt-300 disabled:opacity-50">
                  <RotateCcw className="h-3.5 w-3.5" /> Extend
                </button>
                <button disabled={busy} onClick={() => { setPlanError(""); setPlanOpen(true); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-300 transition hover:border-volt-400/40 hover:text-volt-300 disabled:opacity-50">
                  <CreditCard className="h-3.5 w-3.5" /> Change plan
                </button>
                {effStatus === "SUSPENDED" ? (
                  <button disabled={busy} onClick={() => void doSubStatus(primary.id, "ACTIVE", "Subscription activated")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-moss-400/40 bg-moss-400/10 px-3 py-1.5 text-xs font-bold text-moss-300 transition hover:bg-moss-400/20 disabled:opacity-50">
                    <PlayCircle className="h-3.5 w-3.5" /> Activate
                  </button>
                ) : (
                  <button disabled={busy} onClick={() => void doSubStatus(primary.id, "SUSPENDED", "Subscription suspended")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-warn-400/40 bg-warn-400/10 px-3 py-1.5 text-xs font-bold text-warn-300 transition hover:bg-warn-400/20 disabled:opacity-50">
                    <PauseCircle className="h-3.5 w-3.5" /> Suspend
                  </button>
                )}
                {effStatus === "ACTIVE" && (
                  <button disabled={busy} onClick={() => void doSubStatus(primary.id, "CANCELLED", "Subscription cancelled")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-400 transition hover:border-danger-500/40 hover:text-danger-300 disabled:opacity-50">
                    <Ban className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
                {effStatus !== "ACTIVE" && effStatus !== "SUSPENDED" && (
                  <button disabled={busy} onClick={() => void doSubStatus(primary.id, "ACTIVE", "Subscription activated")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-moss-400/40 bg-moss-400/10 px-3 py-1.5 text-xs font-bold text-moss-300 transition hover:bg-moss-400/20 disabled:opacity-50">
                    <PlayCircle className="h-3.5 w-3.5" /> Activate
                  </button>
                )}
                <button disabled={busy} onClick={() => setConfirm({ kind: "delete-sub", id: primary.id, label: `${cfg?.name ?? primary.planName} (${primary.startDate} → ${primary.endDate})` })} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger-500/40 bg-danger-500/10 px-3 py-1.5 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
            {(!primary || effStatus !== "ACTIVE") && (
              <button disabled={busy} onClick={openCreate} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-volt-400/40 bg-volt-400/10 px-3 py-1.5 text-xs font-bold text-volt-300 transition hover:bg-volt-400/20 disabled:opacity-50">
                <PlusCircle className="h-3.5 w-3.5" /> New subscription
              </button>
            )}
          </div>
        </div>

        {primary ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Plan", cfg ? cfg.name : primary.planName],
              ["Price", `${formatEGP(Number(primary.price || 0))} / month`],
              ["Period", `${primary.startDate || "—"} → ${primary.endDate || "—"}`],
              ["Auto-renew", primary.autoRenew ? "On" : "Off"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-night-700 bg-night-800 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">{k}</p>
                <p className="mt-1 truncate text-sm font-bold text-mist-100">{v}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-night-600 bg-night-800/40 p-6 text-center">
            <p className="text-sm font-bold text-mist-300">No subscription</p>
            <p className="mt-1 text-xs text-mist-500">This coach has no subscription rows. Create one to set their plan and limits.</p>
          </div>
        )}

        {others.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist-500">
              {primary ? `Other subscription rows (${others.length})` : `Subscription rows (${others.length})`}
            </p>
            <ul className="grid gap-2">
              {others.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5">
                  <span className="text-xs font-bold text-mist-200">{getCoachPlanConfig(plans, s.planName)?.name ?? s.planName}</span>
                  {statusBadge(s.status)}
                  <span className="text-[11px] text-mist-500 tnum">{s.startDate || "—"} → {s.endDate || "—"} · {formatEGP(Number(s.price || 0))}</span>
                  <button
                    disabled={busy}
                    onClick={() => setConfirm({ kind: "delete-sub", id: s.id, label: `${s.planName} (${s.startDate} → ${s.endDate})` })}
                    className="ms-auto grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-danger-500/10 hover:text-danger-300 disabled:opacity-50"
                    aria-label="Delete subscription row"
                    title="Delete subscription row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* clients */}
      <section className="rise rounded-2xl border border-night-700 bg-night-850/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <Users className="h-5 w-5 text-volt-400" />
          Clients · {clients.length}
        </h3>
        {clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-night-600 bg-night-800/40 p-6 text-center text-sm text-mist-500">
            This coach has no clients yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-night-700">
            <table className="w-full">
              <thead>
                <tr className="border-b border-night-700 bg-night-800/50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Client</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Contact</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Start</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-mist-500">Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-night-800 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} className="h-8 w-8 text-[10px]" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-mist-100">{c.name}</p>
                          <p className="truncate text-[11px] text-mist-500">@{c.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-mist-400">{c.email || c.phone || "—"}</td>
                    <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                    <td className="px-4 py-2.5 text-xs text-mist-400">{c.startDate ? fmtDate(c.startDate) : "—"}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-mist-300 tnum">
                      {state.checkIns.filter((ci) => ci.clientId === c.id).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* timeline */}
      <section className="rise rounded-2xl border border-night-700 bg-night-850/50 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <History className="h-5 w-5 text-volt-400" />
          Activity
        </h3>
        {timelineLoading ? (
          <p className="py-4 text-center text-sm text-mist-500">Loading activity…</p>
        ) : timeline.length === 0 ? (
          <p className="rounded-xl border border-dashed border-night-600 bg-night-800/40 p-6 text-center text-sm text-mist-500">
            No recorded activity yet. New actions will appear here.
          </p>
        ) : (
          <ul className="grid gap-2">
            {timeline.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl border border-night-700 bg-night-800 px-3.5 py-2.5">
                <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[t.tone] ?? TONE.mute}`}>
                  {t.badge}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-mist-200">{t.title}</p>
                  <p className="text-[11px] text-mist-500">by {t.by}</p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold text-mist-500">
                  {t.ts ? new Date(t.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* danger zone */}
      <section className="rise rounded-2xl border border-danger-500/25 bg-danger-500/[0.04] p-6">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase text-danger-300">
          <AlertTriangle className="h-5 w-5" />
          Danger zone
        </h3>
        <p className="mt-1 text-xs leading-5 text-mist-400">
          Deleting this coach removes their login, all {clients.length} client{clients.length === 1 ? "" : "s"} and
          every plan, check-in, meal, payment and message. It cannot be undone.
        </p>
        <button
          disabled={busy}
          onClick={() => setConfirm({ kind: "delete-coach" })}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-2 text-xs font-bold text-danger-300 transition hover:bg-danger-500/20 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete coach permanently
        </button>
      </section>

      {/* confirm modal */}
      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          !confirm
            ? ""
            : confirm.kind === "suspend"
              ? "Suspend Coach?"
              : confirm.kind === "activate"
                ? "Activate Coach?"
                : confirm.kind === "delete-sub"
                  ? "Delete Subscription?"
                  : "Delete Coach Permanently?"
        }
      >
        {confirm && (
          <div className="grid gap-4">
            <p className="text-sm leading-6 text-mist-300">
              {confirm.kind === "suspend" &&
                `Suspend ${coach.name}? They will be signed out and blocked from signing in until reactivated.`}
              {confirm.kind === "activate" && `Activate ${coach.name}? Their access will be restored immediately.`}
              {confirm.kind === "delete-sub" &&
                `Delete subscription ${confirm.label}? Its history rows are deleted with it. ${primary?.id === confirm.id ? "The coach falls back to no subscription." : ""}`}
              {confirm.kind === "delete-coach" &&
                `Permanently delete ${coach.name}, their login, ${clients.length} client${clients.length === 1 ? "" : "s"} and all related data? This cannot be undone.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirm(null)} className={`${btnSecondary} flex-1`}>
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm.kind === "suspend") void doAccountStatus("SUSPENDED");
                  else if (confirm.kind === "activate") void doAccountStatus("ACTIVE");
                  else if (confirm.kind === "delete-sub") void doDeleteSub(confirm.id);
                  else void doDeleteCoach();
                }}
                className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                  confirm.kind === "activate"
                    ? "border-moss-400/40 bg-moss-400/10 text-moss-300 hover:bg-moss-400/20"
                    : "border-danger-500/40 bg-danger-500/10 text-danger-300 hover:bg-danger-500/20"
                }`}
              >
                {confirm.kind === "suspend"
                  ? "Suspend"
                  : confirm.kind === "activate"
                    ? "Activate"
                    : confirm.kind === "delete-sub"
                      ? "Delete subscription"
                      : "Delete everything"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* change plan modal */}
      <Modal
        open={planOpen}
        onClose={() => { setPlanOpen(false); setPlanError(""); }}
        title="Change Subscription Plan"
        description="Downgrades below the current roster size are blocked."
      >
        <div className="grid gap-3">
          {plans.filter((p) => p.isActive).map((p) => (
            <button
              key={p.id}
              onClick={() => void doPlanChange(p.id)}
              disabled={planSaving}
              className="w-full rounded-xl border border-night-600 bg-night-800 p-4 text-left transition hover:border-volt-400/40 hover:bg-volt-400/10 disabled:opacity-50"
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
      </Modal>

      {/* extend modal */}
      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title="Extend Subscription" description={`Currently ends ${primary?.endDate ?? "—"}. Extension counts from the current end date.`}>
        <div className="grid grid-cols-4 gap-2">
          {EXTEND_PRESETS.map((d) => (
            <button
              key={d}
              onClick={() => { setExtendDays(String(d)); }}
              className={`cursor-pointer rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
                extendDays === String(d)
                  ? "border-volt-400/50 bg-volt-400/10 text-volt-300"
                  : "border-night-600 bg-night-800 text-mist-400 hover:border-mist-400/40"
              }`}
            >
              +{d}d
            </button>
          ))}
        </div>
        <button
          onClick={() => setExtendDays("custom")}
          className={`mt-2 w-full cursor-pointer rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
            extendDays === "custom"
              ? "border-volt-400/50 bg-volt-400/10 text-volt-300"
              : "border-night-600 bg-night-800 text-mist-400 hover:border-mist-400/40"
          }`}
        >
          Custom duration
        </button>
        {extendDays === "custom" && (
          <input
            type="number"
            min={1}
            max={3650}
            value={extendCustom}
            onChange={(e) => setExtendCustom(e.target.value)}
            placeholder="Days (1–3650)"
            className="mt-2 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
          />
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={() => setExtendOpen(false)} className={`${btnSecondary} flex-1`}>
            Cancel
          </button>
          <button onClick={() => void doExtend()} disabled={busy} className={`${btnPrimary} flex-1 disabled:opacity-50`}>
            Extend
          </button>
        </div>
      </Modal>

      {/* create subscription modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCError(""); }}
        title="New Subscription"
        description={effStatus === "ACTIVE" && primary ? `Warning: ${coach.name} already has an active subscription ending ${primary.endDate}. The new row will overlap it.` : `Create an ACTIVE subscription for ${coach.name}.`}
      >
        <div className="grid gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Plan</label>
            <select
              value={cPlan}
              onChange={(e) => {
                const id = e.target.value;
                setCPlan(id);
                const p = plans.find((x) => x.id === id);
                if (p) setCPrice(String(p.price));
              }}
              className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
            >
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatEGP(p.price)}/mo · {p.maxClients === null ? "unlimited" : `up to ${p.maxClients}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Start date</label>
              <input
                type="date"
                value={cStart}
                onChange={(e) => setCStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Price (EGP)</label>
              <input
                type="number"
                min={0}
                value={cPrice}
                onChange={(e) => setCPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Duration</label>
            <div className="mt-1 grid grid-cols-5 gap-2">
              {EXTEND_PRESETS.map((d) => (
                <button
                  key={d}
                  onClick={() => setCPreset(String(d))}
                  className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-bold transition ${
                    cPreset === String(d)
                      ? "border-volt-400/50 bg-volt-400/10 text-volt-300"
                      : "border-night-600 bg-night-800 text-mist-400 hover:border-mist-400/40"
                  }`}
                >
                  {d}d
                </button>
              ))}
              <button
                onClick={() => setCPreset("custom")}
                className={`cursor-pointer rounded-xl border px-2 py-2 text-xs font-bold transition ${
                  cPreset === "custom"
                    ? "border-volt-400/50 bg-volt-400/10 text-volt-300"
                    : "border-night-600 bg-night-800 text-mist-400 hover:border-mist-400/40"
                }`}
              >
                Custom
              </button>
            </div>
            {cPreset === "custom" && (
              <input
                type="number"
                min={1}
                max={3650}
                value={cCustom}
                onChange={(e) => setCCustom(e.target.value)}
                placeholder="Days (1–3650)"
                className="mt-2 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
              />
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-mist-300">
            <input
              type="checkbox"
              checked={cAuto}
              onChange={(e) => setCAuto(e.target.checked)}
              className="h-4 w-4 accent-[#cdf14b]"
            />
            Auto-renew
          </label>
          {cError && (
            <p role="alert" className="rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-danger-300">
              {cError}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setCreateOpen(false); setCError(""); }} className={`${btnSecondary} flex-1`}>
              Cancel
            </button>
            <button onClick={() => void doCreateSub()} disabled={busy} className={`${btnPrimary} flex-1 disabled:opacity-50`}>
              Create & activate
            </button>
          </div>
        </div>
      </Modal>

      {/* reset password modal */}
      <Modal
        open={resetOpen}
        onClose={() => { setResetOpen(false); setResetError(""); setResetDone(false); }}
        title="Reset Coach Password"
        description={`Set a new password for ${coach.name}. Share it with them securely.`}
      >
        {resetDone ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-moss-400/25 bg-moss-400/[0.07] px-3.5 py-3 text-sm font-bold text-moss-300">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Password updated.
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-night-600 bg-night-800 px-3 py-2.5">
              <p className="flex-1 truncate font-mono text-sm font-bold text-mist-100">{resetPw}</p>
              <button
                onClick={() => void copy(resetPw, "Password")}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-night-600 text-mist-400 transition hover:border-volt-400/40 hover:text-volt-300"
                aria-label="Copy password"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => { setResetOpen(false); setResetDone(false); }} className={`${btnPrimary} w-full`}>
              Done
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="relative">
              <input
                type={showResetPw ? "text" : "password"}
                value={resetPw}
                onChange={(e) => setResetPw(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 pe-20 font-mono text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
              />
              <div className="absolute end-1.5 top-1/2 flex -translate-y-1/2 gap-1">
                <button
                  type="button"
                  onClick={() => setResetPw(randomPassword())}
                  aria-label="Generate a new password"
                  title="Generate a new password"
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetPw((v) => !v)}
                  aria-label={showResetPw ? "Hide password" : "Show password"}
                  className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {resetError && (
              <p role="alert" className="rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-danger-300">
                {resetError}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setResetOpen(false); setResetError(""); }} className={`${btnSecondary} flex-1`}>
                Cancel
              </button>
              <button onClick={() => void doResetPw()} disabled={busy} className={`${btnPrimary} flex-1 disabled:opacity-50`}>
                Set password
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function relActivity(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return fmtDate(new Date(ts).toISOString().slice(0, 10));
}
