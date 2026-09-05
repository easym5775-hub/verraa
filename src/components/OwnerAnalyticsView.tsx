/* ================================================================
   FORGE — Owner Analytics View: SaaS-level analytics.
   Real data from database with correct status values (ACTIVE, SUSPENDED, etc.)
   ================================================================ */

import { useMemo, useState } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Users, TrendingUp, Shield, DollarSign, Activity, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Target, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import { normalizeCoachPlanId } from "../coachPricing";

export function OwnerAnalyticsView() {
  const { state } = useApp();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");

  const coaches = state.coaches ?? [];
  const coachSubscriptions = state.coachSubscriptions ?? [];

  // Calculate real metrics from actual data
  const metrics = useMemo(() => {
    // Coach metrics from actual coaches data (database uses uppercase status)
    const totalCoaches = coaches.length;
    const activeCoaches = coaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "ACTIVE").length;
    const pendingCoaches = coaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "PENDING").length;
    const suspendedCoaches = coaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "SUSPENDED").length;
    const inactiveCoaches = coaches.filter((c) => (c.accountStatus ?? "").toUpperCase() === "INACTIVE").length;

    // Client metrics
    const totalClients = state.clients.length;
    const activeClients = state.clients.filter((c) => c.status === "Active").length;
    const inactiveClients = totalClients - activeClients;
    const avgClientsPerCoach = totalCoaches > 0 ? (totalClients / totalCoaches).toFixed(1) : "0";

    // Subscription metrics from coach_subscriptions (database uses uppercase status)
    const now = new Date();
    const todayISO = now.toISOString().slice(0, 10);
    const activeSubs = coachSubscriptions.filter((s) => {
      const endDate = s.endDate ? new Date(s.endDate) : null;
      const status = (s.status ?? "").toUpperCase();
      return status === "ACTIVE" && (!endDate || endDate >= now);
    });
    const expiredSubs = coachSubscriptions.filter((s) => {
      const endDate = s.endDate ? new Date(s.endDate) : null;
      const status = (s.status ?? "").toUpperCase();
      return status !== "ACTIVE" || (endDate && endDate < now);
    });
    const pendingSubs = coachSubscriptions.filter((s) => (s.status ?? "").toUpperCase() === "PENDING");
    const expiringSoon = activeSubs.filter((s) => {
      if (!s.endDate) return false;
      const endDate = new Date(s.endDate);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
    });

    // Plan distribution from coach subscriptions (normalize plan names)
    const planDistribution = coachSubscriptions.reduce((acc, sub) => {
      const planId = normalizeCoachPlanId(sub.planName);
      const plan = planId ? planId : (sub.planName || "No Plan");
      acc[plan] = (acc[plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Revenue calculations (Coach SaaS subscription revenue, not client payments)
    const totalRevenue = coachSubscriptions.reduce((sum, s) => sum + (s.price || 0), 0);
    const activeRevenue = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);
    
    // MRR (Monthly Recurring Revenue) - sum of active subscription monthly prices
    const mrr = activeSubs.reduce((sum, s) => {
      const price = s.price || 0;
      return sum + price;
    }, 0);
    
    // ARR (Annual Recurring Revenue)
    const arr = mrr * 12;
    
    // ARPU (Average Revenue Per User) - per active coach
    const arpu = activeCoaches > 0 ? mrr / activeCoaches : 0;
    
    // Churn rate (simplified: expired / total at start of period)
    const totalSubsAtStart = coachSubscriptions.length;
    const churnRate = totalSubsAtStart > 0 ? ((expiredSubs.length / totalSubsAtStart) * 100).toFixed(1) : "0";
    
    // Growth metrics (month-over-month new coaches / revenue)
    const newCoachesThisMonth = coaches.filter((c) => {
      const created = new Date(c.createdAt || "2024-01-01");
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return created >= monthAgo;
    }).length;
    
    const newRevenueThisMonth = coachSubscriptions
      .filter((s) => {
        const created = new Date(s.createdAt || "2024-01-01");
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return created >= monthAgo;
      })
      .reduce((sum, s) => sum + (s.price || 0), 0);

    // Coach status distribution for chart
    const coachStatusDistribution = {
      active: activeCoaches,
      pending: pendingCoaches,
      suspended: suspendedCoaches,
      inactive: inactiveCoaches,
    };

    return {
      coaches: { total: totalCoaches, active: activeCoaches, pending: pendingCoaches, suspended: suspendedCoaches, inactive: inactiveCoaches, newThisMonth: newCoachesThisMonth },
      clients: { total: totalClients, active: activeClients, inactive: inactiveClients, avgPerCoach: avgClientsPerCoach },
      subscriptions: { total: coachSubscriptions.length, active: activeSubs.length, expired: expiredSubs.length, pending: pendingSubs.length, expiringSoon: expiringSoon.length },
      revenue: { total: totalRevenue, active: activeRevenue, mrr, arr, arpu, newThisMonth: newRevenueThisMonth },
      planDistribution,
      coachStatusDistribution,
      churnRate,
    };
  }, [state]);

  const statCard = (icon: React.ReactNode, label: string, value: string | number, sub?: string, trend?: { value: string; positive: boolean; icon: React.ReactNode }) => (
    <div className="rounded-2xl border border-night-700 bg-night-850/50 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-volt-400/10 text-volt-300">{icon}</div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-mist-500">{label}</p>
            <p className="font-display text-2xl font-bold leading-none text-mist-100">{value}</p>
            {sub && <p className="mt-0.5 text-[10px] text-mist-400">{sub}</p>}
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trend.positive ? "text-moss-300" : "text-danger-300"}`}>
            {trend.icon}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <OwnerPageHeader title="Analytics" sub="SaaS performance insights" />

      {/* Coach Growth */}
      <div className="rise mt-8">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <Users className="h-5 w-5 text-volt-400" />
          Coach Overview
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statCard(<Users className="h-5 w-5" />, "Total Coaches", metrics.coaches.total)}
          {statCard(<Users className="h-5 w-5" />, "Active", metrics.coaches.active)}
          {statCard(<Users className="h-5 w-5" />, "Pending", metrics.coaches.pending)}
          {statCard(<Users className="h-5 w-5" />, "Suspended", metrics.coaches.suspended)}
          {statCard(<Users className="h-5 w-5" />, "Inactive", metrics.coaches.inactive)}
        </div>

        {/* Coach Status Distribution Chart */}
        <div className="mt-6 rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
          <h4 className="mb-4 font-display text-sm font-bold uppercase text-mist-100">Coach Status Distribution</h4>
          <div className="space-y-3">
            {Object.entries(metrics.coachStatusDistribution).map(([status, count]) => {
              const percentage = metrics.coaches.total > 0 ? ((count / metrics.coaches.total) * 100).toFixed(1) : "0";
              const colors: Record<string, string> = {
                active: "bg-moss-400",
                pending: "bg-warn-400",
                suspended: "bg-danger-500",
                inactive: "bg-mist-600",
              };
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-bold uppercase text-mist-400">{status}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-night-700">
                    <div
                      className={`h-2.5 rounded-full ${colors[status] || "bg-mist-600"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-bold text-mist-300">{count} ({percentage}%)</span>
                </div>
              );
            })}
            {metrics.coaches.total === 0 && (
              <p className="text-sm text-mist-500">No coach data available yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Client Growth */}
      <div className="rise mt-8">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <TrendingUp className="h-5 w-5 text-sky-400" />
          Client Metrics
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCard(<Users className="h-5 w-5" />, "Total Clients", metrics.clients.total)}
          {statCard(<Users className="h-5 w-5" />, "Active Clients", metrics.clients.active, `${metrics.clients.inactive} inactive`)}
          {statCard(<Activity className="h-5 w-5" />, "Avg Clients/Coach", metrics.clients.avgPerCoach, "per coach")}
          {statCard(<Users className="h-5 w-5" />, "Client Retention", "N/A", "coming soon")}
        </div>
      </div>

      {/* Subscription Analytics */}
      <div className="rise mt-8">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <Shield className="h-5 w-5 text-moss-400" />
          Subscription Analytics
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {statCard(<Shield className="h-5 w-5" />, "Active", metrics.subscriptions.active)}
          {statCard(<Shield className="h-5 w-5" />, "Expired", metrics.subscriptions.expired)}
          {statCard(<Shield className="h-5 w-5" />, "Pending", metrics.subscriptions.pending)}
          {statCard(<Shield className="h-5 w-5" />, "Expiring Soon", metrics.subscriptions.expiringSoon, "within 7 days")}
          {statCard(<Shield className="h-5 w-5" />, "Total", metrics.subscriptions.total)}
        </div>

        {/* Plan Distribution */}
        <div className="mt-6 rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
          <h4 className="mb-4 font-display text-sm font-bold uppercase text-mist-100">Plan Distribution</h4>
          <div className="space-y-3">
            {Object.entries(metrics.planDistribution).map(([plan, count]) => {
              const percentage = metrics.subscriptions.total > 0 ? ((count / metrics.subscriptions.total) * 100).toFixed(1) : "0";
              return (
                <div key={plan} className="flex items-center gap-3">
                  <span className="w-24 truncate text-sm font-bold text-mist-300">{plan}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-night-700">
                    <div
                      className="h-2.5 rounded-full bg-volt-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs font-bold text-mist-400">{count} ({percentage}%)</span>
                </div>
              );
            })}
            {Object.keys(metrics.planDistribution).length === 0 && (
              <p className="text-sm text-mist-500">No subscription data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue & SaaS Metrics */}
      <div className="rise mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
            <DollarSign className="h-5 w-5 text-warn-400" />
            Revenue Overview
          </h3>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            className="rounded-xl border border-night-600 bg-night-850 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
        
        {/* Key SaaS Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-6">
          {statCard(
            <Target className="h-5 w-5" />,
            "MRR",
            `${metrics.revenue.mrr.toLocaleString()} EGP`,
            "Monthly Recurring Revenue",
            { value: `+${metrics.revenue.newThisMonth.toLocaleString()}`, positive: true, icon: <ArrowUpRight className="h-3 w-3" /> }
          )}
          {statCard(
            <Target className="h-5 w-5" />,
            "ARR",
            `${metrics.revenue.arr.toLocaleString()} EGP`,
            "Annual Recurring Revenue",
            { value: `+${(metrics.revenue.newThisMonth * 12).toLocaleString()}`, positive: true, icon: <ArrowUpRight className="h-3 w-3" /> }
          )}
          {statCard(
            <Users className="h-5 w-5" />,
            "ARPU",
            `${metrics.revenue.arpu.toFixed(0)} EGP`,
            "Avg Revenue Per User",
            metrics.coaches.newThisMonth > 0 ? { value: `+${metrics.coaches.newThisMonth} new`, positive: true, icon: <ArrowUpRight className="h-3 w-3" /> } : undefined
          )}
          {statCard(
            <Activity className="h-5 w-5" />,
            "Churn Rate",
            `${metrics.churnRate}%`,
            "Monthly coach churn",
            { value: parseFloat(metrics.churnRate) > 5 ? "High" : "Healthy", positive: parseFloat(metrics.churnRate) <= 5, icon: parseFloat(metrics.churnRate) <= 5 ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" /> }
          )}
          {statCard(
            <Zap className="h-5 w-5" />,
            "New Coaches",
            metrics.coaches.newThisMonth,
            "This month",
            metrics.coaches.newThisMonth > 0 ? { value: "Growing", positive: true, icon: <ArrowUpRight className="h-3 w-3" /> } : { value: "Flat", positive: false, icon: <Minus className="h-3 w-3" /> }
          )}
          {statCard(
            <TrendingUp className="h-5 w-5" />,
            "New Revenue",
            `${metrics.revenue.newThisMonth.toLocaleString()} EGP`,
            "This month",
            metrics.revenue.newThisMonth > 0 ? { value: "Growing", positive: true, icon: <ArrowUpRight className="h-3 w-3" /> } : { value: "Flat", positive: false, icon: <Minus className="h-3 w-3" /> }
          )}
        </div>

        {/* Traditional Revenue Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCard(<DollarSign className="h-5 w-5" />, "Total Revenue", `${metrics.revenue.total.toLocaleString()} EGP`)}
          {statCard(<DollarSign className="h-5 w-5" />, "Active Revenue", `${metrics.revenue.active.toLocaleString()} EGP`, "from active subscriptions")}
          {statCard(<DollarSign className="h-5 w-5" />, "Avg per Coach", `${(metrics.revenue.total / (metrics.coaches.total || 1)).toFixed(0)} EGP`)}
          {statCard(<DollarSign className="h-5 w-5" />, "Avg per Client", `${(metrics.revenue.total / (metrics.clients.total || 1)).toFixed(0)} EGP`)}
        </div>
      </div>

      {/* Growth Trends */}
      <div className="rise mt-8">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
          <BarChart3 className="h-5 w-5 text-sky-400" />
          Growth Trends
        </h3>
        <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-night-800/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-mist-500">Coach Growth</p>
              <p className="mt-2 font-display text-3xl font-bold text-mist-100">{metrics.coaches.total}</p>
              <p className="mt-1 text-sm text-mist-400">Total coaches on platform</p>
            </div>
            <div className="rounded-xl bg-night-800/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-mist-500">Client Growth</p>
              <p className="mt-2 font-display text-3xl font-bold text-mist-100">{metrics.clients.total}</p>
              <p className="mt-1 text-sm text-mist-400">Total clients across all coaches</p>
            </div>
            <div className="rounded-xl bg-night-800/50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-mist-500">Subscription Growth</p>
              <p className="mt-2 font-display text-3xl font-bold text-mist-100">{metrics.subscriptions.total}</p>
              <p className="mt-1 text-sm text-mist-400">Total active subscriptions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State Info */}
      {metrics.coaches.total === 0 && (
        <div className="rise mt-8 rounded-2xl border border-night-700 bg-night-850/30 p-5">
          <p className="text-xs text-mist-500">
            <span className="font-bold text-volt-300">Note:</span> No coaches registered yet. Analytics will populate as coaches join the platform.
          </p>
        </div>
      )}
    </>
  );
}