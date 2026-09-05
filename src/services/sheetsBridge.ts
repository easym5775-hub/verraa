import { uid } from "../lib";

/**
 * FORGE Sheets Bridge client.
 *
 * The bridge is a tiny Google Apps Script Web App (public/apps-script/forge-bridge.gs)
 * deployed once by whoever installs FORGE. It needs NO OAuth client and NO API
 * keys: Google's built-in Apps Script consent screen handles authorisation, and
 * the script then runs as the signed-in coach — so it can only touch sheets
 * that coach can already access.
 *
 * Linking flow (one click for the coach):
 *   app opens popup → Google consent (automatic) → bridge creates/opens the
 *   database sheet + the 16 tabs → popup redirects back to the app with a
 *   nonce-signed result → app stores the connection and starts syncing.
 */

const BRIDGE_KEY = "forge-bridge-url-v1";

export function getBridgeUrl(): string {
  try {
    return localStorage.getItem(BRIDGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveBridgeUrl(url: string): void {
  try {
    localStorage.setItem(BRIDGE_KEY, url.trim().replace(/\/$/, ""));
  } catch {
    /* non-fatal */
  }
}

export function normalizeBridgeUrl(raw: string): string | null {
  const url = raw.trim().replace(/\/$/, "");
  if (/^https:\/\/script\.google(usercontent)?\.com\/macros\/.+\/exec$/i.test(url)) return url;
  return null;
}

export type LinkResult =
  | { ok: true; nonce: string; spreadsheetId: string; sheetUrl: string; title: string }
  | { ok: false; nonce: string; error: string };

/**
 * Opens the Google consent + linking popup and resolves when the bridge
 * redirects back with a nonce-signed result.
 */
export function linkViaPopup(opts: {
  bridgeUrl: string;
  mode: "new" | "existing";
  sheetUrl?: string;
}): Promise<LinkResult> {
  return new Promise((resolve, reject) => {
    const nonce = uid() + uid();
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({
      op: "link",
      mode: opts.mode,
      sheet: opts.sheetUrl ?? "",
      returnTo,
      nonce,
    });
    const url = `${opts.bridgeUrl.replace(/\/$/, "")}?${params.toString()}`;

    const popup = window.open(url, "forge-link", "width=520,height=680,menubar=no,toolbar=no");
    if (!popup) {
      reject(new Error("Pop-up blocked — allow pop-ups for this site, then press the button again."));
      return;
    }

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { forge?: string; nonce?: string; payload?: LinkResult } | null;
      if (!d || d.forge !== "forge-link" || d.nonce !== nonce || !d.payload) return;
      settled = true;
      cleanup();
      resolve(d.payload);
    };
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        try {
          popup.close();
        } catch {
          /* ignore */
        }
        reject(new Error("Linking timed out — please try again."));
      }
    }, 240_000);
    const poll = window.setInterval(() => {
      if (!popup.closed || settled) return;
      window.clearInterval(poll);
      // The redirect may still be loading — give it a short grace period.
      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error("The linking window was closed before finishing."));
        }
      }, 2500);
    }, 600);

    window.addEventListener("message", onMessage);
  });
}

/**
 * Runs once when the app starts: if this window was opened as the linking
 * popup (bridge redirected back with #forge-link=…), hand the result to the
 * opener window and close.
 */
export function respondToLinkRedirect(): boolean {
  const h = window.location.hash;
  const prefix = "#forge-link=";
  if (!h.startsWith(prefix)) return false;
  let payload: LinkResult | null = null;
  try {
    payload = JSON.parse(decodeURIComponent(h.slice(prefix.length))) as LinkResult;
  } catch {
    payload = null;
  }
  if (payload && window.opener) {
    window.opener.postMessage(
      { forge: "forge-link", nonce: payload.nonce, payload },
      window.location.origin,
    );
  }
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch {
    /* ignore */
  }
  if (window.opener) {
    window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* ignore */
      }
    }, 250);
  }
  return true;
}
