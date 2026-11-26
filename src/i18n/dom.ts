/* ================================================================
   VERRAA — dictionary translator for the app UI.
   When the language is Arabic it swaps exact English UI strings
   (text nodes + placeholder / aria-label / title / alt) for Arabic.
   Original text is remembered so switching back restores it.
   Anything not in the dictionary stays untouched — user data
   (names, notes, numbers) is never rewritten.
   ================================================================ */

import { AR_APP } from "./ar-app";
import { AR_SITE } from "./ar-site";

const DICT: Record<string, string> = { ...AR_APP, ...AR_SITE };

const MONTHS: Record<string, string> = {
  Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو", Jun: "يونيو",
  Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر", Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
};
const MONTHS_FULL: Record<string, string> = {
  January: "يناير", February: "فبراير", March: "مارس", April: "أبريل", June: "يونيو", July: "يوليو",
  August: "أغسطس", September: "سبتمبر", October: "أكتوبر", November: "نوفمبر", December: "ديسمبر",
};
const DAYS: Record<string, string> = {
  Mon: "الاثنين", Tue: "الثلاثاء", Wed: "الأربعاء", Thu: "الخميس", Fri: "الجمعة", Sat: "السبت", Sun: "الأحد",
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^(\d+) days? remaining$/, (m) => `متبقي ${m[1]} يوم`],
  [/^Expired (\d+) days? ago$/, (m) => `انتهى من ${m[1]} يوم`],
  [/^(\d+) Clients?$/, (m) => `${m[1]} عميل`],
  [/^(\d+) overdue payments?$/, (m) => `${m[1]} مدفوعات متأخرة`],
  [/^(\d+) need attention$/, (m) => `${m[1]} محتاجين متابعة`],
  [/^(\d+) renewals? due this week$/, (m) => `${m[1]} تجديدات هذا الأسبوع`],
  [/^(\d+) sessions? today · next at (.+)$/i, (m) => `${m[1]} جلسة النهاردة · التالية ${m[2]}`],
  [/^Next at (.+)$/, (m) => `التالية ${m[1]}`],
  [/^(\d+) in the last 7 days · View feed$/, (m) => `${m[1]} في آخر 7 أيام · عرض`],
  [/^(\d+) \/ (\d+) clients · (.+)$/, (m) => `${m[1]} / ${m[2]} عميل · ${DICT[m[3]] ?? m[3]}`],
  [/^(\d+) of (\d+) client slots used$/, (m) => `${m[1]} من ${m[2]} مكان عملاء مستخدم`],
  [/^Show (\d+) more (clients|alerts|activities)$/, (m) => `عرض ${m[1]} أكتر`],
  [/^(\d[\d,]*) EGP$/, (m) => `${m[1]} ج.م`],
  [/^(\d[\d,]*) EGP outstanding$/, (m) => `${m[1]} ج.م مستحقة`],
  [/^(\d[\d,]*) EGP · (.+)$/, (m) => `${m[1]} ج.م · ${DICT[m[2]] ?? m[2]}`],
  [/^(\d[\d,]*) paid of (\d[\d,]*)$/, (m) => `مدفوع ${m[1]} من ${m[2]}`],
  [/^(\d[\d,]*) kcal$/, (m) => `${m[1]} سعرة`],
  [/^(\d[\d,]*) kcal remaining$/, (m) => `متبقي ${m[1]} سعرة`],
  [/^(\d+)g remaining$/, (m) => `متبقي ${m[1]} جم`],
  [/^(\d+) days planned$/, (m) => `${m[1]} أيام متخطط لها`],
  [/^Delete (.+)$/, (m) => `حذف ${m[1]}`],
  [/^Edit (.+)$/, (m) => `تعديل ${m[1]}`],
  [/^Open (.+)'s (meals|profile|workout plan)$/, (m) => `فتح ${m[2] === "meals" ? "وجبات" : m[2] === "profile" ? "ملف" : "تمرين"} ${m[1]}`],
  [/^More actions for (.+)$/, (m) => `خيارات أكتر لـ ${m[1]}`],
  [/^Weight trend for (.+)$/, (m) => `منحنى وزن ${m[1]}`],
  [/^Session booked with (.+)$/, (m) => `تم حجز جلسة مع ${m[1]}`],
  [/^Good (morning|afternoon|evening)$/, (m) => (m[1] === "morning" ? "صباح الخير" : m[1] === "afternoon" ? "مساء الخير" : "مساء الخير")],
  [/^Today's meals · (.+)$/, (m) => `وجبات النهاردة · ${m[1]}`],
  [/^Mood (\d)\/5$/, (m) => `المزاج ${m[1]}/5`],
  [/^(\d+) logged in total.*$/, (m) => `${m[1]} تسجيل إجمالي: الوزن والمزاج والماية وإتمام التمرين`],
  [/^(Active|Expiring|Expired|Paused): (\d+) clients?$/, (m) => `${DICT[m[1]] ?? m[1]}: ${m[2]} عميل`],
  [/^Client usage (\d+) of (\d+)$/, (m) => `استخدام العملاء ${m[1]} من ${m[2]}`],
  [/^Subscription expired · \+(\d+) more$/, (m) => `الاشتراك انتهى · +${m[1]} أخرى`],
  [/^(.+) · Today$/, (m) => `${m[1]} · النهاردة`],
  [/^(\d[\d,]*) EGP · Monthly$/, (m) => `${m[1]} ج.م · شهري`],
  [/^Monthly$/, () => "شهري"],
  [/^© (\d{4}) VERRAA\. All rights reserved\.$/, (m) => `© ${m[1]} VERRAA. جميع الحقوق محفوظة.`],
];

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE", "NOSCRIPT"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;

type Rec = { orig: string; tr: string };
const textRec = new WeakMap<Node, Rec>();
const attrRec = new WeakMap<Element, Record<string, Rec>>();
let observer: MutationObserver | null = null;
let active = false;

export function translateString(s: string): string | null {
  const lead = s.match(/^\s*/)![0];
  const trail = s.match(/\s*$/)![0];
  const core = s.trim().replace(/\s+/g, " ");
  if (!core) return null;
  let out: string | undefined = DICT[core];
  if (out === undefined) {
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) {
        out = fn(m);
        break;
      }
    }
  }
  if (out === undefined && /\d/.test(core)) {
    // generic pass for dates / times / units on untranslated numeric strings
    let g = core;
    g = g.replace(/\b(\d{1,2}:\d{2}) ?AM\b/g, "$1 ص").replace(/\b(\d{1,2}:\d{2}) ?PM\b/g, "$1 م");
    g = g.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, mo) => `${d} ${MONTHS[mo]}`);
    g = g.replace(/\bEGP\b/g, "ج.م").replace(/\bkg\b/g, "كجم").replace(/\bkcal\b/g, "سعرة");
    if (g !== core) out = g;
  }
  if (out === undefined) {
    const full = MONTHS_FULL[core] ?? DAYS[core];
    if (full) out = full;
  }
  if (out !== undefined) out = out.replace(/\b(\d{1,2}:\d{2}) ?AM\b/g, "$1 ص").replace(/\b(\d{1,2}:\d{2}) ?PM\b/g, "$1 م");
  return out === undefined ? null : lead + out + trail;
}

function skip(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.hasAttribute("data-no-translate")) return true;
  }
  return false;
}

function doText(n: Text) {
  const parent = n.parentElement;
  if (!parent || skip(parent)) return;
  const rec = textRec.get(n);
  if (rec && n.data === rec.tr) return; // our own write
  const src = n.data;
  const tr = translateString(src);
  if (tr === null || tr === src) {
    if (rec) textRec.delete(n);
    return;
  }
  textRec.set(n, { orig: src, tr });
  n.data = tr;
}

function doAttrs(el: Element) {
  if (skip(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const recs = attrRec.get(el) ?? {};
    const rec = recs[a];
    if (rec && v === rec.tr) continue;
    const tr = translateString(v);
    if (tr === null || tr === v) {
      if (rec) delete recs[a];
      continue;
    }
    recs[a] = { orig: v, tr };
    attrRec.set(el, recs);
    el.setAttribute(a, tr);
  }
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    doText(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  doAttrs(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else doAttrs(n as Element);
  }
}

function restore(root: Node) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null;
  while ((n = w.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      const rec = textRec.get(n);
      if (rec && (n as Text).data === rec.tr) (n as Text).data = rec.orig;
      textRec.delete(n);
    } else {
      const el = n as Element;
      const recs = attrRec.get(el);
      if (recs) {
        for (const [a, rec] of Object.entries(recs)) if (el.getAttribute(a) === rec.tr) el.setAttribute(a, rec.orig);
        attrRec.delete(el);
      }
    }
  }
}

function start() {
  if (observer || typeof document === "undefined") return;
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") doText(m.target as Text);
      else if (m.type === "attributes") doAttrs(m.target as Element);
      else m.addedNodes.forEach((n) => walk(n));
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS],
  });
}

function stop() {
  observer?.disconnect();
  observer = null;
  restore(document.body);
}

/** Start/stop the translator for the given language (safe before body exists). */
export function syncDomTranslator(lang: "en" | "ar") {
  const on = lang === "ar";
  if (on === active) return;
  active = on;
  const run = () => (on ? start() : stop());
  if (document.body) run();
  else document.addEventListener("DOMContentLoaded", run, { once: true });
}
