import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { companies, clients, accounts, matchingRules } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const REVALIDATE_SHORT = 60;
const REVALIDATE_MEDIUM = 300;

export const getCachedCompanies = unstable_cache(
  async (tenantId: string) => {
    return db
      .select({ id: companies.id, name: companies.name, orgNumber: companies.orgNumber })
      .from(companies)
      .where(eq(companies.tenantId, tenantId))
      .orderBy(companies.name);
  },
  ["companies-by-tenant"],
  { revalidate: REVALIDATE_MEDIUM, tags: ["companies"] }
);

export const getCachedClients = unstable_cache(
  async (tenantId: string) => {
    return db
      .select({
        id: clients.id,
        name: clients.name,
        companyId: clients.companyId,
        status: clients.status,
      })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(eq(companies.tenantId, tenantId))
      .orderBy(clients.name);
  },
  ["clients-by-tenant"],
  { revalidate: REVALIDATE_MEDIUM, tags: ["clients"] }
);

export const getCachedAccount = unstable_cache(
  async (accountId: string, tenantId: string) => {
    const [row] = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        accountNumber: accounts.accountNumber,
        accountType: accounts.accountType,
      })
      .from(accounts)
      .innerJoin(companies, eq(accounts.companyId, companies.id))
      .where(and(eq(accounts.id, accountId), eq(companies.tenantId, tenantId)));
    return row ?? null;
  },
  ["account-by-id"],
  { revalidate: REVALIDATE_MEDIUM, tags: ["accounts"] }
);

export const getCachedMatchingRules = unstable_cache(
  async (tenantId: string, clientId?: string) => {
    const baseWhere = clientId
      ? and(eq(matchingRules.tenantId, tenantId), eq(matchingRules.clientId, clientId))
      : eq(matchingRules.tenantId, tenantId);

    return db
      .select({
        id: matchingRules.id,
        name: matchingRules.name,
        priority: matchingRules.priority,
        isActive: matchingRules.isActive,
        ruleType: matchingRules.ruleType,
        dateMustMatch: matchingRules.dateMustMatch,
        dateToleranceDays: matchingRules.dateToleranceDays,
        allowTolerance: matchingRules.allowTolerance,
        toleranceAmount: matchingRules.toleranceAmount,
        conditions: matchingRules.conditions,
      })
      .from(matchingRules)
      .where(baseWhere)
      .orderBy(matchingRules.priority);
  },
  ["matching-rules"],
  { revalidate: REVALIDATE_SHORT, tags: ["matching-rules"] }
);
