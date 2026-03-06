import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { companies, clients, accounts, matchingRules, subscriptions } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

const REVALIDATE_SHORT = 60;
const REVALIDATE_MEDIUM = 300;

export const getCachedCompanies = unstable_cache(
  async (tenantId: string) => {
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        orgNumber: companies.orgNumber,
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
        orgNumber: r.orgNumber,
        type: r.type,
        integrationSources: sources,
      };
    });
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

export const getCachedClientCount = unstable_cache(
  async (tenantId: string) => {
    const [row] = await db
      .select({ value: count() })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(eq(companies.tenantId, tenantId));
    return row?.value ?? 0;
  },
  ["client-count-by-tenant"],
  { revalidate: REVALIDATE_MEDIUM, tags: ["clients"] }
);

export const getCachedTenantPlan = unstable_cache(
  async (tenantId: string) => {
    const [sub] = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);
    if (!sub || sub.status === "canceled") return "starter";
    return sub.plan;
  },
  ["tenant-plan"],
  { revalidate: REVALIDATE_MEDIUM, tags: ["plans"] }
);
