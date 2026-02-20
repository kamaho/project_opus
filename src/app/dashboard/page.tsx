import { auth } from "@clerk/nextjs/server";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Velkommen til Account Control. Her kan du administrere avstemminger
          for din organisasjon.
        </p>
      </div>
      {orgId ? (
        <div className="rounded-lg border bg-card p-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Aktiv organisasjon</p>
          <p className="font-medium">{orgSlug ?? orgId}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm">
          <p className="font-medium">Velg eller opprett organisasjon</p>
          <p className="text-muted-foreground mt-1">
            Bruk organisasjonsvelgeren i headeren for å velge en organisasjon, eller opprett en ny.
          </p>
        </div>
      )}
    </div>
  );
}
