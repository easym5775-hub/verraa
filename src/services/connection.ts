import type { ConnectionConfig } from "./dataProvider";

/**
 * Connection metadata lives in its own localStorage key, separate from the data
 * cache. It stores only the OAuth client id, the spreadsheet id/url and the
 * coach id — never a secret and never the (short-lived, in-memory) access token.
 */

const CONN_KEY = "forge-conn-v1";

export interface StoredConnection {
  config: ConnectionConfig | null;
  lastSync: string | null;
}

export function loadStoredConnection(): StoredConnection {
  try {
    const raw = localStorage.getItem(CONN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredConnection;
      if (parsed && typeof parsed === "object") {
        return { config: parsed.config ?? null, lastSync: parsed.lastSync ?? null };
      }
    }
  } catch {
    /* corrupted — treat as disconnected */
  }
  return { config: null, lastSync: null };
}

export function saveStoredConnection(stored: StoredConnection): void {
  try {
    localStorage.setItem(CONN_KEY, JSON.stringify(stored));
  } catch {
    /* non-fatal */
  }
}

export function clearStoredConnection(): void {
  try {
    localStorage.removeItem(CONN_KEY);
  } catch {
    /* non-fatal */
  }
}
