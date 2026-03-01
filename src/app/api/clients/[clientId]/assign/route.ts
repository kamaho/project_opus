import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => null);
  if (!body || !("userId" in body)) {
    return NextResponse.json({ error: "userId er påkrevd" }, { status: 400 });
  }

  const userId = body.userId as string | null;

  await db
    .update(clients)
    .set({ assignedUserId: userId })
    .where(eq(clients.id, clientId));

  return NextResponse.json({ ok: true, assignedUserId: userId });
});
