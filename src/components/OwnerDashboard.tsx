/* ================================================================
   VERRAA — Owner Dashboard: SaaS-level overview.
   ================================================================ */

import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Users, Shield, TrendingUp, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { OwnerView } from "./OwnerShell";

export function OwnerDashboard({ setView }: { setView: (v: OwnerView) => void }) {
  const { state } = useApp();

  // Real SaaS metrics from the database (no hardcoded demo values).
  const allCoaches = state.coaches ?? [];
  const allCoachSubs = state.coachSubscriptions ?? [];
  const totalCoaches = allCoaches.length;
  const activeCoaches = allCoaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "ACTIVE").length;
  const inactiveCoaches = allCoaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "INACTIVE").length;
  const suspendedCoaches = allCoaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "SUSPENDED").length;

  const totalClients = state.clients.length;
  const activeClients = state.clients.filter((c) => c.status === "Active").length;

  const today = new Date().toISOString().slice(0, 10);
  const totalSubscriptions = allCoachSubs.length;
  const activeSubscriptions = allCoachSubs.filter((s) => (s.status ?? "").toUpperCase() === "ACTIVE" && (!s.endDate || s.endDate >= today)).length;

  const avgClientsPerCoach = totalCoaches > 0 ? (totalClients / totalCoaches).toFixed(1) : "0";

  // Check for expiring subscriptions (within 7 days) — coach-level subscriptions.
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = allCoachSubs.filter((s) => {
    if ((s.status ?? "").toUpperCase() !== "ACTIVE" || !s.endDate) return false;
    const endDate = new Date(s.endDate + "T12:00:00");
    return endDate >= now && endDate <= sevenDaysFromNow;
  }).length;

  const expiredSubscriptions = allCoachSubs.filter((s) => {
    if (!s.endDate) return false;
    if ((s.status ?? "").toUpperCase() === "ACTIVE") return new Date(s.endDate + "T12:00:00") < now;
    return (s.status ?? "").toUpperCase() === "EXPIRED";
  }).length;

  const statCard = (
    icon: React.ReactNode,
    label: string,
    value: string | number,
    sub?: string,
    tone: "volt" | "sky" | "warn" | "danger" | "moss" = "volt"
  ) => {
    const toneClasses = {
      volt: "bg-volt-400/10 text-volt-300 border-volt-400/20",
      sky: "bg-sky-400/10 text-sky-300 border-sky-400/20",
      warn: "bg-warn-400/10 text-warn-300 border-warn-400/20",
      danger: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      moss: "bg-moss-400/10 text-moss-300 border-moss-400/20",
    };
    return (
      <div className={`rounded-2xl border p-5 ${toneClasses[tone]} backdrop-blur-sm`}>
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-xl bg-night-800`}>{icon}</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-mist-500">{label}</p>
            <p className="font-display text-2xl font-bold leading-none text-mist-100">{value}</p>
            {sub && <p className="mt-0.5 text-[10px] text-mist-400">{sub}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <OwnerPageHeader
        title="Owner Dashboard"
        sub="SaaS-level overview and control center"
        action={
          <div className="flex items-center gap-2 rounded-xl border border-volt-400/20 bg-volt-400/10 px-3 py-1.5">
            <Shield className="h-4 w-4 text-volt-400" />
            <span className="text-xs font-bold uppercase tracking-wide text-volt-300">Owner Mode</span>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="rise mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCard(
          <Users className="h-5 w-5" />,
          "Total Coaches",
          totalCoaches,
          `${activeCoaches} active`,
          "volt"
        )}
        {statCard(
          <Users className="h-5 w-5" />,
          "Total Clients",
          totalClients,
          `${activeClients} active`,
          "sky"
        )}
        {statCard(
          <TrendingUp className="h-5 w-5" />,
          "Avg Clients/Coach",
          avgClientsPerCoach,
          "across all coaches",
          "moss"
        )}
        {statCard(
          <Shield className="h-5 w-5" />,
          "Active Subscriptions",
          activeSubscriptions,
          `${totalSubscriptions} total`,
          "volt"
        )}
      </div>

      {/* Subscription Status */}
      <div className="rise mt-6 grid gap-4 sm:grid-cols-3">
        {statCard(
          <CheckCircle2 className="h-5 w-5" />,
          "Active",
          activeSubscriptions,
          "subscriptions",
          "moss"
        )}
        {statCard(
          <Clock className="h-5 w-5" />,
          "Expiring Soon",
          expiringSoon,
          "within 7 days",
          "warn"
        )}
        {statCard(
          <XCircle className="h-5 w-5" />,
          "Expired",
          expiredSubscriptions,
          "past due date",
          "danger"
        )}
      </div>

      {/* Quick Actions / Info Cards */}
      <div className="rise mt-8 grid gap-6 lg:grid-cols-2">
        {/* Coaches Summary */}
        <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-volt-400" />
            <h3 className="font-display text-lg font-bold uppercase text-mist-100">Coaches Overview</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Active Coaches</span>
              <span className="font-bold text-moss-300">{activeCoaches}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Inactive Coaches</span>
              <span className="font-bold text-mist-300">{inactiveCoaches}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Suspended Coaches</span>
              <span className="font-bold text-mist-300">{suspendedCoaches}</span>
            </div>
          </div>
          <button
            onClick={() => setView("coaches")}
            className="mt-4 w-full cursor-pointer rounded-xl border border-night-600 bg-night-800 py-2.5 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 hover:text-volt-300"
          >
            Manage Coaches →
          </button>
        </div>

        {/* Subscriptions Summary */}
        <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-volt-400" />
            <h3 className="font-display text-lg font-bold uppercase text-mist-100">Subscription Health</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Total Subscriptions</span>
              <span className="font-bold text-mist-300">{totalSubscriptions}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Expiring Soon (7 days)</span>
              <span className={`font-bold ${expiringSoon > 0 ? "text-warn-300" : "text-mist-300"}`}>{expiringSoon}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-night-800/50 px-4 py-3">
              <span className="text-sm text-mist-400">Expired</span>
              <span className={`font-bold ${expiredSubscriptions > 0 ? "text-danger-300" : "text-mist-300"}`}>
                {expiredSubscriptions}
              </span>
            </div>
          </div>
          <button
            onClick={() => setView("subscriptions")}
            className="mt-4 w-full cursor-pointer rounded-xl border border-night-600 bg-night-800 py-2.5 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 hover:text-volt-300"
          >
            Manage Subscriptions →
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {(expiringSoon > 0 || expiredSubscriptions > 0) && (
        <div className="rise mt-6 rounded-2xl border border-warn-400/20 bg-warn-400/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warn-400" />
            <div>
              <h4 className="font-display text-sm font-bold uppercase text-warn-300">Action Required</h4>
              {expiringSoon > 0 && (
                <p className="mt-1 text-xs text-mist-400">
                  {expiringSoon} subscription{expiringSoon > 1 ? "s" : ""} expiring within 7 days. Consider reaching out to the coach(es).
                </p>
              )}
              {expiredSubscriptions > 0 && (
                <p className="mt-1 text-xs text-mist-400">
                  {expiredSubscriptions} expired subscription{expiredSubscriptions > 1 ? "s" : ""} detected. Review and take action.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
