import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import { clients, companies, transactions, bulkJobs } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";
import { previewAutoMatch, runAutoMatch } from "@/lib/matching/engine";

export const maxDuration = 120;

const schema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(200),
  mode: z.enum(["preview", "commit"]),
});

/**
 * POST /api/clients/bulk/auto-match
 *
 * Preview or commit Smart Match for multiple clients at once.
 * Validates tenant ownership and filters out clients that aren't ready.
 */
export const POST = withTenant(async (req: NextRequest, ctx) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { clientIds, mode } = parsed.data;

  const ownedClients = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      companyId: clients.companyId,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(
      and(
        eq(companies.tenantId, ctx.tenantId),
        inArray(clients.id, clientIds)
      )
    );

  const ownedIds = new Set(ownedClients.map((c) => c.clientId));
  const unauthorized = clientIds.filter((id) => !ownedIds.has(id));
  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: "En eller flere klienter tilhører ikke din organisasjon." },
      { status: 403 }
    );
  }

  const txCounts = await db
    .select({
      clientId: transactions.clientId,
      setNumber: transactions.setNumber,
      count: sql<number>`count(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.clientId, clientIds),
        eq(transactions.matchStatus, "unmatched")
      )
    )
    .groupBy(transactions.clientId, transactions.setNumber);

  const txByClient = new Map<string, { set1: number; set2: number }>();
  for (const row of txCounts) {
    const entry = txByClient.get(row.clientId) ?? { set1: 0, set2: 0 };
    if (row.setNumber === 1) entry.set1 = row.count;
    else entry.set2 = row.count;
    txByClient.set(row.clientId, entry);
  }

  const ready: typeof ownedClients = [];
  const skipped: { clientId: string; clientName: string; reason: string }[] = [];

  for (const cl of ownedClients) {
    const counts = txByClient.get(cl.clientId);
    if (!counts || (counts.set1 === 0 && counts.set2 === 0)) {
      skipped.push({ clientId: cl.clientId, clientName: cl.clientName, reason: "Ingen uavstemte transaksjoner" });
    } else if (counts.set1 === 0 || counts.set2 === 0) {
      skipped.push({ clientId: cl.clientId, clientName: cl.clientName, reason: `Mangler transaksjoner i ${counts.set1 === 0 ? "mengde 1" : "mengde 2"}` });
    } else {
      ready.push(cl);
    }
  }

  if (mode === "preview") {
    const previews = await Promise.all(
      ready.map(async (cl) => {
        try {
          const stats = await previewAutoMatch(cl.clientId);
          return {
            clientId: cl.clientId,
            clientName: cl.clientName,
            expectedMatches: stats.totalMatches,
            totalTransactions: stats.totalTransactions,
            durationMs: stats.durationMs,
            status: "ready" as const,
          };
        } catch {
          return {
            clientId: cl.clientId,
            clientName: cl.clientName,
            expectedMatches: 0,
            totalTransactions: 0,
            durationMs: 0,
            status: "error" as const,
          };
        }
      })
    );

    return NextResponse.json({
      ready: previews,
      skipped,
      totalReady: ready.length,
      totalSkipped: skipped.length,
    });
  }

  const [job] = await db
    .insert(bulkJobs)
    .values({
      tenantId: ctx.tenantId,
      type: "smart_match",
      status: "running",
      total: ready.length,
      completed: 0,
      results: [],
      createdBy: ctx.userId,
    })
    .returning();

  processInBackground(job.id, ready, ctx.userId);

  return NextResponse.json({
    jobId: job.id,
    totalReady: ready.length,
    totalSkipped: skipped.length,
    skipped,
  });
});

async function processInBackground(
  jobId: string,
  readyClients: { clientId: string; clientName: string }[],
  userId: string
) {
  const results: { clientId: string; clientName: string; matches: number; status: string; error?: string }[] = [];

  for (const cl of readyClients) {
    try {
      const result = await runAutoMatch(cl.clientId, userId);
      results.push({
        clientId: cl.clientId,
        clientName: cl.clientName,
        matches: result.totalMatches,
        status: "completed",
      });
    } catch (err) {
      results.push({
        clientId: cl.clientId,
        clientName: cl.clientName,
        matches: 0,
        status: "error",
        error: err instanceof Error ? err.message : "Ukjent feil",
      });
    }

    await db
      .update(bulkJobs)
      .set({
        completed: results.length,
        results,
        updatedAt: new Date(),
      })
      .where(eq(bulkJobs.id, jobId));
  }

  await db
    .update(bulkJobs)
    .set({
      status: results.some((r) => r.status === "error") ? "failed" : "completed",
      completed: results.length,
      results,
      updatedAt: new Date(),
    })
    .where(eq(bulkJobs.id, jobId));
}
