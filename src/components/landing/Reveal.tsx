/* ================================================================
   VERRAA — landing shared bits: scroll-reveal helper + section shell.
   Subtle fade-up only; fully disabled under prefers-reduced-motion
   (the global CSS already neutralizes transitions there).
   ================================================================ */

import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -48px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionShell({
  id,
  eyebrow,
  title,
  accent,
  sub,
  children,
  labelledBy,
  step,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  accent?: string;
  sub?: string;
  children: ReactNode;
  labelledBy?: string;
  /** Editorial section number, e.g. "01" — rendered before the eyebrow. */
  step?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className="relative scroll-mt-24 px-5 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">
            {step && (
              <span className="me-2 inline-block font-display text-[13px] font-bold tracking-[0.1em] text-volt-400" aria-hidden="true">
                {step}
              </span>
            )}
            {step && (
              <span className="me-2 text-mist-500" aria-hidden="true">
                /
              </span>
            )}
            {eyebrow}
          </p>
          <h2 id={labelledBy} className="text-balance mt-3 text-[28px] font-extrabold leading-[1.08] tracking-tight text-mist-100 sm:text-[36px]">
            {title} {accent && <span className="text-volt-400">{accent}</span>}
          </h2>
          {sub && <p className="text-balance mx-auto mt-3 max-w-xl text-[15px] leading-7 text-mist-400">{sub}</p>}
        </Reveal>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}
