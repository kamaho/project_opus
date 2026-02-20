import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
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
