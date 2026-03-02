import { auth } from "@clerk/nextjs/server";
import { db, reports } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { companies } from "@/lib/db/schema";
import { notFound, redirect } from "next/navigation";
import { ReportViewer } from "@/components/reports/report-viewer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportWorkspacePage({ params }: Props) {
  const { id } = await params;
  const { orgId } = await auth();

  if (!orgId) redirect("/sign-in");

  const [row] = await db
    .select({
      id: reports.id,
      title: reports.title,
      reportType: reports.reportType,
      format: reports.format,
      generatedAt: reports.generatedAt,
      companyName: companies.name,
    })
    .from(reports)
    .innerJoin(companies, eq(reports.companyId, companies.id))
    .where(and(eq(reports.id, id), eq(reports.tenantId, orgId)))
    .limit(1);

  if (!row) notFound();

  return (
    <ReportViewer
      reportId={row.id}
      metadata={{
        tittel: row.title,
        firma: row.companyName,
        generertDato: row.generatedAt?.toISOString() ?? new Date().toISOString(),
        type: row.reportType,
        format: row.format,
      }}
    />
  );
}
