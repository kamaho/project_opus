import { db } from "@/lib/db";
import { clients, companies, accounts, tripletexSyncConfigs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Validates that a client belongs to the given tenant.
 * Returns basic client info or null if not found / not authorized.
 */
export async function validateClientTenant(
  clientId: string,
  tenantId: string
) {
  const [row] = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyId: clients.companyId,
      companyName: companies.name,
      set1AccountId: clients.set1AccountId,
      set2AccountId: clients.set2AccountId,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(clients.id, clientId), eq(companies.tenantId, tenantId)));
  return row ?? null;
}

/**
 * Returns all companies for a tenant, ordered by name.
 */
export async function getCompaniesByTenant(tenantId: string) {
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      type: companies.type,
      tripletexCompanyId: companies.tripletexCompanyId,
      vismaNxtCompanyNo: companies.vismaNxtCompanyNo,
    })
    .from(companies)
    .where(eq(companies.tenantId, tenantId))
    .orderBy(companies.name);

  return rows.map((r) => {
    const sources: string[] = [];
    if (r.tripletexCompanyId != null) sources.push("tripletex");
    if (r.vismaNxtCompanyNo != null) sources.push("visma_nxt");
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      integrationSources: sources,
    };
  });
}

/**
 * Returns all clients for a tenant with company info, optionally filtered by companyId.
 */
export async function getClientsByTenant(
  tenantId: string,
  companyId?: string
) {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      companyId: clients.companyId,
      syncStatus: tripletexSyncConfigs.syncStatus,
      syncError: tripletexSyncConfigs.syncError,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .leftJoin(tripletexSyncConfigs, eq(tripletexSyncConfigs.clientId, clients.id))
    .where(
      companyId && companyId !== "__none__"
        ? (() => {
            const ids = companyId.split(",").filter((id) => id && id !== "__none__");
            if (ids.length === 0) return eq(companies.tenantId, tenantId);
            return ids.length === 1
              ? and(eq(companies.tenantId, tenantId), eq(clients.companyId, ids[0]))
              : and(eq(companies.tenantId, tenantId), inArray(clients.companyId, ids));
          })()
        : eq(companies.tenantId, tenantId)
    )
    .orderBy(clients.name);
}

/**
 * Returns an account with tenant validation (via company join).
 */
export async function getAccountByTenant(
  accountId: string,
  tenantId: string
) {
  const [row] = await db
    .select({ id: accounts.id, name: accounts.name, accountNumber: accounts.accountNumber })
    .from(accounts)
    .innerJoin(companies, eq(accounts.companyId, companies.id))
    .where(and(eq(accounts.id, accountId), eq(companies.tenantId, tenantId)));
  return row ?? null;
}
