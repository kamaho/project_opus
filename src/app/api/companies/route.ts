import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCompaniesByTenant } from "@/lib/db/tenant";
import { revalidateCompanies } from "@/lib/revalidate";

/** GET: Liste selskap for nåværende organisasjon (tenant). */
export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await getCompaniesByTenant(orgId);
  return NextResponse.json(list);
}

/** POST: Opprett selskap eller konsern. */
export async function POST(request: Request) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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
      .where(and(eq(companies.id, parentCompanyId), eq(companies.tenantId, orgId)));
    if (!parent) {
      return NextResponse.json({ error: "Konsern ikke funnet" }, { status: 404 });
    }
  }

  const [created] = await db
    .insert(companies)
    .values({
      tenantId: orgId,
      name: name.trim(),
      orgNumber: orgNumber?.trim() || null,
      type: companyType,
      parentCompanyId: parentCompanyId || null,
    })
    .returning();

  revalidateCompanies();

  return NextResponse.json(created, { status: 201 });
}
