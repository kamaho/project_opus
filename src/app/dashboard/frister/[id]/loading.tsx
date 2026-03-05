import { Skeleton } from "@/components/ui/skeleton";

export default function DeadlineDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
