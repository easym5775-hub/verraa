/* ================================================================
   FORGE — "Remember me" session persistence.
   • remember = true  → the session lives in localStorage and survives
     a browser restart.
   • remember = false → the session lives in sessionStorage and dies
     when the tab/window closes.
   The preference itself is always kept in localStorage (it is not
   sensitive) so the storage adapter knows where to look on reload.
   ================================================================ */

const REMEMBER_KEY = "forge-remember-v1";

export function setRemember(value: boolean): void {
  try {
    localStorage.setItem(REMEMBER_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function getRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true; // default to remembering when storage is blocked
  }
}

/** Where the active session should live, based on the preference. */
function target(): Storage {
  return getRemember() ? localStorage : sessionStorage;
}

/**
 * A Supabase-compatible storage adapter that honours the remember
 * preference. Reads probe sessionStorage first (a still-live non-remembered
 * session wins), then fall back to localStorage.
 */
export const rememberAwareStorage = {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      target().setItem(key, value);
      // Keep the two stores mutually exclusive so a stale session in the
      // other store can never shadow the current one.
      const other = target() === localStorage ? sessionStorage : localStorage;
      other.removeItem(key);
    } catch {
      /* storage unavailable — non-fatal */
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      /* storage unavailable — non-fatal */
    }
  },
};
