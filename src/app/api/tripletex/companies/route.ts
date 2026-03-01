import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { tripletexGet } from "@/lib/tripletex";
import type { TxCompany } from "@/lib/tripletex/types";

export const dynamic = "force-dynamic";

interface CompanyListResponse {
  fullResultSize: number;
  values: TxCompany[];
}

interface WhoAmIResponse {
  value: { companyId: number };
}

/**
 * GET /api/tripletex/companies
 * Lists companies accessible via the current Tripletex token.
 * Uses per-tenant credentials from DB, falling back to env vars.
 */
export const GET = withTenant(async (_req, { tenantId }) => {
  try {
    const companies: Array<{
      id: number;
      name: string;
      orgNumber: string | null;
      type: string | null;
    }> = [];

    const whoami = await tripletexGet<WhoAmIResponse>(
      "/token/session/>whoAmI",
      undefined,
      tenantId
    );
    const ownCompanyId = whoami.value.companyId;

    const ownCompany = await tripletexGet<{ value: TxCompany }>(
      `/company/${ownCompanyId}`,
      { fields: "id,name,displayName,organizationNumber,type" },
      tenantId
    );

    companies.push({
      id: ownCompany.value.id,
      name: ownCompany.value.displayName || ownCompany.value.name,
      orgNumber: ownCompany.value.organizationNumber || null,
      type: ownCompany.value.type || null,
    });

    try {
      const clientCompanies = await tripletexGet<CompanyListResponse>(
        "/company/>withLoginAccess",
        { fields: "id,name,displayName,organizationNumber,type", count: 1000 },
        tenantId
      );

      for (const c of clientCompanies.values) {
        if (c.id !== ownCompanyId) {
          companies.push({
            id: c.id,
            name: c.displayName || c.name,
            orgNumber: c.organizationNumber || null,
            type: c.type || null,
          });
        }
      }
    } catch {
      // withLoginAccess may fail for non-accountant tokens
    }

    return NextResponse.json({ companies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
