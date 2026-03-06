import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { ClientsPageClient } from "./clients-page-client";
import { CreateReconciliationDialog } from "@/components/setup/create-reconciliation-dialog";
import { SyncInProgressView } from "./sync-in-progress-view";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClientsPageData } from "./clients-data";

function ClientsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <div className="flex gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

async function ClientsContent({
  orgId,
  companyIdParam,
}: {
  orgId: string;
  companyIdParam?: string;
}) {
  const selectedCompanyIds = companyIdParam
    ? companyIdParam.split(",").filter(Boolean)
    : [];

  const result = await fetchClientsPageData(orgId, selectedCompanyIds);

  if (result.type === "sync-in-progress") {
    return <SyncInProgressView />;
  }

  if (result.type === "empty") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Klient avstemming</h1>
          <CreateReconciliationDialog />
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium">Ingen klienter ennå</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Opprett din første klient for å begynne med avstemming av
            transaksjoner mellom hovedbok og bank.
          </p>
          <div className="mt-6">
            <CreateReconciliationDialog />
          </div>
        </div>
      </div>
    );
  }

  return <ClientsPageClient rows={result.rows} groups={result.groups} />;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Klient avstemming</h1>
        <p className="text-muted-foreground">
          Velg en organisasjon for å se klienter.
        </p>
      </div>
    );
  }

  const { companyId: companyIdParam } = await searchParams;

  if (companyIdParam === "__none__") {
    return <ClientsPageClient rows={[]} groups={[]} />;
  }

  return (
    <Suspense fallback={<ClientsTableSkeleton />}>
      <ClientsContent orgId={orgId} companyIdParam={companyIdParam} />
    </Suspense>
  );
}
