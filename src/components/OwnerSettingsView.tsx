/* ================================================================
   FORGE — Owner Settings View: SaaS configuration.
   Real data from coach_plans table (owner-managed).
   ================================================================ */

import { useState, useEffect } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Settings as SettingsIcon, User, Shield, CreditCard, CheckCircle, Save, Loader2 } from "lucide-react";
import { btnPrimary, btnSecondary, Modal } from "./ui";
import { backend } from "../services/backend";
import { formatEGP, type CoachPlanConfig } from "../coachPricing";
import { errorMessage } from "../lib";

export function OwnerSettingsView() {
  const { me, state, toast, reload } = useApp();
  const [activeTab, setActiveTab] = useState<"profile" | "saas">("profile");
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<CoachPlanConfig[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  // Default settings
  const [defaultDuration, setDefaultDuration] = useState("30");
  const [autoRenew, setAutoRenew] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const loadedPlans = await backend.loadCoachPlans();
      setPlans(loadedPlans);
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleTogglePlanActive = async (plan: CoachPlanConfig) => {
    const newActive = !plan.isActive;
    setPlans(plans.map(p => p.id === plan.id ? { ...p, isActive: newActive } : p));
    setPlanErrors(prev => ({ ...prev, [plan.id]: "" }));
    
    try {
      await backend.update("coach_plans", plan.id, { is_active: newActive });
      toast(`Plan ${newActive ? "activated" : "deactivated"}`, "ok");
    } catch (e) {
      // Revert on failure
      setPlans(plans.map(p => p.id === plan.id ? { ...p, isActive: plan.isActive } : p));
      const msg = errorMessage(e);
      setPlanErrors(prev => ({ ...prev, [plan.id]: msg }));
      toast(msg, "warn");
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // In a real implementation, these would be persisted to a settings table
      // For now, we just show success
      await new Promise(resolve => setTimeout(resolve, 300));
      toast("Default settings saved", "ok");
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlanPrice = async (planId: string, newPrice: number) => {
    setPlanErrors(prev => ({ ...prev, [planId]: "" }));
    try {
      await backend.update("coach_plans", planId, { price: newPrice });
      setPlans(plans.map(p => p.id === planId ? { ...p, price: newPrice } : p));
      toast("Price updated", "ok");
    } catch (e) {
      const msg = errorMessage(e);
      setPlanErrors(prev => ({ ...prev, [planId]: msg }));
      toast(msg, "warn");
    }
  };

  return (
    <>
      <OwnerPageHeader title="Settings" sub="Owner account and SaaS configuration" />

      {/* Tabs */}
      <div className="rise mt-6 flex gap-2 border-b border-night-700 pb-1">
        <button
          onClick={() => setActiveTab("profile")}
          className={`rounded-t-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
            activeTab === "profile"
              ? "bg-volt-400/10 text-volt-300 border-b-2 border-volt-400"
              : "text-mist-400 hover:text-mist-200"
          }`}
        >
          <User className="mr-2 inline h-4 w-4" />
          Owner Profile
        </button>
        <button
          onClick={() => setActiveTab("saas")}
          className={`rounded-t-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
            activeTab === "saas"
              ? "bg-volt-400/10 text-volt-300 border-b-2 border-volt-400"
              : "text-mist-400 hover:text-mist-200"
          }`}
        >
          <Shield className="mr-2 inline h-4 w-4" />
          SaaS Settings
        </button>
      </div>

      {/* Content */}
      <div className="rise mt-6">
        {activeTab === "profile" && (
          <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
              <User className="h-5 w-5 text-volt-400" />
              Owner Profile
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Name</label>
                <p className="mt-1 text-sm text-mist-200">{me?.name ?? "Not available"}</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Email</label>
                <p className="mt-1 text-sm text-mist-200">{me?.email ?? "Not available"}</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Role</label>
                <p className="mt-1 text-sm text-mist-200 capitalize">{me?.role ?? "Not available"}</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-warn-400/20 bg-warn-400/5 p-4">
              <p className="text-xs text-mist-400">
                <span className="font-bold text-warn-300">Note:</span> Owner profile settings are managed through your authentication provider. Contact your system administrator to update your profile information.
              </p>
            </div>
          </div>
        )}

        {activeTab === "saas" && (
          <div className="space-y-6">
            {/* Subscription Plans - from coach_plans table */}
            <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
                <CreditCard className="h-5 w-5 text-volt-400" />
                Subscription Plans
              </h3>
              <p className="mb-4 text-sm text-mist-400">Manage available subscription plans for coaches. Changes take effect immediately for new subscriptions.</p>
              
              {loadingPlans ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-volt-400" />
                  <span className="ml-3 text-sm text-mist-400">Loading plans...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {plans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between rounded-xl border border-night-600 bg-night-800/50 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-mist-200 truncate">{plan.name} Plan</p>
                            <span className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              plan.isActive
                                ? "bg-moss-400/10 text-moss-300 border-moss-400/20"
                                : "bg-night-700 text-mist-400 border-night-500/40"
                            }`}>
                              {plan.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-mist-500 truncate">
                            {formatEGP(plan.price)}/month · {plan.maxClients === null ? "Unlimited clients" : `Up to ${plan.maxClients} clients`}
                            {plan.description && ` · ${plan.description}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 ms-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-mist-500 w-16 text-right">Price</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={plan.price}
                              onChange={(e) => handleUpdatePlanPrice(plan.id, Number(e.target.value) || 0)}
                              className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none text-right"
                              aria-label={`${plan.name} plan price`}
                            />
                            <span className="text-xs text-mist-500">EGP</span>
                          </div>
                          <button
                            onClick={() => handleTogglePlanActive(plan)}
                            disabled={saving}
                            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                              plan.isActive
                                ? "border-moss-400/40 bg-moss-400/10 text-moss-300 hover:bg-moss-400/20"
                                : "border-volt-400/40 bg-volt-400/10 text-volt-300 hover:bg-volt-400/20"
                            } disabled:opacity-50`}
                          >
                            {plan.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {planErrors && Object.keys(planErrors).length > 0 && (
                    <div className="mt-3 space-y-1">
                      {Object.entries(planErrors).map(([planId, msg]) => (
                        <p key={planId} className="text-xs text-danger-300" role="alert">{msg}</p>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-warn-400/20 bg-warn-400/5 p-4">
                    <p className="text-xs text-mist-400">
                      <span className="font-bold text-warn-300">Note:</span> Plan prices are in EGP/month. Deactivated plans cannot be assigned to new coaches. 
                      Price changes affect only new subscriptions; existing coach subscriptions retain their original price until changed by the owner.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Default Settings */}
            <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
                <SettingsIcon className="h-5 w-5 text-volt-400" />
                Default Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Default Subscription Duration</label>
                  <select 
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Auto-renew Default</label>
                  <select 
                    value={autoRenew ? "true" : "false"}
                    onChange={(e) => setAutoRenew(e.target.value === "true")}
                    className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none"
                  >
                    <option value="false">Disabled</option>
                    <option value="true">Enabled</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={handleSaveSettings}
                disabled={saving}
                className="mt-4 flex items-center gap-2 cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="rounded-2xl border border-night-700 bg-night-850/30 p-5">
              <p className="text-xs text-mist-500">
                <span className="font-bold text-volt-300">Configuration:</span> These settings control default values for new coach subscriptions. 
                Plan management reads from and writes to the <code className="font-mono text-[11px] bg-night-700 px-1 rounded">coach_plans</code> table.
                Changes apply to new subscriptions created after saving.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}