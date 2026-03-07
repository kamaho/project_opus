import { NextResponse } from "next/server";
import { withTenant, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookSubscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { subscribe, unsubscribe } from "@/lib/webhooks/subscription-manager";
import { tripletexRequest } from "@/lib/tripletex";

/**
 * POST /api/admin/webhooks/resubscribe?mode=reenable|recreate
 * - mode=reenable (default): Re-enables disabled subscriptions on Tripletex via PUT
 * - mode=recreate: Deletes and re-creates all subscriptions from scratch
 */
export const POST = withTenant(async (req, ctx) => {
  requireAdmin(ctx);

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "reenable";

  const [existing] = await db
    .select({
      id: webhookSubscriptions.id,
      externalSubId: webhookSubscriptions.externalSubId,
      webhookUrl: webhookSubscriptions.webhookUrl,
    })
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.tenantId, ctx.tenantId),
        eq(webhookSubscriptions.source, "tripletex")
      )
    )
    .limit(1);

  if (mode === "reenable" && existing?.externalSubId) {
    const externalIds = existing.externalSubId.split(",").filter(Boolean);
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const extId of externalIds) {
      try {
        const current = await tripletexRequest<{
          value?: { id: number; status: string; event: string; targetUrl: string };
        }>({
          method: "GET",
          path: `/event/subscription/${extId}`,
          tenantId: ctx.tenantId,
        });

        const status = String(current.value?.status ?? "").toUpperCase();

        if (status === "ACTIVE") {
          results.push({ id: extId, status: "already_active" });
          continue;
        }

        await tripletexRequest({
          method: "PUT",
          path: `/event/subscription/${extId}`,
          body: {
            id: Number(extId),
            event: current.value?.event,
            targetUrl: current.value?.targetUrl,
            status: "ACTIVE",
          },
          tenantId: ctx.tenantId,
        });

        results.push({ id: extId, status: "reactivated" });
      } catch (err) {
        results.push({
          id: extId,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const reactivated = results.filter((r) => r.status === "reactivated").length;

    return NextResponse.json({
      status: "ok",
      mode: "reenable",
      message: `${reactivated} abonnement(er) reaktivert.`,
      results,
    });
  }

  const oldUrl = existing?.webhookUrl ?? null;
  const oldExternalIds = existing?.externalSubId ?? null;

  try {
    if (existing) {
      await unsubscribe(ctx.tenantId, "tripletex");
    }
  } catch (err) {
    console.warn(
      "[admin/resubscribe] Cleanup failed (non-blocking):",
      err instanceof Error ? err.message : err
    );
  }

  try {
    const result = await subscribe(ctx.tenantId, "tripletex");

    const [newSub] = await db
      .select({
        webhookUrl: webhookSubscriptions.webhookUrl,
        externalSubId: webhookSubscriptions.externalSubId,
      })
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.tenantId, ctx.tenantId),
          eq(webhookSubscriptions.source, "tripletex")
        )
      )
      .limit(1);

    return NextResponse.json({
      status: "ok",
      mode: "recreate",
      message: "Webhook-abonnementer opprettet på nytt.",
      old: { webhookUrl: oldUrl, externalSubIds: oldExternalIds },
      new: {
        subscriptionId: result.subscriptionId,
        externalSubIds: result.externalSubIds,
        webhookUrl: newSub?.webhookUrl,
      },
    });
  } catch (err) {
    console.error("[admin/resubscribe] Re-subscribe failed:", err);
    return NextResponse.json(
      {
        error: "Kunne ikke opprette nye webhook-abonnementer.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
