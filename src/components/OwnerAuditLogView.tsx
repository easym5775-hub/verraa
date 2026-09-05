/* ================================================================
   FORGE — Owner Audit Log View: Admin action history.
   ================================================================ */

import { useState, useMemo, useEffect } from "react";
import { useApp } from "../store";
import { OwnerPageHeader } from "./OwnerShell";
import { Search, Filter, FileText, Shield, Database, RefreshCw, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Dropdown, DropdownItem, Modal } from "./ui";
import { backend } from "../services/backend";
import { errorMessage } from "../lib";

type LogType = "admin" | "subscription";
type LogEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  performedBy: string | null;
  performedAt: string;
  // Subscription history specific
  subscriptionId?: string;
  planName?: string;
};

export function OwnerAuditLogView() {
  const { state, toast } = useApp();
  const [logType, setLogType] = useState<LogType>("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 25;

  // Fetch audit logs — real backend rows (RLS-scoped for owners).
  const fetchLogs = async (): Promise<LogEntry[]> => {
    setLoading(true);
    try {
      if (logType === "admin") {
        const rows = await backend.loadAuditLog(125);
        return rows.map((r) => {
          const rec = r as unknown as Record<string, unknown>;
          return {
            id: String(rec.id ?? ""),
            action: String(rec.action ?? "unknown"),
            targetType: String(rec.target_type ?? "unknown"),
            targetId: String(rec.target_id ?? ""),
            oldValue: (rec.old_value as Record<string, any> | null) ?? null,
            newValue: (rec.new_value as Record<string, any> | null) ?? null,
            performedBy: rec.performed_by ? String(rec.performed_by) : null,
            performedAt: String(rec.performed_at ?? new Date().toISOString()),
          } satisfies LogEntry;
        });
      }
      const rows = await backend.loadSubscriptionHistory();
      return rows.map((r) => {
        const rec = r as unknown as Record<string, unknown>;
        return {
          id: String(rec.id ?? ""),
          action: String(rec.action ?? "updated"),
          targetType: "subscription",
          targetId: String(rec.subscription_id ?? rec.id ?? ""),
          oldValue: (rec.old_value as Record<string, any> | null) ?? null,
          newValue: (rec.new_value as Record<string, any> | null) ?? null,
          performedBy: rec.performed_by ? String(rec.performed_by) : null,
          performedAt: String(rec.performed_at ?? new Date().toISOString()),
          subscriptionId: rec.subscription_id ? String(rec.subscription_id) : undefined,
        } satisfies LogEntry;
      });
    } catch (error) {
      toast(errorMessage(error), "warn");
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load logs on mount and when logType changes
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    fetchLogs().then(setLogs);
  }, [logType]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = searchQuery === "" ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.targetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.performedBy?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      
      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, actionFilter]);

  // Unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map((l) => l.action));
    return Array.from(actions).sort();
  }, [logs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      coach_activated: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      coach_suspended: "bg-danger-500/10 text-danger-300 border-danger-500/20",
      subscription_extended: "bg-volt-400/10 text-volt-300 border-volt-400/20",
      plan_changed: "bg-sky-400/10 text-sky-300 border-sky-400/20",
      coach_created: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      subscription_cancelled: "bg-warn-400/10 text-warn-300 border-warn-400/20",
      created: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      extended: "bg-volt-400/10 text-volt-300 border-volt-400/20",
      activated: "bg-moss-400/10 text-moss-300 border-moss-400/20",
      cancelled: "bg-warn-400/10 text-warn-300 border-warn-400/20",
      expired: "bg-danger-500/10 text-danger-300 border-danger-500/20",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[action] || "bg-night-600/30 text-mist-400 border-night-500/40"}`}>
        {action.replace(/_/g, " ")}
      </span>
    );
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = () => {
    fetchLogs().then(setLogs);
  };

  const handleViewDetails = (log: LogEntry) => {
    setSelectedLog(log);
  };

  return (
    <>
      <OwnerPageHeader
        title="Audit Log"
        sub="Track all administrative actions and subscription changes"
        action={
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="cursor-pointer rounded-xl border border-night-600 bg-night-800 px-3 py-1.5 text-xs font-bold text-mist-400 transition-all duration-200 hover:border-volt-400/40 hover:bg-volt-400/10 hover:text-volt-300 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* Log Type Tabs */}
      <div className="rise mt-6 flex gap-2 border-b border-night-700 pb-1">
        <button
          onClick={() => setLogType("admin")}
          className={`rounded-t-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
            logType === "admin"
              ? "bg-volt-400/10 text-volt-300 border-b-2 border-volt-400"
              : "text-mist-400 hover:text-mist-200"
          }`}
        >
          <Shield className="mr-2 inline h-4 w-4" />
          Admin Actions
        </button>
        <button
          onClick={() => setLogType("subscription")}
          className={`rounded-t-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
            logType === "subscription"
              ? "bg-volt-400/10 text-volt-300 border-b-2 border-volt-400"
              : "text-mist-400 hover:text-mist-200"
          }`}
        >
          <Database className="mr-2 inline h-4 w-4" />
          Subscription History
        </button>
      </div>

      {/* Search and Filters */}
      <div className="rise mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-500" />
          <input
            className="w-full rounded-xl border border-night-600 bg-night-850 py-2 pl-9 pr-3 text-sm text-mist-200 placeholder:text-mist-500 focus:border-volt-400/40 focus:outline-none focus:ring-1 focus:ring-volt-400/20"
            placeholder="Search by action, target, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-mist-500" />
          <Dropdown
            open={false}
            onOpenChange={() => {}}
            items={[
              { type: "item" as const, label: "All Actions", onClick: () => setActionFilter("all") },
              { type: "divider" as const },
              ...uniqueActions.map((action) => ({
                type: "item" as const,
                label: action.replace(/_/g, " "),
                onClick: () => setActionFilter(action),
              })),
            ]}
            trigger={
              <button className="rounded-xl border border-night-600 bg-night-850 px-3 py-2 text-sm text-mist-200 focus:border-volt-400/40 focus:outline-none flex items-center gap-1.5">
                {actionFilter === "all" ? "All Actions" : actionFilter.replace(/_/g, " ")}
                <ChevronDown className="h-3 w-3" />
              </button>
            }
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="rise mt-4 overflow-hidden rounded-2xl border border-night-700 bg-night-850/50 backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-night-700 bg-night-800/50">
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Time</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Action</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Target</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-mist-500">Performed By</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-mist-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center">
                    <p className="text-sm text-mist-500">No audit logs found.</p>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="border-b border-night-800 transition-colors hover:bg-night-800/30">
                    <td className="px-4 py-3">
                      <span className="text-xs text-mist-400">{formatDate(log.performedAt)}</span>
                    </td>
                    <td className="px-4 py-3">{getActionBadge(log.action)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {log.targetType === "coach" ? <FileText className="h-3 w-3 text-mist-500" /> : <Database className="h-3 w-3 text-mist-500" />}
                        <span className="text-sm text-mist-300 font-mono text-xs">{log.targetId.slice(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-mist-400 font-mono">{log.performedBy?.slice(0, 12) || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleViewDetails(log)}
                        className="cursor-pointer rounded-lg p-1.5 text-mist-400 transition hover:bg-night-700 hover:text-mist-100"
                        aria-label="View details"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-night-700 flex items-center justify-between">
            <span className="text-xs text-mist-500">
              Page {page} of {totalPages} ({filteredLogs.length} entries)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="cursor-pointer rounded-lg p-1.5 text-mist-400 transition hover:bg-night-700 hover:text-mist-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="cursor-pointer rounded-lg p-1.5 text-mist-400 transition hover:bg-night-700 hover:text-mist-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="rise mt-6 rounded-2xl border border-night-700 bg-night-850/30 p-5">
        <p className="text-xs text-mist-500">
          <span className="font-bold text-volt-300">Audit Log:</span> All administrative actions are logged here including coach account changes, subscription modifications, and plan changes.
          {logType === "subscription" && " Subscription history tracks all changes to coach subscriptions including extensions, plan changes, and cancellations."}
        </p>
      </div>

      <Modal open={selectedLog !== null} onClose={() => setSelectedLog(null)} title={selectedLog ? selectedLog.action.replace(/_/g, " ") : "Details"}>
        {selectedLog && (
          <dl className="grid gap-2.5 text-sm">
            {[
              ["Target", `${selectedLog.targetType} (${selectedLog.targetId.slice(0, 12)}…)`],
              ["Performed By", selectedLog.performedBy ? `${selectedLog.performedBy.slice(0, 12)}…` : "system"],
              ["Time", formatDate(selectedLog.performedAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 border-b border-night-700/60 pb-2 last:border-0 last:pb-0">
                <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-mist-500">{k}</dt>
                <dd className="min-w-0 truncate text-end font-semibold text-mist-200">{v}</dd>
              </div>
            ))}
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">Old value</p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-mist-300">{selectedLog.oldValue ? JSON.stringify(selectedLog.oldValue, null, 2) : "—"}</pre>
            </div>
            <div className="rounded-xl border border-night-700 bg-night-800 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mist-500">New value</p>
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-mist-300">{selectedLog.newValue ? JSON.stringify(selectedLog.newValue, null, 2) : "—"}</pre>
            </div>
          </dl>
        )}
      </Modal>
    </>
  );
}