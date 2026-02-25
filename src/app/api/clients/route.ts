import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, clients, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getClientsByTenant } from "@/lib/db/tenant";
import { revalidateClients, revalidateAccounts } from "@/lib/revalidate";

/** GET: Liste avstemminger for org. Optional ?companyId= for å filtrere på selskap. */
export async function GET(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") ?? undefined;

  const rows = await getClientsByTenant(orgId, companyId);
  return NextResponse.json(rows);
}

/** POST: Opprett avstemming med to kontoer i én transaksjon. */
export async function POST(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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
    .where(and(eq(companies.id, companyId), eq(companies.tenantId, orgId)));

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

  revalidateClients();
  revalidateAccounts();

  return NextResponse.json(created, { status: 201 });
}
