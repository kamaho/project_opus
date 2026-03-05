import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tasks, deadlines } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { computeDeadlineStatus } from "@/lib/deadlines/compute-status";

export const PATCH = withTenant(async (req, { tenantId }, params) => {
  const deadlineId = params?.id;
  const taskId = params?.taskId;
  if (!deadlineId || !taskId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const body = await req.json();
  const { status } = body as { status?: string };

  const validStatuses = ["open", "in_progress", "waiting", "completed", "cancelled"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Verify the task belongs to this deadline and tenant
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
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Update the task
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === "completed") {
    updateData.completedAt = new Date();
  } else if (task.status === "completed" && status !== "completed") {
    updateData.completedAt = null;
  }

  await db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

  // The Postgres trigger handles deadline status recomputation,
  // but we also compute it app-side for the immediate response.
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
