"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutProps } from "../types";

function ModuleSkeleton() {
  return <Skeleton className="h-40 w-full rounded-lg" />;
}

export default function CompactLayout({
  modules,
  tenantId,
  clientId,
}: LayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {modules.map((mod) => (
        <Suspense key={mod.id} fallback={<ModuleSkeleton />}>
          <mod.component
            tenantId={tenantId}
            clientId={clientId}
            size="small"
          />
        </Suspense>
      ))}
    </div>
  );
}
