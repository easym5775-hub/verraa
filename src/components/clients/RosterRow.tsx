/* ================================================================
   VERRAA — roster table row (desktop) + shared roster types.
   Extracted from Clients.tsx so the roster list can be rendered
   plainly (small teams) or virtualized (100+ clients) without
   duplicating markup.
   ================================================================ */

import { ClipboardList, Pencil, Trash2, User, UtensilsCrossed } from "lucide-react";
import type { CheckIn, Client, CoachView } from "../../types";
import { GOAL_META, STATUS_META, SUB_STATE_META } from "../../types";
import { relDay } from "../../lib";
import { remainingLabel, type SubWithState } from "../../logic";
import { Avatar, Badge } from "../ui";

export interface RosterEntry {
  client: Client;
  subInfo: SubWithState;
  last: CheckIn | null;
}

export interface RosterActions {
  go: (v: CoachView, id?: string) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}

export function RosterTableHead() {
  return (
    <thead>
      <tr className="border-b border-night-700 bg-night-800/50 text-[11px] font-bold uppercase tracking-wider text-mist-500">
        <th className="px-5 py-3 text-start">Client</th>
        <th className="px-4 py-3 text-start">Goal</th>
        <th className="px-4 py-3 text-start">Status</th>
        <th className="px-4 py-3 text-start">Subscription</th>
        <th className="px-4 py-3 text-start">Last check-in</th>
        <th className="px-4 py-3 text-end">Actions</th>
      </tr>
    </thead>
  );
}

export function RosterRow({
  entry,
  go,
  onEdit,
  onDelete,
  measureRef,
  dataIndex,
  ariaRowIndex,
}: RosterActions & {
  entry: RosterEntry;
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
  ariaRowIndex?: number;
}) {
  const { client: c, subInfo, last } = entry;
  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      aria-rowindex={ariaRowIndex}
      className="group cursor-pointer border-b border-night-700/60 transition last:border-0 hover:bg-night-800/60"
      onClick={() => go("client", c.id)}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={c.name} photo={c.photo} className="h-10 w-10 text-xs" />
          <div className="min-w-0">
            <p className="truncate font-bold text-mist-100 transition group-hover:text-volt-300">{c.name}</p>
            <p className="truncate text-[11px] text-mist-500">@{c.username} · {c.phone || c.email || "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge className={GOAL_META[c.goal].chip}>
          <span className={`h-1.5 w-1.5 rounded-full ${GOAL_META[c.goal].dot}`} />
          {c.goal}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge className={STATUS_META[c.status].chip}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot} ${c.status === "Active" ? "tick-pulse" : ""}`} />
          {c.status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {subInfo.sub ? (
          <span className="block">
            <Badge className={SUB_STATE_META[subInfo.state].chip}>{subInfo.state}</Badge>
            <span className={`mt-1 block text-[11px] font-semibold ${subInfo.state === "Expired" ? "text-danger-300" : subInfo.state === "Expiring Soon" ? "text-warn-300" : "text-mist-500"}`}>
              {remainingLabel(subInfo.daysLeft)}
            </span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-mist-500">No subscription</span>
        )}
      </td>
      <td className="px-4 py-3 text-mist-300">
        {last ? (
          <span>
            {last.weight} kg
            <span className="ms-2 text-[11px] text-mist-500">{relDay(last.date)}</span>
          </span>
        ) : (
          <span className="text-mist-500">none yet</span>
        )}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1 opacity-100 transition lg:opacity-60 lg:group-hover:opacity-100">
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Open profile" onClick={() => go("client", c.id)}>
            <User className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Workout plan" onClick={() => go("plans", c.id)}>
            <ClipboardList className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-volt-300" title="Meals" onClick={() => go("meals", c.id)}>
            <UtensilsCrossed className="h-4 w-4" />
          </button>
          <button
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition-all duration-200 hover:bg-night-700 hover:text-mist-100"
            title="Edit"
            onClick={() => onEdit(c)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" onClick={() => onDelete(c)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
