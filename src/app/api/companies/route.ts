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
  try {
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

    if (!created) {
      return NextResponse.json({ error: "Kunne ikke opprette selskap" }, { status: 500 });
    }

    revalidateCompanies();

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/companies] POST error:", message);
    if (message.includes("duplicate") || message.includes("unique") || message.includes("constraint")) {
      return NextResponse.json({ error: "Selskap eller konsern med dette navnet/org.nr finnes allerede" }, { status: 400 });
    }
    return NextResponse.json({ error: "Kunne ikke opprette selskap. Sjekk at du har valgt organisasjon." }, { status: 500 });
  }
});
