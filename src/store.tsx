/* ================================================================
   FORGE — app store (React Context).
   Backend is the source of truth; local state updates optimistically
   and re-syncs if a write fails.
   ================================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppNotification,
  AppState,
  CheckIn,
  Client,
  CoachNote,
  CoachPlan,
  CoachPlanConfig,
  CoachSubscription,
  Exercise,
  Meal,
  NewClientInput,
  NutritionTargets,
  Payment,
  PlanItem,
  Session,
  SessionStatus,
  Subscription,
} from "./types";
import { errorMessage, todayISO, uid, uuid } from "./lib";
import {
  getCoachClientCount,
  getCoachPlan,
  isPlanLimitError,
  parsePlanLimitError,
  resolveCoachSubscription,
} from "./coachPricing";
import {
  backend,
  isDemoMode,
  type RoleInfo,
  checkInToRow,
  clientToRow,
  exerciseToRow,
  mealToRow,
  messageToRow,
  notificationToRow,
  paymentToRow,
  planToRow,
  sessionToRow,
  subscriptionToRow,
} from "./services/backend";
import { getSessionUserId, onAuthChange, resolveRole } from "./services/auth";

export type Phase = "booting" | "signed-out" | "loading" | "ready";

export interface ToastItem {
  id: string;
  msg: string;
  kind: "ok" | "warn";
}

interface Store {
  phase: Phase;
  me: RoleInfo | null;
  isDemo: boolean;
  state: AppState;

  toasts: ToastItem[];
  toast: (msg: string, kind?: "ok" | "warn") => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  warn: (msg: string) => void;
  info: (msg: string) => void;
  dismiss: (id: string) => void;

  reload: () => Promise<void>;

  createClient: (input: NewClientInput) => Promise<Client>;
  updateClient: (client: Client) => void;
  deleteClient: (id: string) => void;
  resetClientPassword: (clientId: string, newPassword: string) => Promise<void>;

  addExercise: (input: Omit<Exercise, "id" | "coachId">) => void;
  updateExercise: (ex: Exercise) => void;
  deleteExercise: (id: string) => void;

  addPlanItem: (input: Omit<PlanItem, "id" | "coachId">) => void;
  updatePlanItem: (item: PlanItem) => void;
  deletePlanItem: (id: string) => void;

  addMeal: (input: Omit<Meal, "id" | "coachId">) => void;
  updateMeal: (meal: Meal) => void;
  deleteMeal: (id: string) => void;

  addCheckIn: (input: Omit<CheckIn, "id" | "ts" | "coachId">) => void;
  deleteCheckIn: (id: string) => void;

  addSubscription: (input: Omit<Subscription, "id" | "createdAt" | "coachId">, opts?: { paymentMethod?: Payment["method"] }) => Subscription;
  updateSubscription: (sub: Subscription, opts?: { paymentMethod?: Payment["method"] }) => void;
  renewSubscription: (sub: Subscription) => Subscription;
  addPayment: (input: Omit<Payment, "id" | "coachId">) => Payment;
  updatePayment: (p: Payment) => void;
  deletePayment: (id: string) => void;

  addSession: (input: Omit<Session, "id" | "coachId">) => Session;
  updateSession: (s: Session) => void;
  deleteSession: (id: string) => void;
  setSessionStatus: (id: string, status: SessionStatus) => void;

  addCoachNote: (clientId: string, text: string) => void;
  updateCoachNote: (clientId: string, noteId: string, text: string) => void;
  deleteCoachNote: (clientId: string, noteId: string) => void;
  setFollowUpDays: (clientId: string, days: number) => void;
  markFollowUpDone: (clientId: string) => void;
  setNutritionTargets: (clientId: string, targets: NutritionTargets) => void;

  sendMessage: (clientId: string, text: string) => void;
  addNotification: (input: { clientId: string; kind: AppNotification["kind"]; text: string }) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (clientId: string) => void;

  updateCoachName: (name: string) => Promise<void>;
  resetData: () => Promise<void>;

  /* ---- Coach pricing & limits (centralized, real backend data) ---- */
  coachPlans: CoachPlanConfig[];
  myCoachSubscription: CoachSubscription | null;
  myCoachPlan: CoachPlanConfig;
  myClientCount: number;
  myClientLimit: number | null;
  myCanAddClient: boolean;
  changeMyPlan: (planId: CoachPlan) => Promise<void>;
}

const Ctx = createContext<Store>(null!);

const EMPTY: AppState = {
  clients: [],
  exercises: [],
  plans: [],
  checkIns: [],
  meals: [],
  subscriptions: [],
  payments: [],
  sessions: [],
  messages: [],
  notifications: [],
  coaches: [],
  coachSubscriptions: [],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [phase, setPhase] = useState<Phase>("booting");
  const [me, setMe] = useState<RoleInfo | null>(null);

  const stateRef = useRef(state);
  const meRef = useRef(me);
  const activeUserRef = useRef<string | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    meRef.current = me;
  }, [me]);
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  /* ---------------- toasts ---------------- */

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (msg: string, kind: "ok" | "warn" = "ok") => {
      const id = uid();
      setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
      timersRef.current.push(window.setTimeout(() => dismiss(id), 3400));
    },
    [dismiss],
  );

  const success = useCallback((msg: string) => toast(msg, "ok"), [toast]);
  const error = useCallback((msg: string) => toast(msg, "warn"), [toast]);
  const warn = useCallback((msg: string) => toast(msg, "warn"), [toast]);
  const info = useCallback((msg: string) => toast(msg, "ok"), [toast]);

  /* ---------------- session bootstrap ---------------- */

  const reload = useCallback(async () => {
    try {
      const me = meRef.current;
      const baseState = await backend.load();
      let fullState = baseState;
      if (me?.role === "owner" && typeof backend.loadAllCoachesAndSubscriptions === "function") {
        const { coaches, subscriptions } = await backend.loadAllCoachesAndSubscriptions!();
        fullState = {
          ...baseState,
          coaches: coaches as any[],
          coachSubscriptions: subscriptions as any[],
          // backend.load() already carries the authoritative coachPlans — keep them.
          coachPlans: baseState.coachPlans,
        };
      }
      setState(fullState);
    } catch (e) {
      toast(`Couldn't load data — ${errorMessage(e)}`, "warn");
    }
  }, [toast]);

  const bootSession = useCallback(
    async (userId: string) => {
      if (activeUserRef.current === userId) return;
      activeUserRef.current = userId;
      setPhase("loading");
      try {
        const role = await resolveRole(userId);
        if (!role) {
          activeUserRef.current = null;
          setMe(null);
          setState(EMPTY);
          setPhase("signed-out");
          return;
        }
        const baseState = await backend.load();
        let fullState = baseState;
        if (role.role === "owner" && typeof backend.loadAllCoachesAndSubscriptions === "function") {
          const { coaches, subscriptions } = await backend.loadAllCoachesAndSubscriptions!();
          fullState = {
            ...baseState,
            coaches: coaches as any[],
            coachSubscriptions: subscriptions as any[],
          };
        }
        setState(fullState);
        setMe(role);
        setPhase("ready");
      } catch (e) {
        activeUserRef.current = null;
        setMe(null);
        setState(EMPTY);
        setPhase("signed-out");
        toast(`Couldn't load your data. ${errorMessage(e)}`, "warn");
      }
    },
    [toast],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getSessionUserId();
      if (!cancelled) {
        if (userId) await bootSession(userId);
        else setPhase("signed-out");
      }
    })();
    const off = onAuthChange((userId) => {
      if (cancelled) return;
      if (!userId) {
        activeUserRef.current = null;
        setMe(null);
        setState(EMPTY);
        setPhase("signed-out");
      } else {
        activeUserRef.current = null; // force re-boot on sign-in
        void bootSession(userId);
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [bootSession]);

  /* ---------------- mutation core ---------------- */

  const coachId = () => meRef.current?.coachId ?? "";

  /** Optimistic local update + persist; re-sync and warn on failure. */
  const mutate = useCallback(
    (recipe: (s: AppState) => AppState, persist: () => Promise<unknown>, okMsg?: string) => {
      setState(recipe);
      persist()
        .then(() => {
          if (okMsg) toast(okMsg);
        })
        .catch((e) => {
          toast(`Couldn't save — ${errorMessage(e)}`, "warn");
          void reload();
        });
    },
    [toast, reload],
  );

  /** Push an in-app notification onto a client's feed (coach-triggered). */
  const addNotification = useCallback(
    (input: { clientId: string; kind: AppNotification["kind"]; text: string }) => {
      const n: AppNotification = {
        id: uuid(),
        coachId: coachId(),
        clientId: input.clientId,
        kind: input.kind,
        text: input.text,
        createdAt: Date.now(),
        read: false,
      };
      mutate(
        (s) => ({ ...s, notifications: [...s.notifications, n] }),
        () => backend.insert("notifications", { id: n.id, coach_id: n.coachId, ...notificationToRow(n) }),
      );
    },
    [mutate],
  );

  /* ---------------- clients ---------------- */

  const createClient = useCallback(
    async (input: NewClientInput): Promise<Client> => {
      try {
        const client = await backend.createClientAccount(input);
        setState((s) => ({ ...s, clients: [client, ...s.clients] }));
        toast(`${client.name} added — their login works right away`);
        return client;
      } catch (e) {
        // Normalize backend limit rejections (edge function / trigger / demo)
        // into a structured PlanLimitError so the UI can offer an upgrade path
        // instead of a dead-end toast.
        if (isPlanLimitError(e)) throw e;
        const parsed = parsePlanLimitError(errorMessage(e), stateRef.current.coachPlans);
        if (parsed) throw parsed;
        throw e;
      }
    },
    [toast],
  );

  const updateClient = useCallback(
    (client: Client) => {
      mutate(
        (s) => ({ ...s, clients: s.clients.map((x) => (x.id === client.id ? client : x)) }),
        () => backend.update("clients", client.id, clientToRow(client)),
        "Client updated",
      );
    },
    [mutate],
  );

  const deleteClient = useCallback(
    (id: string) => {
      const name = stateRef.current.clients.find((x) => x.id === id)?.name ?? "Client";
      mutate(
        (s) => ({
          ...s,
          clients: s.clients.filter((x) => x.id !== id),
          plans: s.plans.filter((x) => x.clientId !== id),
          checkIns: s.checkIns.filter((x) => x.clientId !== id),
          meals: s.meals.filter((x) => x.clientId !== id),
          subscriptions: s.subscriptions.filter((x) => x.clientId !== id),
          payments: s.payments.filter((x) => x.clientId !== id),
          sessions: s.sessions.filter((x) => x.clientId !== id),
          messages: s.messages.filter((x) => x.clientId !== id),
          notifications: s.notifications.filter((x) => x.clientId !== id),
        }),
        () => backend.deleteClientAccount(id),
      );
      toast(`${name} deleted`, "warn");
    },
    [mutate, toast],
  );

  const resetClientPassword = useCallback(
    async (clientId: string, newPassword: string): Promise<void> => {
      await backend.resetClientPassword(clientId, newPassword);
      toast("Password reset — share it securely");
    },
    [toast],
  );

  /* ---------------- exercises ---------------- */

  const addExercise = useCallback(
    (input: Omit<Exercise, "id" | "coachId">) => {
      const ex: Exercise = { ...input, id: uuid(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, exercises: [ex, ...s.exercises] }),
        () => backend.insert("exercises", { id: ex.id, coach_id: ex.coachId, ...exerciseToRow(ex) }),
        `${ex.name} added to library`,
      );
    },
    [mutate],
  );

  const updateExercise = useCallback(
    (ex: Exercise) => {
      mutate(
        (s) => ({ ...s, exercises: s.exercises.map((x) => (x.id === ex.id ? ex : x)) }),
        () => backend.update("exercises", ex.id, exerciseToRow(ex)),
        "Exercise updated",
      );
    },
    [mutate],
  );

  const deleteExercise = useCallback(
    (id: string) => {
      const name = stateRef.current.exercises.find((x) => x.id === id)?.name ?? "Exercise";
      mutate(
        (s) => ({
          ...s,
          exercises: s.exercises.filter((x) => x.id !== id),
          plans: s.plans.filter((x) => x.exerciseId !== id),
        }),
        () => backend.remove("exercises", id),
      );
      toast(`${name} removed`, "warn");
    },
    [mutate, toast],
  );

  /* ---------------- plan items ---------------- */

  const addPlanItem = useCallback(
    (input: Omit<PlanItem, "id" | "coachId">) => {
      const item: PlanItem = { ...input, id: uuid(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, plans: [...s.plans, item] }),
        () => backend.insert("plan_items", { id: item.id, coach_id: item.coachId, ...planToRow(item) }),
        "Exercise added to plan",
      );
      addNotification({ clientId: item.clientId, kind: "plan_updated", text: "Your workout plan was updated" });
    },
    [mutate, addNotification],
  );

  const updatePlanItem = useCallback(
    (item: PlanItem) => {
      mutate(
        (s) => ({ ...s, plans: s.plans.map((x) => (x.id === item.id ? item : x)) }),
        () => backend.update("plan_items", item.id, planToRow(item)),
        "Plan updated",
      );
      addNotification({ clientId: item.clientId, kind: "plan_updated", text: "Your workout plan was updated" });
    },
    [mutate, addNotification],
  );

  const deletePlanItem = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, plans: s.plans.filter((x) => x.id !== id) }),
        () => backend.remove("plan_items", id),
        "Removed from plan",
      );
    },
    [mutate],
  );

  /* ---------------- meals ---------------- */

  const addMeal = useCallback(
    (input: Omit<Meal, "id" | "coachId">) => {
      const meal: Meal = { ...input, id: uuid(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, meals: [...s.meals, meal] }),
        () => backend.insert("meals", { id: meal.id, coach_id: meal.coachId, ...mealToRow(meal) }),
        "Meal added",
      );
      addNotification({ clientId: meal.clientId, kind: "meal_updated", text: "Your meal plan was updated" });
    },
    [mutate, addNotification],
  );

  const updateMeal = useCallback(
    (meal: Meal) => {
      mutate(
        (s) => ({ ...s, meals: s.meals.map((x) => (x.id === meal.id ? meal : x)) }),
        () => backend.update("meals", meal.id, mealToRow(meal)),
        "Meal updated",
      );
      addNotification({ clientId: meal.clientId, kind: "meal_updated", text: "Your meal plan was updated" });
    },
    [mutate, addNotification],
  );

  const deleteMeal = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, meals: s.meals.filter((x) => x.id !== id) }),
        () => backend.remove("meals", id),
        "Meal removed",
      );
    },
    [mutate],
  );

  /* ---------------- check-ins ---------------- */

  const addCheckIn = useCallback(
    (input: Omit<CheckIn, "id" | "ts" | "coachId">) => {
      const ci: CheckIn = { ...input, id: uuid(), ts: Date.now(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, checkIns: [...s.checkIns, ci] }),
        () => backend.insert("check_ins", { id: ci.id, coach_id: ci.coachId, ...checkInToRow(ci) }),
        "Check-in logged",
      );
    },
    [mutate],
  );

  const deleteCheckIn = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, checkIns: s.checkIns.filter((x) => x.id !== id) }),
        () => backend.remove("check_ins", id),
        "Check-in deleted",
      );
    },
    [mutate],
  );

  /* ---------------- subscriptions & payments ---------------- */

  const addSubscription = useCallback(
    (input: Omit<Subscription, "id" | "createdAt" | "coachId">, opts?: { paymentMethod?: Payment["method"] }) => {
      const sub: Subscription = { ...input, id: uuid(), coachId: coachId(), createdAt: Date.now() };
      // Auto-record a linked payment when the subscription is marked Paid,
      // so it shows up in the Payments section immediately.
      const autoPay: Payment | null =
        input.paymentStatus === "Paid"
          ? {
              id: uuid(),
              coachId: sub.coachId,
              clientId: sub.clientId,
              subscriptionId: sub.id,
              amount: sub.price,
              date: sub.startDate,
              method: opts?.paymentMethod ?? "Cash",
              status: "Paid",
              notes: "",
            }
          : null;
      mutate(
        (s) => ({
          ...s,
          subscriptions: [...s.subscriptions, sub],
          payments: autoPay ? [...s.payments, autoPay] : s.payments,
        }),
        async () => {
          await backend.insert("subscriptions", { id: sub.id, coach_id: sub.coachId, ...subscriptionToRow(sub) });
          if (autoPay) await backend.insert("payments", { id: autoPay.id, coach_id: autoPay.coachId, ...paymentToRow(autoPay) });
        },
        autoPay ? "Subscription added — payment recorded" : "Subscription added",
      );
      addNotification({ clientId: sub.clientId, kind: "subscription", text: `New subscription: ${sub.planName}` });
      return sub;
    },
    [mutate, addNotification],
  );

  const updateSubscription = useCallback(
    (sub: Subscription, opts?: { paymentMethod?: Payment["method"] }) => {
      const prev = stateRef.current.subscriptions.find((x) => x.id === sub.id);
      const justBecamePaid = prev?.paymentStatus !== "Paid" && sub.paymentStatus === "Paid";
      const alreadyHasPaid = stateRef.current.payments.some((p) => p.subscriptionId === sub.id && p.status === "Paid");
      const autoPay: Payment | null =
        justBecamePaid && !alreadyHasPaid
          ? {
              id: uuid(),
              coachId: sub.coachId,
              clientId: sub.clientId,
              subscriptionId: sub.id,
              amount: sub.price,
              date: sub.startDate,
              method: opts?.paymentMethod ?? "Cash",
              status: "Paid",
              notes: "",
            }
          : null;
      mutate(
        (s) => ({
          ...s,
          subscriptions: s.subscriptions.map((x) => (x.id === sub.id ? sub : x)),
          payments: autoPay ? [...s.payments, autoPay] : s.payments,
        }),
        async () => {
          await backend.update("subscriptions", sub.id, subscriptionToRow(sub));
          if (autoPay) await backend.insert("payments", { id: autoPay.id, coach_id: autoPay.coachId, ...paymentToRow(autoPay) });
        },
        autoPay ? "Subscription updated — payment recorded" : "Subscription updated",
      );
    },
    [mutate],
  );

  const renewSubscription = useCallback(
    (sub: Subscription) => {
      const today = todayISO();
      const start = sub.endDate >= today ? sub.endDate : today;
      const length = Math.max(
        1,
        Math.round((new Date(sub.endDate + "T12:00:00").getTime() - new Date(sub.startDate + "T12:00:00").getTime()) / 86_400_000),
      );
      const end = new Date(start + "T12:00:00");
      end.setDate(end.getDate() + length);
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      const next: Subscription = {
        ...sub,
        id: uuid(),
        startDate: start,
        endDate: endIso,
        paymentStatus: "Pending",
        createdAt: Date.now(),
      };
      mutate(
        (s) => ({ ...s, subscriptions: [...s.subscriptions, next] }),
        () => backend.insert("subscriptions", subscriptionToRow(next)),
        "Subscription renewed — history preserved",
      );
      addNotification({ clientId: sub.clientId, kind: "subscription", text: "Your subscription was renewed" });
      return next;
    },
    [mutate, addNotification],
  );

  const addPayment = useCallback(
    (input: Omit<Payment, "id" | "coachId">) => {
      const p: Payment = { ...input, id: uuid(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, payments: [...s.payments, p] }),
        () => backend.insert("payments", { id: p.id, coach_id: p.coachId, ...paymentToRow(p) }),
        "Payment recorded",
      );
      return p;
    },
    [mutate],
  );

  const updatePayment = useCallback(
    (p: Payment) => {
      mutate(
        (s) => ({ ...s, payments: s.payments.map((x) => (x.id === p.id ? p : x)) }),
        () => backend.update("payments", p.id, paymentToRow(p)),
        "Payment updated",
      );
    },
    [mutate],
  );

  const deletePayment = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, payments: s.payments.filter((x) => x.id !== id) }),
        () => backend.remove("payments", id),
        "Payment deleted",
      );
    },
    [mutate],
  );

  /* ---------------- sessions ---------------- */

  const addSession = useCallback(
    (input: Omit<Session, "id" | "coachId">) => {
      const se: Session = { ...input, id: uuid(), coachId: coachId() };
      mutate(
        (s) => ({ ...s, sessions: [...s.sessions, se] }),
        () => backend.insert("sessions", { id: se.id, coach_id: se.coachId, ...sessionToRow(se) }),
        "Session scheduled",
      );
      return se;
    },
    [mutate],
  );

  const updateSession = useCallback(
    (se: Session) => {
      mutate(
        (s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === se.id ? se : x)) }),
        () => backend.update("sessions", se.id, sessionToRow(se)),
        "Session updated",
      );
    },
    [mutate],
  );

  const deleteSession = useCallback(
    (id: string) => {
      mutate(
        (s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }),
        () => backend.remove("sessions", id),
        "Session deleted",
      );
    },
    [mutate],
  );

  const setSessionStatus = useCallback(
    (id: string, status: SessionStatus) => {
      const cur = stateRef.current.sessions.find((x) => x.id === id);
      if (!cur) return;
      const updated: Session = { ...cur, status };
      mutate(
        (s) => ({ ...s, sessions: s.sessions.map((x) => (x.id === id ? updated : x)) }),
        () => backend.update("sessions", id, sessionToRow(updated)),
      );
    },
    [mutate],
  );

  /* ---------------- coach notes / follow-up / nutrition ---------------- */

  const patchClient = useCallback(
    (clientId: string, patch: Partial<Client>, okMsg?: string) => {
      const cur = stateRef.current.clients.find((c) => c.id === clientId);
      if (!cur) return;
      const updated: Client = { ...cur, ...patch };
      mutate(
        (s) => ({ ...s, clients: s.clients.map((x) => (x.id === clientId ? updated : x)) }),
        () => backend.update("clients", clientId, clientToRow(updated)),
        okMsg,
      );
    },
    [mutate],
  );

  const addCoachNote = useCallback(
    (clientId: string, text: string) => {
      const note: CoachNote = { id: uid(), text, createdAt: Date.now() };
      const cur = stateRef.current.clients.find((c) => c.id === clientId);
      patchClient(clientId, { coachNotes: [...(cur?.coachNotes ?? []), note] }, "Note added");
    },
    [patchClient],
  );

  const updateCoachNote = useCallback(
    (clientId: string, noteId: string, text: string) => {
      const cur = stateRef.current.clients.find((c) => c.id === clientId);
      patchClient(
        clientId,
        { coachNotes: (cur?.coachNotes ?? []).map((n) => (n.id === noteId ? { ...n, text } : n)) },
        "Note updated",
      );
    },
    [patchClient],
  );

  const deleteCoachNote = useCallback(
    (clientId: string, noteId: string) => {
      const cur = stateRef.current.clients.find((c) => c.id === clientId);
      patchClient(clientId, { coachNotes: (cur?.coachNotes ?? []).filter((n) => n.id !== noteId) }, "Note deleted");
    },
    [patchClient],
  );

  const setFollowUpDays = useCallback(
    (clientId: string, days: number) => {
      patchClient(clientId, { followUpDays: days }, "Follow-up frequency updated");
    },
    [patchClient],
  );

  const markFollowUpDone = useCallback(
    (clientId: string) => {
      patchClient(clientId, { lastFollowUp: todayISO() }, "Follow-up marked done");
    },
    [patchClient],
  );

  const setNutritionTargets = useCallback(
    (clientId: string, targets: NutritionTargets) => {
      patchClient(clientId, { nutritionTargets: targets }, "Nutrition targets saved");
    },
    [patchClient],
  );

  /* ---------------- chat ---------------- */

  const sendMessage = useCallback(
    (clientId: string, text: string) => {
      const role = meRef.current?.role ?? "coach";
      const msg = {
        id: uuid(),
        coachId: coachId(),
        clientId,
        senderRole: role,
        text: text.trim(),
        createdAt: Date.now(),
      };
      const notify: AppNotification | null =
        role === "coach"
          ? {
              id: uuid(),
              coachId: coachId(),
              clientId,
              kind: "message",
              text: "New message from your coach",
              createdAt: Date.now(),
              read: false,
            }
          : null;
      mutate(
        (s) => ({
          ...s,
          messages: [...s.messages, msg],
          notifications: notify ? [...s.notifications, notify] : s.notifications,
        }),
        async () => {
          await backend.insert("messages", { id: msg.id, coach_id: msg.coachId, ...messageToRow(msg) });
          if (notify) await backend.insert("notifications", { id: notify.id, coach_id: notify.coachId, ...notificationToRow(notify) });
        },
        "Message sent",
      );
    },
    [mutate],
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      mutate(
        (s) => ({
          ...s,
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }),
        () => backend.update("notifications", id, { read: true }),
      );
    },
    [mutate],
  );

  const markAllNotificationsRead = useCallback(
    (clientId: string) => {
      const unread = stateRef.current.notifications.filter((n) => n.clientId === clientId && !n.read);
      if (unread.length === 0) return;
      mutate(
        (s) => ({
          ...s,
          notifications: s.notifications.map((n) =>
            n.clientId === clientId && !n.read ? { ...n, read: true } : n,
          ),
        }),
        () => Promise.all(unread.map((n) => backend.update("notifications", n.id, { read: true }))),
        "All notifications marked as read",
      );
    },
    [mutate],
  );

  /* ---------------- coach profile / demo ---------------- */

  const updateCoachName = useCallback(
    async (name: string) => {
      const prev = meRef.current;
      if (prev) setMe({ ...prev, name });
      try {
        await backend.updateCoachName(name);
        toast("Profile updated");
      } catch (e) {
        if (prev) setMe(prev);
        toast(`Couldn't save — ${errorMessage(e)}`, "warn");
      }
    },
    [toast],
  );

  const resetData = useCallback(async () => {
    if (!isDemoMode) {
      toast("Reset is only available in demo mode.", "warn");
      return;
    }
    localStorage.removeItem("forge-demo-data-v1");
    localStorage.removeItem("forge-demo-coach-subs-v1");
    localStorage.removeItem("forge-demo-coach-status-v1");
    localStorage.removeItem("forge-demo-coach-plans-v1");
    localStorage.removeItem("forge-demo-sub-history-v1");
    localStorage.removeItem("forge-demo-audit-v1");
    activeUserRef.current = null;
    const userId = await getSessionUserId();
    if (userId) {
      activeUserRef.current = null;
      await bootSession(userId);
    }
    toast("Demo data restored");
  }, [bootSession, toast]);

  /* ---------------- coach pricing derived state (single source of truth) ---------------- */

  const coachPlans: CoachPlanConfig[] =
    state.coachPlans && state.coachPlans.length > 0 ? state.coachPlans : [];
  const coachIdForPricing = me?.role === "coach" ? me.coachId : "";
  const myCoachSubscription: CoachSubscription | null = coachIdForPricing
    ? resolveCoachSubscription(state.coachSubscriptions, coachIdForPricing)
    : null;
  const myCoachPlan: CoachPlanConfig = getCoachPlan(coachPlans.length > 0 ? coachPlans : undefined, myCoachSubscription);
  const myClientCount: number = coachIdForPricing ? getCoachClientCount(state.clients, coachIdForPricing) : 0;
  const myClientLimit: number | null = myCoachPlan.maxClients;
  const myCanAddClient: boolean =
    myClientLimit === null ? true : myClientCount < myClientLimit;

  const changeMyPlan = useCallback(
    async (planId: CoachPlan) => {
      const cid = meRef.current?.role === "coach" ? meRef.current.coachId : "";
      if (!cid) throw new Error("Not signed in as a coach.");
      await backend.changeCoachPlan(cid, planId);
      await reload();
      toast(`Plan changed to ${planId.charAt(0) + planId.slice(1).toLowerCase()}`, "ok");
    },
    [reload, toast],
  );

  return (
    <Ctx.Provider
      value={{
        phase,
        me,
        isDemo: isDemoMode,
        state,
        toasts,
        toast,
        success,
        error,
        warn,
        info,
        dismiss,
        reload,
        createClient,
        updateClient,
        deleteClient,
        resetClientPassword,
        addExercise,
        updateExercise,
        deleteExercise,
        addPlanItem,
        updatePlanItem,
        deletePlanItem,
        addMeal,
        updateMeal,
        deleteMeal,
        addCheckIn,
        deleteCheckIn,
        addSubscription,
        updateSubscription,
        renewSubscription,
        addPayment,
        updatePayment,
        deletePayment,
        addSession,
        updateSession,
        deleteSession,
        setSessionStatus,
        addCoachNote,
        updateCoachNote,
        deleteCoachNote,
        setFollowUpDays,
        markFollowUpDone,
        setNutritionTargets,
        sendMessage,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        updateCoachName,
        resetData,
        coachPlans,
        myCoachSubscription,
        myCoachPlan,
        myClientCount,
        myClientLimit,
        myCanAddClient,
        changeMyPlan,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
