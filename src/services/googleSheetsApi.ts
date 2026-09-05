import type { ConnectionConfig } from "./dataProvider";
import { getValidToken } from "./googleOAuth";

/**
 * Direct Google Sheets API v4 client.
 *
 * Every call carries the coach's short-lived OAuth access token (obtained via
 * the "Link with Google" consent flow). If a call comes back 401 the token is
 * refreshed silently and the request retried once — so an expired token never
 * surfaces as a hard failure while the coach still has a valid Google session.
 */

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export type Row = Record<string, string | number | boolean>;

interface SheetMeta {
  properties: { sheetId: number; title: string };
}

async function call(
  cfg: ConnectionConfig,
  path: string,
  init?: RequestInit & { body?: string },
): Promise<unknown> {
  const attempt = async (token: string) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });

  let res = await attempt(await getValidToken(cfg.clientId));
  if (res.status === 401) {
    // Token expired — silent refresh and one retry.
    res = await attempt(await getValidToken(cfg.clientId, true));
  }
  if (!res.ok) {
    let msg = `Google Sheets error (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep default message */
    }
    if (res.status === 403) msg = `${msg} — make sure the sheet is shared with the linked Google account.`;
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const colLetter = (n: number): string => {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/* ------------------------------------------------------------------ */
/* Metadata / spreadsheet management                                   */
/* ------------------------------------------------------------------ */

export async function getMetadata(cfg: ConnectionConfig): Promise<{ title: string; sheets: SheetMeta[] }> {
  const j = (await call(cfg, `/${cfg.spreadsheetId}?fields=properties.title,sheets.properties`)) as {
    properties?: { title?: string };
    sheets?: SheetMeta[];
  };
  return { title: j.properties?.title ?? "Untitled", sheets: j.sheets ?? [] };
}

export async function createSpreadsheet(
  clientId: string | undefined,
  title: string,
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getValidToken(clientId);
  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties: { title } }),
  });
  if (!res.ok) {
    throw new Error(`Couldn't create a new spreadsheet (HTTP ${res.status}). Check the OAuth Client ID.`);
  }
  const j = (await res.json()) as { spreadsheetId: string; spreadsheetUrl: string };
  return { spreadsheetId: j.spreadsheetId, spreadsheetUrl: j.spreadsheetUrl };
}

export function spreadsheetIdFrom(input: string): string | null {
  const trimmed = input.trim();
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // A bare spreadsheet id is also accepted.
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

/* ------------------------------------------------------------------ */
/* Schema initialisation — never touches existing data                 */
/* ------------------------------------------------------------------ */

export async function initTabs(
  cfg: ConnectionConfig,
  schema: Record<string, string[]>,
): Promise<string[]> {
  const meta = await getMetadata(cfg);
  const existing = new Map(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const missing = Object.keys(schema).filter((name) => !existing.has(name));

  if (missing.length > 0) {
    await call(cfg, `/${cfg.spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
  }

  // Write headers only where the header row is still empty.
  for (const name of Object.keys(schema)) {
    const cols = schema[name];
    const range = `${name}!A1:${colLetter(cols.length)}1`;
    const current = (await call(cfg, `/${cfg.spreadsheetId}/values/${encodeURIComponent(range)}`)) as {
      values?: string[][];
    };
    const hasHeaders = (current.values?.[0] ?? []).some((c) => String(c ?? "").trim() !== "");
    if (!hasHeaders) {
      await call(cfg, `/${cfg.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: "PUT",
        body: JSON.stringify({ values: [cols] }),
      });
    }
  }
  return Object.keys(schema);
}

/* ------------------------------------------------------------------ */
/* Table-level operations (always scoped to the coach's rows)          */
/* ------------------------------------------------------------------ */

interface TableRead {
  headers: string[];
  /** 0-based data row index (relative to the first data row) → sheet row number. */
  rows: { sheetRow: number; values: (string | number | boolean)[] }[];
  sheetId: number;
}

async function readTable(cfg: ConnectionConfig, tab: string): Promise<TableRead> {
  const meta = await getMetadata(cfg);
  const sheet = meta.sheets.find((s) => s.properties.title === tab);
  if (!sheet) throw new Error(`Tab "${tab}" not found — reconnect to re-initialise the database.`);

  const j = (await call(cfg, `/${cfg.spreadsheetId}/values/${encodeURIComponent(tab)}`)) as {
    values?: (string | number | boolean)[][];
  };
  const all = j.values ?? [];
  const headers = (all[0] ?? []).map((h) => String(h ?? ""));
  const rows = all.slice(1).map((values, i) => ({ sheetRow: i + 2, values }));
  return { headers, rows, sheetId: sheet.properties.sheetId };
}

const cellAt = (values: (string | number | boolean)[], idx: number) =>
  idx >= 0 && idx < values.length ? values[idx] : "";

export async function readRecords(cfg: ConnectionConfig, tab: string): Promise<Row[]> {
  const { headers, rows } = await readTable(cfg, tab);
  const idIdx = headers.indexOf("id");
  const coachIdx = headers.indexOf("coach_id");
  const out: Row[] = [];
  for (const r of rows) {
    if (idIdx >= 0 && String(cellAt(r.values, idIdx) ?? "").trim() === "") continue;
    if (coachIdx >= 0 && String(cellAt(r.values, coachIdx)) !== cfg.coachId) continue;
    const obj: Row = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = cellAt(r.values, i);
    });
    out.push(obj);
  }
  return out;
}

function alignToHeaders(headers: string[], row: Row, coachId: string, createdAt: string): (string | number | boolean)[] {
  const now = new Date().toISOString();
  return headers.map((h) => {
    if (h === "coach_id") return coachId;
    if (h === "created_at") return createdAt;
    if (h === "updated_at") return now;
    const v = row[h];
    return v === undefined || v === null ? "" : (v as string | number | boolean);
  });
}

export async function upsertRow(cfg: ConnectionConfig, tab: string, row: Row): Promise<void> {
  const { headers, rows, } = await readTable(cfg, tab);
  const idIdx = headers.indexOf("id");
  const coachIdx = headers.indexOf("coach_id");
  const createdIdx = headers.indexOf("created_at");
  if (idIdx < 0) throw new Error(`Tab "${tab}" has no "id" column.`);

  const rowId = String(row.id);
  const existing = rows.find(
    (r) => String(cellAt(r.values, idIdx)) === rowId && (coachIdx < 0 || String(cellAt(r.values, coachIdx)) === cfg.coachId),
  );

  const createdAt = existing && createdIdx >= 0 ? String(cellAt(existing.values, createdIdx) || new Date().toISOString()) : new Date().toISOString();
  const aligned = [alignToHeaders(headers, row, cfg.coachId, createdAt)];
  const width = colLetter(headers.length);

  if (existing) {
    const range = `${tab}!A${existing.sheetRow}:${width}${existing.sheetRow}`;
    await call(cfg, `/${cfg.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: aligned }),
    });
  } else {
    await call(
      cfg,
      `/${cfg.spreadsheetId}/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: aligned }) },
    );
  }
}

export async function removeRow(cfg: ConnectionConfig, tab: string, id: string): Promise<void> {
  const { headers, rows, sheetId } = await readTable(cfg, tab);
  const idIdx = headers.indexOf("id");
  const coachIdx = headers.indexOf("coach_id");
  if (idIdx < 0) return;
  const target = rows.find(
    (r) => String(cellAt(r.values, idIdx)) === id && (coachIdx < 0 || String(cellAt(r.values, coachIdx)) === cfg.coachId),
  );
  if (!target) return;
  await deleteSheetRows(cfg, sheetId, [target.sheetRow]);
}

export async function removeWhere(cfg: ConnectionConfig, tab: string, field: string, value: string): Promise<void> {
  const { headers, rows, sheetId } = await readTable(cfg, tab);
  const fieldIdx = headers.indexOf(field);
  const coachIdx = headers.indexOf("coach_id");
  if (fieldIdx < 0) return;
  const targets = rows
    .filter(
      (r) =>
        String(cellAt(r.values, fieldIdx)) === value &&
        (coachIdx < 0 || String(cellAt(r.values, coachIdx)) === cfg.coachId),
    )
    .map((r) => r.sheetRow);
  if (targets.length) await deleteSheetRows(cfg, sheetId, targets);
}

async function deleteSheetRows(cfg: ConnectionConfig, sheetId: number, sheetRows: number[]): Promise<void> {
  // deleteDimension uses 0-based start indexes; delete bottom-up to keep them stable.
  const requests = [...sheetRows]
    .sort((a, b) => b - a)
    .map((row) => ({
      deleteDimension: {
        range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row },
      },
    }));
  await call(cfg, `/${cfg.spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}
