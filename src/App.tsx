/* ================================================================
   VERRAA — app root: auth phases + coach/client/owner routing.
   ================================================================ */

import { Suspense, lazy, startTransition, useEffect, useState } from "react";
import { Dumbbell } from "lucide-react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { CoachView } from "./types";
import type { ClientsFilter } from "./components/Clients";
import { StoreProvider, useApp } from "./store";
import { Toasts } from "./components/ui";
import { Auth } from "./components/Auth";
import { AdminAuth } from "./components/AdminAuth";
import { LandingPage } from "./components/landing/LandingPage";
import { CoachModePage } from "./components/landing/CoachModePage";
import { ClientModePage } from "./components/landing/ClientModePage";
import { PrivacyPage, TermsPage } from "./components/landing/LandingFooter";
import { CoachShell } from "./components/Shell";
import { OwnerShell } from "./components/OwnerShell";
import { Seo } from "./components/Seo";
import { SectionErrorBoundary } from "./components/ErrorBoundary";
import {
  CheckInsSkeleton,
  GenericViewSkeleton,
  LibrarySkeleton,
  MealsSkeleton,
  PlansSkeleton,
  ProfileSkeleton,
  RosterSkeleton,
} from "./components/skeletons";
import { DashboardSkeleton } from "./components/dashboard/index";
import { signOut } from "./services/auth";

/* ---------------- lazy views ----------------
   Every route-level view ships in its own chunk and loads on first
   visit only. Shells, auth, landing and ui stay eager so first paint
   and navigation chrome are never blocked on view code. */

const Dashboard = lazy(() => import("./components/Dashboard").then((m) => ({ default: m.Dashboard })));
const ClientsView = lazy(() => import("./components/Clients").then((m) => ({ default: m.ClientsView })));
const ClientProfile = lazy(() => import("./components/Clients").then((m) => ({ default: m.ClientProfile })));
const PlansView = lazy(() => import("./components/Workspaces").then((m) => ({ default: m.PlansView })));
const LibraryView = lazy(() => import("./components/Workspaces").then((m) => ({ default: m.LibraryView })));
const CheckInsView = lazy(() => import("./components/Workspaces").then((m) => ({ default: m.CheckInsView })));
const SettingsView = lazy(() => import("./components/Settings").then((m) => ({ default: m.SettingsView })));
const ClientApp = lazy(() => import("./components/ClientApp").then((m) => ({ default: m.ClientApp })));
const NutritionPlanView = lazy(() => import("./components/NutritionPlan").then((m) => ({ default: m.NutritionPlanView })));
const CoachPricingView = lazy(() => import("./components/CoachPricing").then((m) => ({ default: m.CoachPricingView })));
const OwnerDashboard = lazy(() => import("./components/OwnerDashboard").then((m) => ({ default: m.OwnerDashboard })));
const OwnerCoachesView = lazy(() => import("./components/OwnerCoachesView").then((m) => ({ default: m.OwnerCoachesView })));
const OwnerCoachDetail = lazy(() => import("./components/OwnerCoachDetail").then((m) => ({ default: m.OwnerCoachDetail })));
const OwnerSubscriptionsView = lazy(() => import("./components/OwnerSubscriptionsView").then((m) => ({ default: m.OwnerSubscriptionsView })));
const OwnerRequestsView = lazy(() => import("./components/OwnerRequestsView").then((m) => ({ default: m.OwnerRequestsView })));
const OwnerAnalyticsView = lazy(() => import("./components/OwnerAnalyticsView").then((m) => ({ default: m.OwnerAnalyticsView })));
const OwnerSettingsView = lazy(() => import("./components/OwnerSettingsView").then((m) => ({ default: m.OwnerSettingsView })));
const OwnerAuditLogView = lazy(() => import("./components/OwnerAuditLogView").then((m) => ({ default: m.OwnerAuditLogView })));

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

  /** Internal navigation — keeps deep-link presets in sync.
      Wrapped in startTransition: the target view chunk may not be fetched
      yet (always the case right after a refresh), and a lazy suspend during
      a synchronous click update would crash into the error boundary instead
      of showing the Suspense fallback. Transitions keep the render
      concurrent so the skeleton shows while the chunk loads. */
  const go = (v: CoachView, id?: string) => {
    startTransition(() => {
      if (v === "client") setClientPreset(id ?? null);
      if (v === "plans") setPlanPreset(id ?? null);
      if (v === "meals") setMealPreset(id ?? null);
      if (v === "clients") setClientsFilter(null);
      setCoachView(v);
    });
  };

  /** Dashboard deep-link: jump straight into a pre-filtered roster. */
  const openClientsWithFilter = (f: "Active" | "Expiring Soon" | "Expired") => {
    startTransition(() => {
      setClientsFilter(f);
      setCoachView("clients");
    });
  };

  /** Sidebar navigation always lands on an unfiltered view. */
  const nav = (v: CoachView) => {
    startTransition(() => {
      if (v === "clients") setClientsFilter(null);
      setCoachView(v);
    });
  };

  // If authenticated as owner, show Owner Mode directly (no AdminAuth screen)
  if (phase === "ready" && me?.role === "owner") {
    const setView: typeof setOwnerView = (v) => {
      // Leaving the coaches section always closes an open coach page.
      startTransition(() => {
        setOwnerCoachId(null);
        setOwnerView(v);
      });
    };
    const openCoach = (id: string) => {
      startTransition(() => setOwnerCoachId(id));
    };
    const closeCoach = () => {
      startTransition(() => setOwnerCoachId(null));
    };
    return (
      <OwnerShell view={ownerView} setView={setView} onLogout={() => void signOut()}>
        <Seo page="app" titleOverride="Owner Console — VERRAA" pathOverride="/owner" />
        {ownerView === "dashboard" && <SectionErrorBoundary section="Owner dashboard"><Suspense fallback={<GenericViewSkeleton label="Loading dashboard" />}><OwnerDashboard setView={setView} /></Suspense></SectionErrorBoundary>}
        {ownerView === "coaches" &&
          (ownerCoachId ? (
            <SectionErrorBoundary section="Coach details"><Suspense fallback={<GenericViewSkeleton label="Loading coach" />}><OwnerCoachDetail coachId={ownerCoachId} onBack={closeCoach} /></Suspense></SectionErrorBoundary>
          ) : (
            <SectionErrorBoundary section="Coaches"><Suspense fallback={<GenericViewSkeleton label="Loading coaches" />}><OwnerCoachesView onOpenCoach={openCoach} /></Suspense></SectionErrorBoundary>
          ))}
        {ownerView === "subscriptions" && <SectionErrorBoundary section="Subscriptions"><Suspense fallback={<GenericViewSkeleton label="Loading subscriptions" />}><OwnerSubscriptionsView /></Suspense></SectionErrorBoundary>}
        {ownerView === "requests" && <SectionErrorBoundary section="Requests"><Suspense fallback={<GenericViewSkeleton label="Loading requests" />}><OwnerRequestsView /></Suspense></SectionErrorBoundary>}
        {ownerView === "analytics" && <SectionErrorBoundary section="Analytics"><Suspense fallback={<GenericViewSkeleton label="Loading analytics" />}><OwnerAnalyticsView /></Suspense></SectionErrorBoundary>}
        {ownerView === "audit" && <SectionErrorBoundary section="Audit log"><Suspense fallback={<GenericViewSkeleton label="Loading audit log" />}><OwnerAuditLogView /></Suspense></SectionErrorBoundary>}
        {ownerView === "settings" && <SectionErrorBoundary section="Settings"><Suspense fallback={<GenericViewSkeleton label="Loading settings" />}><OwnerSettingsView /></Suspense></SectionErrorBoundary>}
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
        {/* Public mode pages — static feature explanations, no private data. */}
        <Route path="/coach-mode" element={<CoachModePage />} />
        <Route path="/client-mode" element={<ClientModePage />} />
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
    return (
      <SectionErrorBoundary section="My training">
        <Seo page="app" titleOverride="My Training — VERRAA" pathOverride="/client" />
        <Suspense fallback={<GenericViewSkeleton label="Loading training" />}>
          <ClientApp onLogout={() => void signOut()} />
        </Suspense>
      </SectionErrorBoundary>
    );
  }

  // Coach mode (me.role === "coach") — every section is isolated so one
  // crashing view can never take down the whole shell.
  return (
    <CoachShell view={coachView} setView={nav} onLogout={() => void signOut()}>
      <Seo page="app" titleOverride="Coach Dashboard — VERRAA" pathOverride="/coach" />
      {coachView === "dashboard" && <SectionErrorBoundary section="Dashboard"><Suspense fallback={<DashboardSkeleton />}><Dashboard go={go} openClientsWithFilter={openClientsWithFilter} /></Suspense></SectionErrorBoundary>}
      {coachView === "clients" && <SectionErrorBoundary section="Clients"><Suspense fallback={<RosterSkeleton />}><ClientsView key={clientsFilter ?? "all"} go={go} initialFilter={clientsFilter ?? undefined} /></Suspense></SectionErrorBoundary>}
      {coachView === "client" && clientPreset && <SectionErrorBoundary section="Client profile"><Suspense fallback={<ProfileSkeleton />}><ClientProfile key={clientPreset} clientId={clientPreset} go={go} /></Suspense></SectionErrorBoundary>}
      {coachView === "plans" && <SectionErrorBoundary section="Workout plans"><Suspense fallback={<PlansSkeleton />}><PlansView presetClientId={planPreset} /></Suspense></SectionErrorBoundary>}
      {coachView === "meals" && <SectionErrorBoundary section="Nutrition plan"><Suspense fallback={<MealsSkeleton />}><NutritionPlanView presetClientId={mealPreset} /></Suspense></SectionErrorBoundary>}
      {coachView === "library" && <SectionErrorBoundary section="Exercise library"><Suspense fallback={<LibrarySkeleton />}><LibraryView /></Suspense></SectionErrorBoundary>}
      {coachView === "checkins" && <SectionErrorBoundary section="Check-ins"><Suspense fallback={<CheckInsSkeleton />}><CheckInsView go={go} /></Suspense></SectionErrorBoundary>}
      {coachView === "pricing" && <SectionErrorBoundary section="Plans & pricing"><Suspense fallback={<GenericViewSkeleton label="Loading plans" />}><CoachPricingView go={go} /></Suspense></SectionErrorBoundary>}
      {coachView === "settings" && <SectionErrorBoundary section="Settings"><Suspense fallback={<GenericViewSkeleton label="Loading settings" />}><SettingsView /></Suspense></SectionErrorBoundary>}
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
