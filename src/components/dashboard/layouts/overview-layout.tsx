"use client";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardDataProvider } from "../dashboard-data-provider";
import type { LayoutProps } from "../types";

function ModuleSkeleton() {
  return <Skeleton className="h-48 w-full rounded-lg" />;
}

export default function OverviewLayout({
  modules,
  tenantId,
  clientId,
  companyId,
}: LayoutProps) {
  const byId = Object.fromEntries(modules.map((m) => [m.id, m]));

  const keyFigures =
    byId["key-figures"] ?? byId["client-key-figures"] ?? null;
  const activity =
    byId["recent-activity"] ?? byId["client-recent-activity"] ?? null;
  const reconciliation =
    byId["reconciliation-overview"] ?? byId["client-reconciliation"] ?? null;
  const deadlines = byId["deadlines"] ?? byId["client-deadlines"] ?? null;
  const deadlineWidget = byId["deadline-widget"] ?? null;

  return (
    <DashboardDataProvider tenantId={tenantId} clientId={clientId} companyId={companyId}>
    <div className="space-y-4">
      {/* Row 1: Key figures + Attention — same size, side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 items-stretch">
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

      {/* Row 2: Deadline widget — full width */}
      {deadlineWidget && (
        <Suspense fallback={<ModuleSkeleton />}>
          <deadlineWidget.component
            tenantId={tenantId}
            clientId={clientId}
            size="full"
          />
        </Suspense>
      )}

      {/* Row 3: Reconciliation — full width */}
      {reconciliation && (
        <Suspense fallback={<ModuleSkeleton />}>
          <reconciliation.component
            tenantId={tenantId}
            clientId={clientId}
            size="full"
          />
        </Suspense>
      )}

      {/* Row 4: Recent activity — full width */}
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
    </DashboardDataProvider>
  );
}
