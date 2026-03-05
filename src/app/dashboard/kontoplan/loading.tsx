import { Skeleton } from "@/components/ui/skeleton";

export default function KontoplanLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-14 w-48 rounded-lg" />
        <Skeleton className="h-14 w-48 rounded-lg" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-8 w-64 rounded-md" />
      </div>
      <Skeleton className="h-20 rounded-lg" />
      <div className="rounded-lg border overflow-hidden">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full border-t" />
        ))}
      </div>
    </div>
  );
}
