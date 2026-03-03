import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/webhooks/subscriptions
 * Lists all webhook subscriptions for the current tenant.
 */
export const GET = withTenant(async (_req, ctx) => {
  requireAdmin(ctx);

  const subs = await db
    .select({
      id: webhookSubscriptions.id,
      source: webhookSubscriptions.source,
      webhookUrl: webhookSubscriptions.webhookUrl,
      eventTypes: webhookSubscriptions.eventTypes,
      status: webhookSubscriptions.status,
      lastEventAt: webhookSubscriptions.lastEventAt,
      createdAt: webhookSubscriptions.createdAt,
      updatedAt: webhookSubscriptions.updatedAt,
    })
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.tenantId, ctx.tenantId));

  return NextResponse.json({ subscriptions: subs });
});
