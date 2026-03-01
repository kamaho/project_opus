import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { dashboardConfigs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getModulesForDashboard } from "./module-registry";
import { layouts } from "./layouts";
import { DashboardToolbar } from "./dashboard-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardType, DashboardConfig, LayoutType } from "./types";

interface DashboardShellProps {
  type: DashboardType;
  clientId?: string;
}

const DEFAULT_CONFIG: DashboardConfig = {
  layout: "overview",
  hiddenModules: [],
  moduleSettings: {},
};

async function getConfig(
  tenantId: string,
  userId: string,
  type: string
): Promise<DashboardConfig> {
  const [row] = await db
    .select()
    .from(dashboardConfigs)
    .where(
      and(
        eq(dashboardConfigs.tenantId, tenantId),
        eq(dashboardConfigs.userId, userId),
        eq(dashboardConfigs.dashboardType, type)
      )
    )
    .limit(1);

  if (!row) return DEFAULT_CONFIG;

  return {
    layout: row.layout as LayoutType,
    hiddenModules: (row.hiddenModules as string[]) ?? [],
    moduleSettings: (row.moduleSettings as Record<string, unknown>) ?? {},
  };
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

export default async function DashboardShell({
  type,
  clientId,
}: DashboardShellProps) {
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <p className="font-medium">Velg eller opprett organisasjon</p>
        <p className="mt-1 text-muted-foreground">
          Bruk organisasjonsvelgeren i headeren for å velge en organisasjon.
        </p>
      </div>
    );
  }

  const config = await getConfig(orgId, userId, type);
  const allModules = getModulesForDashboard(type);
  const visibleModules = allModules.filter(
    (m) => !config.hiddenModules.includes(m.id)
  );

  const LayoutComponent = layouts[config.layout] ?? layouts.overview;

  return (
    <div className="space-y-4">
      <DashboardToolbar
        currentLayout={config.layout}
        availableModules={allModules}
        hiddenModules={config.hiddenModules}
        dashboardType={type}
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <LayoutComponent
          modules={visibleModules}
          tenantId={orgId}
          clientId={clientId}
        />
      </Suspense>
    </div>
  );
}
