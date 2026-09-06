/* ================================================================
   VERRAA — public landing header (sticky, responsive, no admin link).
   CTAs use the real auth routes: /signup and /login.
   ================================================================ */

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Dumbbell, Menu, X } from "lucide-react";
import { btnPrimary } from "../ui";

const NAV = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How It Works" },
  { id: "pricing", label: "Pricing" },
] as const;

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  const goSection = (id: string) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate(`/#${id}`);
    } else {
      scrollToSection(id);
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
        scrolled || open ? "border-white/[0.07] bg-night-950/85 backdrop-blur-xl" : "border-transparent bg-night-950/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-5 sm:px-6">
        <Link to="/" aria-label="VERRAA — home" className="flex min-w-0 items-center gap-2.5 rounded-xl">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt-400 text-night-950 shadow-[0_8px_24px_-10px_rgba(205,241,75,0.55)]">
            <Dumbbell className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block font-display text-[21px] font-bold uppercase tracking-wide text-mist-100">
              Verraa
            </span>
            <span className="mt-0.5 hidden text-[9px] font-bold uppercase tracking-[0.28em] text-mist-500 sm:block">
              Coaching OS
            </span>
          </span>
        </Link>

        <nav aria-label="Primary" className="ms-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => goSection(n.id)}
              className="cursor-pointer rounded-xl px-3.5 py-2 text-sm font-semibold text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="ms-auto hidden items-center gap-2 md:flex">
          <Link
            to="/login"
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-xl px-4 text-sm font-bold text-mist-300 transition hover:bg-white/[0.05] hover:text-mist-100"
          >
            Sign In
          </Link>
          <Link to="/signup" className={`${btnPrimary} !min-h-[40px] !py-2 text-sm`}>
            Get Started <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>

        <div className="ms-auto flex items-center gap-2 md:hidden">
          <Link to="/signup" className={`${btnPrimary} !min-h-[38px] !px-3.5 !py-1.5 !text-[13px]`}>
            Get Started
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-mist-200 transition hover:bg-white/[0.06]"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade border-t border-white/[0.06] bg-night-950/95 backdrop-blur-xl md:hidden">
          <nav aria-label="Mobile" className="mx-auto grid w-full max-w-6xl gap-1 px-5 py-4 sm:px-6">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => goSection(n.id)}
                className="flex min-h-[48px] w-full cursor-pointer items-center rounded-xl px-3 text-start text-[15px] font-bold text-mist-200 transition hover:bg-white/[0.05] hover:text-mist-100"
              >
                {n.label}
              </button>
            ))}
            <Link
              to="/login"
              className="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-[15px] font-bold text-mist-100 transition hover:bg-white/[0.06]"
            >
              Sign In
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
