import { NextResponse } from "next/server";
import { tripletexAdapter, getTripletexWebhookSecret } from "@/lib/webhooks/sources/tripletex";
import { receiveWebhookBatch } from "@/lib/webhooks/receiver";

export const dynamic = "force-dynamic";

const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1 MB

/**
 * POST /api/webhooks/tripletex?tenant={tenantId}
 *
 * Receives webhook events from Tripletex.
 * - No Clerk auth (public route, protected by webhook secret)
 * - Always returns 200 to avoid Tripletex disabling the subscription
 * - Only returns 401 for signature validation failures
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenant");

  if (!tenantId) {
    console.warn("[webhook/tripletex] Missing tenant query parameter");
    return NextResponse.json({ error: "Missing tenant" }, { status: 400 });
  }

  let rawBody: Buffer;
  try {
    const arrayBuffer = await request.arrayBuffer();
    rawBody = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (rawBody.length > MAX_PAYLOAD_SIZE) {
    console.warn(`[webhook/tripletex] Payload too large: ${rawBody.length} bytes`);
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const secret = await getTripletexWebhookSecret(tenantId);
  if (!secret) {
    console.warn(`[webhook/tripletex] No active subscription for tenant ${tenantId}`);
    return NextResponse.json({ error: "No active subscription" }, { status: 401 });
  }

  const validation = tripletexAdapter.validateSignature(rawBody, request.headers, secret);
  if (!validation.valid) {
    console.warn(`[webhook/tripletex] Signature validation failed: ${validation.error}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const events = tripletexAdapter.normalizeEvents(rawBody);

    const enriched = events.map((e) => ({ ...e, tenantId }));
    const result = await receiveWebhookBatch(enriched);

    console.log(
      `[webhook/tripletex] tenant=${tenantId} inserted=${result.inserted} duplicates=${result.duplicates}`
    );

    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("[webhook/tripletex] Processing error:", error);
    return NextResponse.json({ received: true });
  }
}
