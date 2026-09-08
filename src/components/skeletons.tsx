import { useEffect, useState } from "react";
import { Skeleton } from "./ui";

/**
 * Shared loading skeletons — one visual language for every view.
 * Dashboard already had an excellent skeleton; these reuse the same
 * `.skeleton` primitive so all views feel consistent.
 */

/** Brief "mounted" gate so client switches / tab switches show a skeleton
 *  instead of a flash of empty content. Mirrors the Dashboard's 420ms boot. */
export function useViewReady(key = "", delay = 280): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(t);
  }, [key, delay]);
  return ready;
}

function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-night-900/60">
      <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
        <Skeleton className="h-8 w-8 !rounded-xl" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="ms-auto h-8 w-24" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Rows({ n = 4 }: { n?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-night-800/60 px-4 py-3"
        >
          <Skeleton className="h-10 w-10 shrink-0 !rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="mt-2 h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="rise" aria-hidden="true">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 h-[38px] w-80 max-w-full" />
      <Skeleton className="mt-2 h-4 w-64 max-w-full" />
    </div>
  );
}

export function RosterSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading clients" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <CardFrame>
        <Rows n={5} />
      </CardFrame>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading client profile" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-24" />
      <div className="rounded-[20px] border border-white/[0.07] bg-night-900/60 p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 !rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px]" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CardFrame>
          <Rows n={3} />
        </CardFrame>
        <CardFrame>
          <Rows n={3} />
        </CardFrame>
      </div>
    </div>
  );
}

export function PlansSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workout plans" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[76px]" />
        ))}
      </div>
      <CardFrame>
        <Rows n={4} />
      </CardFrame>
    </div>
  );
}

export function MealsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading nutrition plan" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-3 w-full" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[64px]" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardFrame key={i}>
            <Rows n={2} />
          </CardFrame>
        ))}
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading exercise library" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-4"
          >
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-3 h-6 w-3/4" />
            <Skeleton className="mt-2 h-3 w-full" />
            <div className="mt-3 flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CheckInsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading check-ins" className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <CardFrame>
        <Rows n={5} />
      </CardFrame>
    </div>
  );
}

export function GenericViewSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-4">
      <PageHeaderSkeleton />
      <CardFrame>
        <Rows n={4} />
      </CardFrame>
    </div>
  );
}
