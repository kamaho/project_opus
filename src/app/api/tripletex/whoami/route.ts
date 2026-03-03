import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth";
import { tripletexWhoAmI, TripletexError } from "@/lib/tripletex";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req, { tenantId }) => {
  try {
    const data = await tripletexWhoAmI(tenantId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[tripletex/whoami]", error);
    const message = error instanceof TripletexError
      ? error.userMessage
      : "Tripletex-tilkobling feilet. Sjekk konfigurasjonen.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
