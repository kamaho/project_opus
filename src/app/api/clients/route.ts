import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, clients, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getClientsByTenant } from "@/lib/db/tenant";
import { revalidateClients, revalidateAccounts } from "@/lib/revalidate";
import { seedStandardRules } from "@/lib/matching/seed-rules";
import { logAudit } from "@/lib/audit";

/** GET: Liste avstemminger for org. Optional ?companyId= for å filtrere på selskap. */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;

  const rows = await getClientsByTenant(tenantId, companyId);
  return NextResponse.json(rows);
});

/** POST: Opprett avstemming med to kontoer i én transaksjon. */
export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const { companyId, name, set1, set2 } = body as {
    companyId?: string;
    name?: string;
    set1?: { accountNumber: string; name: string; type: "ledger" | "bank" };
    set2?: { accountNumber: string; name: string; type: "ledger" | "bank" };
  };

  if (!companyId || !name?.trim() || !set1 || !set2) {
    return NextResponse.json(
      { error: "companyId, name, set1 og set2 er påkrevd" },
      { status: 400 }
    );
  }

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, tenantId)));

  if (!company) {
    return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const [account1] = await db
    .insert(accounts)
    .values({
      companyId,
      accountNumber: set1.accountNumber.trim(),
      name: set1.name.trim(),
      accountType: set1.type,
    })
    .returning();

  const [account2] = await db
    .insert(accounts)
    .values({
      companyId,
      accountNumber: set2.accountNumber.trim(),
      name: set2.name.trim(),
      accountType: set2.type,
    })
    .returning();

  const [created] = await db
    .insert(clients)
    .values({
      companyId,
      name: name.trim(),
      set1AccountId: account1.id,
      set2AccountId: account2.id,
    })
    .returning();

  seedStandardRules(created.id, tenantId).catch((e) =>
    console.error("[clients] Failed to seed standard matching rules:", e)
  );

  revalidateClients();
  revalidateAccounts();

  await logAudit({ tenantId, userId, action: "client.created", entityType: "client", entityId: created.id, metadata: { name: created.name } });

  return NextResponse.json(created, { status: 201 });
});
