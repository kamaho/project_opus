import { withTenant } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regulatoryDeadlines, calendarEvents, tasks } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

interface DeadlineDate {
  id: string;
  title: string;
  date: string;
  source: "regulatory" | "custom_deadline";
}

function resolveDeadlineDatesForYear(
  deadline: {
    id: string;
    title: string;
    frequency: string;
    deadlineRule: { day: number; month?: number; relative_to?: string; months_after?: number };
    periodStartMonth: number | null;
  },
  year: number
): DeadlineDate[] {
  const rule = deadline.deadlineRule;
  const results: DeadlineDate[] = [];

  if (deadline.frequency === "yearly") {
    if (rule.month !== undefined) {
      const m = rule.month - 1;
      results.push({
        id: deadline.id,
        title: deadline.title,
        date: `${year}-${String(m + 1).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`,
        source: "regulatory",
      });
    }
  } else if (deadline.frequency === "monthly") {
    for (let m = 0; m < 12; m++) {
      let deadlineMonth = m;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = m + rule.months_after;
      }
      if (deadlineMonth < 12) {
        results.push({
          id: deadline.id,
          title: deadline.title,
          date: `${year}-${String(deadlineMonth + 1).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`,
          source: "regulatory",
        });
      }
    }
  } else if (deadline.frequency === "bimonthly") {
    const startMonth = (deadline.periodStartMonth ?? 1) - 1;
    for (let pStart = startMonth; pStart < 12; pStart += 2) {
      const pEnd = pStart + 1;
      let deadlineMonth = pEnd;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = pEnd + rule.months_after;
      }
      if (deadlineMonth < 12) {
        results.push({
          id: deadline.id,
          title: deadline.title,
          date: `${year}-${String(deadlineMonth + 1).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`,
          source: "regulatory",
        });
      }
    }
  } else if (deadline.frequency === "quarterly") {
    for (let q = 0; q < 4; q++) {
      const qEnd = (q + 1) * 3 - 1;
      let deadlineMonth = qEnd;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = qEnd + rule.months_after;
      }
      if (deadlineMonth < 12) {
        results.push({
          id: deadline.id,
          title: deadline.title,
          date: `${year}-${String(deadlineMonth + 1).padStart(2, "0")}-${String(rule.day).padStart(2, "0")}`,
          source: "regulatory",
        });
      }
    }
  }

  return results;
}

export const GET = withTenant(async (_req, { tenantId }) => {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [regDeadlines, customDeadlineEvents, allTasks] = await Promise.all([
    db.select().from(regulatoryDeadlines),
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.tenantId, tenantId),
          eq(calendarEvents.type, "custom_deadline")
        )
      ),
    db
      .select({
        id: tasks.id,
        status: tasks.status,
        dueDate: tasks.dueDate,
        assigneeId: tasks.assigneeId,
        linkedDeadlineId: tasks.linkedDeadlineId,
        linkedEventId: tasks.linkedEventId,
        title: tasks.title,
        priority: tasks.priority,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          sql`(${tasks.linkedDeadlineId} IS NOT NULL OR ${tasks.linkedEventId} IS NOT NULL)`
        )
      ),
  ]);

  const resolvedDeadlines: DeadlineDate[] = [];
  for (const dl of regDeadlines) {
    const rule = dl.deadlineRule as { day: number; month?: number; relative_to?: string; months_after?: number };
    const dates = resolveDeadlineDatesForYear(
      { id: dl.id, title: dl.title, frequency: dl.frequency, deadlineRule: rule, periodStartMonth: dl.periodStartMonth },
      currentYear
    );
    resolvedDeadlines.push(...dates);
  }

  for (const ev of customDeadlineEvents) {
    resolvedDeadlines.push({
      id: ev.id,
      title: ev.title,
      date: ev.startAt.toISOString().split("T")[0],
      source: "custom_deadline",
    });
  }

  const tasksByDeadline = new Map<string, typeof allTasks>();
  const tasksByEvent = new Map<string, typeof allTasks>();

  for (const t of allTasks) {
    if (t.linkedDeadlineId) {
      const arr = tasksByDeadline.get(t.linkedDeadlineId) ?? [];
      arr.push(t);
      tasksByDeadline.set(t.linkedDeadlineId, arr);
    }
    if (t.linkedEventId) {
      const arr = tasksByEvent.get(t.linkedEventId) ?? [];
      arr.push(t);
      tasksByEvent.set(t.linkedEventId, arr);
    }
  }

  const todayStr = now.toISOString().split("T")[0];

  const result = resolvedDeadlines
    .filter((d) => {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 2);
      return d.date >= sixMonthsAgo.toISOString().split("T")[0];
    })
    .map((d) => {
      const linkedTasks =
        d.source === "regulatory"
          ? tasksByDeadline.get(d.id) ?? []
          : tasksByEvent.get(d.id) ?? [];

      const total = linkedTasks.length;
      const completed = linkedTasks.filter((t) => t.status === "completed").length;
      const inProgress = linkedTasks.filter((t) => t.status === "in_progress").length;
      const waiting = linkedTasks.filter((t) => t.status === "waiting").length;
      const isOverdue = d.date < todayStr;
      const hasIncomplete = total > 0 && completed < total;

      let status: "completed" | "in_progress" | "overdue" | "not_started" | "no_tasks";
      if (total === 0) {
        status = "no_tasks";
      } else if (completed === total) {
        status = "completed";
      } else if (isOverdue && hasIncomplete) {
        status = "overdue";
      } else if (inProgress > 0 || waiting > 0) {
        status = "in_progress";
      } else {
        status = "not_started";
      }

      const target = new Date(d.date + "T00:00:00");
      target.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);

      return {
        deadlineId: d.id,
        title: d.title,
        date: d.date,
        daysLeft,
        source: d.source,
        status,
        taskSummary: { total, completed, inProgress, overdue: isOverdue && hasIncomplete ? total - completed : 0 },
        tasks: linkedTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigneeId: t.assigneeId,
          dueDate: t.dueDate,
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return NextResponse.json(result);
});
