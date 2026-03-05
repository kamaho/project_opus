import { NextResponse } from "next/server";
import { vismaNxtAdapter } from "@/lib/webhooks/sources/visma-nxt";
import { receiveWebhook } from "@/lib/webhooks/receiver";

function getWebhookSecret(): string {
  const secret = process.env.VISMA_WEBHOOK_SECRET;
  if (!secret) throw new Error("VISMA_WEBHOOK_SECRET is not set");
  return secret;
}

export async function POST(request: Request) {
  let rawBody: Buffer;
  try {
    const arrayBuffer = await request.arrayBuffer();
    rawBody = Buffer.from(arrayBuffer);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const headers = request.headers;

  const validation = vismaNxtAdapter.validateSignature(
    rawBody,
    headers,
    getWebhookSecret()
  );
  if (!validation.valid) {
    console.warn(
      `[webhook/visma-nxt] Signature validation failed: ${validation.error}`
    );
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const tenantId = await vismaNxtAdapter.resolveTenantId(rawBody, headers);
  if (!tenantId) {
    console.warn(
      "[webhook/visma-nxt] Could not resolve tenant from webhook payload"
    );
    return NextResponse.json(
      { error: "Unknown tenant" },
      { status: 404 }
    );
  }

  const events = vismaNxtAdapter.normalizeEvents(rawBody);

  for (const event of events) {
    event.tenantId = tenantId;
    await receiveWebhook(event);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
