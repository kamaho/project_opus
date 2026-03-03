import { db } from "@/lib/db";
import { webhookInbox, webhookSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { NormalizedWebhookEvent, WebhookSource } from "./sources/types";

export type ReceiveResult = "inserted" | "duplicate";

/**
 * Inserts a normalized webhook event into the inbox.
 * Uses ON CONFLICT DO NOTHING for idempotency — duplicate externalIds are silently skipped.
 */
export async function receiveWebhook(
  event: NormalizedWebhookEvent
): Promise<ReceiveResult> {
  const result = await db
    .insert(webhookInbox)
    .values({
      tenantId: event.tenantId,
      source: event.source,
      eventType: event.eventType,
      externalId: event.externalId,
      payload: event.payload,
    })
    .onConflictDoNothing({
      target: [webhookInbox.tenantId, webhookInbox.source, webhookInbox.externalId],
    })
    .returning({ id: webhookInbox.id });

  if (result.length === 0) {
    return "duplicate";
  }

  await updateLastEventAt(event.tenantId, event.source);
  return "inserted";
}

/**
 * Inserts multiple events in a single batch.
 * Returns counts of inserted vs. duplicates.
 */
export async function receiveWebhookBatch(
  events: NormalizedWebhookEvent[]
): Promise<{ inserted: number; duplicates: number }> {
  if (events.length === 0) return { inserted: 0, duplicates: 0 };

  const result = await db
    .insert(webhookInbox)
    .values(
      events.map((e) => ({
        tenantId: e.tenantId,
        source: e.source,
        eventType: e.eventType,
        externalId: e.externalId,
        payload: e.payload,
      }))
    )
    .onConflictDoNothing({
      target: [webhookInbox.tenantId, webhookInbox.source, webhookInbox.externalId],
    })
    .returning({ id: webhookInbox.id });

  const inserted = result.length;
  const duplicates = events.length - inserted;

  if (inserted > 0) {
    const sources = new Set(events.map((e) => `${e.tenantId}:${e.source}`));
    for (const key of sources) {
      const [tenantId, source] = key.split(":");
      await updateLastEventAt(tenantId, source as WebhookSource);
    }
  }

  return { inserted, duplicates };
}

async function updateLastEventAt(tenantId: string, source: WebhookSource) {
  await db
    .update(webhookSubscriptions)
    .set({ lastEventAt: new Date() })
    .where(
      and(
        eq(webhookSubscriptions.tenantId, tenantId),
        eq(webhookSubscriptions.source, source),
        eq(webhookSubscriptions.status, "active")
      )
    );
}
