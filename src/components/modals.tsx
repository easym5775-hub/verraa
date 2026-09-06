/* ================================================================
   VERRAA — all form modals (client, exercise, plan, meal, nutrition,
   subscription, payment, session, password reset, photo viewer).
   ================================================================ */

import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Dumbbell, Image as ImageIcon, RefreshCw, X } from "lucide-react";
import type {
  Client,
  ClientStatus,
  DayLabelMode,
  Exercise,
  ExerciseCategory,
  Goal,
  Meal,
  MealType,
  NutritionTargets,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PlanItem,
  Session,
  SessionStatus,
  Subscription,
  SubscriptionPaymentStatus,
} from "../types";
import {
  CATEGORIES,
  GOALS,
  MEAL_TYPES,
  PAYMENT_METHODS,
  SESSION_STATUSES,
  STATUSES,
  WEEK_DAYS,
  WEEK_ORDER_SAT_FIRST,
  formatDayName,
} from "../types";
import { fileToDataUrl, isValidUsername, randomPassword, todayISO } from "../lib";
import { useApp } from "../store";
import { isPlanLimitError, type PlanLimitError } from "../coachPricing";
import { Modal, btnPrimary, btnSecondary, inputCls, labelCls, textareaCls } from "./ui";

/* ---------------- shared photo field ---------------- */

function PhotoField({
  value,
  onChange,
  label = "Profile photo",
}: {
  value?: string;
  onChange: (v?: string) => void;
  label?: string;
}) {
  const [err, setErr] = useState("");
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setErr("");
      onChange(await fileToDataUrl(f));
    } catch {
      setErr("Could not read that image — try another file.");
    }
  };
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="Preview" className="h-16 w-16 rounded-xl object-cover ring-1 ring-night-600" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-night-500 text-night-400">
            <ImageIcon className="h-6 w-6" />
          </span>
        )}
        <div className="flex flex-col items-start gap-1.5">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-200 transition hover:border-night-500 hover:bg-night-700">
            {value ? "Replace" : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={pick} />
          </label>
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="cursor-pointer text-[11px] font-semibold text-danger-400 hover:underline">
              Remove photo
            </button>
          )}
        </div>
      </div>
      {err && <p className="mt-1 text-xs font-semibold text-danger-400">{err}</p>}
    </div>
  );
}

/* ---------------- client form (create = username+password) ---------------- */

export function ClientFormModal({
  open,
  initial,
  onClose,
  onSaved,
  onUpgrade,
}: {
  open: boolean;
  initial: Client | null;
  onClose: () => void;
  onSaved?: (c: Client) => void;
  onUpgrade?: () => void;
}) {
  const { createClient, updateClient } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Client["gender"]>(undefined);
  const [goal, setGoal] = useState<Goal>("Lose weight");
  const [status, setStatus] = useState<ClientStatus>("Active");
  const [startDate, setStartDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");
  const [limitInfo, setLimitInfo] = useState<PlanLimitError | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(initial?.username ?? "");
    setPassword("");
    setName(initial?.name ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setAge(initial?.age !== undefined ? String(initial.age) : "");
    setGender(initial?.gender);
    setGoal(initial?.goal ?? "Lose weight");
    setStatus(initial?.status ?? "Active");
    setStartDate(initial?.startDate ?? todayISO());
    setNotes(initial?.notes ?? "");
    setPhoto(initial?.photo);
    setError("");
    setLimitInfo(null);
    setBusy(false);
  }, [open, initial]);

  const save = async () => {
    if (!name.trim()) return setError("Client name is required.");
    if (!initial) {
      if (!isValidUsername(username.trim())) return setError("Username must be 3–24 chars: letters, numbers, dots, dashes.");
      if (password.length < 6) return setError("Password must be at least 6 characters.");
    }
    setBusy(true);
    setError("");
    setLimitInfo(null);
    try {
      if (initial) {
        updateClient({
          ...initial,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          age: age.trim() === "" ? undefined : Math.max(0, Number(age) || 0),
          gender,
          goal,
          status,
          startDate,
          notes: notes.trim(),
          photo,
        });
        onClose();
      } else {
        const c = await createClient({
          username: username.trim().toLowerCase(),
          password,
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          age: age.trim() === "" ? undefined : Math.max(0, Number(age) || 0),
          gender,
          goal,
          status,
          startDate,
          notes: notes.trim() || undefined,
          photo,
        });
        onSaved?.(c);
        onClose();
      }
    } catch (e) {
      if (isPlanLimitError(e)) {
        setLimitInfo(e);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't save the client.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit client" : "New client"}
      description={initial ? undefined : "Pick the username & password they'll sign in with."}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoField value={photo} onChange={setPhoto} />
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" />
        </div>
        {!initial && (
          <>
            <div>
              <label className={labelCls}>Login username *</label>
              <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="alex.m" autoComplete="off" />
            </div>
            <div>
              <label className={labelCls}>Login password *</label>
              <div className="flex gap-2">
                <input className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 chars" autoComplete="new-password" />
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-3 text-mist-400 transition-all duration-200 hover:border-volt-400 hover:text-volt-300"
                  onClick={() => setPassword(randomPassword())}
                  title="Generate a random password"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
        <div>
          <label className={labelCls}>Contact email</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@email.com" />
        </div>
        <div>
          <label className={labelCls}>Phone (WhatsApp)</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 101 234 5678" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Age</label>
            <input className={inputCls} type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} placeholder="—" />
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select className={inputCls} value={gender ?? ""} onChange={(e) => setGender((e.target.value || undefined) as Client["gender"])}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Goal</label>
          <select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
            {GOALS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Start date</label>
          <input className={inputCls} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Notes</label>
          <textarea className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Injuries, preferences, schedule…" />
        </div>
      </div>
      {error && !limitInfo && <p className="mt-3 rounded-xl border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-xs font-bold text-danger-300">{error}</p>}
      {limitInfo && (
        <div role="alert" className="mt-3 rounded-xl border border-warn-400/30 bg-warn-400/[0.08] p-4">
          <p className="text-sm font-bold leading-6 text-warn-200">You've reached the {limitInfo.limit}-client limit of your {limitInfo.plan.name} plan.</p>
          <p className="mt-1 text-[13px] font-semibold text-mist-300">Upgrade your plan to add more clients.</p>
          {onUpgrade && (
            <button
              className={`${btnPrimary} mt-3 w-full`}
              onClick={() => {
                onClose();
                onUpgrade();
              }}
            >
              Upgrade Plan
            </button>
          )}
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Create client"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- exercise form ---------------- */

export function ExerciseFormModal({ open, initial, onClose }: { open: boolean; initial: Exercise | null; onClose: () => void }) {
  const { addExercise, updateExercise } = useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("Chest");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setCategory(initial?.category ?? "Chest");
    setDescription(initial?.description ?? "");
    setVideoUrl(initial?.videoUrl ?? "");
    setError("");
  }, [open, initial]);

  const save = () => {
    if (!name.trim()) return setError("Exercise name is required.");
    const data = { name: name.trim(), category, description: description.trim(), videoUrl: videoUrl.trim() };
    if (initial) updateExercise({ ...initial, ...data });
    else addExercise(data);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit exercise" : "New exercise"}>
      <div className="grid gap-4">
        <div>
          <label className={labelCls}>Exercise name *</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Goblet Squat" />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Video URL (YouTube)</label>
          <input className={inputCls} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/…" />
        </div>
        <div>
          <label className={labelCls}>Coaching cues</label>
          <textarea className={textareaCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Setup, tempo, common mistakes…" />
        </div>
      </div>
      {error && <p className="mt-3 text-xs font-bold text-danger-400">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          {initial ? "Save changes" : "Add to library"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- plan item form ---------------- */

export function PlanItemFormModal({
  open,
  clientId,
  day,
  initial,
  onClose,
}: {
  open: boolean;
  clientId: string;
  day: number;
  initial: PlanItem | null;
  onClose: () => void;
}) {
  const { state, addPlanItem, updatePlanItem, toast } = useApp();
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [rest, setRest] = useState("60");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setExerciseId(initial?.exerciseId ?? state.exercises[0]?.id ?? "");
    setSets(String(initial?.sets ?? 3));
    setReps(String(initial?.reps ?? 10));
    setRest(String(initial?.rest ?? 60));
    setNotes(initial?.notes ?? "");
  }, [open, initial, state.exercises]);

  const save = () => {
    if (!exerciseId) return toast("Add an exercise to the library first", "warn");
    const data = {
      exerciseId,
      sets: Math.max(1, Number(sets) || 1),
      reps: Math.max(1, Number(reps) || 1),
      rest: Math.max(0, Number(rest) || 0),
      notes: notes.trim(),
    };
    if (initial) updatePlanItem({ ...initial, ...data });
    else addPlanItem({ clientId, day, ...data });
    onClose();
  };

  const picked = state.exercises.find((e) => e.id === exerciseId);

  return (
    <Modal open={open} onClose={onClose} title={`${initial ? "Edit" : "Add"} exercise — Day ${day} (${WEEK_DAYS[day - 1]})`}>
      {state.exercises.length === 0 ? (
        <p className="rounded-xl border border-warn-400/25 bg-warn-400/10 p-3 text-sm text-warn-300">The library is empty — add an exercise there first.</p>
      ) : (
        <div className="grid gap-4">
          <div>
            <label className={labelCls}>Exercise</label>
            <select className={inputCls} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              {state.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} — {e.category}
                </option>
              ))}
            </select>
            {picked && picked.description && (
              <p className="mt-2 rounded-xl bg-night-800 p-2.5 text-xs leading-5 text-mist-400">{picked.description}</p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Sets</label>
              <input className={inputCls} type="number" min={1} value={sets} onChange={(e) => setSets(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Reps</label>
              <input className={inputCls} type="number" min={1} value={reps} onChange={(e) => setReps(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Rest (s)</label>
              <input className={inputCls} type="number" min={0} step={15} value={rest} onChange={(e) => setRest(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes for this day</label>
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tempo, load target, cue…" />
          </div>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save} disabled={state.exercises.length === 0}>
          {initial ? "Save changes" : "Add to plan"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- meal form ---------------- */

export function MealFormModal({
  open,
  clientId,
  initial,
  defaultType,
  defaultDay,
  labelMode,
  onClose,
}: {
  open: boolean;
  clientId: string;
  initial: Meal | null;
  defaultType?: MealType;
  defaultDay?: number;
  labelMode?: DayLabelMode;
  onClose: () => void;
}) {
  const { addMeal, updateMeal } = useApp();
  const [day, setDay] = useState<number>(defaultDay ?? 1);
  const [type, setType] = useState<MealType>("Breakfast");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("450");
  const [protein, setProtein] = useState("30");
  const [carbs, setCarbs] = useState("40");
  const [fats, setFats] = useState("12");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDay(initial?.day ?? defaultDay ?? 1);
    setType(initial?.type ?? defaultType ?? "Breakfast");
    setTime(initial?.time ?? "");
    setDescription(initial?.description ?? "");
    setCalories(String(initial?.calories ?? 450));
    setProtein(String(initial?.protein ?? 30));
    setCarbs(String(initial?.carbs ?? 40));
    setFats(String(initial?.fats ?? 12));
    setNotes(initial?.notes ?? "");
    setError("");
  }, [open, initial, defaultType, defaultDay]);

  const save = () => {
    if (!description.trim()) return setError("Describe the meal first.");
    const data = {
      day,
      type,
      time: time.trim() || undefined,
      description: description.trim(),
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
      notes: notes.trim() || undefined,
    };
    if (initial) updateMeal({ ...initial, ...data });
    else addMeal({ clientId, ...data });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit meal" : "Assign meal"}>
      <div className="grid gap-4">
        <div>
          <label className={labelCls}>Day</label>
          <select className={inputCls} value={day} onChange={(e) => setDay(Number(e.target.value))}>
            {WEEK_ORDER_SAT_FIRST.map((d) => (
              <option key={d} value={d}>
                {labelMode === "numbered" ? `${formatDayName(d, labelMode)} — ${WEEK_DAYS[d - 1]}` : WEEK_DAYS[d - 1]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Meal type</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`cursor-pointer rounded-xl border px-1 py-2 text-[11px] font-bold transition ${
                  type === t ? "border-volt-400 bg-volt-400/15 text-volt-300" : "border-night-600 bg-night-800 text-mist-400 hover:border-night-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Time (optional)</label>
          <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Food description *</label>
          <textarea className={textareaCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Grilled chicken, rice, salad…" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: "Kcal", v: calories, s: setCalories },
            { l: "Protein", v: protein, s: setProtein },
            { l: "Carbs", v: carbs, s: setCarbs },
            { l: "Fats", v: fats, s: setFats },
          ].map((f) => (
            <div key={f.l}>
              <label className={labelCls}>{f.l}</label>
              <input className={inputCls} type="number" min={0} value={f.v} onChange={(e) => f.s(e.target.value)} />
            </div>
          ))}
        </div>
        <div>
          <label className={labelCls}>Notes (optional)</label>
          <textarea className={textareaCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Prep tips, substitutions…" />
        </div>
      </div>
      {error && <p className="mt-3 text-xs font-bold text-danger-400">{error}</p>}
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          {initial ? "Save changes" : "Add meal"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- nutrition targets ---------------- */

export function NutritionTargetsModal({ open, clientId, onClose }: { open: boolean; clientId: string; onClose: () => void }) {
  const { state, setNutritionTargets } = useApp();
  const current = state.clients.find((c) => c.id === clientId)?.nutritionTargets;
  const [calories, setCalories] = useState("2200");
  const [protein, setProtein] = useState("160");
  const [carbs, setCarbs] = useState("220");
  const [fats, setFats] = useState("70");
  const [water, setWater] = useState("3");

  useEffect(() => {
    if (!open) return;
    setCalories(String(current?.calories ?? 2200));
    setProtein(String(current?.protein ?? 160));
    setCarbs(String(current?.carbs ?? 220));
    setFats(String(current?.fats ?? 70));
    setWater(String(current?.water ?? 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const save = () => {
    const targets: NutritionTargets = {
      calories: Math.max(0, Number(calories) || 0),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
      water: Math.max(0, Number(water) || 0),
    };
    setNutritionTargets(clientId, targets);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nutrition targets" description="Daily targets the client aims for.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { l: "Calories", v: calories, s: setCalories, u: "kcal" },
          { l: "Protein", v: protein, s: setProtein, u: "g" },
          { l: "Carbs", v: carbs, s: setCarbs, u: "g" },
          { l: "Fats", v: fats, s: setFats, u: "g" },
          { l: "Water", v: water, s: setWater, u: "L" },
        ].map((f) => (
          <div key={f.l}>
            <label className={labelCls}>
              {f.l} <span className="normal-case text-mist-500">({f.u})</span>
            </label>
            <input className={inputCls} type="number" min={0} step={f.u === "L" ? 0.5 : 10} value={f.v} onChange={(e) => f.s(e.target.value)} />
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          Save targets
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- subscription form ---------------- */

export function SubscriptionFormModal({
  open,
  clientId,
  initial,
  onClose,
}: {
  open: boolean;
  clientId: string;
  initial: Subscription | null;
  onClose: () => void;
}) {
  const { addSubscription, updateSubscription } = useApp();
  const [planName, setPlanName] = useState("Monthly");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [price, setPrice] = useState("1200");
  const [paymentStatus, setPaymentStatus] = useState<SubscriptionPaymentStatus>("Pending");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");

  useEffect(() => {
    if (!open) return;
    setPlanName(initial?.planName ?? "Monthly");
    setStartDate(initial?.startDate ?? todayISO());
    setEndDate(initial?.endDate ?? todayISO());
    setPrice(String(initial?.price ?? 1200));
    setPaymentStatus(initial?.paymentStatus ?? "Pending");
    setPaymentMethod("Cash");
  }, [open, initial]);

  const save = () => {
    const data = {
      planName: planName.trim() || "Monthly",
      startDate,
      endDate,
      price: Math.max(0, Number(price) || 0),
      paymentStatus,
    };
    if (initial) updateSubscription({ ...initial, ...data }, { paymentMethod });
    else addSubscription({ clientId, ...data }, { paymentMethod });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit subscription" : "Add subscription"}>
      <div className="grid gap-4">
        <div>
          <label className={labelCls}>Plan name</label>
          <input className={inputCls} value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="Monthly / Quarterly…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start</label>
            <input className={inputCls} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End</label>
            <input className={inputCls} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Price (EGP)</label>
            <input className={inputCls} type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Payment status</label>
            <select className={inputCls} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as SubscriptionPaymentStatus)}>
              <option>Paid</option>
              <option>Pending</option>
              <option>Partial</option>
            </select>
          </div>
        </div>
        {paymentStatus === "Paid" && (
          <div>
            <label className={labelCls}>Payment method (auto-recorded)</label>
            <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] font-semibold text-mist-500">
              A {price || 0} EGP payment linked to this subscription will appear in Payments automatically.
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          {initial ? "Save changes" : "Add subscription"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- payment form ---------------- */

export function PaymentFormModal({
  open,
  clientId,
  initial,
  subscriptions,
  onClose,
}: {
  open: boolean;
  clientId: string | null; // null → pick client inside (quick-add from dashboard)
  initial: Payment | null;
  subscriptions: Subscription[];
  onClose: () => void;
}) {
  const { state, addPayment, updatePayment, toast } = useApp();
  const [picked, setPicked] = useState("");
  const [amount, setAmount] = useState("1200");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [status, setStatus] = useState<PaymentStatus>("Paid");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(clientId ?? state.clients[0]?.id ?? "");
    setAmount(String(initial?.amount ?? 1200));
    setDate(initial?.date ?? todayISO());
    setMethod(initial?.method ?? "Cash");
    setStatus(initial?.status ?? "Paid");
    setSubscriptionId(initial?.subscriptionId ?? "");
    setNotes(initial?.notes ?? "");
  }, [open, initial, clientId, state.clients]);

  const subOptions = subscriptions.filter((s) => s.clientId === (clientId ?? picked));

  const save = () => {
    const target = clientId ?? picked;
    if (!target) return toast("Pick a client first", "warn");
    const data = {
      amount: Math.max(0, Number(amount) || 0),
      date,
      method,
      status,
      subscriptionId: subscriptionId || undefined,
      notes: notes.trim(),
    };
    if (initial) updatePayment({ ...initial, ...data });
    else addPayment({ clientId: target, ...data });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit payment" : "Record payment"}>
      <div className="grid gap-4">
        {clientId === null && (
          <div>
            <label className={labelCls}>Client</label>
            <select className={inputCls} value={picked} onChange={(e) => setPicked(e.target.value)}>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Amount (EGP)</label>
            <input className={inputCls} type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Method</label>
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              <option>Paid</option>
              <option>Pending</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Related subscription</label>
          <select className={inputCls} value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)}>
            <option value="">— none —</option>
            {subOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.planName} · ends {s.endDate}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          {initial ? "Save changes" : "Record payment"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- session form ---------------- */

export function SessionFormModal({
  open,
  clientId,
  initial,
  presetDate,
  onClose,
}: {
  open: boolean;
  clientId: string | null; // null → pick client inside
  initial: Session | null;
  presetDate?: string;
  onClose: () => void;
}) {
  const { state, addSession, updateSession, toast } = useApp();
  const [picked, setPicked] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("18:00");
  const [type, setType] = useState("Personal Training");
  const [status, setStatus] = useState<SessionStatus>("Scheduled");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setPicked(clientId ?? state.clients[0]?.id ?? "");
    setDate(initial?.date ?? presetDate ?? todayISO());
    setTime(initial?.time ?? "18:00");
    setType(initial?.type ?? "Personal Training");
    setStatus(initial?.status ?? "Scheduled");
    setNotes(initial?.notes ?? "");
  }, [open, initial, presetDate, clientId, state.clients]);

  const save = () => {
    const target = clientId ?? picked;
    if (!target) return toast("Pick a client first", "warn");
    const data = { date, time, type: type.trim() || "Training", status, notes: notes.trim() };
    if (initial) updateSession({ ...initial, ...data });
    else addSession({ clientId: target, ...data });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit session" : "Book session"} description="Attendance is derived from session outcomes.">
      <div className="grid gap-4">
        {clientId === null && (
          <div>
            <label className={labelCls}>Client</label>
            <select className={inputCls} value={picked} onChange={(e) => setPicked(e.target.value)}>
              {state.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Type</label>
            <input className={inputCls} value={type} onChange={(e) => setType(e.target.value)} placeholder="Personal Training / Online…" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)}>
              {SESSION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Focus, equipment…" />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={save}>
          {initial ? "Save changes" : "Book session"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- reset client password ---------------- */

export function ResetPasswordModal({ open, clientId, onClose }: { open: boolean; clientId: string; onClose: () => void }) {
  const { resetClientPassword } = useApp();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPw("");
      setErr("");
      setBusy(false);
    }
  }, [open]);

  const save = async () => {
    if (pw.length < 6) return setErr("Password must be at least 6 characters.");
    setBusy(true);
    try {
      await resetClientPassword(clientId, pw);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't reset the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reset client password" description="Set a new sign-in password for this client.">
      <div className="flex gap-2">
        <input className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 6 chars)" autoComplete="new-password" />
        <button
          type="button"
          className="shrink-0 cursor-pointer rounded-xl border border-night-600 bg-night-800 px-3 text-mist-400 transition-all duration-200 hover:border-volt-400 hover:text-volt-300"
          onClick={() => setPw(randomPassword())}
          title="Generate a random password"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      {err && <p className="mt-2 text-xs font-bold text-danger-400">{err}</p>}
      <div className="mt-5 flex gap-2">
        <button className={`${btnPrimary} flex-1`} onClick={() => void save()} disabled={busy}>
          {busy ? "Resetting…" : "Reset password"}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- photo lightbox ---------------- */

export function PhotoModal({ src, onClose }: { src: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!src) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  if (!src) return null;
  // Portaled for the same reason as Modal: avoids clipping inside
  // transformed ancestors (`.rise`) and stays above the noise overlay.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="animate-fade absolute inset-0 bg-night-950/90" onClick={onClose} />
      <div className="animate-pop relative">
        <img src={src} alt="Progress" className="max-h-[80vh] max-w-full rounded-xl ring-1 ring-night-600" />
        <button
          onClick={onClose}
          className="absolute -right-3 -top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-volt-400 text-night-950 shadow-lg transition hover:bg-volt-300"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- copy day modal ---------------- */

export function CopyDayModal({
  open,
  clientId,
  sourceDay,
  meals,
  labelMode,
  onClose,
}: {
  open: boolean;
  clientId: string;
  sourceDay: number;
  meals: Meal[];
  labelMode?: DayLabelMode;
  onClose: () => void;
}) {
  const { addMeal } = useApp();
  const [destDays, setDestDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setDestDays([]);
      setBusy(false);
    }
  }, [open]);

  const sourceMeals = meals.filter((m) => m.day === sourceDay);
  const otherDays = WEEK_ORDER_SAT_FIRST.filter((d) => d !== sourceDay);
  const sourceLabel = labelMode === "numbered" ? `${formatDayName(sourceDay, labelMode)} (${WEEK_DAYS[sourceDay - 1]})` : WEEK_DAYS[sourceDay - 1];

  const toggleDay = (day: number) => {
    setDestDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleCopy = () => {
    if (destDays.length === 0 || sourceMeals.length === 0) return;

    setBusy(true);
    
    // Check if any destination days have existing meals
    const daysWithMeals = destDays.filter((d) => meals.some((m) => m.day === d && m.clientId === clientId));
    
    if (daysWithMeals.length > 0) {
      // Show confirmation - for simplicity we'll proceed with append behavior
      // In a more complex system we'd show a proper confirmation dialog
    }

    // Copy meals to each selected day
    destDays.forEach((destDay) => {
      sourceMeals.forEach((meal) => {
        addMeal({
          clientId,
          day: destDay,
          type: meal.type,
          time: meal.time,
          description: meal.description,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fats: meal.fats,
          notes: meal.notes,
        });
      });
    });

    setBusy(false);
    onClose();
  };

  const hasSourceMeals = sourceMeals.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Copy Day">
      <div className="grid gap-4">
        <p className="text-sm text-mist-400">
          Copy all meals from <strong>{sourceLabel}</strong> to:
        </p>
        
        {!hasSourceMeals ? (
          <div className="rounded-xl border border-warn-400/25 bg-warn-400/10 p-3 text-sm text-warn-300">
            {sourceLabel} has no meals to copy.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {otherDays.map((day) => {
                const dayHasMeals = meals.some((m) => m.day === day && m.clientId === clientId);
                const isChecked = destDays.includes(day);
                
                return (
                  <label
                    key={day}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      isChecked
                        ? "border-volt-400 bg-volt-400/15 text-volt-300"
                        : "border-night-600 bg-night-800 text-mist-300 hover:border-night-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleDay(day)}
                      className="h-4 w-4 accent-volt-400"
                    />
                    <span className="flex-1 font-semibold">
                      {labelMode === "numbered" ? `${formatDayName(day, labelMode)} · ${WEEK_DAYS[day - 1]}` : WEEK_DAYS[day - 1]}
                    </span>
                    {dayHasMeals && <span className="text-[10px] text-warn-400">(has meals)</span>}
                  </label>
                );
              })}
            </div>
            
            <div className="rounded-xl bg-night-800 p-3">
              <p className="text-xs text-mist-500">
                Will copy <strong>{sourceMeals.length}</strong> meal{sourceMeals.length !== 1 ? "s" : ""} to {destDays.length} day{destDays.length !== 1 ? "s" : ""}
              </p>
            </div>
          </>
        )}
      </div>
      
      <div className="mt-5 flex gap-2">
        <button 
          className={`${btnPrimary} flex-1`} 
          onClick={handleCopy}
          disabled={!hasSourceMeals || destDays.length === 0 || busy}
        >
          {busy ? "Copying..." : `Copy to ${destDays.length} Day${destDays.length !== 1 ? "s" : ""}`}
        </button>
        <button className={btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

void Dumbbell;
