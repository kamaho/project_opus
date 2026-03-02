import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matches, transactions, clients } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logAuditTx } from "@/lib/audit";
import { z } from "zod";

const createMatchSchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(2),
});

/**
 * POST: Create a manual match from selected transactions.
 * Validates sum = 0 (or within tolerance), then atomically
 * creates a match record and updates all transactions.
 */
export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const body = await req.json().catch(() => ({}));
  const parsed = createMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ugyldig forespørsel", details: "Minst 2 transaksjons-IDer kreves." },
      { status: 400 }
    );
  }

  const { transactionIds } = parsed.data;

  const txRows = await db
    .select({
      id: transactions.id,
      clientId: transactions.clientId,
      setNumber: transactions.setNumber,
      amount: transactions.amount,
      matchStatus: transactions.matchStatus,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.clientId, clientId),
        inArray(transactions.id, transactionIds)
      )
    );

  if (txRows.length !== transactionIds.length) {
    return NextResponse.json(
      { error: "Transaksjoner ikke funnet", details: "Én eller flere transaksjoner tilhører ikke denne klienten." },
      { status: 400 }
    );
  }

  const alreadyMatched = txRows.filter((t) => t.matchStatus === "matched");
  if (alreadyMatched.length > 0) {
    return NextResponse.json(
      { error: "Allerede matchet", details: `${alreadyMatched.length} transaksjon(er) er allerede matchet.` },
      { status: 409 }
    );
  }

  const sum = txRows.reduce((s, t) => s + parseFloat(t.amount), 0);
  const roundedSum = Math.round(sum * 100) / 100;

  const [clientConfig] = await db
    .select({
      allowTolerance: clients.allowTolerance,
      toleranceAmount: clients.toleranceAmount,
    })
    .from(clients)
    .where(eq(clients.id, clientId));

  const tolerance = clientConfig?.allowTolerance
    ? parseFloat(clientConfig.toleranceAmount ?? "0")
    : 0;

  if (Math.abs(roundedSum) > tolerance) {
    return NextResponse.json(
      {
        error: "Sum er ikke null",
        details: `Summen av valgte transaksjoner er ${roundedSum.toFixed(2)}. Summen må være 0${tolerance > 0 ? ` (toleranse: ±${tolerance.toFixed(2)})` : ""}.`,
        sum: roundedSum,
      },
      { status: 400 }
    );
  }

  let result: { id: string };
  try {
    result = await db.transaction(async (tx) => {
      const [matchRow] = await tx
        .insert(matches)
        .values({
          clientId,
          matchType: "manual",
          difference: String(roundedSum),
          matchedBy: userId,
        })
        .returning({ id: matches.id });

      await tx
        .update(transactions)
        .set({ matchId: matchRow.id, matchStatus: "matched" })
        .where(
          and(
            eq(transactions.clientId, clientId),
            inArray(transactions.id, transactionIds)
          )
        );

      await logAuditTx(tx, {
        tenantId,
        userId,
        action: "match.created",
        entityType: "match",
        entityId: matchRow.id,
        metadata: {
          transactionCount: transactionIds.length,
          difference: roundedSum,
          setNumbers: [...new Set(txRows.map((t) => t.setNumber))],
        },
      });

      return matchRow;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
    console.error("[api/matches] POST error:", message, code, err);
    if (code === "42501") {
      return NextResponse.json({ error: "Ingen tilgang til å opprette match." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kunne ikke opprette match. Prøv igjen." }, { status: 500 });
  }

  return NextResponse.json({
    matchId: result.id,
    transactionCount: transactionIds.length,
  });
});

/**
 * DELETE: Unmatch — reverse a match, moving transactions back to unmatched.
 * Query params:
 *   ?matchId=uuid          — unmatch a single match group
 *   ?all=true              — unmatch ALL matches for this client
 *   ?transactionId=uuid    — remove a single transaction from its match group
 */
export const DELETE = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");
  const all = url.searchParams.get("all") === "true";
  const transactionId = url.searchParams.get("transactionId");

  if (all) {
    let result: { matchCount: number; transactionCount: number };
    try {
      result = await db.transaction(async (tx) => {
        const updated = await tx
          .update(transactions)
          .set({ matchId: null, matchStatus: "unmatched" })
          .where(
            and(
              eq(transactions.clientId, clientId),
              eq(transactions.matchStatus, "matched")
            )
          )
          .returning({ id: transactions.id });

        const deleted = await tx
          .delete(matches)
          .where(eq(matches.clientId, clientId))
          .returning({ id: matches.id });

        await logAuditTx(tx, {
          tenantId,
          userId,
          action: "match.deleted",
          entityType: "match",
          metadata: {
            matchCount: deleted.length,
            transactionCount: updated.length,
          },
        });

        return { matchCount: deleted.length, transactionCount: updated.length };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[api/matches] DELETE all error:", message, err);
      return NextResponse.json({ error: "Kunne ikke fjerne matcher. Prøv igjen." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result });
  }

  if (transactionId) {
    const [txRow] = await db
      .select({
        id: transactions.id,
        matchId: transactions.matchId,
        clientId: transactions.clientId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.clientId, clientId)
        )
      );

    if (!txRow || !txRow.matchId) {
      return NextResponse.json({ error: "Transaksjon ikke funnet eller ikke matchet" }, { status: 404 });
    }

    let result: { dissolved: boolean };
    try {
      result = await db.transaction(async (tx) => {
        await tx
          .update(transactions)
          .set({ matchId: null, matchStatus: "unmatched" })
          .where(eq(transactions.id, transactionId));

        const remaining = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(eq(transactions.matchId, txRow.matchId!));

        let dissolved = false;
        if (remaining.length < 2) {
          await tx
            .update(transactions)
            .set({ matchId: null, matchStatus: "unmatched" })
            .where(eq(transactions.matchId, txRow.matchId!));

          await tx.delete(matches).where(eq(matches.id, txRow.matchId!));
          dissolved = true;
        }

        await logAuditTx(tx, {
          tenantId,
          userId,
          action: "match.deleted",
          entityType: "match",
          entityId: txRow.matchId!,
          metadata: { transactionId, dissolved },
        });

        return { dissolved };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[api/matches] DELETE transactionId error:", message, err);
      return NextResponse.json({ error: "Kunne ikke fjerne match. Prøv igjen." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result });
  }

  if (!matchId) {
    return NextResponse.json({ error: "Mangler matchId, transactionId, eller all=true" }, { status: 400 });
  }

  const [matchRow] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.clientId, clientId)));

  if (!matchRow) {
    return NextResponse.json({ error: "Match ikke funnet" }, { status: 404 });
  }

  let result: { count: number };
  try {
    result = await db.transaction(async (tx) => {
      const updated = await tx
        .update(transactions)
        .set({ matchId: null, matchStatus: "unmatched" })
        .where(eq(transactions.matchId, matchId))
        .returning({ id: transactions.id });

      await tx.delete(matches).where(eq(matches.id, matchId));

      await logAuditTx(tx, {
        tenantId,
        userId,
        action: "match.deleted",
        entityType: "match",
        entityId: matchId,
        metadata: { transactionCount: updated.length },
      });

      return { count: updated.length };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/matches] DELETE matchId error:", message, err);
    return NextResponse.json({ error: "Kunne ikke fjerne match. Prøv igjen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transactionCount: result.count });
});
