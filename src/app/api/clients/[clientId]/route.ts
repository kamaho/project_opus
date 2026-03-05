import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accounts, companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidateAccounts } from "@/lib/revalidate";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

export const GET = withTenant(async (req, { tenantId }, params) => {
  const client = await verifyClientOwnership(params!.clientId, tenantId);
  return NextResponse.json({ id: client.id, name: client.name, companyId: client.companyId });
});

const patchSchema = z.object({
  accountId: z.string().uuid("Må være en gyldig UUID"),
  name: z.string().min(1, "Navn kan ikke være tomt").max(100, "Navn kan maks være 100 tegn"),
});

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const client = await verifyClientOwnership(params!.clientId, tenantId);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return zodError(parsed.error);

  const { accountId, name } = parsed.data;
  const newName = name.trim();

  const validAccountId =
    accountId === client.set1AccountId || accountId === client.set2AccountId;
  if (!validAccountId) {
    return NextResponse.json({ error: "Kontoen tilhører ikke denne klienten" }, { status: 403 });
  }

  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(companies, eq(accounts.companyId, companies.id))
    .where(and(eq(accounts.id, accountId), eq(companies.tenantId, tenantId)));

  if (!row) {
    return NextResponse.json({ error: "Konto ikke funnet" }, { status: 404 });
  }

  await db
    .update(accounts)
    .set({ name: newName })
    .where(eq(accounts.id, accountId));

  revalidateAccounts();

  return NextResponse.json({ ok: true, name: newName });
});
