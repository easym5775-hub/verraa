/**
 * Navigation + lazy-view regression tests.
 * Refresh-then-navigate must always land on the Suspense skeleton and
 * then the real view — never on an error boundary. (Covers the reported
 * "A component suspended while responding to synchronous input" crash:
 * view switches run in transitions and every lazy view has a Suspense
 * fallback, so a cold chunk can only ever show a skeleton.)
 */
// @vitest-environment jsdom
import { StrictMode, createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

// jsdom has no matchMedia — stub it as a desktop viewport.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: query.includes("768"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

const fakeState: any = {
  clients: [
    { id: "c1", coachId: "coach-1", username: "ali", name: "Ali", email: "", phone: "", goal: "Lose weight", startDate: "2026-01-01", status: "Active", notes: "", coachNotes: [] },
    { id: "c2", coachId: "coach-1", username: "sara", name: "Sara", email: "", phone: "", goal: "Build muscle", startDate: "2026-02-01", status: "Active", notes: "", coachNotes: [] },
  ],
  exercises: [],
  plans: [],
  checkIns: [],
  meals: [],
  subscriptions: [],
  payments: [],
  sessions: [],
  messages: [],
  notifications: [],
  clientExercises: [],
  workoutTemplates: [],
  workoutSessions: [],
  workoutEntries: [],
  mealRequests: [],
};

vi.mock("./store", () => ({
  StoreProvider: ({ children }: any) => children,
  useApp: () => ({
    phase: "ready",
    me: { role: "coach", name: "Coach", email: "coach@test.com" },
    state: fakeState,
    toasts: [],
    toast: () => {},
    success: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    dismiss: () => {},
    reload: async () => {},
    setSessionStatus: () => {},
    myCoachPlan: { name: "Free", price: 0, maxClients: 5 },
    myCoachSubscription: null,
    myClientCount: 2,
    myClientLimit: 5,
    myPlanAllowsClientMode: true,
    myProgressMode: "auto",
    myLoginCount: 0,
    myFrozenLoginCount: 0,
  }),
}));

vi.mock("./services/auth", () => ({
  signOut: () => {},
  getSessionUserId: () => null,
  onAuthChange: () => () => {},
  resolveRole: async () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import App from "./App";

function renderCoachApp() {
  render(
    createElement(
      StrictMode,
      null,
      createElement(MemoryRouter, { initialEntries: ["/coach-mode"] }, createElement(App)),
    ),
  );
}

describe("app navigation to lazy views", () => {
  it("refresh then Workout Plans: skeleton first, real view after, never an error", async () => {
    renderCoachApp();
    // settle boot effects, like a real refresh
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(screen.getByText("Workout Plans"));

    // cold chunk → the skeleton must show, not the error boundary
    expect(screen.queryByText(/couldn't load/)).toBeNull();
    expect(screen.getByLabelText("Loading workout plans")).toBeTruthy();

    // chunk loads + view becomes ready → real content, skeleton gone
    await waitFor(
      () => expect(screen.getByRole("heading", { name: /workout plans/i })).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(screen.queryByLabelText("Loading workout plans")).toBeNull();
    expect(screen.queryByText(/couldn't load/)).toBeNull();
  });

  it("refresh then Clients roster renders without errors", async () => {
    renderCoachApp();
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(screen.getAllByText("Clients")[0]);

    expect(screen.queryByText(/couldn't load/)).toBeNull();
    await waitFor(
      () => expect(screen.getByRole("heading", { name: /client roster/i })).toBeTruthy(),
      { timeout: 5000 },
    );
    expect(screen.queryByText(/couldn't load/)).toBeNull();
  });
});
