import { db } from "@/lib/db";
import { clients, companies, accounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.tenantId, tenantId))
    .orderBy(companies.name);
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
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(
      companyId
        ? and(eq(companies.tenantId, tenantId), eq(clients.companyId, companyId))
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
