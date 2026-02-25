import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { clients, companies, matchingRules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import Link from "next/link";
import { ChevronRight, SlidersHorizontal } from "lucide-react";

export default async function MatchingRulesOverviewPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Matching-regler</h1>
        <p className="text-muted-foreground">
          Velg en organisasjon for å se matching-regler.
        </p>
      </div>
    );
  }

  const clientsWithRuleCounts = await db
    .select({
      id: clients.id,
      name: clients.name,
      companyName: companies.name,
      ruleCount: sql<number>`(
        SELECT count(*)::int FROM matching_rules
        WHERE matching_rules.client_id = ${clients.id}
      )`,
    })
    .from(clients)
    .innerJoin(companies, eq(clients.companyId, companies.id))
    .where(eq(companies.tenantId, orgId))
    .orderBy(clients.name);

  if (clientsWithRuleCounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Matching-regler</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <SlidersHorizontal className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">Ingen avstemminger ennå</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Opprett en avstemming først, så kan du konfigurere matching-regler
            for Smart Match.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Matching-regler</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Konfigurer regler for automatisk Smart Match per avstemming.
          </p>
        </div>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Avstemming</th>
              <th className="p-3 text-left font-medium">Selskap</th>
              <th className="p-3 text-right font-medium">Aktive regler</th>
              <th className="p-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {clientsWithRuleCounts.map((c) => (
              <tr key={c.id} className="border-b hover:bg-muted/30">
                <td className="p-3">
                  <Link
                    href={`/dashboard/clients/${c.id}/matching-rules`}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.companyName}</td>
                <td className="p-3 text-right font-mono tabular-nums">
                  {c.ruleCount}
                </td>
                <td className="p-3">
                  <Link
                    href={`/dashboard/clients/${c.id}/matching-rules`}
                    className="inline-flex text-muted-foreground hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
