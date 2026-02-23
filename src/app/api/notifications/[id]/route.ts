import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteParams) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.tenantId, orgId)
      )
    );

  if (!row) {
    return NextResponse.json({ error: "Varsling ikke funnet" }, { status: 404 });
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));

  return NextResponse.json({ ok: true });
}
