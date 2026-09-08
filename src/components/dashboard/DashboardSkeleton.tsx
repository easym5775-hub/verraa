import { Skeleton } from "../ui";

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 sm:gap-5">
      <div className="rise">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-[42px] w-80 max-w-full" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 xl:col-span-2">
          <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
            <Skeleton className="h-8 w-8 !rounded-xl" />
            <Skeleton className="h-4 w-36" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3 last:border-0">
              <Skeleton className="h-10 w-10 shrink-0 !rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-2 h-3 w-48 max-w-full" />
              </div>
              <Skeleton className="h-9 w-20 shrink-0" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60">
          <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
            <Skeleton className="h-8 w-8 !rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-2">
              <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
              <Skeleton className="h-[18px] w-[70px] shrink-0" />
              <Skeleton className="h-3.5 min-w-0 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-h-[104px] rounded-2xl border border-white/[0.07] bg-night-900/60 p-5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-8 !rounded-xl" />
            </div>
            <Skeleton className="mt-2.5 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/[0.07] bg-night-900/60">
        <div className="flex min-h-[60px] items-center gap-2 border-b border-white/[0.06] px-5 py-3.5">
          <Skeleton className="h-8 w-8 !rounded-xl" />
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3 last:border-0">
            <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-48 max-w-full" />
            </div>
            <Skeleton className="h-9 w-16 shrink-0" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-5 xl:col-span-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-8 w-48" />
          <Skeleton className="mt-3 h-14 w-full" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[64px]" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-night-900/60 p-2 py-1.5 xl:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-white/[0.07] bg-night-900/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 !rounded-xl" />
          <div>
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="mt-1.5 h-3 w-56 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-1.5 min-w-[160px] flex-1 sm:max-w-[280px]" />
        <Skeleton className="ms-auto h-8 w-28" />
      </div>
    </div>
  );
}
