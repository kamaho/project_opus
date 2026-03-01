import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const PATCH = withTenant(async (_req, { tenantId, userId }, params) => {
  const id = params!.id;

  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        eq(notifications.tenantId, tenantId)
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
});
