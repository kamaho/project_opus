import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
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
    const { name, orgNumber, type, parentCompanyId, tripletexCompanyId } = body as {
      name?: string;
      orgNumber?: string;
      type?: "company" | "group";
      parentCompanyId?: string;
      tripletexCompanyId?: number;
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

    const nameVal = name.trim();
    const orgNumberVal = orgNumber?.trim() || null;
    const parentVal = parentCompanyId || null;
    const txCompanyIdVal = tripletexCompanyId ?? null;
    const rows = await db.execute<{
      id: string;
      tenant_id: string;
      name: string;
      org_number: string | null;
      type: string;
      parent_company_id: string | null;
      tripletex_company_id: number | null;
      created_at: Date;
      updated_at: Date;
    }>(sql`
      INSERT INTO companies (tenant_id, name, org_number, type, parent_company_id, tripletex_company_id)
      VALUES (${tenantId}, ${nameVal}, ${orgNumberVal}, ${companyType}, ${parentVal}, ${txCompanyIdVal})
      RETURNING id, tenant_id, name, org_number, type, parent_company_id, tripletex_company_id, created_at, updated_at
    `);

    const created = rows[0];
    if (!created) {
      return NextResponse.json({ error: "Kunne ikke opprette selskap" }, { status: 500 });
    }

    revalidateCompanies();

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        tenantId: created.tenant_id,
        orgNumber: created.org_number,
        type: created.type,
        parentCompanyId: created.parent_company_id,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    console.error("[api/companies] POST error:", message, code, err);
    if (message.includes("duplicate") || message.includes("unique") || message.includes("constraint")) {
      return NextResponse.json({ error: "Selskap eller konsern med dette navnet/org.nr finnes allerede" }, { status: 400 });
    }
    // RLS / permission (e.g. Postgres 42501) or missing org context
    if (code === "42501" || /policy|permission|denied|tenant|organization/i.test(message)) {
      return NextResponse.json({ error: "Kunne ikke opprette selskap. Sjekk at du har valgt organisasjon." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kunne ikke opprette selskap. Sjekk at du har valgt organisasjon." }, { status: 500 });
  }
});
