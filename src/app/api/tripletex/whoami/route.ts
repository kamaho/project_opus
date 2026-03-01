import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { tripletexWhoAmI } from "@/lib/tripletex";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req, { tenantId }) => {
  try {
    const data = await tripletexWhoAmI(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
