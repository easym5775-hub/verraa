/* ================================================================
   VERRAA — app root: auth phases + coach/client/owner routing.
   ================================================================ */

import { useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { CoachView } from "./types";
import { StoreProvider, useApp } from "./store";
import { Toasts } from "./components/ui";
import { Auth } from "./components/Auth";
import { AdminAuth } from "./components/AdminAuth";
import { LandingPage } from "./components/landing/LandingPage";
import { PrivacyPage, TermsPage } from "./components/landing/LandingFooter";
import { CoachShell } from "./components/Shell";
import { OwnerShell } from "./components/OwnerShell";
import { Dashboard } from "./components/Dashboard";
import { ClientsView, ClientProfile, type ClientsFilter } from "./components/Clients";
import { PlansView, MealsView, LibraryView, CheckInsView } from "./components/Workspaces";
import { SettingsView } from "./components/Settings";
import { ClientApp } from "./components/ClientApp";
import { NutritionPlanView } from "./components/NutritionPlan";
import { CoachPricingView } from "./components/CoachPricing";
import { OwnerDashboard } from "./components/OwnerDashboard";
import { OwnerCoachesView } from "./components/OwnerCoachesView";
import { OwnerCoachDetail } from "./components/OwnerCoachDetail";
import { OwnerSubscriptionsView } from "./components/OwnerSubscriptionsView";
import { OwnerRequestsView } from "./components/OwnerRequestsView";
import { OwnerAnalyticsView } from "./components/OwnerAnalyticsView";
import { OwnerSettingsView } from "./components/OwnerSettingsView";
import { OwnerAuditLogView } from "./components/OwnerAuditLogView";
import { signOut } from "./services/auth";

type OwnerView = "dashboard" | "coaches" | "subscriptions" | "requests" | "analytics" | "audit" | "settings";

/** Reset scroll position on pathname change (hash-only changes are ignored). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Splash({ label }: { label: string }) {
  return (
    <div className="noise relative grid min-h-screen place-items-center px-4" role="status" aria-live="polite" aria-label={label}>
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0" />
      <div className="rise flex w-full max-w-[280px] flex-col items-center gap-4 rounded-[24px] border border-white/[0.07] bg-night-900/60 px-8 py-10 shadow-sm backdrop-blur-xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_10px_32px_-10px_rgba(205,241,75,0.5)]">
          <Dumbbell className="h-7 w-7" strokeWidth={2.4} />
        </span>
        <div className="text-center">
          <p className="font-display text-2xl font-bold uppercase tracking-wide text-mist-100">Verraa</p>
          <p className="mt-1 text-[13px] font-medium text-mist-400">{label}</p>
        </div>
        <span className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
          <span className="skeleton block h-full w-full" />
        </span>
      </div>
    </div>
  );
}

function Root() {
  const { phase, me } = useApp();
  const [coachView, setCoachView] = useState<CoachView>("dashboard");
  const [ownerView, setOwnerView] = useState<OwnerView>("dashboard");
  const [ownerCoachId, setOwnerCoachId] = useState<string | null>(null);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [clientPreset, setClientPreset] = useState<string | null>(null);
  const [planPreset, setPlanPreset] = useState<string | null>(null);
  const [mealPreset, setMealPreset] = useState<string | null>(null);
  const [clientsFilter, setClientsFilter] = useState<ClientsFilter | null>(null);

  /** Internal navigation — keeps deep-link presets in sync. */
  const go = (v: CoachView, id?: string) => {
    if (v === "client") setClientPreset(id ?? null);
    if (v === "plans") setPlanPreset(id ?? null);
    if (v === "meals") setMealPreset(id ?? null);
    if (v === "clients") setClientsFilter(null);
    setCoachView(v);
  };

  /** Dashboard deep-link: jump straight into a pre-filtered roster. */
  const openClientsWithFilter = (f: "Active" | "Expiring Soon" | "Expired") => {
    setClientsFilter(f);
    setCoachView("clients");
  };

  /** Sidebar navigation always lands on an unfiltered view. */
  const nav = (v: CoachView) => {
    if (v === "clients") setClientsFilter(null);
    setCoachView(v);
  };

  // If authenticated as owner, show Owner Mode directly (no AdminAuth screen)
  if (phase === "ready" && me?.role === "owner") {
    const setView: typeof setOwnerView = (v) => {
      // Leaving the coaches section always closes an open coach page.
      setOwnerCoachId(null);
      setOwnerView(v);
    };
    return (
      <OwnerShell view={ownerView} setView={setView} onLogout={() => void signOut()}>
        {ownerView === "dashboard" && <OwnerDashboard setView={setView} />}
        {ownerView === "coaches" &&
          (ownerCoachId ? (
            <OwnerCoachDetail coachId={ownerCoachId} onBack={() => setOwnerCoachId(null)} />
          ) : (
            <OwnerCoachesView onOpenCoach={(id) => setOwnerCoachId(id)} />
          ))}
        {ownerView === "subscriptions" && <OwnerSubscriptionsView />}
        {ownerView === "requests" && <OwnerRequestsView />}
        {ownerView === "analytics" && <OwnerAnalyticsView />}
        {ownerView === "audit" && <OwnerAuditLogView />}
        {ownerView === "settings" && <OwnerSettingsView />}
      </OwnerShell>
    );
  }

  // Show admin auth screen only when explicitly requested AND not already authenticated
  if (showAdminAuth && (!me || me.role !== "owner")) {
    return <AdminAuth onBack={() => setShowAdminAuth(false)} />;
  }

  if (phase === "booting" || phase === "loading") {
    return <Splash label={phase === "booting" ? "Waking up…" : "Loading your data…"} />;
  }

  if (phase === "signed-out" || !me) {
    return (
      <Routes>
        {/* Public marketing page — no authentication required, no private data. */}
        <Route path="/" element={<LandingPage />} />
        {/* Existing authentication flows (coach email+password, client username). */}
        <Route path="/login" element={<Auth initialMode="signin" onShowAdmin={() => setShowAdminAuth(true)} />} />
        <Route path="/signup" element={<Auth initialMode="signup" onShowAdmin={() => setShowAdminAuth(true)} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* App areas stay protected: unauthenticated visitors go to sign-in.
            No owner/admin surface is exposed publicly. */}
        <Route path="/coach" element={<Navigate to="/login" replace />} />
        <Route path="/client" element={<Navigate to="/login" replace />} />
        <Route path="/owner" element={<Navigate to="/login" replace />} />
        <Route path="/admin" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (me.role === "client") {
    return <ClientApp onLogout={() => void signOut()} />;
  }

  // Coach mode (me.role === "coach")
  return (
    <CoachShell view={coachView} setView={nav} onLogout={() => void signOut()}>
      {coachView === "dashboard" && <Dashboard go={go} openClientsWithFilter={openClientsWithFilter} />}
      {coachView === "clients" && <ClientsView key={clientsFilter ?? "all"} go={go} initialFilter={clientsFilter ?? undefined} />}
      {coachView === "client" && clientPreset && <ClientProfile key={clientPreset} clientId={clientPreset} go={go} />}
      {coachView === "plans" && <PlansView presetClientId={planPreset} />}
      {coachView === "meals" && <NutritionPlanView presetClientId={mealPreset} />}
      {coachView === "library" && <LibraryView />}
      {coachView === "checkins" && <CheckInsView go={go} />}
      {coachView === "pricing" && <CoachPricingView go={go} />}
      {coachView === "settings" && <SettingsView />}
    </CoachShell>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-volt-400 focus:text-night-950 focus:font-bold focus:rounded-xl focus:shadow-lg">
        Skip to main content
      </a>
      <ScrollToTop />
      <Root />
      <Toasts />
    </StoreProvider>
  );
}
