import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  metadata: z.any().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, orgId)));

  if (!task) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.resolution !== undefined) updates.resolution = data.resolution;
  if (data.metadata !== undefined) updates.metadata = data.metadata;

  if (data.status !== undefined) {
    updates.status = data.status;
    if (data.status === "completed") {
      updates.completedAt = new Date();
      updates.completedBy = userId;
    } else if (data.status === "open" || data.status === "in_progress") {
      updates.completedAt = null;
      updates.completedBy = null;
    }
  }

  const [updated] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, orgId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, orgId)))
    .returning({ id: tasks.id });

  if (!deleted) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  return NextResponse.json({ success: true });
}
