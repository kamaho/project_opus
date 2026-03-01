import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCompaniesByTenant } from "@/lib/db/tenant";
import { revalidateCompanies } from "@/lib/revalidate";

/** GET: Liste selskap for nåværende organisasjon (tenant). */
export const GET = withTenant(async (_req, { tenantId }) => {
  const list = await getCompaniesByTenant(tenantId);
  return NextResponse.json(list);
});

/** POST: Opprett selskap eller konsern. */
export const POST = withTenant(async (req, { tenantId }) => {
  const body = await req.json();
  const { name, orgNumber, type, parentCompanyId } = body as {
    name?: string;
    orgNumber?: string;
    type?: "company" | "group";
    parentCompanyId?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Navn er påkrevd" }, { status: 400 });
  }

  const companyType = type === "group" ? "group" : "company";

  if (parentCompanyId) {
    const [parent] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, parentCompanyId), eq(companies.tenantId, tenantId)));
    if (!parent) {
      return NextResponse.json({ error: "Konsern ikke funnet" }, { status: 404 });
    }
  }

  const [created] = await db
    .insert(companies)
    .values({
      tenantId,
      name: name.trim(),
      orgNumber: orgNumber?.trim() || null,
      type: companyType,
      parentCompanyId: parentCompanyId || null,
    })
    .returning();

  revalidateCompanies();

  return NextResponse.json(created, { status: 201 });
});
