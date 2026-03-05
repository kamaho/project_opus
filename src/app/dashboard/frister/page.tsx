import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import FristerClient from "./frister-client";

function FristerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-10 w-64" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function FristerPage() {
  return (
    <Suspense fallback={<FristerSkeleton />}>
      <FristerClient />
    </Suspense>
  );
}
