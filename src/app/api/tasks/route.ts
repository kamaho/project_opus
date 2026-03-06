import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, companies, clients, contacts, calendarEvents, deadlines, deadlineTemplates, TASK_CATEGORIES } from "@/lib/db/schema";
import { eq, and, inArray, desc, asc, ilike, or, isNull } from "drizzle-orm";
import { z } from "zod";
import type { TaskStatus, TaskPriority } from "@/lib/db/schema";
import { sendTaskExternalEmail } from "@/lib/resend";
import { notifyTaskAssigned } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum(["reconciliation_difference", "unmatched_items", "deadline", "overdue_items", "approval_needed", "manual"]).default("manual"),
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]).default("open"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  category: z.enum([...TASK_CATEGORIES]).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  externalContactId: z.string().uuid().nullable().optional(),
  notifyExternal: z.boolean().optional(),
  companyId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  linkedDeadlineId: z.string().uuid().nullable().optional(),
  linkedEventId: z.string().uuid().nullable().optional(),
  metadata: z.any().optional(),
});

export const GET = withTenant(async (req, { tenantId, userId }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");
  const assignee = url.searchParams.get("assignee");
  const clientId = url.searchParams.get("clientId");
  const companyId = url.searchParams.get("companyId");
  const priority = url.searchParams.get("priority");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const deadlineId = url.searchParams.get("deadlineId");
  const sortBy = url.searchParams.get("sortBy") ?? "due_date";
  const sortDir = url.searchParams.get("sortDir") ?? "asc";

  const conditions = [eq(tasks.tenantId, tenantId)];
  if (deadlineId) conditions.push(eq(tasks.linkedDeadlineId, deadlineId));

  if (status) {
    const statuses = status.split(",") as TaskStatus[];
    conditions.push(inArray(tasks.status, statuses));
  }
  if (assignee === "me" && userId) {
    conditions.push(eq(tasks.assigneeId, userId));
  } else if (assignee === "unassigned") {
    conditions.push(isNull(tasks.assigneeId));
    conditions.push(isNull(tasks.externalContactId));
  } else if (assigneeId) {
    conditions.push(eq(tasks.assigneeId, assigneeId));
  }
  if (clientId) conditions.push(eq(tasks.clientId, clientId));
  if (companyId) {
    const ids = companyId.split(",").filter(Boolean);
    if (ids.length === 1) conditions.push(eq(tasks.companyId, ids[0]));
    else if (ids.length > 1) conditions.push(inArray(tasks.companyId, ids));
  }
  if (priority) {
    const priorities = priority.split(",") as TaskPriority[];
    conditions.push(inArray(tasks.priority, priorities));
  }
  if (category && (TASK_CATEGORIES as readonly string[]).includes(category)) {
    conditions.push(eq(tasks.category, category as (typeof TASK_CATEGORIES)[number]));
  }
  if (search) {
    conditions.push(
      or(ilike(tasks.title, `%${search}%`), ilike(tasks.description, `%${search}%`))!
    );
  }

  const orderColumn =
    sortBy === "priority" ? tasks.priority :
    sortBy === "status" ? tasks.status :
    sortBy === "created_at" ? tasks.createdAt :
    sortBy === "title" ? tasks.title :
    sortBy === "category" ? tasks.category :
    tasks.dueDate;

  const orderFn = sortDir === "desc" ? desc : asc;

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      type: tasks.type,
      status: tasks.status,
      priority: tasks.priority,
      category: tasks.category,
      assigneeId: tasks.assigneeId,
      externalContactId: tasks.externalContactId,
      notifyExternal: tasks.notifyExternal,
      companyId: tasks.companyId,
      clientId: tasks.clientId,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      completedBy: tasks.completedBy,
      resolution: tasks.resolution,
      metadata: tasks.metadata,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
      linkedDeadlineId: tasks.linkedDeadlineId,
      linkedEventId: tasks.linkedEventId,
      updatedAt: tasks.updatedAt,
      companyName: companies.name,
      clientName: clients.name,
      externalContactName: contacts.name,
      externalContactEmail: contacts.email,
      deadlineName: deadlineTemplates.name,
      deadlineSlug: deadlineTemplates.slug,
      deadlineDueDate: deadlines.dueDate,
      deadlinePeriodLabel: deadlines.periodLabel,
      deadlineAssigneeId: deadlines.assigneeId,
    })
    .from(tasks)
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .leftJoin(contacts, eq(tasks.externalContactId, contacts.id))
    .leftJoin(deadlines, eq(tasks.linkedDeadlineId, deadlines.id))
    .leftJoin(deadlineTemplates, eq(deadlines.templateId, deadlineTemplates.id))
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn), desc(tasks.createdAt))
    .limit(500);

  return NextResponse.json(rows);
});

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.companyId) {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, data.companyId), eq(companies.tenantId, tenantId)));
    if (!company) return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  if (data.linkedEventId) {
    const [event] = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, data.linkedEventId), eq(calendarEvents.tenantId, tenantId)));
    if (!event) return NextResponse.json({ error: "Kalenderhendelse ikke funnet" }, { status: 404 });
  }

  const [created] = await db
    .insert(tasks)
    .values({
      tenantId,
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status,
      priority: data.priority,
      category: data.category ?? null,
      assigneeId: data.assigneeId,
      externalContactId: data.externalContactId ?? null,
      notifyExternal: data.notifyExternal ?? false,
      companyId: data.companyId,
      clientId: data.clientId,
      dueDate: data.dueDate,
      linkedDeadlineId: data.linkedDeadlineId ?? null,
      linkedEventId: data.linkedEventId ?? null,
      createdBy: userId,
      metadata: data.metadata ?? {},
    })
    .returning();

  if (data.notifyExternal && data.externalContactId) {
    const [contact] = await db
      .select({ name: contacts.name, email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.id, data.externalContactId), eq(contacts.tenantId, tenantId)));

    if (contact?.email) {
      let clientName: string | undefined;
      if (data.clientId) {
        const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, data.clientId));
        clientName = c?.name ?? undefined;
      }
      await sendTaskExternalEmail({
        to: contact.email,
        contactName: contact.name,
        taskTitle: data.title,
        taskDescription: data.description,
        category: data.category ?? null,
        clientName: clientName ?? null,
      }).catch((err) => console.error("[tasks/POST] Failed to send external email:", err));
    }
  }

  if (data.assigneeId && data.assigneeId !== userId) {
    let clientName: string | undefined;
    if (data.clientId) {
      const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, data.clientId));
      clientName = c?.name ?? undefined;
    }
    notifyTaskAssigned({
      tenantId,
      assigneeId: data.assigneeId,
      assignedByUserId: userId,
      taskId: created.id,
      taskTitle: data.title,
      taskDescription: data.description,
      clientId: data.clientId,
      clientName,
      dueDate: data.dueDate,
    }).catch((e) => console.error("[tasks/POST] notification failed:", e));
  }

  await logAudit({ tenantId, userId, action: "task.created", entityType: "task", entityId: created.id, metadata: { title: created.title } });

  return NextResponse.json(created, { status: 201 });
});
