"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LayoutProps } from "../types";

function ModuleSkeleton() {
  return <Skeleton className="h-48 w-full rounded-lg" />;
}

export default function FocusLayout({
  modules,
  tenantId,
  clientId,
}: LayoutProps) {
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]));

  const reconciliation =
    byId["reconciliation-overview"] ?? byId["client-reconciliation"] ?? null;
  const keyFigures =
    byId["key-figures"] ?? byId["client-key-figures"] ?? null;
  const deadlines = byId["deadlines"] ?? byId["client-deadlines"] ?? null;

  return (
    <div className="space-y-4">
      {reconciliation && (
        <Suspense fallback={<ModuleSkeleton />}>
          <reconciliation.component
            tenantId={tenantId}
            clientId={clientId}
            size="large"
          />
        </Suspense>
      )}

      {(keyFigures || deadlines) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
    </div>
  );
}
