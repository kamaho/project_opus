import { auth } from "@clerk/nextjs/server";
import { db, controlResults } from "@/lib/db";
import { companies } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ControlDetail } from "@/components/controls/control-detail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ControlDetailPage({ params }: Props) {
  const { orgId } = await auth();
  const { id } = await params;

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Velg en organisasjon for å se kontrollresultat.</p>
      </div>
    );
  }

  const [row] = await db
    .select({
      id: controlResults.id,
      controlType: controlResults.controlType,
      companyName: companies.name,
      overallStatus: controlResults.overallStatus,
      summary: controlResults.summary,
      deviations: controlResults.deviations,
      sourceSystem: controlResults.sourceSystem,
      reportPdfUrl: controlResults.reportPdfUrl,
      reportExcelUrl: controlResults.reportExcelUrl,
      executedAt: controlResults.executedAt,
      metadata: controlResults.metadata,
    })
    .from(controlResults)
    .innerJoin(companies, eq(controlResults.companyId, companies.id))
    .where(and(eq(controlResults.id, id), eq(controlResults.tenantId, orgId)))
    .limit(1);

  if (!row) notFound();

  return (
    <div className="p-6">
      <ControlDetail
        id={row.id}
        controlType={row.controlType}
        companyName={row.companyName}
        overallStatus={row.overallStatus}
        summary={row.summary as ControlDetail["summary"]}
        deviations={(row.deviations ?? []) as ControlDetail["deviations"]}
        metadata={(row.metadata ?? {}) as ControlDetail["metadata"]}
        sourceSystem={row.sourceSystem}
        executedAt={row.executedAt?.toISOString() ?? ""}
        reportPdfUrl={row.reportPdfUrl}
        reportExcelUrl={row.reportExcelUrl}
      />
    </div>
  );
}

type ControlDetail = {
  summary: { totalChecked: number; totalDeviations: number; totalDeviationAmount: number };
  deviations: { id: string; severity: string; category: string; description: string; reference: string; amount: number }[];
  metadata: { totalOutstanding?: number; totalOverdue?: number; overduePercentage?: number; agingBuckets?: { label: string; count: number; totalAmount: number; percentage: number }[] };
};
