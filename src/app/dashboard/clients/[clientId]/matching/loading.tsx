import { Skeleton } from "@/components/ui/skeleton";

export default function MatchingLoading() {
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Account badges + balance */}
      <div className="flex items-center gap-3 shrink-0 px-1">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
        <div className="flex-1" />
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Two-panel transaction area */}
      <div className="flex flex-1 min-h-0 gap-2">
        {/* Left panel */}
        <div className="flex-1 flex flex-col gap-1 border rounded-md p-2">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-7 w-full max-w-xs" />
          </div>
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 flex-1" />
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col gap-1 border rounded-md p-2">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-7 w-full max-w-xs" />
          </div>
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 flex-1" />
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
