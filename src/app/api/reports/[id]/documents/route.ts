import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import { documentRequests, documentRequestFiles, contacts } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

export interface DocRequestInfo {
  requestId: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  message: string | null;
  createdAt: Date | null;
  completedAt: Date | null;
  files: {
    id: string;
    filename: string;
    filePath: string;
    fileSize: number | null;
    contentType: string | null;
  }[];
}

export interface CustomerDocRequests {
  [customerId: string]: DocRequestInfo[];
}

export const GET = withTenant(async (req: NextRequest, ctx) => {
  const customerIds = req.nextUrl.searchParams.get("customerIds");
  if (!customerIds) {
    return NextResponse.json({ error: "Mangler customerIds" }, { status: 400 });
  }

  const ids = customerIds.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const rows = await db
    .select({
      id: documentRequests.id,
      status: documentRequests.status,
      metadata: documentRequests.metadata,
      message: documentRequests.message,
      createdAt: documentRequests.createdAt,
      completedAt: documentRequests.completedAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
    })
    .from(documentRequests)
    .leftJoin(contacts, eq(documentRequests.contactId, contacts.id))
    .where(
      and(
        eq(documentRequests.tenantId, ctx.tenantId),
        sql`${documentRequests.metadata}->>'reportCustomerId' IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
      ),
    );

  const fileRows = rows.length > 0
    ? await db
        .select({
          id: documentRequestFiles.id,
          requestId: documentRequestFiles.requestId,
          filename: documentRequestFiles.filename,
          filePath: documentRequestFiles.filePath,
          fileSize: documentRequestFiles.fileSize,
          contentType: documentRequestFiles.contentType,
        })
        .from(documentRequestFiles)
        .where(
          inArray(documentRequestFiles.requestId, rows.map((r) => r.id)),
        )
    : [];

  const result: CustomerDocRequests = {};

  for (const id of ids) {
    const customerReqs = rows.filter(
      (r) => (r.metadata as Record<string, unknown>)?.reportCustomerId === id,
    );
    result[id] = customerReqs.map((r) => ({
      requestId: r.id,
      status: r.status,
      contactName: r.contactName,
      contactEmail: r.contactEmail,
      message: r.message,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      files: fileRows
        .filter((f) => f.requestId === r.id)
        .map((f) => ({
          id: f.id,
          filename: f.filename,
          filePath: f.filePath,
          fileSize: f.fileSize,
          contentType: f.contentType,
        })),
    }));
  }

  return NextResponse.json(result);
});
