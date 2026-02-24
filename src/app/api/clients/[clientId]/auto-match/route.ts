import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { validateClientTenant } from "@/lib/db/tenant";
import { previewAutoMatch, runAutoMatch } from "@/lib/matching/engine";
import { logAudit } from "@/lib/audit";
import { notifySmartMatchCompleted } from "@/lib/notifications";

/**
 * POST: Auto-match endpoint.
 * - Default (no body or mode=preview): runs pipeline, returns stats only (no DB writes)
 * - mode=commit: runs pipeline + commits all matches in bulk, returns stats + matched tx IDs
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const mode = (body as { mode?: string }).mode ?? "preview";

  try {
    if (mode === "commit") {
      const result = await runAutoMatch(clientId, userId);

      if (result.totalMatches > 0) {
        await logAudit({
          tenantId: orgId,
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
          tenantId: orgId,
          userId,
          clientId,
          clientName: clientRow.name,
          matchCount: result.totalMatches,
          transactionCount: result.totalTransactions,
        }).catch((e) => console.error("[auto-match] notification failed:", e));
      }

      return NextResponse.json(result);
    }

    const stats = await previewAutoMatch(clientId);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[auto-match] Failed:", err);
    return NextResponse.json(
      { error: "Matching feilet", details: String(err) },
      { status: 500 }
    );
  }
}
