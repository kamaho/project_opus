import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { companies, accountSyncSettings, tripletexConnections, vismaNxtConnections } from "@/lib/db/schema";
import { eq, and, inArray, asc, desc } from "drizzle-orm";
import { KontoplanClient } from "./kontoplan-client";

export default async function KontoplanPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Kontoplan</h1>
        <p className="text-muted-foreground">
          Velg en organisasjon for å se kontoplanen.
        </p>
      </div>
    );
  }

  const { companyId: companyIdParam } = await searchParams;
  const selectedCompanyIds = companyIdParam ? companyIdParam.split(",").filter(Boolean) : [];

  const allCompanyRows = await db
    .select({
      id: companies.id,
      name: companies.name,
      orgNumber: companies.orgNumber,
      type: companies.type,
      tripletexCompanyId: companies.tripletexCompanyId,
      vismaNxtCompanyNo: companies.vismaNxtCompanyNo,
    })
    .from(companies)
    .where(eq(companies.tenantId, orgId))
    .orderBy(asc(companies.name));

  const companyRows = allCompanyRows.filter((c) => c.type === "company");
  const companyIds = companyRows.map((c) => c.id);

  if (companyIds.length === 0) {
    const [[txConn], [vnxtConn]] = await Promise.all([
      db
        .select({ id: tripletexConnections.id })
        .from(tripletexConnections)
        .where(and(eq(tripletexConnections.tenantId, orgId), eq(tripletexConnections.isActive, true)))
        .limit(1),
      db
        .select({ id: vismaNxtConnections.id })
        .from(vismaNxtConnections)
        .where(eq(vismaNxtConnections.tenantId, orgId))
        .limit(1),
    ]);

    const hasIntegration = txConn || vnxtConn;

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Kontoplan</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <p className="text-sm text-muted-foreground max-w-sm">
            {hasIntegration
              ? "Kontoplanen synkroniseres fra regnskapssystemet. Sjekk igjen om et øyeblikk."
              : "Koble til et regnskapssystem under Integrasjoner for å hente kontoplanen, eller opprett selskaper manuelt."}
          </p>
        </div>
      </div>
    );
  }

  const rawAcctRows = await db
    .select()
    .from(accountSyncSettings)
    .where(
      and(
        eq(accountSyncSettings.tenantId, orgId),
        inArray(accountSyncSettings.companyId, companyIds)
      )
    )
    .orderBy(
      desc(accountSyncSettings.syncLevel),
      asc(accountSyncSettings.accountNumber)
    );

  const accountRows = rawAcctRows.map((r) => ({
    id: r.id,
    accountNumber: r.accountNumber,
    accountName: r.accountName,
    accountType: r.accountType as "ledger" | "bank",
    syncLevel: r.syncLevel as "balance_only" | "transactions",
    balanceIn: r.balanceIn,
    balanceOut: r.balanceOut,
    balanceYear: r.balanceYear,
    clientId: r.clientId,
    txCount: r.txCount ?? 0,
    lastTxSyncAt: r.lastTxSyncAt?.toISOString() ?? null,
    companyId: r.companyId,
  }));

  const companyIdsWithAccounts = new Set(accountRows.map((a) => a.companyId));
  const companiesWithAccounts = companyRows
    .filter((c) => companyIdsWithAccounts.has(c.id))
    .map((c) => {
      const sources: string[] = [];
      if (c.tripletexCompanyId != null) sources.push("tripletex");
      if (c.vismaNxtCompanyNo != null) sources.push("visma_nxt");
      return {
        id: c.id,
        name: c.name,
        orgNumber: c.orgNumber,
        integrationSources: sources,
      };
    });

  return (
    <KontoplanClient
      companies={companiesWithAccounts}
      accounts={accountRows}
    />
  );
}
