import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  clientGroups,
  clientGroupMembers,
  clients,
  companies,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { previewAutoMatch, runAutoMatch, TooManyTransactionsError } from "@/lib/matching/engine";
import { logAudit } from "@/lib/audit";

export const maxDuration = 120;

export interface GroupAutoMatchClientResult {
  clientId: string;
  clientName: string;
  matches: number;
  transactions: number;
  remainingOpen: number;
}

export interface GroupAutoMatchResult {
  totalMatches: number;
  totalTransactions: number;
  clients: GroupAutoMatchClientResult[];
  durationMs: number;
}

export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  const groupId = params!.groupId;

  const [group] = await db
    .select({ id: clientGroups.id, name: clientGroups.name })
    .from(clientGroups)
    .where(and(eq(clientGroups.id, groupId), eq(clientGroups.tenantId, tenantId)));

  if (!group) {
    return NextResponse.json({ error: "Gruppe ikke funnet" }, { status: 404 });
  }

  const memberRows = await db
    .select({
      clientId: clientGroupMembers.clientId,
      clientName: clients.name,
    })
    .from(clientGroupMembers)
    .innerJoin(clients, eq(clientGroupMembers.clientId, clients.id))
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(
      and(
        eq(clientGroupMembers.groupId, groupId),
        eq(companies.tenantId, tenantId)
      )
    );

  if (memberRows.length === 0) {
    return NextResponse.json(
      { error: "Gruppen har ingen klienter" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const mode = (body as { mode?: string }).mode ?? "preview";
  const startMs = Date.now();

  try {
    if (mode === "commit") {
      const MAX_CONCURRENT = 3;
      const clientResults: GroupAutoMatchClientResult[] = [];
      let totalMatches = 0;
      let totalTransactions = 0;

      const tasks = memberRows.map((member) => async () => {
        const result = await runAutoMatch(member.clientId, userId);
        return {
          clientId: member.clientId,
          clientName: member.clientName,
          matches: result.totalMatches,
          transactions: result.totalTransactions,
          remainingOpen: result.remainingOpen,
        };
      });

      let idx = 0;
      const running: Promise<void>[] = [];
      async function next(): Promise<void> {
        const i = idx++;
        if (i >= tasks.length) return;
        const result = await tasks[i]();
        clientResults.push(result);
        totalMatches += result.matches;
        totalTransactions += result.transactions;
        await next();
      }
      for (let i = 0; i < Math.min(MAX_CONCURRENT, tasks.length); i++) {
        running.push(next());
      }
      await Promise.all(running);

      if (totalMatches > 0) {
        await logAudit({
          tenantId,
          userId,
          action: "match.created",
          entityType: "match",
          metadata: {
            type: "group-auto",
            groupId,
            groupName: group.name,
            matchCount: totalMatches,
            transactionCount: totalTransactions,
            clientCount: memberRows.length,
          },
        });
      }

      const response: GroupAutoMatchResult = {
        totalMatches,
        totalTransactions,
        clients: clientResults,
        durationMs: Date.now() - startMs,
      };

      return NextResponse.json(response);
    }

    const previews = await Promise.all(
      memberRows.map(async (member) => {
        const stats = await previewAutoMatch(member.clientId);
        return {
          clientId: member.clientId,
          clientName: member.clientName,
          matches: stats.totalMatches,
          transactions: stats.totalTransactions,
          remainingOpen: 0,
        };
      })
    );

    const response: GroupAutoMatchResult = {
      totalMatches: previews.reduce((s, p) => s + p.matches, 0),
      totalTransactions: previews.reduce((s, p) => s + p.transactions, 0),
      clients: previews,
      durationMs: Date.now() - startMs,
    };

    return NextResponse.json(response);
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
    console.error("[group-auto-match] Failed:", err);
    return NextResponse.json({ error: "Gruppe-matching feilet" }, { status: 500 });
  }
});
