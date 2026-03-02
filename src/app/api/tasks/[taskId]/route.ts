import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, contacts, clients, TASK_CATEGORIES } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { sendTaskExternalEmail } from "@/lib/resend";
import { logAudit } from "@/lib/audit";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  category: z.enum([...TASK_CATEGORIES]).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  externalContactId: z.string().uuid().nullable().optional(),
  notifyExternal: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  linkedDeadlineId: z.string().uuid().nullable().optional(),
  linkedEventId: z.string().uuid().nullable().optional(),
  resolution: z.string().nullable().optional(),
  metadata: z.any().optional(),
});

export const GET = withTenant(async (_req, { tenantId }, params) => {
  const taskId = params!.taskId;

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

  if (!task) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  return NextResponse.json(task);
});

export const PATCH = withTenant(async (req, { tenantId, userId }, params) => {
  const taskId = params!.taskId;
  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.category !== undefined) updates.category = data.category;
  if (data.assigneeId !== undefined) updates.assigneeId = data.assigneeId;
  if (data.externalContactId !== undefined) updates.externalContactId = data.externalContactId;
  if (data.notifyExternal !== undefined) updates.notifyExternal = data.notifyExternal;
  if (data.dueDate !== undefined) updates.dueDate = data.dueDate;
  if (data.linkedDeadlineId !== undefined) updates.linkedDeadlineId = data.linkedDeadlineId;
  if (data.linkedEventId !== undefined) updates.linkedEventId = data.linkedEventId;
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
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  if (data.notifyExternal && data.externalContactId) {
    const [contact] = await db
      .select({ name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, data.externalContactId));

    if (contact?.email) {
      let clientName: string | undefined;
      if (updated.clientId) {
        const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, updated.clientId));
        clientName = c?.name ?? undefined;
      }
      await sendTaskExternalEmail({
        to: contact.email,
        contactName: contact.name,
        taskTitle: updated.title,
        taskDescription: updated.description ?? undefined,
        category: updated.category ?? null,
        clientName: clientName ?? null,
      }).catch((err) => console.error("[tasks/PATCH] Failed to send external email:", err));
    }
  }

  await logAudit({ tenantId, userId, action: "task.updated", entityType: "task", entityId: taskId });

  return NextResponse.json(updated);
});

export const DELETE = withTenant(async (_req, { tenantId, userId }, params) => {
  const taskId = params!.taskId;

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)))
    .returning({ id: tasks.id });

  if (!deleted) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

  await logAudit({ tenantId, userId, action: "task.deleted", entityType: "task", entityId: taskId });

  return NextResponse.json({ success: true });
});
