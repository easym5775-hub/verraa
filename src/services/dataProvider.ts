import type {
  CheckIn,
  Client,
  Exercise,
  Meal,
  Payment,
  PlanItem,
  Session,
  Subscription,
} from "../types";

/**
 * Abstract persistence boundary.
 *
 * The UI and the store only ever talk to a `DataProvider`. The current
 * implementation is GoogleSheetsProvider, but a SupabaseProvider (or any other
 * backend) can implement this exact interface and be swapped in without
 * touching a single component.
 */

export type SyncStatus = "local" | "idle" | "syncing" | "error";

export interface ConnectionConfig {
  /**
   * Google OAuth 2.0 Client ID. Optional — the app ships with a built-in client
   * id, so the coach never has to supply one. A client id is public by design
   * (it identifies the application, it is NOT a secret); the real credential is
   * the short-lived access token granted via Google's consent screen.
   */
  clientId?: string;
  /** The spreadsheet that acts as the database. */
  spreadsheetId: string;
  /** Full spreadsheet URL (used for "Open Google Sheet"). */
  sheetUrl: string;
  /** Identity used to isolate this coach's rows (every record carries coach_id). */
  coachId: string;
}

export interface SyncInfo {
  status: SyncStatus;
  /** Number of entity operations waiting to reach the database. */
  pending: number;
  /** ISO timestamp of the last successful remote write/load. */
  lastSync: string | null;
  /** Human readable error when status === "error". */
  error: string | null;
}

/** The collections the application actively reads and writes. */
export interface RemoteData {
  clients: Client[];
  exercises: Exercise[];
  plans: PlanItem[];
  checkIns: CheckIn[];
  meals: Meal[];
  subscriptions: Subscription[];
  payments: Payment[];
  sessions: Session[];
}

export type EntityName =
  | "client"
  | "exercise"
  | "plan"
  | "checkin"
  | "meal"
  | "subscription"
  | "payment"
  | "session";

/**
 * Entity-level mutation descriptors. The provider is responsible for mapping an
 * entity to its physical storage (sheet + row, table + record, ...).
 */
export type EntityOp =
  | { type: "upsert"; entity: "client"; record: Client }
  | { type: "upsert"; entity: "exercise"; record: Exercise }
  | { type: "upsert"; entity: "plan"; record: PlanItem }
  | { type: "upsert"; entity: "checkin"; record: CheckIn }
  | { type: "upsert"; entity: "meal"; record: Meal }
  | { type: "upsert"; entity: "subscription"; record: Subscription }
  | { type: "upsert"; entity: "payment"; record: Payment }
  | { type: "upsert"; entity: "session"; record: Session }
  | { type: "remove"; entity: EntityName; id: string }
  | { type: "removeWhere"; entity: EntityName; field: "clientId" | "exerciseId"; value: string };

export interface DataProvider {
  readonly kind: string;
  /** Validate the connection (throws on failure). */
  ping(cfg: ConnectionConfig): Promise<void>;
  /** Create any missing tabs/headers without touching existing data. Returns tab names. */
  init(cfg: ConnectionConfig): Promise<string[]>;
  /** Read every record owned by the coach. */
  load(cfg: ConnectionConfig): Promise<RemoteData>;
  /** Apply a batch of entity mutations. Throws on failure (caller retries). */
  apply(cfg: ConnectionConfig, ops: EntityOp[]): Promise<void>;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return typeof e === "string" ? e : "Unexpected error";
}
