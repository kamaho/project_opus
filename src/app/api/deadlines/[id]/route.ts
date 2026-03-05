import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDeadlineById } from "@/lib/deadlines/queries";
import { db } from "@/lib/db";
import { deadlines, DEADLINE_STATUSES } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchDeadlineSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  status: z.enum(DEADLINE_STATUSES).optional(),
});

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
  const parsed = patchDeadlineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldig data" },
      { status: 400 }
    );
  }

  const updates: Partial<{ assigneeId: string | null; status: (typeof DEADLINE_STATUSES)[number] }> = {};
  if (parsed.data.assigneeId !== undefined) updates.assigneeId = parsed.data.assigneeId;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

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
