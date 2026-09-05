/* ================================================================
   FORGE — sign-in screen (coach: email+password, client: username).
   Premium-minimal: calmer type scale, glass card, a11y-first forms.
   ================================================================ */

import { useId, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  User,
  Users,
  Zap,
  Shield,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { coachSignIn, coachSignUp, clientSignIn } from "../services/auth";
import { errorMessage } from "../lib";
import { btnPrimary, inputCls, labelCls } from "./ui";

const TICKER = ["STRENGTH", "NUTRITION", "RECOVERY", "CONSISTENCY", "PROGRESS", "DISCIPLINE", "OVERLOAD", "FORM FIRST"];

export function Auth({ onShowAdmin }: { onShowAdmin?: () => void }) {
  const [role, setRole] = useState<"coach" | "client">("coach");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const emailId = useId();
  const passId = useId();
  const nameId = useId();
  const userId = useId();
  const clientPassId = useId();

  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    // Instant client-side validation — no network round-trip for obvious mistakes.
    if (role === "coach") {
      if (!email.trim()) { setError("Enter your email address."); return; }
      if (!isEmail(email)) { setError("Enter a valid email address."); return; }
      if (!password) { setError("Enter your password."); return; }
      if (mode === "signup" && password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (mode === "signup" && name.trim().length > 80) { setError("Name is too long (max 80 characters)."); return; }
    } else {
      if (!username.trim()) { setError("Enter your username."); return; }
      if (username.trim().length < 3) { setError("Username must be at least 3 characters."); return; }
      if (!clientPassword) { setError("Enter your password."); return; }
    }
    setBusy(true);
    try {
      if (role === "coach") {
        if (mode === "signup") await coachSignUp(email.trim(), password, name.trim() || "Coach", remember);
        else await coachSignIn(email.trim(), password, remember);
      } else {
        await clientSignIn(username.trim(), clientPassword, remember);
      }
      // store's onAuthChange listener boots the session.
    } catch (err) {
      const msg = errorMessage(err);
      // Email-confirmation ON: the account exists, the coach just needs to
      // click the link first. Show guidance, not a scary red error.
      if (msg.includes("EMAIL_CONFIRMATION_REQUIRED")) {
        setMode("signin");
        setNotice("Account created — check your inbox for the verification link, then sign in.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="noise relative flex min-h-screen flex-col overflow-hidden">
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="orb orb-a -right-32 -top-40" />
        <div className="orb orb-b -left-24 bottom-1/4" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center gap-12 px-5 py-12 lg:gap-16 lg:px-8">
        {/* brand side */}
        <div className="hidden min-w-0 flex-1 flex-col lg:flex">
          <div className="rise flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_10px_30px_-10px_rgba(205,241,75,0.5)]">
              <Dumbbell className="h-6 w-6" strokeWidth={2.4} />
            </span>
            <div>
              <p className="font-display text-[28px] font-bold uppercase leading-none tracking-wide text-mist-100">
                Forge
              </p>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.28em] text-mist-500">
                Coaching OS
              </p>
            </div>
          </div>

          <h1
            className="rise text-balance mt-12 font-display text-[68px] font-bold uppercase leading-[0.9] tracking-tight text-mist-100 xl:text-[76px]"
            style={{ animationDelay: "90ms" }}
          >
            Every rep.
            <br />
            <span className="text-stroke">Every meal.</span>
            <br />
            <span className="text-volt-400">Tracked.</span>
          </h1>

          <p
            className="rise mt-6 max-w-md text-balance text-[15px] leading-7 text-mist-400"
            style={{ animationDelay: "180ms" }}
          >
            The command center for coaches and their clients — workout plans, nutrition targets,
            daily check-ins and direct chat in one calm workspace.
          </p>

          <dl className="rise mt-10 flex max-w-md gap-8" style={{ animationDelay: "260ms" }}>
            {[
              { v: "3", l: "Roles in sync" },
              { v: "10", l: "Data tables" },
              { v: "24/7", l: "Client access" },
            ].map((s, i) => (
              <div key={s.l} className={`flex flex-col ${i > 0 ? "border-l border-white/[0.08] pl-8" : ""}`}>
                <dd className="order-1 font-display text-[40px] font-bold leading-none text-volt-300 tnum">
                  {s.v}
                </dd>
                <dt className="order-2 mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-mist-500">
                  {s.l}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* sign-in side */}
        <div className="rise w-full max-w-[440px] flex-none max-lg:mx-auto" style={{ animationDelay: "140ms" }}>
          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-night-900/75 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <span
              aria-hidden="true"
              className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/60 to-transparent"
            />
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-volt-400 text-night-950">
                <Dumbbell className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div>
                <p className="font-display text-2xl font-bold uppercase leading-none text-mist-100">Forge</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-mist-500">
                  Coaching OS
                </p>
              </div>
            </div>

            <p className="text-[20px] font-extrabold tracking-tight text-mist-100">
              Sign in to your space
            </p>
            <p className="mt-1 text-[13px] leading-5 text-mist-400">
              Pick who is stepping onto the floor today.
            </p>

            <div
              role="tablist"
              aria-label="Choose your role"
              className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-night-950 p-1.5"
            >
              <button
                role="tab"
                aria-selected={role === "coach"}
                onClick={() => {
                  setRole("coach");
                  setError("");
                  setNotice("");
                }}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/60 ${
                  role === "coach"
                    ? "bg-volt-400 text-night-950 shadow-[0_4px_14px_-4px_rgba(205,241,75,0.45)]"
                    : "text-mist-400 hover:bg-white/[0.05] hover:text-mist-100"
                }`}
              >
                <Zap className="h-4 w-4" /> Coach
              </button>
              <button
                role="tab"
                aria-selected={role === "client"}
                onClick={() => {
                  setRole("client");
                  setError("");
                  setNotice("");
                }}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/60 ${
                  role === "client"
                    ? "bg-volt-400 text-night-950 shadow-[0_4px_14px_-4px_rgba(205,241,75,0.45)]"
                    : "text-mist-400 hover:bg-white/[0.05] hover:text-mist-100"
                }`}
              >
                <Users className="h-4 w-4" /> Client
              </button>
            </div>

            <form onSubmit={(e) => void submit(e)} className="animate-pop mt-6 grid gap-4" key={role + mode} noValidate={false}>
              {role === "coach" ? (
                <>
                  <div>
                    <label htmlFor={emailId} className={labelCls}>
                      Email
                    </label>
                    <input
                      id={emailId}
                      className={inputCls}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      aria-invalid={!!error}
                    />
                  </div>
                  {mode === "signup" && (
                    <div>
                      <label htmlFor={nameId} className={labelCls}>
                        Your name
                      </label>
                      <input
                        id={nameId}
                        className={inputCls}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Coach Dana"
                        autoComplete="name"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor={passId} className={labelCls}>
                      Password{mode === "signup" ? " (min. 6 characters)" : ""}
                    </label>
                    <div className="relative">
                      <input
                        id={passId}
                        className={`${inputCls} pe-11`}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        required
                        minLength={mode === "signup" ? 6 : undefined}
                        aria-invalid={!!error}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <RememberMe checked={remember} onChange={setRemember} />
                  <button type="submit" className={`${btnPrimary} h-12 w-full text-[15px]`} disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Signing in…
                      </>
                    ) : (
                      <>
                        {mode === "signup" ? "Create coach account" : "Open coach dashboard"}
                        <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="cursor-pointer rounded-lg py-1 text-center text-[13px] font-bold text-mist-400 transition hover:text-volt-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
                    onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}
                    disabled={busy}
                  >
                    {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor={userId} className={labelCls}>
                      Username
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
                      <input
                        id={userId}
                        className={`${inputCls} ps-10`}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="your username"
                        autoComplete="username"
                        required
                        aria-invalid={!!error}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor={clientPassId} className={labelCls}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id={clientPassId}
                        className={`${inputCls} pe-11`}
                        type={showClientPassword ? "text" : "password"}
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        aria-invalid={!!error}
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientPassword((v) => !v)}
                        aria-label={showClientPassword ? "Hide password" : "Show password"}
                        className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                      >
                        {showClientPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <RememberMe checked={remember} onChange={setRemember} />
                  <button type="submit" className={`${btnPrimary} h-12 w-full text-[15px]`} disabled={busy}>
                    {busy ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Signing in…
                      </>
                    ) : (
                      <>
                        Enter client space
                        <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs leading-5 text-mist-500">
                    Your coach gave you these credentials — no email needed.
                  </p>
                </>
              )}

              {notice && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-volt-400/25 bg-volt-400/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-volt-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  {notice}
                </p>
              )}
              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-danger-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
            </form>

            {onShowAdmin && (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={onShowAdmin}
                  className="group flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-1.5 text-[11px] font-bold text-mist-500 transition-all duration-200 hover:border-volt-400/25 hover:bg-volt-400/[0.06] hover:text-volt-300"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Sign in as Admin
                </button>
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-mist-500">
            Protected by your workspace · Secured by Supabase
          </p>
        </div>
      </main>

      {/* ticker */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-night-950/70 py-3 backdrop-blur-xl">
        <div className="overflow-hidden" aria-hidden="true">
          <div className="ticker-track flex w-max items-center gap-10">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span
                key={i}
                className="flex items-center gap-10 font-display text-[13px] font-semibold uppercase tracking-[0.32em] text-mist-500/80"
              >
                {t}
                <span className="text-volt-500/70">/</span>
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------- remember me ---------------- */

function RememberMe({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl py-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
    >
      <span
        aria-hidden="true"
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border transition-all duration-150 ${
          checked
            ? "border-volt-400 bg-volt-400 text-night-950 shadow-[0_0_14px_-2px_rgba(205,241,75,0.5)]"
            : "border-white/15 bg-white/[0.03] text-transparent group-hover:border-mist-400"
        }`}
      >
        <Check className={`h-3 w-3 ${checked ? "scale-100" : "scale-0"} transition-transform duration-150`} strokeWidth={3.4} />
      </span>
      <span className="text-[13px] font-semibold text-mist-300 transition group-hover:text-mist-100">
        Remember me
        <span className="ms-1.5 font-normal text-mist-500">
          {checked ? "stay signed in on this device" : "sign out when the browser closes"}
        </span>
      </span>
    </button>
  );
}
