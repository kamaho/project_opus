import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, deadlines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { computeDeadlineStatus } from "@/lib/deadlines/compute-status";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";

const bodySchema = z.object({
  status: z.enum(["open", "in_progress", "waiting", "completed", "cancelled"], {
    message: "Må være en av: open, in_progress, waiting, completed, cancelled",
  }),
});

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const deadlineId = params?.id;
  const taskId = params?.taskId;
  if (!deadlineId || !taskId) {
    return NextResponse.json({ error: "Mangler deadline-ID eller task-ID" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { status } = parsed.data;

  const [task] = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.tenantId, tenantId),
        eq(tasks.linkedDeadlineId, deadlineId)
      )
    )
    .limit(1);

  if (!task) {
    return NextResponse.json({ error: "Oppgave ikke funnet" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === "completed") {
    updateData.completedAt = new Date();
  } else if (task.status === "completed" && (status as string) !== "completed") {
    updateData.completedAt = null;
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

  const allTasks = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.linkedDeadlineId, deadlineId),
        eq(tasks.tenantId, tenantId)
      )
    );

  const [deadline] = await db
    .select({ dueDate: deadlines.dueDate })
    .from(deadlines)
    .where(eq(deadlines.id, deadlineId))
    .limit(1);

  const computedStatus = deadline
    ? computeDeadlineStatus(deadline.dueDate, allTasks)
    : "not_started";

  return NextResponse.json({
    taskId,
    status,
    deadlineStatus: computedStatus,
  });
});
