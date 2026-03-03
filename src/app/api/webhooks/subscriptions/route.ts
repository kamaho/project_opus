import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import {
  subscribe,
  unsubscribe,
  verifySubscription,
} from "@/lib/webhooks/subscription-manager";
import type { WebhookSource } from "@/lib/webhooks/sources/types";

/**
 * GET /api/webhooks/subscriptions?source=tripletex
 * Returns current subscription status for the tenant.
 */
export const GET = withTenant(async (req, { tenantId }) => {
  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "tripletex") as WebhookSource;

  const result = await verifySubscription(tenantId, source);
  return NextResponse.json(result);
});

/**
 * POST /api/webhooks/subscriptions
 * Creates or re-activates webhook subscriptions.
 */
export const POST = withTenant(async (req, ctx) => {
  requireAdmin(ctx);
  const body = await req.json();
  const source = (body?.source ?? "tripletex") as WebhookSource;
  const eventTypes = body?.eventTypes as string[] | undefined;

  const result = await subscribe(ctx.tenantId, source, eventTypes);
  return NextResponse.json(result, { status: 201 });
});

/**
 * DELETE /api/webhooks/subscriptions?source=tripletex
 * Removes webhook subscriptions for the tenant.
 */
export const DELETE = withTenant(async (req, ctx) => {
  requireAdmin(ctx);
  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "tripletex") as WebhookSource;

  await unsubscribe(ctx.tenantId, source);
  return NextResponse.json({ ok: true });
});
