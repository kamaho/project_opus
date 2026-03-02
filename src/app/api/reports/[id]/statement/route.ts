import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant } from "@/lib/auth/api-handler";
import { db, reports } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { companies, contacts, tripletexConnections } from "@/lib/db/schema";
import { getAdapter } from "@/lib/accounting";
import { generateAccountStatementPdf } from "@/lib/reports/pdf/account-statement-pdf";
import { sendStatementEmail } from "@/lib/resend";
import type { AgingRow } from "@/lib/reports/view-types";

const bodySchema = z.object({
  kundeId: z.string(),
  contactId: z.string().uuid(),
  message: z.string().optional(),
});

export const POST = withTenant(async (req: NextRequest, ctx, params) => {
  const reportId = params?.id;
  if (!reportId) return NextResponse.json({ error: "Mangler id" }, { status: 400 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }

  const { kundeId, contactId, message } = parsed.data;

  const [row] = await db
    .select({
      id: reports.id,
      reportType: reports.reportType,
      title: reports.title,
      asOfDate: reports.asOfDate,
      companyId: reports.companyId,
      companyName: companies.name,
    })
    .from(reports)
    .innerJoin(companies, eq(reports.companyId, companies.id))
    .where(and(eq(reports.id, reportId), eq(reports.tenantId, ctx.tenantId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Rapport ikke funnet" }, { status: 404 });

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, ctx.tenantId)))
    .limit(1);

  if (!contact) return NextResponse.json({ error: "Kontakt ikke funnet" }, { status: 404 });

  const [conn] = await db
    .select()
    .from(tripletexConnections)
    .where(and(eq(tripletexConnections.tenantId, ctx.tenantId), eq(tripletexConnections.isActive, true)))
    .limit(1);

  const adapter = conn
    ? await getAdapter({ systemId: "tripletex", tenantId: ctx.tenantId })
    : await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });

  const asOfDate = row.asOfDate ? new Date(row.asOfDate) : new Date();

  let entries = row.reportType === "accounts_receivable"
    ? await adapter.getAccountsReceivable(asOfDate)
    : await adapter.getAccountsPayable(asOfDate);

  if (entries.length === 0 && adapter.systemId !== "demo") {
    const demoAdapter = await getAdapter({ systemId: "demo", tenantId: ctx.tenantId });
    entries = row.reportType === "accounts_receivable"
      ? await demoAdapter.getAccountsReceivable(asOfDate)
      : await demoAdapter.getAccountsPayable(asOfDate);
  }

  const isReceivable = row.reportType === "accounts_receivable";
  const customerEntries = entries.filter((e) => {
    const id = isReceivable
      ? (e as { customerId: string }).customerId
      : (e as { supplierId: string }).supplierId;
    return id === kundeId;
  });

  const customerName = isReceivable
    ? (customerEntries[0] as { customerName: string })?.customerName
    : (customerEntries[0] as { supplierName: string })?.supplierName;

  if (!customerName) {
    return NextResponse.json({ error: "Kunde ikke funnet i rapportdata" }, { status: 404 });
  }

  const agingRows: AgingRow[] = customerEntries.map((e) => ({
    customerId: kundeId,
    invoiceNumber: e.invoiceNumber,
    dok: e.originalAmount < 0 ? "Kreditnota" : "Faktura",
    ref: e.invoiceNumber,
    dokDato: e.invoiceDate.toISOString().split("T")[0],
    forfallsDato: e.dueDate.toISOString().split("T")[0],
    gjeldende: 0,
    forfalt_1_30: 0,
    forfalt_31_50: 0,
    forfalt_51_90: 0,
    forfalt_over90: 0,
    saldo: e.remainingAmount,
  }));

  const totalSaldo = agingRows.reduce((s, r) => s + r.saldo, 0);

  const aldersfordeltPer = asOfDate.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const pdf = await generateAccountStatementPdf({
    kundeId,
    kundeNavn: customerName,
    firmaNavn: row.companyName,
    aldersfordeltPer,
    rows: agingRows,
    totalSaldo,
  });

  await sendStatementEmail({
    to: contact.email,
    contactName: contact.name,
    companyName: row.companyName,
    customerName,
    perDato: aldersfordeltPer,
    message,
    pdfBuffer: pdf,
    pdfFileName: `Kontoutskrift - ${customerName} - ${aldersfordeltPer}.pdf`,
  });

  return NextResponse.json({ ok: true });
});
