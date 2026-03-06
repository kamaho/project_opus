import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { tasks, companies, clients } from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TasksClient } from "./tasks-client";
import { parseCompanyIds } from "@/lib/utils";

export default async function OppgaverPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Oppgaver</h1>
        <p className="text-muted-foreground">Velg en organisasjon for å se oppgaver.</p>
      </div>
    );
  }

  const { companyId: companyIdParam } = await searchParams;
  const selectedCompanyIds = parseCompanyIds(companyIdParam);

  const companyFilter = selectedCompanyIds.length > 0
    ? and(eq(companies.tenantId, orgId), inArray(companies.id, selectedCompanyIds))
    : eq(companies.tenantId, orgId);

  const [companyList, clientList, stats] = await Promise.all([
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(companyFilter)
      .orderBy(companies.name),
    db
      .select({
        id: clients.id,
        name: clients.name,
        companyId: clients.companyId,
        companyName: companies.name,
      })
      .from(clients)
      .innerJoin(companies, eq(clients.companyId, companies.id))
      .where(companyFilter)
      .orderBy(clients.name),
    selectedCompanyIds.length > 0
      ? db
          .select({
            total: sql<number>`count(*)::int`,
            open: sql<number>`count(*) filter (where ${tasks.status} = 'open')::int`,
            inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
            overdue: sql<number>`count(*) filter (where ${tasks.status} in ('open','in_progress','waiting') and ${tasks.dueDate} < current_date)::int`,
            completedThisMonth: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= date_trunc('month', current_date))::int`,
          })
          .from(tasks)
          .innerJoin(clients, eq(tasks.clientId, clients.id))
          .innerJoin(companies, eq(clients.companyId, companies.id))
          .where(and(eq(tasks.tenantId, orgId), inArray(companies.id, selectedCompanyIds)))
      : db
          .select({
            total: sql<number>`count(*)::int`,
            open: sql<number>`count(*) filter (where ${tasks.status} = 'open')::int`,
            inProgress: sql<number>`count(*) filter (where ${tasks.status} = 'in_progress')::int`,
            overdue: sql<number>`count(*) filter (where ${tasks.status} in ('open','in_progress','waiting') and ${tasks.dueDate} < current_date)::int`,
            completedThisMonth: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= date_trunc('month', current_date))::int`,
          })
          .from(tasks)
          .where(eq(tasks.tenantId, orgId)),
  ]);

  return (
    <TasksClient
      companies={companyList}
      clients={clientList}
      stats={stats[0] ?? { total: 0, open: 0, inProgress: 0, overdue: 0, completedThisMonth: 0 }}
    />
  );
}
