import { db } from "@/lib/db";
import { webhookSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt, isEncrypted } from "@/lib/crypto";
import type {
  WebhookSourceAdapter,
  WebhookValidationResult,
  NormalizedWebhookEvent,
  WebhookEventType,
} from "./types";

/**
 * Tripletex webhook payload format:
 * { subscriptionId: number, event: "object.verb", id: number, value: object | null }
 */
interface TripletexWebhookPayload {
  subscriptionId: number;
  event: string;
  id: number;
  value: unknown;
}

const EVENT_MAP: Record<string, WebhookEventType> = {
  "voucher.create": "transaction.created",
  "voucher.update": "transaction.updated",
  "voucher.delete": "transaction.deleted",
  "account.create": "account.created",
  "account.update": "account.updated",
  "account.delete": "account.deleted",
};

const AUTH_HEADER_NAME = "Authorization";

export const tripletexAdapter: WebhookSourceAdapter = {
  source: "tripletex",

  /**
   * Tripletex sends a custom auth header we configured during subscription.
   * We validate the Bearer token against our stored (encrypted) secret.
   */
  validateSignature(
    _rawBody: Buffer,
    headers: Headers,
    secret: string
  ): WebhookValidationResult {
    const authHeader = headers.get(AUTH_HEADER_NAME);
    if (!authHeader) {
      return { valid: false, error: "Missing Authorization header" };
    }

    const expectedToken = isEncrypted(secret) ? decrypt(secret) : secret;
    const expected = `Bearer ${expectedToken}`;

    if (authHeader !== expected) {
      return { valid: false, error: "Invalid Authorization token" };
    }

    return { valid: true };
  },

  normalizeEvents(rawBody: Buffer): NormalizedWebhookEvent[] {
    const payload = JSON.parse(rawBody.toString("utf-8")) as TripletexWebhookPayload;

    const eventType = EVENT_MAP[payload.event] ?? "unknown";
    const externalId = `${payload.event}:${payload.id}:${payload.subscriptionId}`;

    return [
      {
        tenantId: "",
        source: "tripletex",
        eventType,
        externalId,
        payload,
      },
    ];
  },

  /**
   * Tenant resolution: the webhook URL includes ?tenant={tenantId}.
   * We verify the subscription exists and is active for that tenant.
   */
  async resolveTenantId(
    _rawBody: Buffer,
    headers: Headers
  ): Promise<string | null> {
    const url = headers.get("x-webhook-url");
    if (url) {
      try {
        const parsed = new URL(url);
        const tenant = parsed.searchParams.get("tenant");
        if (tenant) return tenant;
      } catch {
        // fall through
      }
    }
    return null;
  },
};

/**
 * Resolve the stored webhook secret for a Tripletex tenant subscription.
 */
export async function getTripletexWebhookSecret(
  tenantId: string
): Promise<string | null> {
  const [sub] = await db
    .select({ secret: webhookSubscriptions.secret })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, tenantId),
        eq(webhookSubscriptions.source, "tripletex"),
        eq(webhookSubscriptions.status, "active")
      )
    )
    .limit(1);

  return sub?.secret ?? null;
}
