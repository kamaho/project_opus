import { db } from "@/lib/db";
import { webhookInbox, webhookSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";
import { randomBytes } from "crypto";
import {
  tripletexRequest,
  getTripletexCredentials,
  TripletexError,
} from "@/lib/tripletex";
import type { WebhookSource } from "./sources/types";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.revizo.no";

const TRIPLETEX_EVENT_TYPES = [
  "voucher.create",
  "voucher.update",
  "voucher.delete",
  "account.create",
  "account.update",
  "account.delete",
];

const VISMA_NXT_EVENT_TYPES = ["TableChange"];

interface SubscribeResult {
  subscriptionId: string;
  externalSubIds: string[];
}

/**
 * Subscribe to webhook events for a tenant.
 * Creates subscriptions at the source (e.g. Tripletex) and stores them locally.
 */
export async function subscribe(
  tenantId: string,
  source: WebhookSource,
  eventTypes?: string[]
): Promise<SubscribeResult> {
  if (source === "visma_nxt") {
    return subscribeVismaNxt(tenantId, eventTypes);
  }

  if (source !== "tripletex") {
    throw new Error(`Unsupported webhook source: ${source}`);
  }

  const secret = randomBytes(32).toString("hex");
  const callbackUrl = `${APP_URL}/api/webhooks/tripletex?tenant=${encodeURIComponent(tenantId)}`;

  const events = eventTypes ?? TRIPLETEX_EVENT_TYPES;
  const externalSubIds: string[] = [];

  for (const event of events) {
    try {
      const result = await tripletexRequest<{
        value: { id: number };
      }>({
        method: "POST",
        path: "/event/subscription",
        body: {
          event,
          targetUrl: callbackUrl,
          authHeaderName: "Authorization",
          authHeaderValue: `Bearer ${secret}`,
        },
        tenantId,
      });

      externalSubIds.push(String(result.value.id));
    } catch (error) {
      if (error instanceof TripletexError && error.statusCode === 409) {
        console.warn(
          `[webhook/subscribe] Subscription for ${event} already exists for tenant=${tenantId}`
        );
        continue;
      }
      throw error;
    }
  }

  const encryptedSecret = encrypt(secret);

  const [sub] = await db
    .insert(webhookSubscriptions)
    .values({
      tenantId,
      source,
      externalSubId: externalSubIds.join(","),
      webhookUrl: callbackUrl,
      secret: encryptedSecret,
      eventTypes: events,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [webhookSubscriptions.tenantId, webhookSubscriptions.source],
      set: {
        externalSubId: externalSubIds.join(","),
        webhookUrl: callbackUrl,
        secret: encryptedSecret,
        eventTypes: events,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning({ id: webhookSubscriptions.id });

  return { subscriptionId: sub.id, externalSubIds };
}

/**
 * Unsubscribe from webhook events and clean up.
 */
export async function unsubscribe(
  tenantId: string,
  source: WebhookSource
): Promise<void> {
  const [sub] = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, tenantId),
        eq(webhookSubscriptions.source, source)
      )
    )
    .limit(1);

  if (!sub) return;

  if (source === "tripletex" && sub.externalSubId) {
    const ids = sub.externalSubId.split(",").filter(Boolean);
    for (const id of ids) {
      try {
        await tripletexRequest({
          method: "DELETE",
          path: `/event/subscription/${id}`,
          tenantId,
        });
      } catch (error) {
        console.warn(
          `[webhook/unsubscribe] Failed to delete external subscription ${id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  await db
    .update(webhookSubscriptions)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(webhookSubscriptions.id, sub.id));

  await db
    .update(webhookInbox)
    .set({ status: "skipped", processedAt: new Date() })
    .where(
      and(
        eq(webhookInbox.tenantId, tenantId),
        eq(webhookInbox.source, source),
        eq(webhookInbox.status, "pending")
      )
    );
}

/**
 * Subscribe to Visma NXT webhooks.
 * Visma NXT webhook subscriptions are configured via the Development Portal.
 * This function stores the subscription record locally for tracking.
 */
async function subscribeVismaNxt(
  tenantId: string,
  eventTypes?: string[]
): Promise<SubscribeResult> {
  const webhookSecret = process.env.VISMA_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("VISMA_WEBHOOK_SECRET is not set");
  }

  const callbackUrl = `${APP_URL}/api/webhooks/visma-nxt`;
  const events = eventTypes ?? VISMA_NXT_EVENT_TYPES;
  const encryptedSecret = encrypt(webhookSecret);

  const [sub] = await db
    .insert(webhookSubscriptions)
    .values({
      tenantId,
      source: "visma_nxt",
      externalSubId: null,
      webhookUrl: callbackUrl,
      secret: encryptedSecret,
      eventTypes: events,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [webhookSubscriptions.tenantId, webhookSubscriptions.source],
      set: {
        webhookUrl: callbackUrl,
        secret: encryptedSecret,
        eventTypes: events,
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning({ id: webhookSubscriptions.id });

  return { subscriptionId: sub.id, externalSubIds: [] };
}

/**
 * Verify that a subscription is active for a tenant.
 */
export async function verifySubscription(
  tenantId: string,
  source: WebhookSource
): Promise<{ active: boolean; eventTypes: string[] }> {
  const [sub] = await db
    .select({
      status: webhookSubscriptions.status,
      eventTypes: webhookSubscriptions.eventTypes,
    })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, tenantId),
        eq(webhookSubscriptions.source, source)
      )
    )
    .limit(1);

  if (!sub) {
    return { active: false, eventTypes: [] };
  }

  return {
    active: sub.status === "active",
    eventTypes: (sub.eventTypes as string[]) ?? [],
  };
}
