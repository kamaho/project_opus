import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { tasks, clients, companies } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TeamClient } from "./team-client";

export default async function TeamPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-muted-foreground">Velg en organisasjon for å se teamet.</p>
      </div>
    );
  }

  const clerk = await clerkClient();
  const membershipsResponse = await clerk.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
  });

  const members = await Promise.all(
    membershipsResponse.data.map(async (m) => {
      const user = m.publicUserData;
      return {
        userId: user?.userId ?? "",
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        imageUrl: user?.imageUrl ?? null,
        role: m.role,
      };
    })
  );

  const memberIds = members.map((m) => m.userId).filter(Boolean);

  const taskStats = memberIds.length > 0
    ? await db
        .select({
          assigneeId: tasks.assigneeId,
          total: sql<number>`count(*)::int`,
          open: sql<number>`count(*) filter (where ${tasks.status} = 'open')::int`,
          inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
          overdue: sql<number>`count(*) filter (where ${tasks.status} in ('open','in_progress','waiting') and ${tasks.dueDate} < current_date)::int`,
          completedThisMonth: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= date_trunc('month', current_date))::int`,
        })
        .from(tasks)
        .where(and(eq(tasks.tenantId, orgId), inArray(tasks.assigneeId, memberIds)))
        .groupBy(tasks.assigneeId)
    : [];

  const clientAssignments = memberIds.length > 0
    ? await db
        .select({
          assignedUserId: clients.assignedUserId,
          count: sql<number>`count(*)::int`,
        })
        .from(clients)
        .innerJoin(companies, eq(clients.companyId, companies.id))
        .where(and(eq(companies.tenantId, orgId), inArray(clients.assignedUserId, memberIds)))
        .groupBy(clients.assignedUserId)
    : [];

  const taskMap = new Map(taskStats.map((s) => [s.assigneeId, s]));
  const clientMap = new Map(clientAssignments.map((c) => [c.assignedUserId, c.count]));

  const teamData = members.map((m) => {
    const stats = taskMap.get(m.userId);
    return {
      userId: m.userId,
      firstName: m.firstName,
      lastName: m.lastName,
      imageUrl: m.imageUrl,
      role: m.role,
      assignedClients: clientMap.get(m.userId) ?? 0,
      tasksOpen: stats?.open ?? 0,
      tasksInProgress: stats?.inProgress ?? 0,
      tasksOverdue: stats?.overdue ?? 0,
      tasksCompletedThisMonth: stats?.completedThisMonth ?? 0,
    };
  });

  return <TeamClient members={teamData} />;
}
