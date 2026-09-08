/* ================================================================
   VERRAA — virtualized roster lists (@tanstack/react-virtual).
   Only engaged past VIRTUALIZE_AFTER rows; smaller rosters render
   the plain map in Clients.tsx (zero behavior change there).
   Window scroller is used so page scroll UX stays identical —
   rows/cards are measured live, so wrapped content keeps exact
   heights (no jumpy estimates).
   ================================================================ */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { RosterCard } from "./RosterCard";
import { RosterRow, type RosterActions, type RosterEntry } from "./RosterRow";

/** Past this many visible rows the roster switches to virtualization. */
export const VIRTUALIZE_AFTER = 40;

type Props = RosterActions & { items: RosterEntry[] };

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/**
 * Document-relative top of the list container. Stable across scroll
 * (rect.top + scrollY), measured pre-paint so the first virtual frame
 * is already correct — no flash of misplaced rows.
 */
function useListTop<T extends HTMLElement>(dep: unknown): [(el: T | null) => void, number] {
  const elRef = useRef<T | null>(null);
  const [top, setTop] = useState(0);
  const setRef = useCallback((el: T | null) => {
    elRef.current = el;
  }, []);
  useLayoutEffect(() => {
    const measure = () => {
      const el = elRef.current;
      if (el) setTop(Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [dep]);
  return [setRef, top];
}

/* ---------------- desktop table body ---------------- */

export function VirtualRosterBody({ items, go, onEdit, onDelete }: Props) {
  const [tbodyRef, margin] = useListTop<HTMLTableSectionElement>(items.length);
  const v = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 72,
    overscan: 8,
    scrollMargin: margin,
    getItemKey: (i) => items[i]?.client.id ?? i,
  });

  const rows = v.getVirtualItems();
  const padTop = rows.length > 0 ? Math.max(0, rows[0].start - margin) : 0;
  const lastRow = rows[rows.length - 1];
  const padBottom = lastRow ? Math.max(0, v.getTotalSize() - (lastRow.end - margin)) : 0;

  return (
    <tbody ref={tbodyRef}>
      {padTop > 0 && (
        <tr aria-hidden="true">
          <td colSpan={6} style={{ height: padTop, padding: 0, border: 0 }} />
        </tr>
      )}
      {rows.map((vr) => {
        const entry = items[vr.index];
        if (!entry) return null;
        return (
          <RosterRow
            key={entry.client.id}
            entry={entry}
            go={go}
            onEdit={onEdit}
            onDelete={onDelete}
            measureRef={v.measureElement}
            dataIndex={vr.index}
            ariaRowIndex={vr.index + 2}
          />
        );
      })}
      {padBottom > 0 && (
        <tr aria-hidden="true">
          <td colSpan={6} style={{ height: padBottom, padding: 0, border: 0 }} />
        </tr>
      )}
    </tbody>
  );
}

/* ---------------- mobile card list ---------------- */

export function VirtualMobileList({ items, go, onEdit, onDelete }: Props) {
  const [listRef, margin] = useListTop<HTMLUListElement>(items.length);
  const v = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 176,
    overscan: 6,
    scrollMargin: margin,
    getItemKey: (i) => items[i]?.client.id ?? i,
  });

  return (
    <ul ref={listRef} aria-label={`${items.length} clients`} className="relative py-3 md:hidden" style={{ height: v.getTotalSize() }}>
      {v.getVirtualItems().map((vi) => {
        const entry = items[vi.index];
        if (!entry) return null;
        return (
          <RosterCard
            key={entry.client.id}
            entry={entry}
            go={go}
            onEdit={onEdit}
            onDelete={onDelete}
            measureRef={v.measureElement}
            dataIndex={vi.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              padding: "0 12px 8px",
              transform: `translateY(${vi.start - margin}px)`,
            }}
          />
        );
      })}
    </ul>
  );
}
