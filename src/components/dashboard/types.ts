import type { Client } from "../../types";

export type Severity = "high" | "med" | "low";

export interface AttentionItem {
  key: string;
  client: Client;
  severity: Severity;
  title: string;
  detail: string;
  meta: string;
  actionLabel: string;
  run: () => void;
  sort: number;
}

export interface ReviewRow {
  client: Client;
  reason: string;
  reasonTone: Severity;
  status: string;
  lastActivity: string;
  actionLabel: string;
  run: () => void;
  sort: number;
}

export const SEV_DOT: Record<Severity, string> = {
  high: "bg-danger-400",
  med: "bg-warn-400",
  low: "bg-mist-400",
};

export const SEV_TEXT: Record<Severity, string> = {
  high: "text-danger-300",
  med: "text-warn-300",
  low: "text-mist-300",
};
