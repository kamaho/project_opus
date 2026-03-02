import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { previewAutoMatch, runAutoMatch, TooManyTransactionsError } from "@/lib/matching/engine";
import { logAudit } from "@/lib/audit";
import { notifySmartMatchCompleted } from "@/lib/notifications";

/**
 * POST: Auto-match endpoint.
 * - Default (no body or mode=preview): runs pipeline, returns stats only (no DB writes)
 * - mode=commit: runs pipeline + commits all matches in bulk, returns stats + matched tx IDs
 */
export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  const clientRow = await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => ({}));
  const mode = (body as { mode?: string }).mode ?? "preview";

  try {
    if (mode === "commit") {
      const result = await runAutoMatch(clientId, userId);

      if (result.totalMatches > 0) {
        await logAudit({
          tenantId,
          userId,
          action: "match.created",
          entityType: "match",
          metadata: {
            type: "auto",
            matchCount: result.totalMatches,
            transactionCount: result.totalTransactions,
          },
        });

        notifySmartMatchCompleted({
          tenantId,
          userId,
          clientId,
          clientName: clientRow.name,
          matchCount: result.totalMatches,
          transactionCount: result.totalTransactions,
          periodFrom: result.periodFrom,
          periodTo: result.periodTo,
          remainingOpen: result.remainingOpen,
          totalItems: result.totalItems,
        }).catch((e) => console.error("[auto-match] notification failed:", e));
      }

      return NextResponse.json(result);
    }

    const stats = await previewAutoMatch(clientId);
    return NextResponse.json(stats);
  } catch (err) {
    if (err instanceof TooManyTransactionsError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          set1Count: err.set1Count,
          set2Count: err.set2Count,
          limit: err.limit,
        },
        { status: 400 }
      );
    }
    console.error("[auto-match] Failed:", err);
    return NextResponse.json({ error: "Matching feilet" }, { status: 500 });
  }
});
