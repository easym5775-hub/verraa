/* ================================================================
   VERRAA — Owner Settings View: SaaS configuration.
   Real data from coach_plans table (owner-managed).
   ================================================================ */

import { useState, useEffect } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { User, Shield, CreditCard, Save, Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { backend } from "../services/backend";
import { formatEGP, type CoachPlanConfig } from "../coachPricing";
import { errorMessage } from "../lib";

export function OwnerSettingsView() {
  const { me, toast } = useApp();
  const [activeTab, setActiveTab] = useState<"profile" | "saas">("profile");
  const [plans, setPlans] = useState<CoachPlanConfig[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  // Price drafts: edit locally, persist once (onBlur/Enter) — not per keystroke.
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceSaving, setPriceSaving] = useState<Record<string, boolean>>({});

  // Owner profile editing (name lives in public.owners, password in Auth).
  const [ownerName, setOwnerName] = useState(me?.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState("");

  useEffect(() => {
    if (me?.name) setOwnerName(me.name);
  }, [me?.name]);

  const handleSaveName = async () => {
    const clean = ownerName.trim();
    if (!clean) { toast("Enter a display name.", "warn"); return; }
    if (!me) return;
    setNameSaving(true);
    try {
      await backend.update("owners", me.userId, { name: clean });
      toast("Display name updated — it shows after your next sign-in", "ok");
    } catch (e) {
      toast(errorMessage(e), "warn");
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPassError("");
    if (newPass.length < 6) { setPassError("Password must be at least 6 characters."); return; }
    if (newPass !== confirmPass) { setPassError("Passwords do not match."); return; }
    setPassSaving(true);
    try {
      await backend.updateOwnPassword(newPass);
      setNewPass("");
      setConfirmPass("");
      toast("Password updated — use it on your next sign-in", "ok");
    } catch (e) {
      setPassError(errorMessage(e));
    } finally {
      setPassSaving(false);
    }
  };

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

  const commitPlanPrice = async (plan: CoachPlanConfig) => {
    const raw = priceDrafts[plan.id];
    if (raw === undefined) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      setPlanErrors((prev) => ({ ...prev, [plan.id]: "Enter a valid price (0 or more)." }));
      return;
    }
    if (parsed === plan.price) {
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      return;
    }
    setPlanErrors((prev) => ({ ...prev, [plan.id]: "" }));
    setPriceSaving((prev) => ({ ...prev, [plan.id]: true }));
    try {
      await backend.update("coach_plans", plan.id, { price: parsed });
      setPlans((list) => list.map((p) => (p.id === plan.id ? { ...p, price: parsed } : p)));
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      toast("Price updated", "ok");
    } catch (e) {
      const msg = errorMessage(e);
      setPlanErrors((prev) => ({ ...prev, [plan.id]: msg }));
      toast(msg, "warn");
    } finally {
      setPriceSaving((prev) => ({ ...prev, [plan.id]: false }));
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
          <div className="grid gap-6">
            <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
                <User className="h-5 w-5 text-volt-400" />
                Owner Profile
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Display name</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Admin"
                      maxLength={80}
                      className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                    />
                    <button
                      onClick={() => void handleSaveName()}
                      disabled={nameSaving}
                      className="shrink-0 cursor-pointer rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 disabled:opacity-50"
                    >
                      {nameSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Email</label>
                  <p className="mt-1 text-sm text-mist-200">{me?.email ?? "Not available"}</p>
                  <p className="mt-1 text-[11px] text-mist-500">Fixed admin account — the email cannot be changed.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Role</label>
                  <p className="mt-1 text-sm text-mist-200 capitalize">{me?.role ?? "Not available"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-night-700 bg-night-850/50 p-6 backdrop-blur-md">
              <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-bold uppercase text-mist-100">
                <KeyRound className="h-5 w-5 text-volt-400" />
                Change Password
              </h3>
              <p className="mb-4 text-sm text-mist-400">Minimum 6 characters. You stay signed in on this device.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">New password</label>
                  <div className="relative mt-1">
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 pe-11 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? "Hide password" : "Show password"}
                      className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-mist-500">Confirm password</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="mt-1 w-full rounded-xl border border-night-600 bg-night-800 px-3 py-2 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none"
                  />
                </div>
              </div>
              {passError && (
                <p role="alert" className="mt-3 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold text-danger-300">
                  {passError}
                </p>
              )}
              <button
                onClick={() => void handleChangePassword()}
                disabled={passSaving}
                className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-volt-400/40 bg-volt-400/10 px-4 py-2 text-xs font-bold text-volt-300 transition-all duration-200 hover:bg-volt-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {passSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Update Password
                  </>
                )}
              </button>
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
                              value={priceDrafts[plan.id] ?? String(plan.price)}
                              onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                              onBlur={() => void commitPlanPrice(plan)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                if (e.key === "Escape") {
                                  setPriceDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[plan.id];
                                    return next;
                                  });
                                }
                              }}
                              disabled={!!priceSaving[plan.id]}
                              className="w-28 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none text-right disabled:opacity-50"
                              aria-label={`${plan.name} plan price — Enter to save`}
                            />
                            <span className="text-xs text-mist-500">EGP</span>
                          </div>
                          <button
                            onClick={() => handleTogglePlanActive(plan)}
                            disabled={!!priceSaving[plan.id]}
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

            {/* Info Box */}
            <div className="rounded-2xl border border-night-700 bg-night-850/30 p-5">
              <p className="text-xs text-mist-500">
                <span className="font-bold text-volt-300">Configuration:</span> Plans are stored in the{" "}
                <code className="font-mono text-[11px] bg-night-700 px-1 rounded">coach_plans</code> table.
                Price changes apply to new subscriptions; existing coach subscriptions keep their price until the owner changes their plan.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}