import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { seedStandardRules } from "@/lib/matching/seed-rules";

/**
 * POST: Seed the standard 10-rule set for a client.
 */
export const POST = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  try {
    const result = await seedStandardRules(clientId, tenantId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[seed-rules] Failed:", err);
    return NextResponse.json(
      { error: "Seeding feilet" },
      { status: 500 }
    );
  }
});
