/**
 * Google OAuth 2.0 (Google Identity Services — token flow).
 *
 * This is what powers the "Link with Google" button. No secret ever lives in
 * the frontend: an OAuth *client id* is public by design, and the access token
 * is short-lived, scoped to the coach's own spreadsheets, granted by the coach
 * through Google's consent screen, and revocable from their Google account.
 *
 * The token is kept in memory only. When it expires it is refreshed silently —
 * if the coach still has a Google session and already granted consent, the
 * refresh happens with no UI at all.
 */

const GIS_SRC = "https://accounts.google.com/gsi/client";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/** Refresh a little early so a call never fires with a token about to die. */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * The OAuth Client ID is baked into the app, so the coach never has to paste or
 * configure one. An OAuth *client id* is public by design (it identifies the
 * application, it is NOT a secret) — the actual credential is the short-lived
 * access token, which only exists after the coach explicitly consents through
 * Google's sign-in screen and can be revoked from their Google account at any
 * time.
 *
 * A project can override this once (e.g. with its own registered client id) via
 * the optional `VITE_GOOGLE_CLIENT_ID` env var without touching any code.
 */
const DEFAULT_CLIENT_ID = "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com";

/** Returns the client id to use: the embedded default, or an explicit override. */
function resolveClientId(clientId?: string): string {
  return clientId && clientId.trim() ? clientId.trim() : DEFAULT_CLIENT_ID;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface OAuth2Namespace {
  initTokenClient: (cfg: TokenClientConfig) => { requestAccessToken: (over?: { prompt?: string }) => void };
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: OAuth2Namespace } };
  }
}

let gisPromise: Promise<OAuth2Namespace> | null = null;

function loadGIS(): Promise<OAuth2Namespace> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google.accounts.oauth2);
      else reject(new Error("Google Identity Services loaded but is unavailable."));
    };
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Couldn't load Google sign-in. Check your network or ad-blocker and try again."));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

interface CachedToken {
  clientId: string;
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;

function requestToken(clientId: string, prompt: string): Promise<{ token: string; expiresAt: number }> {
  return new Promise(async (resolve, reject) => {
    let oauth2: OAuth2Namespace;
    try {
      oauth2 = await loadGIS();
    } catch (e) {
      reject(e);
      return;
    }
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      prompt,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || "Google sign-in failed."));
        } else {
          resolve({
            token: resp.access_token,
            expiresAt: Date.now() + ((resp.expires_in ?? 3600) * 1000 - EXPIRY_BUFFER_MS),
          });
        }
      },
      error_callback: (err) => {
        reject(
          new Error(
            err?.type === "popup_closed"
              ? "The Google sign-in window was closed before finishing."
              : err?.message || "Google sign-in was cancelled.",
          ),
        );
      },
    });
    client.requestAccessToken();
  });
}

/**
 * Explicit user action — the "Link with Google" button. Forces the consent
 * screen so the coach clearly sees the spreadsheet permission being granted.
 */
export async function linkWithGoogle(clientId?: string): Promise<void> {
  const id = resolveClientId(clientId);
  const t = await requestToken(id, "consent");
  cached = { clientId: id, token: t.token, expiresAt: t.expiresAt };
}

/**
 * Returns a valid access token, refreshing silently when the cached one has
 * expired. With an active Google session + prior consent this shows no UI.
 */
export async function getValidToken(clientId?: string, force = false): Promise<string> {
  const id = resolveClientId(clientId);
  if (!force && cached && cached.clientId === id && Date.now() < cached.expiresAt) {
    return cached.token;
  }
  const t = await requestToken(id, "");
  cached = { clientId: id, token: t.token, expiresAt: t.expiresAt };
  return t.token;
}

export function clearToken(): void {
  cached = null;
}
