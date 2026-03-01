import { db } from "./index";
import { eq, and } from "drizzle-orm";
import { companies, clients } from "./schema";
import { AuthError } from "@/lib/auth/tenant";

/**
 * Verifiser at et company tilhører tenanten.
 * Returnerer company-rad hvis OK, kaster 404 hvis ikke funnet.
 */
export async function verifyCompanyOwnership(
  companyId: string,
  tenantId: string
) {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!company) {
    throw new AuthError("Company not found", 404);
  }

  return company;
}

/**
 * Verifiser at en client tilhører tenanten (via company).
 * clients → company_id → companies.tenant_id
 */
export async function verifyClientOwnership(
  clientId: string,
  tenantId: string
) {
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyId: clients.companyId,
      set1AccountId: clients.set1AccountId,
      set2AccountId: clients.set2AccountId,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(and(eq(clients.id, clientId), eq(companies.tenantId, tenantId)))
    .limit(1);

  if (!client) {
    throw new AuthError("Client not found", 404);
  }

  return client;
}
