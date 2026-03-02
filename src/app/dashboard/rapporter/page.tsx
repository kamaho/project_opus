import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ReportList } from "@/components/reports/report-list";

export default async function RapporterPage() {
  const { orgId } = await auth();
  if (!orgId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">Rapporter</h1>
        <p className="text-muted-foreground">
          Velg en organisasjon for å se rapporter.
        </p>
      </div>
    );
  }

  const companyList = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.tenantId, orgId));

  return <ReportList companies={companyList} />;
}
