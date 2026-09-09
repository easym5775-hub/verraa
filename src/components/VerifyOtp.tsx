/* ================================================================
   VERRAA — email OTP verification (coach signup: 6-digit code).
   Flow: /signup creates the account (no session while "Confirm email"
   is ON) → lands here → verify → /login. Same glass-card system
   as Auth, a11y-first, mobile-friendly.
   ================================================================ */

import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  Loader2,
  MailCheck,
} from "lucide-react";
import { resendCoachOtp, signOut, verifyCoachOtp } from "../services/auth";
import { errorMessage } from "../lib";
import { btnPrimary, btnSecondary } from "./ui";
import { Seo } from "./Seo";

const CODE_LEN = 6;
const RESEND_COOLDOWN_S = 60;

export function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const stateEmail = (location.state as { email?: string } | null)?.email ?? "";
  const queryEmail = params.get("email") ?? "";

  const [email, setEmail] = useState(stateEmail || queryEmail);
  const [digits, setDigits] = useState<string[]>(() => Array<string>(CODE_LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    stateEmail || queryEmail
      ? "Account created — enter the 6-digit code we emailed you."
      : "",
  );
  const boxesRef = useRef<Array<HTMLInputElement | null>>([]);
  const emailId = useId();

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const code = digits.join("");
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const focusBox = (i: number) => {
    const el = boxesRef.current[Math.max(0, Math.min(CODE_LEN - 1, i))];
    el?.focus();
    el?.select();
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < CODE_LEN - 1) focusBox(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setDigits((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
      } else if (i > 0) {
        focusBox(i - 1);
        setDigits((prev) => {
          const next = [...prev];
          next[i - 1] = "";
          return next;
        });
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight" && i < CODE_LEN - 1) {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LEN);
    if (!text) return;
    e.preventDefault();
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LEN; i++) next[i] = text[i] ?? next[i] ?? "";
      return next;
    });
    focusBox(Math.min(text.length, CODE_LEN - 1));
  };

  /** verifyOtp creates a session — sign it back out so the flow lands
      on /login exactly as designed (verified → sign in with password). */
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || resending) return;
    setError("");
    if (!isEmail(email)) {
      setError("Enter the email address you signed up with.");
      return;
    }
    if (code.length < CODE_LEN) {
      setError("Enter the full 6-digit code from your email.");
      focusBox(code.length);
      return;
    }
    setBusy(true);
    try {
      await verifyCoachOtp(email.trim(), code);
      try {
        await signOut();
      } catch {
        /* non-fatal — the login page boots signed-out anyway */
      }
      navigate(`/login?verified=1&email=${encodeURIComponent(email.trim().toLowerCase())}`, {
        replace: true,
      });
    } catch (err) {
      const msg = errorMessage(err);
      setAttempts((a) => a + 1);
      if (msg.includes("ALREADY_VERIFIED")) {
        navigate(`/login?verified=1&email=${encodeURIComponent(email.trim().toLowerCase())}`, {
          replace: true,
        });
        return;
      }
      setError(msg);
      // Wrong code → clear boxes and refocus first for a fast retry.
      if (/invalid code/i.test(msg)) {
        setDigits(Array<string>(CODE_LEN).fill(""));
        focusBox(0);
      }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (resending || cooldown > 0) return;
    setError("");
    if (!isEmail(email)) {
      setError("Enter the email address you signed up with first.");
      return;
    }
    setResending(true);
    try {
      await resendCoachOtp(email.trim());
      setNotice(`New code sent to ${email.trim().toLowerCase()} — check your inbox (and spam).`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="noise relative flex min-h-screen flex-col overflow-hidden">
      <Seo page="verify" />
      <div className="app-glow pointer-events-none fixed inset-0" />
      <div className="dot-grid pointer-events-none fixed inset-0" />

      <main id="main-content" className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center justify-center px-5 py-12 lg:px-8">
        <div className="rise w-full max-w-[440px] flex-none">
          <Link
            to="/signup"
            className="mb-4 inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-2 py-1 text-[13px] font-bold text-mist-400 transition hover:text-volt-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            Back to sign up
          </Link>

          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-night-900/75 p-6 shadow-xl backdrop-blur-xl sm:p-8">
            <span
              aria-hidden="true"
              className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-volt-400/60 to-transparent"
            />
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-volt-400 text-night-950">
                <MailCheck className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-[20px] font-extrabold tracking-tight text-mist-100">
                  Check your email
                </p>
                <p className="mt-0.5 text-[13px] leading-5 text-mist-400">
                  We sent a 6-digit code to verify it&apos;s you.
                </p>
              </div>
            </div>

            <form onSubmit={(ev) => void submit(ev)} className="grid gap-4">
              <div>
                <label htmlFor={emailId} className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-mist-400">
                  Email
                </label>
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!error}
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-night-900/80 px-4 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 hover:border-white/[0.14] focus:border-volt-400/60 focus:shadow-[0_0_0_3px_rgba(205,241,75,0.12)]"
                />
              </div>

              <div>
                <label
                  id="otp-label"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-mist-400"
                >
                  6-digit code
                </label>
                <div
                  role="group"
                  aria-labelledby="otp-label"
                  className="flex items-center justify-between gap-2"
                  onPaste={handlePaste}
                >
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        boxesRef.current[i] = el;
                      }}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      aria-label={`Digit ${i + 1} of 6`}
                      aria-invalid={!!error}
                      className="h-12 w-full min-w-0 rounded-xl border border-white/[0.08] bg-night-950 text-center font-display text-xl font-bold text-mist-100 outline-none transition hover:border-white/[0.14] focus:border-volt-400/70 focus:shadow-[0_0_0_3px_rgba(205,241,75,0.14)] aria-[invalid=true]:border-danger-400/60"
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs leading-5 text-mist-500">
                  Tip: you can paste the whole code at once. It expires after a while — resend if needed.
                </p>
              </div>

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
                  {attempts >= 3 && /invalid code|expired/i.test(error) ? " If it's not arriving, check spam or resend a fresh code." : ""}
                </p>
              )}

              <button type="submit" className={`${btnPrimary} h-12 w-full text-[15px]`} disabled={busy || code.length < CODE_LEN}>
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    Verify email
                    <ArrowRight className="h-5 w-5 rtl:rotate-180" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void resend()}
                disabled={resending || cooldown > 0}
                className={`${btnSecondary} h-11 w-full text-sm`}
              >
                {resending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : cooldown > 0 ? (
                  <>Resend code in {cooldown}s</>
                ) : (
                  <>Resend code</>
                )}
              </button>

              <p className="text-center text-[13px] text-mist-500">
                Used a wrong email?{" "}
                <Link to="/signup" className="font-bold text-mist-300 transition hover:text-volt-300">
                  Create the account again
                </Link>
              </p>
            </form>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-mist-500">
            <Dumbbell className="h-3.5 w-3.5" />
            Protected by your workspace · Secured by Supabase
          </p>
        </div>
      </main>
    </div>
  );
}
