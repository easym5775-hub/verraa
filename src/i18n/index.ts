/* ================================================================
   VERRAA — language preference (English / Arabic).
   The choice is stored in localStorage and applied as `lang` + `dir`
   on <html>, so the whole UI flips direction. Order of precedence:
   ?lang=ar|en in the URL → saved choice → browser language → English.
   Search engines and first-time visitors with an English browser keep
   getting English; Arabic browsers open the Arabic site.
   `useLang().t(en, ar)` is used where a view writes its own copy;
   the rest of the app is covered by the dictionary translator in
   ./dom.ts (exact-text lookups, user data is never touched).
   ================================================================ */

import { useCallback, useSyncExternalStore } from "react";
import { syncDomTranslator } from "./dom";

export type Lang = "en" | "ar";

const KEY = "verraa-lang-v1";
const subs = new Set<() => void>();
let current: Lang = "en";

export function resolveInitialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "ar" || q === "en") {
      localStorage.setItem(KEY, q);
      return q;
    }
  } catch {
    /* ignore */
  }
  try {
    const s = localStorage.getItem(KEY);
    if (s === "ar" || s === "en") return s;
  } catch {
    /* storage unavailable — fall through */
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "") || "";
  return nav.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function applyToDocument(l: Lang): void {
  const root = document.documentElement;
  root.lang = l;
  root.dir = l === "ar" ? "rtl" : "ltr";
  syncDomTranslator(l);
}

/** Call once before the first render. */
export function initLang(): Lang {
  current = resolveInitialLang();
  applyToDocument(current);
  return current;
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* non-fatal */
  }
  applyToDocument(l);
  subs.forEach((f) => f());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, () => "en" as Lang);
  const t = useCallback((en: string, ar: string) => (lang === "ar" ? ar : en), [lang]);
  return { lang, isAr: lang === "ar", setLang, toggle: () => setLang(lang === "ar" ? "en" : "ar"), t };
}
