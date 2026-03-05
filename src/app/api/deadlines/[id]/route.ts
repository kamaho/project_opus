import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDeadlineById } from "@/lib/deadlines/queries";
import { db } from "@/lib/db";
import { deadlines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const result = await getDeadlineById(id, tenantId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(result);
});

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json();

  const updates: Partial<{ assigneeId: string | null; status: string }> = {};
  if ("assigneeId" in body) updates.assigneeId = body.assigneeId ?? null;
  if ("status" in body) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(deadlines)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(deadlines.id, id), eq(deadlines.tenantId, tenantId)))
    .returning({ id: deadlines.id });

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
});
