import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { validateClientTenant } from "@/lib/db/tenant";
import { seedStandardRules } from "@/lib/matching/seed-rules";

/**
 * POST: Seed the standard 10-rule set for a client.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  try {
    const result = await seedStandardRules(clientId, orgId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[seed-rules] Failed:", err);
    return NextResponse.json(
      { error: "Seeding feilet", details: String(err) },
      { status: 500 }
    );
  }
}
