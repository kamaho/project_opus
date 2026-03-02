import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { tripletexWhoAmI } from "@/lib/tripletex";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req, { tenantId }) => {
  try {
    const data = await tripletexWhoAmI(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[tripletex/whoami]", error);
    return NextResponse.json({ error: "Tripletex-tilkobling feilet" }, { status: 502 });
  }
});
