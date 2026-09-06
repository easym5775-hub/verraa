/* ================================================================
   FORGE — Admin/Owner sign-in screen (premium-minimal match).
   ================================================================ */

import { useId, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { ownerSignIn } from "../services/auth";
import { ADMIN_EMAIL } from "../services/backend";
import { errorMessage } from "../lib";
import { btnPrimary, inputCls, labelCls } from "./ui";

export function AdminAuth({ onBack }: { onBack: () => void }) {
  // Single admin account — the email is fixed, only the password is typed.
  const [email] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailId = useId();
  const passId = useId();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (!email.trim()) throw new Error("Enter your email address.");
      if (!password) throw new Error("Enter your password.");
      await ownerSignIn(email.trim(), password, remember);
    } catch (err) {
      setError(errorMessage(err));
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

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 py-10">
        <button
          onClick={onBack}
          className="absolute left-4 top-4 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[13px] font-bold text-mist-400 transition hover:border-volt-400/30 hover:text-volt-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50 lg:left-8 lg:top-8"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          Back to sign in
        </button>

        <div className="rise mb-8 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-volt-400 text-night-950 shadow-[0_10px_30px_-10px_rgba(205,241,75,0.5)]">
            <Shield className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <div>
            <p className="font-display text-[26px] font-bold uppercase leading-none text-mist-100">Forge Owner</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-mist-500">Admin access</p>
          </div>
        </div>

        <div className="rise relative w-full max-w-[440px] overflow-hidden rounded-[24px] border border-white/10 bg-night-900/75 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <span aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/60 to-transparent" />

          <div className="mb-1 flex items-center gap-2.5">
            <span className="icon-tile h-9 w-9">
              <Shield className="h-4 w-4" />
            </span>
            <p className="text-[17px] font-extrabold tracking-tight text-mist-100">Owner sign in</p>
          </div>

          <p className="mt-1 text-[13px] leading-5 text-mist-400">Single admin account — enter its password to access the SaaS administration dashboard.</p>

          <form onSubmit={(e) => void submit(e)} className="animate-pop mt-6 grid gap-4">
            <div>
              <label htmlFor={emailId} className={labelCls}>
                Email
              </label>
              <input
                id={emailId}
                className={`${inputCls} opacity-60`}
                type="email"
                value={email}
                readOnly
                disabled
                autoComplete="email"
                aria-readonly="true"
              />
              <p className="mt-1.5 text-[11px] font-semibold text-mist-500">Fixed admin account — cannot be changed.</p>
            </div>
            <div>
              <label htmlFor={passId} className={labelCls}>
                Password
              </label>
              <div className="relative">
                <input
                  id={passId}
                  className={`${inputCls} pe-11`}
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-mist-500 transition hover:bg-white/[0.06] hover:text-mist-100"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  Enter owner dashboard
                  <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                </>
              )}
            </button>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-danger-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
          </form>
        </div>
      </main>
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
        <span className="ms-1.5 font-normal text-mist-500">{checked ? "stay signed in on this device" : "sign out when the browser closes"}</span>
      </span>
    </button>
  );
}
