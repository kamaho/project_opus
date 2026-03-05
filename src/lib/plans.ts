import { db } from "@/lib/db";
import { subscriptions, companies, clients } from "@/lib/db/schema";
import { eq, count, inArray } from "drizzle-orm";

export type PlanTier = "starter" | "pro" | "enterprise";

export const PLAN_LIMITS = {
  starter: { maxClients: 10, maxUsers: 2, integrations: 1 },
  pro: { maxClients: 50, maxUsers: 10, integrations: Infinity },
  enterprise: {
    maxClients: Infinity,
    maxUsers: Infinity,
    integrations: Infinity,
  },
} as const;

export const PLAN_NAMES: Record<PlanTier, string> = {
  starter: "Starter",
  pro: "Profesjonell",
  enterprise: "Enterprise",
};

export async function getSubscription(tenantId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

export async function getTenantPlan(tenantId: string): Promise<PlanTier> {
  const sub = await getSubscription(tenantId);
  if (!sub || sub.status === "canceled") return "starter";
  return sub.plan as PlanTier;
}

export async function checkPlanLimit(
  tenantId: string,
  resource: "clients" | "users" | "integrations"
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getTenantPlan(tenantId);
  const limits = PLAN_LIMITS[plan];

  let current = 0;
  if (resource === "clients") {
    const tenantCompanies = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.tenantId, tenantId));
    if (tenantCompanies.length > 0) {
      const companyIds = tenantCompanies.map((c) => c.id);
      const [result] = await db
        .select({ count: count() })
        .from(clients)
        .where(inArray(clients.companyId, companyIds));
      current = result?.count ?? 0;
    }
  }

  const limit =
    resource === "clients"
      ? limits.maxClients
      : resource === "users"
        ? limits.maxUsers
        : limits.integrations;

  return { allowed: current < limit, current, limit };
}
