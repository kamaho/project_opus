import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const client = await validateClientTenant(clientId, orgId);
  if (!client) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || !("userId" in body)) {
    return NextResponse.json({ error: "userId er påkrevd" }, { status: 400 });
  }

  const userId = body.userId as string | null;

  await db
    .update(clients)
    .set({ assignedUserId: userId })
    .where(eq(clients.id, clientId));

  return NextResponse.json({ ok: true, assignedUserId: userId });
}
