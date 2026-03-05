import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, contacts, clients, calendarEvents, TASK_CATEGORIES } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { sendTaskExternalEmail } from "@/lib/resend";
import { notifyTaskAssigned, notifyTaskCompleted } from "@/lib/notifications";
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

  const [existing] = await db
    .select({
      id: tasks.id,
      assigneeId: tasks.assigneeId,
      createdBy: tasks.createdBy,
      status: tasks.status,
      title: tasks.title,
      clientId: tasks.clientId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, tenantId)));

  if (!existing) return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });

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

  if (data.linkedEventId) {
    const [event] = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, data.linkedEventId), eq(calendarEvents.tenantId, tenantId)));
    if (!event) return NextResponse.json({ error: "Kalenderhendelse ikke funnet" }, { status: 404 });
  }

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

  // Notify external contact
  if (data.notifyExternal && data.externalContactId) {
    const [contact] = await db
      .select({ name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.id, data.externalContactId), eq(contacts.tenantId, tenantId)));

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

  // Notify assignee if assignment changed
  const assigneeChanged = data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId;
  if (assigneeChanged && data.assigneeId && data.assigneeId !== userId) {
    let clientName: string | undefined;
    if (updated.clientId) {
      const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, updated.clientId));
      clientName = c?.name ?? undefined;
    }
    notifyTaskAssigned({
      tenantId,
      assigneeId: data.assigneeId,
      assignedByUserId: userId,
      taskId,
      taskTitle: updated.title,
      taskDescription: updated.description ?? undefined,
      clientId: updated.clientId,
      clientName,
      dueDate: updated.dueDate,
    }).catch((e) => console.error("[tasks/PATCH] assignment notification failed:", e));
  }

  // Notify creator if task was completed by someone else
  if (data.status === "completed" && existing.status !== "completed") {
    let clientName: string | undefined;
    if (updated.clientId) {
      const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, updated.clientId));
      clientName = c?.name ?? undefined;
    }
    notifyTaskCompleted({
      tenantId,
      creatorId: existing.createdBy,
      completedByUserId: userId,
      taskId,
      taskTitle: updated.title,
      clientId: updated.clientId,
      clientName,
    }).catch((e) => console.error("[tasks/PATCH] completion notification failed:", e));
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
