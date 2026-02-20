import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCompaniesByTenant } from "@/lib/db/tenant";

/** GET: Liste selskap for nåværende organisasjon (tenant). */
export async function GET() {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await getCompaniesByTenant(orgId);
  return NextResponse.json(list);
}
