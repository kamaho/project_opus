import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidateAccounts } from "@/lib/revalidate";

/** GET: Grunnleggende info om en konto (for breadcrumb m.m.). */
export const GET = withTenant(async (req, { tenantId }, params) => {
  const client = await verifyClientOwnership(params!.clientId, tenantId);
  return NextResponse.json({ id: client.id, name: client.name, companyId: client.companyId });
});

/** PATCH: Rename an account belonging to this client. */
export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const client = await verifyClientOwnership(params!.clientId, tenantId);

  const body = await req.json().catch(() => null);
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
    .where(and(eq(accounts.id, body.accountId), eq(companies.tenantId, tenantId)));

  if (!row) {
    return NextResponse.json({ error: "Konto ikke funnet" }, { status: 404 });
  }

  await db
    .update(accounts)
    .set({ name: newName })
    .where(eq(accounts.id, body.accountId));

  revalidateAccounts();

  return NextResponse.json({ ok: true, name: newName });
});
