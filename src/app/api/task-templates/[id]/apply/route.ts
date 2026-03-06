import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taskTemplates, tasks, deadlines, TASK_CATEGORIES } from "@/lib/db/schema";
import type { TaskTemplateItem } from "@/lib/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { z } from "zod";

const applySchema = z.object({
  deadlineId: z.string().uuid(),
  assigneeId: z.string().optional(),
});

export const POST = withTenant(async (req, { tenantId, userId }, params) => {
  const templateId = params?.id;
  if (!templateId) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const body = await req.json();
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { deadlineId, assigneeId } = parsed.data;

  const [template] = await db
    .select()
    .from(taskTemplates)
    .where(
      and(
        eq(taskTemplates.id, templateId),
        or(
          eq(taskTemplates.tenantId, tenantId),
          and(eq(taskTemplates.isSystem, true), isNull(taskTemplates.tenantId))
        )
      )
    );

  if (!template) {
    return NextResponse.json({ error: "Mal ikke funnet" }, { status: 404 });
  }

  const [deadline] = await db
    .select()
    .from(deadlines)
    .where(and(eq(deadlines.id, deadlineId), eq(deadlines.tenantId, tenantId)));

  if (!deadline) {
    return NextResponse.json({ error: "Frist ikke funnet" }, { status: 404 });
  }

  const items = template.items as TaskTemplateItem[];
  const deadlineDueDate = new Date(deadline.dueDate + "T00:00:00");

  const validCategories = TASK_CATEGORIES as readonly string[];

  const taskValues = items.map((item) => {
    const taskDueDate = new Date(deadlineDueDate);
    taskDueDate.setDate(taskDueDate.getDate() + item.offsetDays);

    const dueDateStr = `${taskDueDate.getFullYear()}-${String(taskDueDate.getMonth() + 1).padStart(2, "0")}-${String(taskDueDate.getDate()).padStart(2, "0")}`;

    const description = [item.description, item.routine]
      .filter(Boolean)
      .join("\n\n---\n\n");

    return {
      tenantId,
      title: item.title,
      description: description || null,
      type: "deadline" as const,
      status: "open" as const,
      priority: item.priority,
      category: item.category && validCategories.includes(item.category)
        ? (item.category as (typeof TASK_CATEGORIES)[number])
        : null,
      assigneeId: assigneeId ?? null,
      companyId: deadline.companyId,
      dueDate: dueDateStr,
      linkedDeadlineId: deadlineId,
      createdBy: userId,
      metadata: {},
    };
  });

  const created = await db.insert(tasks).values(taskValues).returning();

  return NextResponse.json({
    count: created.length,
    tasks: created.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
  }, { status: 201 });
});
