"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutProps } from "../types";

function ModuleSkeleton() {
  return <Skeleton className="h-48 w-full rounded-lg" />;
}

export default function OverviewLayout({
  modules,
  tenantId,
  clientId,
}: LayoutProps) {
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]));

  const keyFigures =
    byId["key-figures"] ?? byId["client-key-figures"] ?? null;
  const deadlines = byId["deadlines"] ?? byId["client-deadlines"] ?? null;
  const reconciliation =
    byId["reconciliation-overview"] ?? byId["client-reconciliation"] ?? null;
  const activity =
    byId["recent-activity"] ?? byId["client-recent-activity"] ?? null;

  return (
    <div className="space-y-4">
      {(keyFigures || deadlines) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-start">
          {keyFigures && (
            <Suspense fallback={<ModuleSkeleton />}>
              <keyFigures.component
                tenantId={tenantId}
                clientId={clientId}
                size="medium"
              />
            </Suspense>
          )}
          {deadlines && (
            <Suspense fallback={<ModuleSkeleton />}>
              <deadlines.component
                tenantId={tenantId}
                clientId={clientId}
                size="medium"
              />
            </Suspense>
          )}
        </div>
      )}

      {reconciliation && (
        <Suspense fallback={<ModuleSkeleton />}>
          <reconciliation.component
            tenantId={tenantId}
            clientId={clientId}
            size="full"
          />
        </Suspense>
      )}

      {activity && (
        <Suspense fallback={<ModuleSkeleton />}>
          <activity.component
            tenantId={tenantId}
            clientId={clientId}
            size="full"
          />
        </Suspense>
      )}
    </div>
  );
}
