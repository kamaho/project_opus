import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { tasks, regulatoryDeadlines, calendarEvents } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { CalendarClient } from "./calendar-client";

export default async function KalenderPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Kalender</h1>
        <p className="text-muted-foreground">Velg en organisasjon for å se kalenderen.</p>
      </div>
    );
  }

  const [deadlines, activeTasks, events, clerkData] = await Promise.all([
    db.select().from(regulatoryDeadlines),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        clientId: tasks.clientId,
        assigneeId: tasks.assigneeId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, orgId),
          inArray(tasks.status, ["open", "in_progress", "waiting"])
        )
      ),
    db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.tenantId, orgId))
      .orderBy(calendarEvents.startAt)
      .limit(1000),
    clerkClient().then((clerk) =>
      clerk.organizations.getOrganizationMembershipList({
        organizationId: orgId,
        limit: 100,
      })
    ),
  ]);

  const members = clerkData.data.map((m) => {
    const user = m.publicUserData;
    return {
      userId: user?.userId ?? "",
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      imageUrl: user?.imageUrl ?? null,
    };
  });

  const memberIds = members.map((m) => m.userId).filter(Boolean);

  const taskStats = memberIds.length > 0
    ? await db
        .select({
          assigneeId: tasks.assigneeId,
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${tasks.status} = 'open')::int`,
          inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
          overdue: sql<number>`count(*) filter (where ${tasks.status} in ('open','in_progress','waiting') and ${tasks.dueDate} < current_date)::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.tenantId, orgId), inArray(tasks.assigneeId, memberIds)))
        .groupBy(tasks.assigneeId)
    : [];

  const taskMap = new Map(taskStats.map((s) => [s.assigneeId, s]));

  const teamCapacity = members.map((m) => {
    const s = taskMap.get(m.userId);
    return {
      userId: m.userId,
      firstName: m.firstName,
      lastName: m.lastName,
      imageUrl: m.imageUrl,
      open: s?.open ?? 0,
      inProgress: s?.inProgress ?? 0,
      overdue: s?.overdue ?? 0,
    };
  });

  return (
    <CalendarClient
      deadlines={deadlines.map((d) => ({
        id: d.id,
        title: d.title,
        obligation: d.obligation,
        description: d.description,
        frequency: d.frequency,
        deadlineRule: d.deadlineRule as { day: number; month?: number; relative_to?: string; months_after?: number },
        periodStartMonth: d.periodStartMonth,
        periodEndMonth: d.periodEndMonth,
      }))}
      tasks={activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        assigneeId: t.assigneeId,
      }))}
      calendarEvents={events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        startAt: e.startAt.toISOString(),
        endAt: e.endAt?.toISOString() ?? null,
        allDay: e.allDay ?? false,
        color: e.color,
        createdBy: e.createdBy,
        attendees: e.attendees ?? [],
        reminderMinutesBefore: e.reminderMinutesBefore,
      }))}
      teamCapacity={teamCapacity}
    />
  );
}
