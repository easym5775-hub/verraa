/* ================================================================
   VERRAA — central SEO config. Single source of truth.
   HOW TO SET YOUR DOMAIN (pick one):
   1) Recommended: add env var VITE_SITE_URL=https://your-domain.com
      in Vercel → Project → Settings → Environment Variables
      (+ locally in .env), redeploy.
   2) Or edit FALLBACK_SITE_URL below directly.
   No other file needs the domain hardcoded except index.html
   (canonical/og tags) + public/robots.txt + public/sitemap.xml.
   ================================================================ */

const FALLBACK_SITE_URL = "https://verraa.vercel.app";

export const SITE_URL: string = (
  import.meta.env.VITE_SITE_URL ??
  FALLBACK_SITE_URL
)
  .trim()
  .replace(/\/+$/, "");

export const SITE_NAME = "VERRAA";
export const SITE_LOCALE = "en_US";
export const SITE_LOCALE_ALT = "ar_EG";
export const OG_IMAGE = `${SITE_URL}/og-image.svg`;
export const TWITTER_HANDLE = "@verraa";

export type SeoPageKey =
  | "home"
  | "coach-mode"
  | "client-mode"
  | "login"
  | "signup"
  | "privacy"
  | "terms"
  | "app";

interface SeoPage {
  title: string;
  description: string;
  path: string;
  index: boolean;
}

export const SEO_PAGES: Record<SeoPageKey, SeoPage> = {
  home: {
    title: "VERRAA — Personal Trainer Software & Coaching Client Management Platform",
    description:
      "VERRAA is the operating system for modern coaches: manage clients, workout plans, nutrition, check-ins, subscriptions & payments from one powerful platform.",
    path: "/",
    index: true,
  },
  login: {
    title: "Sign In — VERRAA Coaching OS",
    description:
      "Sign in to your VERRAA coaching workspace to manage clients, plans, check-ins and subscriptions.",
    path: "/login",
    index: false,
  },
  "coach-mode": {
    title: "Coach Mode — VERRAA: Dashboard, Clients, Plans & Payments",
    description:
      "Explore VERRAA Coach Mode: a command-center dashboard, client roster, check-in inbox, workout plans, nutrition, sessions, payments and direct client chat.",
    path: "/coach-mode",
    index: true,
  },
  "client-mode": {
    title: "Client Mode — The VERRAA App Your Clients Get",
    description:
      "See what your clients experience in VERRAA Client Mode: today's training, meals, 60-second check-ins, strength tracking, progress charts and direct coach chat.",
    path: "/client-mode",
    index: true,
  },
  signup: {
    title: "Get Started — Create Your VERRAA Coach Account",
    description:
      "Create your VERRAA coach account and run your coaching business from one calm workspace. Start with the Free plan.",
    path: "/signup",
    index: false,
  },
  privacy: {
    title: "Privacy Policy — VERRAA",
    description:
      "How VERRAA handles account and client data: what we collect, who can see it, and how coach and client workspaces stay private.",
    path: "/privacy",
    index: true,
  },
  terms: {
    title: "Terms of Service — VERRAA",
    description:
      "The terms for using VERRAA: plans billed monthly in EGP, plan capacity limits, and coach account responsibilities.",
    path: "/terms",
    index: true,
  },
  // Private app screens (coach / client / owner dashboards) — never indexed.
  app: {
    title: "VERRAA App",
    description: "Your private VERRAA coaching workspace.",
    path: "/",
    index: false,
  },
};

export function canonicalFor(path: string): string {
  if (path.startsWith("/#") || path.startsWith("#")) return `${SITE_URL}/`;
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}
