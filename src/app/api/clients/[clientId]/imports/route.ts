import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imports } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";

/**
 * GET: List all imports for a client, including soft-deleted.
 * Returns active imports + deleted imports with days remaining.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;
  const clientRow = await validateClientTenant(clientId, orgId);

  if (!clientRow) {
    return NextResponse.json({ error: "Klient ikke funnet" }, { status: 404 });
  }

  const allImports = await db
    .select({
      id: imports.id,
      setNumber: imports.setNumber,
      filename: imports.filename,
      fileHash: imports.fileHash,
      fileSize: imports.fileSize,
      recordCount: imports.recordCount,
      status: imports.status,
      importedBy: imports.importedBy,
      deletedAt: imports.deletedAt,
      archivedAt: imports.archivedAt,
      createdAt: imports.createdAt,
    })
    .from(imports)
    .where(eq(imports.clientId, clientId))
    .orderBy(sql`${imports.createdAt} DESC`);

  const now = Date.now();
  const SOFT_DELETE_MS = 14 * 24 * 60 * 60 * 1000;

  const result = allImports.map((imp) => {
    const deletedAt = imp.deletedAt ? new Date(imp.deletedAt).getTime() : null;
    const expiresAt = deletedAt ? deletedAt + SOFT_DELETE_MS : null;
    const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))) : null;
    const isArchived = !!imp.archivedAt;

    return {
      id: imp.id,
      setNumber: imp.setNumber,
      filename: imp.filename,
      fileSize: imp.fileSize,
      recordCount: imp.recordCount,
      status: imp.status,
      importedBy: imp.importedBy,
      createdAt: imp.createdAt,
      isDeleted: !!imp.deletedAt,
      isArchived,
      deletedAt: imp.deletedAt,
      daysRemaining: isArchived ? null : daysRemaining,
    };
  });

  return NextResponse.json({ imports: result });
}
