import { withTenant } from "@/lib/auth";
import { verifyClientOwnership } from "@/lib/db/verify-ownership";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports, transactions, matches } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

/**
 * Dissolve all match groups that include transactions belonging to the given import IDs.
 * Sets affected transactions back to unmatched and deletes the match records.
 */
async function dissolveMatchesForImports(importIds: string[]): Promise<number> {
  if (importIds.length === 0) return 0;

  const affectedTxs = await db
    .select({ matchId: transactions.matchId })
    .from(transactions)
    .where(
      and(
        inArray(transactions.importId, importIds),
        sql`${transactions.matchId} IS NOT NULL`
      )
    );

  const matchIds = [...new Set(affectedTxs.map((t) => t.matchId).filter(Boolean))] as string[];
  if (matchIds.length === 0) return 0;

  await db
    .update(transactions)
    .set({ matchId: null, matchStatus: "unmatched" })
    .where(inArray(transactions.matchId, matchIds));

  await db.delete(matches).where(inArray(matches.id, matchIds));

  return matchIds.length;
}

/**
 * DELETE: Soft-delete a specific import by importId, or all imports for a set.
 * With permanent=true (and importId): permanently delete a soft-deleted import
 * and all its transactions (frees storage, cannot be undone).
 *
 * When soft-deleting, any match groups that include transactions from the
 * deleted import are dissolved (all transactions in those groups return to unmatched).
 */
export const DELETE = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const url = new URL(req.url);
  const importId = url.searchParams.get("importId");
  const permanent = url.searchParams.get("permanent") === "true";
  const setNumberParam = url.searchParams.get("setNumber");

  if (importId) {
    if (permanent) {
      const row = await db
        .select({ id: imports.id, setNumber: imports.setNumber })
        .from(imports)
        .where(
          and(
            eq(imports.id, importId),
            eq(imports.clientId, clientId),
            sql`${imports.deletedAt} IS NOT NULL`
          )
        )
        .limit(1)
        .then((r) => r[0]);

      if (!row) {
        return NextResponse.json(
          { error: "Import ikke funnet eller ikke slettet (må være i papirkurv først)" },
          { status: 400 }
        );
      }

      await dissolveMatchesForImports([importId]);
      await db.delete(transactions).where(eq(transactions.importId, importId));
      await db
        .delete(imports)
        .where(and(eq(imports.id, importId), eq(imports.clientId, clientId)));

      await logAudit({
        tenantId,
        userId,
        action: "import.permanently_deleted",
        entityType: "import",
        entityId: importId,
        metadata: { setNumber: row.setNumber },
      });

      return NextResponse.json({ ok: true });
    }

    const deleted = await db
      .update(imports)
      .set({ deletedAt: sql`NOW()` })
      .where(
        and(
          eq(imports.id, importId),
          eq(imports.clientId, clientId),
          sql`${imports.deletedAt} IS NULL`
        )
      )
      .returning({ id: imports.id, setNumber: imports.setNumber });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Import ikke funnet" }, { status: 404 });
    }

    const dissolved = await dissolveMatchesForImports([importId]);

    await logAudit({
      tenantId,
      userId,
      action: "import.deleted",
      entityType: "import",
      entityId: importId,
      metadata: { setNumber: deleted[0].setNumber, dissolvedMatches: dissolved },
    });

    return NextResponse.json({ ok: true });
  }

  const setNumber = setNumberParam === "1" ? 1 : setNumberParam === "2" ? 2 : null;
  if (setNumber === null) {
    return NextResponse.json(
      { error: "Mangler importId eller setNumber" },
      { status: 400 }
    );
  }

  const toDelete = await db
    .select({ id: imports.id })
    .from(imports)
    .where(
      and(
        eq(imports.clientId, clientId),
        eq(imports.setNumber, setNumber),
        sql`${imports.deletedAt} IS NULL`
      )
    );

  const importIds = toDelete.map((r) => r.id);

  const deleted = await db
    .update(imports)
    .set({ deletedAt: sql`NOW()` })
    .where(
      and(
        eq(imports.clientId, clientId),
        eq(imports.setNumber, setNumber),
        sql`${imports.deletedAt} IS NULL`
      )
    )
    .returning({ id: imports.id });

  const dissolved = await dissolveMatchesForImports(importIds);

  await logAudit({
    tenantId,
    userId,
    action: "import.deleted",
    entityType: "import",
    entityId: clientId,
    metadata: { setNumber, deletedCount: deleted.length, dissolvedMatches: dissolved },
  });

  return NextResponse.json({ ok: true });
});

/**
 * PATCH: Restore a soft-deleted import (set deleted_at = null).
 * Body: { importId: string }
 */
export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  await verifyClientOwnership(params!.clientId, tenantId);
  const clientId = params!.clientId;

  const restoreSchema = z.object({
    importId: z.string().uuid("Må være en gyldig UUID"),
  });
  const parsed = restoreSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { importId } = parsed.data;

  const result = await db
    .update(imports)
    .set({ deletedAt: null })
    .where(
      and(
        eq(imports.id, importId),
        eq(imports.clientId, clientId),
        sql`${imports.deletedAt} IS NOT NULL`
      )
    )
    .returning({ id: imports.id });

  if (result.length === 0) {
    return NextResponse.json(
      { error: "Import ikke funnet eller allerede aktiv" },
      { status: 404 }
    );
  }

  await logAudit({
    tenantId,
    userId,
    action: "import.restored",
    entityType: "import",
    entityId: result[0].id,
  });

  return NextResponse.json({ ok: true, restoredId: result[0].id });
});
