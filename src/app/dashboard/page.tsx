import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { companies, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DashboardEmpty } from "./dashboard-empty";

export default async function DashboardPage() {
  let orgId: string | null = null;
  let orgSlug: string | null = null;
  try {
    const session = await auth();
    orgId = session.orgId ?? null;
    orgSlug = session.orgSlug ?? null;
  } catch {
    // auth() can throw if session not ready
  }

  if (!orgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Velkommen til Revizo.
          </p>
        </div>
        <DashboardEmpty step="org" />
      </div>
    );
  }

  let companyCount = 0;
  let clientCount = 0;
  try {
    const companyRows = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.tenantId, orgId))
      .limit(1);
    companyCount = companyRows.length;

    if (companyCount > 0) {
      const clientRows = await db
        .select({ id: clients.id })
        .from(clients)
        .innerJoin(companies, eq(clients.companyId, companies.id))
        .where(eq(companies.tenantId, orgId))
        .limit(1);
      clientCount = clientRows.length;
    }
  } catch {
    // DB unavailable
  }

  if (companyCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Velkommen til Revizo. Kom i gang ved å opprette ditt første selskap.
          </p>
        </div>
        <DashboardEmpty step="company" orgSlug={orgSlug} />
      </div>
    );
  }

  if (clientCount === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            Du har selskap, men ingen avstemminger ennå.
          </p>
        </div>
        <DashboardEmpty step="reconciliation" orgSlug={orgSlug} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Velkommen til Revizo. Her kan du administrere avstemminger
          for din organisasjon.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4 text-card-foreground">
        <p className="text-sm text-muted-foreground">Aktiv organisasjon</p>
        <p className="font-medium">{orgSlug ?? orgId}</p>
      </div>
    </div>
  );
}
