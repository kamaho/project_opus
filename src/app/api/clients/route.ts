import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getClientsByTenant } from "@/lib/db/tenant";

/** GET: Liste kontoer (avstemmingsenheter) for org. Optional ?companyId= for å filtrere på selskap. */
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
