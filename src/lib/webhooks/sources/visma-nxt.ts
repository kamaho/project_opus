import { db } from "@/lib/db";
import { vismaNxtConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "crypto";
import type {
  WebhookSourceAdapter,
  WebhookValidationResult,
  NormalizedWebhookEvent,
  WebhookEventType,
} from "./types";
import type { VnxtWebhookPayload } from "@/lib/visma-nxt/types";

// ---------------------------------------------------------------------------
// Visma NXT TableChange event → normalized event type mapping
// ---------------------------------------------------------------------------

const TABLE_EVENT_MAP: Record<string, Record<string, WebhookEventType>> = {
  GeneralLedgerTransaction: {
    INSERT: "transaction.created",
    UPDATE: "transaction.updated",
    DELETE: "transaction.deleted",
  },
  GeneralLedgerAccount: {
    INSERT: "account.created",
    UPDATE: "account.updated",
    DELETE: "account.deleted",
  },
  CustomerTransaction: {
    INSERT: "transaction.created",
    UPDATE: "transaction.updated",
    DELETE: "transaction.deleted",
  },
  SupplierTransaction: {
    INSERT: "transaction.created",
    UPDATE: "transaction.updated",
    DELETE: "transaction.deleted",
  },
};

const SIGNATURE_HEADER = "x-webhook-signature";

export const vismaNxtAdapter: WebhookSourceAdapter = {
  source: "visma_nxt",

  /**
   * Visma NXT uses HMAC-SHA256 signature verification.
   * The signature is Base64-encoded HMAC of the raw body.
   */
  validateSignature(
    rawBody: Buffer,
    headers: Headers,
    secret: string
  ): WebhookValidationResult {
    const signature = headers.get(SIGNATURE_HEADER);
    if (!signature) {
      return { valid: false, error: "Missing webhook signature header" };
    }

    const computed = createHmac("sha256", secret)
      .update(rawBody)
      .digest("base64");

    try {
      const sigBuf = Buffer.from(signature, "base64");
      const computedBuf = Buffer.from(computed, "base64");

      if (
        sigBuf.length !== computedBuf.length ||
        !timingSafeEqual(sigBuf, computedBuf)
      ) {
        return { valid: false, error: "Invalid webhook signature" };
      }
    } catch {
      return { valid: false, error: "Signature comparison failed" };
    }

    return { valid: true };
  },

  normalizeEvents(rawBody: Buffer): NormalizedWebhookEvent[] {
    const payload = JSON.parse(
      rawBody.toString("utf-8")
    ) as VnxtWebhookPayload;

    const tableMap = TABLE_EVENT_MAP[payload.tableIdentifier];
    const eventType: WebhookEventType = tableMap?.[payload.event] ?? "unknown";

    const primaryKeyStr = payload.primaryKeys
      ?.map((pk) => Object.values(pk).join("-"))
      .join("_") ?? "unknown";

    const externalId = `${payload.tableIdentifier}:${payload.event}:${primaryKeyStr}:${payload.companyNo}`;

    return [
      {
        tenantId: "",
        source: "visma_nxt",
        eventType,
        externalId,
        payload,
      },
    ];
  },

  /**
   * Resolve tenant by looking up companyNo from the webhook payload
   * against vismaNxtConnections.
   */
  async resolveTenantId(
    rawBody: Buffer,
    _headers: Headers
  ): Promise<string | null> {
    const payload = JSON.parse(
      rawBody.toString("utf-8")
    ) as VnxtWebhookPayload;

    if (!payload.companyNo) return null;

    const [conn] = await db
      .select({ tenantId: vismaNxtConnections.tenantId })
      .from(vismaNxtConnections)
      .where(
        and(
          eq(vismaNxtConnections.companyNo, payload.companyNo),
          eq(vismaNxtConnections.isActive, true)
        )
      )
      .limit(1);

    return conn?.tenantId ?? null;
  },
};
