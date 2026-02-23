import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { validateClientTenant } from "@/lib/db/tenant";

/** GET: Grunnleggende info om en konto (for breadcrumb m.m.). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const row = await validateClientTenant(clientId, orgId);

  if (!row) {
    return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  }

  return NextResponse.json({ id: row.id, name: row.name, companyId: row.companyId });
}

/** PATCH: Rename an account belonging to this client. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const client = await validateClientTenant(clientId, orgId);
  if (!client) {
    return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.accountId !== "string" || typeof body.name !== "string") {
    return NextResponse.json({ error: "accountId og name er påkrevd" }, { status: 400 });
  }

  const newName = body.name.trim();
  if (!newName || newName.length > 100) {
    return NextResponse.json({ error: "Navn må være mellom 1 og 100 tegn" }, { status: 400 });
  }

  const validAccountId =
    body.accountId === client.set1AccountId || body.accountId === client.set2AccountId;
  if (!validAccountId) {
    return NextResponse.json({ error: "Kontoen tilhører ikke denne klienten" }, { status: 403 });
  }

  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(companies, eq(accounts.companyId, companies.id))
    .where(and(eq(accounts.id, body.accountId), eq(companies.tenantId, orgId)));

  if (!row) {
    return NextResponse.json({ error: "Konto ikke funnet" }, { status: 404 });
  }

  await db
    .update(accounts)
    .set({ name: newName })
    .where(eq(accounts.id, body.accountId));

  revalidateTag("accounts");

  return NextResponse.json({ ok: true, name: newName });
}
