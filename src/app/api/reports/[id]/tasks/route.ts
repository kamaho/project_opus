import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/api-handler";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import type { CustomerTaskInfo } from "@/lib/reports/view-types";

export const GET = withTenant(async (req: NextRequest, ctx, params) => {
  const reportId = params?.id;
  if (!reportId) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const customerIds = req.nextUrl.searchParams.get("customerIds");
  if (!customerIds) {
    return NextResponse.json({ error: "Mangler customerIds" }, { status: 400 });
  }

  const ids = customerIds.split(",").filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const taskRows = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      metadata: tasks.metadata,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.tenantId, ctx.tenantId),
        sql`${tasks.metadata}->>'reportCustomerId' IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
      ),
    );

  const result: Record<string, CustomerTaskInfo> = {};

  for (const id of ids) {
    const customerTasks = taskRows.filter(
      (t) => (t.metadata as Record<string, unknown>)?.reportCustomerId === id,
    );
    const openTasks = customerTasks.filter(
      (t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting",
    );
    const completedTasks = customerTasks.filter((t) => t.status === "completed");

    let status: CustomerTaskInfo["status"] = "none";
    if (openTasks.length > 0) {
      status = "task_open";
    } else if (completedTasks.length > 0) {
      status = "task_completed";
    }

    const lastActivity = customerTasks
      .map((t) => t.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

    result[id] = {
      status,
      taskCount: customerTasks.length,
      openCount: openTasks.length,
      lastActivity: lastActivity?.toISOString(),
    };
  }

  return NextResponse.json(result);
});
