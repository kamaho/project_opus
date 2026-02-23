import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST() {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.tenantId, orgId),
        eq(notifications.read, false)
      )
    );

  return NextResponse.json({ ok: true });
}
