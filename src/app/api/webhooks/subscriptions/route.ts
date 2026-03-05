import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import {
  subscribe,
  unsubscribe,
  verifySubscription,
} from "@/lib/webhooks/subscription-manager";
import type { WebhookSource } from "@/lib/webhooks/sources/types";
import { z } from "zod";

const webhookSourceSchema = z.enum(["tripletex", "visma_nxt", "poweroffice"]);

const subscribeSchema = z.object({
  source: webhookSourceSchema.default("tripletex"),
  eventTypes: z.array(z.string().min(1).max(100)).optional(),
});

/**
 * GET /api/webhooks/subscriptions?source=tripletex
 * Returns current subscription status for the tenant.
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const sourceResult = webhookSourceSchema.safeParse(url.searchParams.get("source") ?? "tripletex");
  const source: WebhookSource = sourceResult.success ? sourceResult.data : "tripletex";

  const result = await verifySubscription(tenantId, source);
  return NextResponse.json(result);
});

/**
 * POST /api/webhooks/subscriptions
 * Creates or re-activates webhook subscriptions.
 */
export const POST = withTenant(async (req, ctx) => {
  requireAdmin(ctx);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig data" },
      { status: 400 }
    );
  }

  const result = await subscribe(ctx.tenantId, parsed.data.source, parsed.data.eventTypes);
  return NextResponse.json(result, { status: 201 });
});

/**
 * DELETE /api/webhooks/subscriptions?source=tripletex
 * Removes webhook subscriptions for the tenant.
 */
export const DELETE = withTenant(async (req, ctx) => {
  requireAdmin(ctx);
  const url = new URL(req.url);
  const sourceResult = webhookSourceSchema.safeParse(url.searchParams.get("source") ?? "tripletex");
  const source: WebhookSource = sourceResult.success ? sourceResult.data : "tripletex";

  await unsubscribe(ctx.tenantId, source);
  return NextResponse.json({ ok: true });
});
