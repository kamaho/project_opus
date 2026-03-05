import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookInbox } from "@/lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

/**
 * GET /api/admin/webhooks/inbox?status=failed&limit=50
 * Lists webhook inbox events for the current tenant.
 */
export const GET = withTenant(async (req, ctx) => {
  requireAdmin(ctx);

  const url = new URL(req.url);
  const validStatuses = ["pending", "processing", "completed", "failed", "skipped"] as const;
  type InboxStatus = (typeof validStatuses)[number];
  const rawStatus = url.searchParams.get("status") ?? "failed";
  const status: InboxStatus = validStatuses.includes(rawStatus as InboxStatus)
    ? (rawStatus as InboxStatus)
    : "failed";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);

  const events = await db
    .select({
      id: webhookInbox.id,
      source: webhookInbox.source,
      eventType: webhookInbox.eventType,
      externalId: webhookInbox.externalId,
      status: webhookInbox.status,
      attempts: webhookInbox.attempts,
      lastError: webhookInbox.lastError,
      processAfter: webhookInbox.processAfter,
      processedAt: webhookInbox.processedAt,
      createdAt: webhookInbox.createdAt,
    })
    .from(webhookInbox)
    .where(
      and(
        eq(webhookInbox.tenantId, ctx.tenantId),
        eq(webhookInbox.status, status)
      )
    )
    .orderBy(desc(webhookInbox.createdAt))
    .limit(limit);

  const [counts] = await db
    .select({
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      processing: sql<number>`count(*) filter (where status = 'processing')`,
      completed: sql<number>`count(*) filter (where status = 'completed')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
      skipped: sql<number>`count(*) filter (where status = 'skipped')`,
    })
    .from(webhookInbox)
    .where(eq(webhookInbox.tenantId, ctx.tenantId));

  return NextResponse.json({ events, counts });
});

/**
 * POST /api/admin/webhooks/inbox/replay
 * body: { ids: string[] } — re-enqueue failed events for reprocessing
 */
export const POST = withTenant(async (req, ctx) => {
  requireAdmin(ctx);

  const replaySchema = z.object({
    ids: z
      .array(z.string().uuid("Hver ID må være en gyldig UUID"))
      .min(1, "Minst én ID er påkrevd")
      .max(100, "Maks 100 events per replay"),
  });

  const parsed = replaySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { ids } = parsed.data;

  const result = await db
    .update(webhookInbox)
    .set({
      status: "pending",
      processAfter: new Date(),
      lastError: null,
    })
    .where(
      and(
        eq(webhookInbox.tenantId, ctx.tenantId),
        eq(webhookInbox.status, "failed"),
        inArray(webhookInbox.id, ids)
      )
    )
    .returning({ id: webhookInbox.id });

  return NextResponse.json({ replayed: result.length });
});
