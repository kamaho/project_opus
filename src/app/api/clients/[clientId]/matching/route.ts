import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { validateClientTenant } from "@/lib/db/tenant";

/**
 * DELETE: Soft-delete a specific import by importId, or all imports for a set.
 * Sets deleted_at on matching import rows; transactions remain but are
 * filtered out in queries. Files are permanently removed after 14 days.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const url = new URL(_request.url);
  const importId = url.searchParams.get("importId");
  const setNumberParam = url.searchParams.get("setNumber");

  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  if (importId) {
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

    await logAudit({
      tenantId: orgId,
      userId,
      action: "import.deleted",
      entityType: "import",
      entityId: importId,
      metadata: { setNumber: deleted[0].setNumber },
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

  await logAudit({
    tenantId: orgId,
    userId,
    action: "import.deleted",
    entityType: "import",
    entityId: clientId,
    metadata: { setNumber, deletedCount: deleted.length },
  });

  return NextResponse.json({ ok: true });
}

/**
 * PATCH: Restore a soft-deleted import (set deleted_at = null).
 * Body: { importId: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const body = await request.json().catch(() => ({}));
  const importId = body.importId as string | undefined;

  if (!importId) {
    return NextResponse.json({ error: "Mangler importId" }, { status: 400 });
  }

  const clientRow = await validateClientTenant(clientId, orgId);
  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

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
    tenantId: orgId,
    userId,
    action: "import.restored",
    entityType: "import",
    entityId: result[0].id,
  });

  return NextResponse.json({ ok: true, restoredId: result[0].id });
}
