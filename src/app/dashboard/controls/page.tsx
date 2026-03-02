import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { companies, tripletexConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ControlsPageClient } from "./controls-page-client";

export default async function ControlsPage() {
  const { orgId } = await auth();

  if (!orgId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Kontroller</h1>
        <p className="text-muted-foreground mt-1">Velg en organisasjon for å se kontroller.</p>
      </div>
    );
  }

  const companyList = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .innerJoin(
      tripletexConnections,
      and(
        eq(tripletexConnections.tenantId, companies.tenantId),
        eq(tripletexConnections.isActive, true)
      )
    )
    .where(eq(companies.tenantId, orgId))
    .orderBy(companies.name);

  const uniqueCompanies = Array.from(
    new Map(companyList.map((c) => [c.id, c])).values()
  );

  return <ControlsPageClient companies={uniqueCompanies} />;
}
