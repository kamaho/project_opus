import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, companies, clients } from "@/lib/db/schema";
import { eq, and, inArray, desc, asc, sql, ilike, or } from "drizzle-orm";
import { z } from "zod";
import type { TaskStatus, TaskPriority } from "@/lib/db/schema";

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum(["reconciliation_difference", "unmatched_items", "deadline", "overdue_items", "approval_needed", "manual"]).default("manual"),
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"]).default("open"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  assigneeId: z.string().optional(),
  companyId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
  metadata: z.any().optional(),
});

export async function GET(request: Request) {
  const { orgId } = await auth();
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");
  const clientId = url.searchParams.get("clientId");
  const companyId = url.searchParams.get("companyId");
  const priority = url.searchParams.get("priority");
  const search = url.searchParams.get("search");
  const sortBy = url.searchParams.get("sortBy") ?? "due_date";
  const sortDir = url.searchParams.get("sortDir") ?? "asc";

  const conditions = [eq(tasks.tenantId, orgId)];

  if (status) {
    const statuses = status.split(",") as TaskStatus[];
    conditions.push(inArray(tasks.status, statuses));
  }
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId));
  if (clientId) conditions.push(eq(tasks.clientId, clientId));
  if (companyId) conditions.push(eq(tasks.companyId, companyId));
  if (priority) {
    const priorities = priority.split(",") as TaskPriority[];
    conditions.push(inArray(tasks.priority, priorities));
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
      assigneeId: tasks.assigneeId,
      companyId: tasks.companyId,
      clientId: tasks.clientId,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      completedBy: tasks.completedBy,
      resolution: tasks.resolution,
      metadata: tasks.metadata,
      createdBy: tasks.createdBy,
      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
      companyName: companies.name,
      clientName: clients.name,
    })
    .from(tasks)
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .leftJoin(clients, eq(tasks.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn), desc(tasks.createdAt))
    .limit(500);

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  if (data.companyId) {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, data.companyId), eq(companies.tenantId, orgId)));
    if (!company) return NextResponse.json({ error: "Selskap ikke funnet" }, { status: 404 });
  }

  const [created] = await db
    .insert(tasks)
    .values({
      tenantId: orgId,
      title: data.title,
      description: data.description,
      type: data.type,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId,
      companyId: data.companyId,
      clientId: data.clientId,
      dueDate: data.dueDate,
      createdBy: userId,
      metadata: data.metadata ?? {},
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
