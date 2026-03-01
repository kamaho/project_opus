import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const GET = withTenant(async (req, { tenantId, userId }) => {
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);

  const conditions = [eq(notifications.userId, userId), eq(notifications.tenantId, tenantId)];
  if (unreadOnly) {
    conditions.push(eq(notifications.read, false));
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return NextResponse.json(rows);
});
