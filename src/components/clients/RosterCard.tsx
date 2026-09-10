/* ================================================================
   VERRAA — roster card (mobile) shared by the plain and the
   virtualized roster lists.
   ================================================================ */

import { useState } from "react";
import type { CSSProperties } from "react";
import { ClipboardList, MoreHorizontal, Pencil, Trash2, UtensilsCrossed } from "lucide-react";
import { GOAL_META, STATUS_META, SUB_STATE_META } from "../../types";
import { relDay } from "../../lib";
import { remainingLabel } from "../../logic";
import { Avatar, Badge, Dropdown } from "../ui";
import type { RosterActions, RosterEntry } from "./RosterRow";
import { PriorityBadge, usePriorityItems } from "./primitives";

export function RosterCard({
  entry,
  go,
  onEdit,
  onDelete,
  measureRef,
  dataIndex,
  style,
}: RosterActions & {
  entry: RosterEntry;
  measureRef?: (el: HTMLLIElement | null) => void;
  dataIndex?: number;
  style?: CSSProperties;
}) {
  const { client: c, subInfo, last } = entry;
  const [moreOpen, setMoreOpen] = useState(false);
  const priorityItems = usePriorityItems(c);
  return (
    <li ref={measureRef} data-index={dataIndex} style={style}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => go("client", c.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") go("client", c.id);
        }}
        className="cursor-pointer rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition hover:border-white/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-400/50"
        aria-label={`Open ${c.name}'s profile`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={c.name} photo={c.photo} className="h-11 w-11 shrink-0 text-xs" />
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-sm font-bold text-mist-100">{c.name}</span>
              <PriorityBadge priority={c.priority} />
            </p>
            <p className="truncate text-[11px] text-mist-500">
              {c.hasLogin ? `@${c.username} · ` : <span className="font-bold text-warn-300">No login · </span>}{c.phone || c.email || "—"}
            </p>
          </div>
          <Badge className={`${STATUS_META[c.status].chip} shrink-0`}>
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot}`} />
            {c.status}
          </Badge>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge className={GOAL_META[c.goal].chip}>
            <span className={`h-1.5 w-1.5 rounded-full ${GOAL_META[c.goal].dot}`} />
            {c.goal}
          </Badge>
          {subInfo.sub ? (
            <Badge className={SUB_STATE_META[subInfo.state].chip}>{subInfo.state} · {remainingLabel(subInfo.daysLeft)}</Badge>
          ) : (
            <Badge className={SUB_STATE_META["No Subscription"].chip}>No subscription</Badge>
          )}
          <span className="ms-auto text-[11px] font-semibold text-mist-500">
            {last ? `${last.weight} kg · ${relDay(last.date)}` : "no check-ins"}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1 border-t border-white/[0.06] pt-2.5" onClick={(e) => e.stopPropagation()}>
          <button className="grid h-10 min-w-[44px] flex-1 cursor-pointer place-items-center rounded-xl text-xs font-bold text-mist-300 transition hover:bg-white/[0.06] hover:text-volt-300" title="Open profile" aria-label={`Open ${c.name}'s profile`} onClick={() => go("client", c.id)}>
            Profile
          </button>
          <button className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-white/[0.06] hover:text-volt-300" title="Workout plan" aria-label={`Open ${c.name}'s workout plan`} onClick={() => go("plans", c.id)}>
            <ClipboardList className="h-4 w-4" />
          </button>
          <button className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-white/[0.06] hover:text-volt-300" title="Meals" aria-label={`Open ${c.name}'s meals`} onClick={() => go("meals", c.id)}>
            <UtensilsCrossed className="h-4 w-4" />
          </button>
          <button
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100"
            title="Edit"
            aria-label={`Edit ${c.name}`}
            onClick={() => onEdit(c)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-danger-500/15 hover:text-danger-300" title="Delete" aria-label={`Delete ${c.name}`} onClick={() => onDelete(c)}>
            <Trash2 className="h-4 w-4" />
          </button>
          <Dropdown
            open={moreOpen}
            onOpenChange={setMoreOpen}
            align="end"
            label={`More actions for ${c.name}`}
            trigger={
              <button
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl text-mist-400 transition hover:bg-white/[0.06] hover:text-mist-100"
                title="More"
                aria-label={`More actions for ${c.name}`}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
            items={priorityItems}
          />
        </div>
      </div>
    </li>
  );
}
