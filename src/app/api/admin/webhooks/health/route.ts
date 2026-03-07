import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookSubscriptions, tripletexConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { tripletexRequest } from "@/lib/tripletex";

interface TripletexSubscription {
  value?: {
    id: number;
    event: string;
    targetUrl: string;
    status: string;
  };
}

/**
 * GET /api/admin/webhooks/health
 * Verifies Tripletex webhook subscriptions are active on both sides.
 */
export const GET = withTenant(async (_req, ctx) => {
  requireAdmin(ctx);

  const [sub] = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, ctx.tenantId),
        eq(webhookSubscriptions.source, "tripletex")
      )
    )
    .limit(1);

  if (!sub) {
    return NextResponse.json({
      status: "no_subscription",
      message: "Ingen webhook-abonnement funnet. Koble til Tripletex på nytt.",
      subscriptions: [],
    });
  }

  const externalIds = sub.externalSubId?.split(",").filter(Boolean) ?? [];

  if (externalIds.length === 0) {
    return NextResponse.json({
      status: "no_external_ids",
      message: "Webhook-abonnement finnes lokalt, men mangler Tripletex-IDer.",
      local: {
        id: sub.id,
        status: sub.status,
        webhookUrl: sub.webhookUrl,
        eventTypes: sub.eventTypes,
        lastEventAt: sub.lastEventAt,
        createdAt: sub.createdAt,
      },
      tripletex: [],
    });
  }

  const tripletexResults: Array<{
    externalId: string;
    status: string;
    event?: string;
    targetUrl?: string;
    error?: string;
  }> = [];

  for (const extId of externalIds) {
    try {
      const result = await tripletexRequest<TripletexSubscription>({
        method: "GET",
        path: `/event/subscription/${extId}`,
        tenantId: ctx.tenantId,
      });

      const val = result.value;
      const ttxStatus = String(val?.status ?? "unknown").toUpperCase();
      tripletexResults.push({
        externalId: extId,
        status: ttxStatus,
        event: val?.event,
        targetUrl: val?.targetUrl,
      });
    } catch (err) {
      tripletexResults.push({
        externalId: extId,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allActive = tripletexResults.every((r) => r.status === "ACTIVE");
  const disabledCount = tripletexResults.filter(
    (r) => r.status === "DISABLED_TOO_MANY_ERRORS"
  ).length;
  const urlMismatch = tripletexResults.some(
    (r) => r.targetUrl && r.targetUrl !== sub.webhookUrl
  );

  let message: string;
  if (allActive) {
    message = "Alle webhook-abonnementer er aktive.";
  } else if (disabledCount > 0) {
    message = `${disabledCount} abonnement(er) er deaktivert av Tripletex (for mange feilede leveringer). Bruk /api/admin/webhooks/resubscribe for å opprette nye.`;
  } else {
    message = "Ett eller flere abonnementer har ukjent status.";
  }

  return NextResponse.json({
    status: allActive ? "healthy" : "unhealthy",
    message,
    urlMismatch,
    disabledCount,
    local: {
      id: sub.id,
      status: sub.status,
      webhookUrl: sub.webhookUrl,
      eventTypes: sub.eventTypes,
      lastEventAt: sub.lastEventAt,
      createdAt: sub.createdAt,
    },
    tripletex: tripletexResults,
  });
});
