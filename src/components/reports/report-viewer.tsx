"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ReportHeader } from "./report-header";
import { ReportSummaryCards } from "./report-summary-cards";
import { ReportFilterBar, type AldersFilter, type OppfolgingFilter, type SortField } from "./report-filter-bar";
import { ReportTableAging, type CustomerDocInfo } from "./report-table-aging";
import { ContactPickerDialog, type ContactAction } from "./contact-picker-dialog";
import { DocumentFilesDialog } from "./document-files-dialog";
import { FollowUpTaskDialog, type FollowUpPayload } from "@/components/tasks/follow-up-task-dialog";
import type { ReportViewData, CustomerGroup, AgingRow, CustomerTaskInfo } from "@/lib/reports/view-types";

interface ReportViewerProps {
  reportId: string;
  metadata: {
    tittel: string;
    firma: string;
    generertDato: string;
    type: string;
    format?: string;
  };
}

function filterBySearch(kunder: CustomerGroup[], search: string): CustomerGroup[] {
  if (!search.trim()) return kunder;
  const q = search.toLowerCase();
  return kunder.filter(
    (k) =>
      k.kundeId.toLowerCase().includes(q) ||
      k.navn.toLowerCase().includes(q),
  );
}

function filterByAging(kunder: CustomerGroup[], filter: AldersFilter): CustomerGroup[] {
  if (filter === "alle") return kunder;
  return kunder.filter((k) => {
    switch (filter) {
      case "gjeldende":
        return k.subtotal.gjeldende > 0;
      case "1-30":
        return k.subtotal.forfalt_1_30 > 0;
      case "31-50":
        return k.subtotal.forfalt_31_50 > 0;
      case "51-90":
        return k.subtotal.forfalt_51_90 > 0;
      case "over90":
        return k.subtotal.forfalt_over90 > 0;
      default:
        return true;
    }
  });
}

function filterByOppfolging(kunder: CustomerGroup[], filter: OppfolgingFilter): CustomerGroup[] {
  if (filter === "alle") return kunder;
  return kunder.filter((k) => {
    switch (filter) {
      case "uten":
        return k.oppfolgingStatus === "none";
      case "pagar":
        return k.oppfolgingStatus === "task_open" || k.oppfolgingStatus === "doc_requested";
      case "fullfort":
        return k.oppfolgingStatus === "task_completed";
      default:
        return true;
    }
  });
}

function sortKunder(kunder: CustomerGroup[], field: SortField): CustomerGroup[] {
  const sorted = [...kunder];
  switch (field) {
    case "saldo":
      return sorted.sort((a, b) => b.subtotal.saldo - a.subtotal.saldo);
    case "risiko":
      return sorted.sort((a, b) => b.riskScore - a.riskScore);
    case "alder":
      return sorted.sort((a, b) => {
        const aMax = Math.max(a.subtotal.forfalt_over90, a.subtotal.forfalt_51_90, a.subtotal.forfalt_31_50);
        const bMax = Math.max(b.subtotal.forfalt_over90, b.subtotal.forfalt_51_90, b.subtotal.forfalt_31_50);
        return bMax - aMax;
      });
    default:
      return sorted;
  }
}

function fmtNok(v: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function agingLabel(row: AgingRow): string {
  if (row.forfalt_over90 > 0) return ">90 dager";
  if (row.forfalt_51_90 > 0) return "51–90 dager";
  if (row.forfalt_31_50 > 0) return "31–50 dager";
  if (row.forfalt_1_30 > 0) return "1–30 dager";
  return "Gjeldende";
}

function agingLabelKunde(k: CustomerGroup): string {
  if (k.subtotal.forfalt_over90 > 0) return ">90 dager forfalt";
  if (k.subtotal.forfalt_51_90 > 0) return "51–90 dager forfalt";
  if (k.subtotal.forfalt_31_50 > 0) return "31–50 dager forfalt";
  if (k.subtotal.forfalt_1_30 > 0) return "1–30 dager forfalt";
  return "Gjeldende";
}

export function ReportViewer({ reportId, metadata }: ReportViewerProps) {
  const [data, setData] = useState<ReportViewData | null>(null);
  const [taskInfo, setTaskInfo] = useState<Record<string, CustomerTaskInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [aldersFilter, setAldersFilter] = useState<AldersFilter>("alle");
  const [oppfolgingFilter, setOppfolgingFilter] = useState<OppfolgingFilter>("alle");
  const [sortField, setSortField] = useState<SortField>("saldo");
  const [expandedKunder, setExpandedKunder] = useState<Set<string>>(new Set());

  // Dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskContext, setTaskContext] = useState<{
    kundeId: string;
    kundeNavn: string;
    invoiceNumber?: string;
    amount: number;
    agingCategory: string;
  } | null>(null);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactAction, setContactAction] = useState<ContactAction>("purring");
  const [contactKunde, setContactKunde] = useState<CustomerGroup | null>(null);
  const [contactDefaultMsg, setContactDefaultMsg] = useState<string | undefined>();

  // Document request state
  type DocRequestData = Record<string, Array<{
    requestId: string;
    status: string;
    contactName: string | null;
    contactEmail: string | null;
    message: string | null;
    createdAt: string | null;
    completedAt: string | null;
    files: Array<{ id: string; filename: string; filePath: string; fileSize: number | null; contentType: string | null }>;
  }>>;
  const [docRequests, setDocRequests] = useState<DocRequestData>({});
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docDialogKunde, setDocDialogKunde] = useState<CustomerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reports/${reportId}/data`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Kunne ikke laste rapportdata");
        }
        const json: ReportViewData = await res.json();
        if (!cancelled) setData(json);

        const customerIds = json.kunder.map((k) => k.kundeId).join(",");
        if (customerIds) {
          const [taskRes, docRes] = await Promise.all([
            fetch(`/api/reports/${reportId}/tasks?customerIds=${encodeURIComponent(customerIds)}`),
            fetch(`/api/reports/${reportId}/documents?customerIds=${encodeURIComponent(customerIds)}`),
          ]);
          if (taskRes.ok) {
            const info: Record<string, CustomerTaskInfo> = await taskRes.json();
            if (!cancelled) setTaskInfo(info);
          }
          if (docRes.ok) {
            const docs: DocRequestData = await docRes.json();
            if (!cancelled) setDocRequests(docs);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ukjent feil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reportId]);

  // Merge task info into customer data
  const enrichedKunder = useMemo(() => {
    if (!data) return [];
    return data.kunder.map((k) => {
      const info = taskInfo[k.kundeId];
      const docs = docRequests[k.kundeId];
      let status = k.oppfolgingStatus;
      if (info) status = info.status;
      if (status === "none" && docs?.some((d) => d.status === "pending")) {
        status = "doc_requested";
      }
      return { ...k, oppfolgingStatus: status };
    });
  }, [data, taskInfo, docRequests]);

  const docInfo = useMemo<Record<string, CustomerDocInfo>>(() => {
    const result: Record<string, CustomerDocInfo> = {};
    for (const [kundeId, reqs] of Object.entries(docRequests)) {
      const fileCount = reqs.reduce((sum, r) => sum + r.files.length, 0);
      const pendingCount = reqs.filter((r) => r.status === "pending").length;
      if (fileCount > 0 || pendingCount > 0) {
        result[kundeId] = { fileCount, pendingCount };
      }
    }
    return result;
  }, [docRequests]);

  const filteredKunder = useMemo(() => {
    let result = enrichedKunder;
    result = filterBySearch(result, search);
    result = filterByAging(result, aldersFilter);
    result = filterByOppfolging(result, oppfolgingFilter);
    result = sortKunder(result, sortField);
    return result;
  }, [enrichedKunder, search, aldersFilter, oppfolgingFilter, sortField]);

  const handleToggle = useCallback((kundeId: string) => {
    setExpandedKunder((prev) => {
      const next = new Set(prev);
      if (next.has(kundeId)) next.delete(kundeId);
      else next.add(kundeId);
      return next;
    });
  }, []);

  // --- Action handlers ---

  const refreshTaskInfo = useCallback(async () => {
    if (!data) return;
    const customerIds = data.kunder.map((k) => k.kundeId).join(",");
    if (!customerIds) return;
    const [taskRes, docRes] = await Promise.all([
      fetch(`/api/reports/${reportId}/tasks?customerIds=${encodeURIComponent(customerIds)}`),
      fetch(`/api/reports/${reportId}/documents?customerIds=${encodeURIComponent(customerIds)}`),
    ]);
    if (taskRes.ok) {
      const info: Record<string, CustomerTaskInfo> = await taskRes.json();
      setTaskInfo(info);
    }
    if (docRes.ok) {
      const docs: DocRequestData = await docRes.json();
      setDocRequests(docs);
    }
  }, [data, reportId]);

  const handleCreateTask = useCallback((kunde: CustomerGroup) => {
    setTaskContext({
      kundeId: kunde.kundeId,
      kundeNavn: kunde.navn,
      amount: kunde.subtotal.saldo,
      agingCategory: agingLabelKunde(kunde),
    });
    setTaskTitle(`Oppfølging: ${kunde.navn} – ${agingLabelKunde(kunde)}`);
    setTaskDialogOpen(true);
  }, []);

  const handleCreateInvoiceTask = useCallback((row: AgingRow, kundeNavn: string) => {
    setTaskContext({
      kundeId: row.customerId,
      kundeNavn,
      invoiceNumber: row.invoiceNumber,
      amount: row.saldo,
      agingCategory: agingLabel(row),
    });
    setTaskTitle(`Oppfølging: ${kundeNavn} – Faktura ${row.ref}`);
    setTaskDialogOpen(true);
  }, []);

  const handleTaskSubmit = useCallback(async (payload: FollowUpPayload): Promise<boolean> => {
    if (!taskContext) return false;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          type: "overdue_items",
          metadata: {
            reportId,
            reportCustomerId: taskContext.kundeId,
            reportCustomerName: taskContext.kundeNavn,
            invoiceNumber: taskContext.invoiceNumber,
            amount: taskContext.amount,
            agingCategory: taskContext.agingCategory,
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Oppgave opprettet");
      await refreshTaskInfo();
      return true;
    } catch {
      toast.error("Kunne ikke opprette oppgave");
      return false;
    }
  }, [taskContext, reportId, refreshTaskInfo]);

  const handleViewDocuments = useCallback((kunde: CustomerGroup) => {
    setDocDialogKunde(kunde);
    setDocDialogOpen(true);
  }, []);

  const handleSendPurring = useCallback((kunde: CustomerGroup) => {
    setContactDefaultMsg(undefined);
    setContactKunde(kunde);
    setContactAction("purring");
    setContactDialogOpen(true);
  }, []);

  const handleSendDocRequest = useCallback((kunde: CustomerGroup) => {
    setContactKunde(kunde);
    setContactAction("dokumentforespørsel");
    setContactDialogOpen(true);
  }, []);

  const handleSendInvoiceDocRequest = useCallback((row: AgingRow, kundeNavn: string) => {
    const syntheticKunde: CustomerGroup = {
      kundeId: row.customerId,
      navn: kundeNavn,
      rows: [row],
      subtotal: {
        gjeldende: row.gjeldende,
        forfalt_1_30: row.forfalt_1_30,
        forfalt_31_50: row.forfalt_31_50,
        forfalt_51_90: row.forfalt_51_90,
        forfalt_over90: row.forfalt_over90,
        saldo: row.saldo,
      },
      riskScore: 0,
      riskLevel: "low",
      oppfolgingStatus: "none",
    };
    const parts: string[] = [];
    parts.push(`Kunde: ${kundeNavn}`);
    if (row.dok) parts.push(`Bilag: ${row.dok}`);
    if (row.ref) parts.push(`Ref.nr: ${row.ref}`);
    if (row.dokDato) parts.push(`Dato: ${row.dokDato}`);
    if (row.forfallsDato) parts.push(`Forfall: ${row.forfallsDato}`);
    parts.push(`Beløp: ${fmtNok(row.saldo)} kr`);
    setContactDefaultMsg(parts.join("\n"));
    setContactKunde(syntheticKunde);
    setContactAction("dokumentforespørsel");
    setContactDialogOpen(true);
  }, []);

  const handleSendStatement = useCallback((kunde: CustomerGroup) => {
    setContactDefaultMsg(undefined);
    setContactKunde(kunde);
    setContactAction("kontoutskrift");
    setContactDialogOpen(true);
  }, []);

  const handleContactConfirm = useCallback(async (
    contact: { id: string; name: string; email: string },
    message?: string,
  ) => {
    if (!contactKunde) return;

    if (contactAction === "dokumentforespørsel") {
      let defaultMsg = `Forespørsel om dokumentasjon for ${contactKunde.navn}. Saldo: ${fmtNok(contactKunde.subtotal.saldo)} kr.`;
      const row = contactKunde.rows.length === 1 ? contactKunde.rows[0] : null;
      if (row) {
        const parts: string[] = [];
        parts.push(`Kunde: ${contactKunde.navn}`);
        if (row.dok) parts.push(`Bilag: ${row.dok}`);
        if (row.ref) parts.push(`Ref.nr: ${row.ref}`);
        if (row.dokDato) parts.push(`Dato: ${row.dokDato}`);
        if (row.forfallsDato) parts.push(`Forfall: ${row.forfallsDato}`);
        parts.push(`Beløp: ${fmtNok(row.saldo)} kr`);
        defaultMsg = `Forespørsel om dokumentasjon:\n${parts.join("\n")}`;
      }
      const res = await fetch("/api/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          message: message || defaultMsg,
          metadata: {
            reportId,
            reportCustomerId: contactKunde.kundeId,
            reportCustomerName: contactKunde.navn,
            ...(row ? { invoiceRef: row.ref, invoiceDate: row.dokDato, invoiceDueDate: row.forfallsDato } : {}),
          },
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[doc-request] API error:", res.status, errBody);
        throw new Error(errBody?.error ?? "Ukjent feil");
      }
      toast.success(`Dokumentasjonsforespørsel sendt til ${contact.name}`);
      refreshTaskInfo().catch(() => {});
    } else if (contactAction === "purring") {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Purring: ${contactKunde.navn} – ${fmtNok(contactKunde.subtotal.saldo)} kr`,
          type: "overdue_items",
          category: "follow_up_external",
          externalContactId: contact.id,
          notifyExternal: true,
          metadata: {
            reportId,
            reportCustomerId: contactKunde.kundeId,
            reportCustomerName: contactKunde.navn,
            amount: contactKunde.subtotal.saldo,
            purringMessage: message,
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Purring sendt til ${contact.name}`);
      refreshTaskInfo().catch(() => {});
    } else if (contactAction === "kontoutskrift") {
      const res = await fetch(`/api/reports/${reportId}/statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: contactKunde.kundeId,
          contactId: contact.id,
          message,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Kontoutskrift sendt til ${contact.name}`);
    }
  }, [contactAction, contactKunde, reportId, refreshTaskInfo]);

  const isPayable = metadata.type === "accounts_payable";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Laster rapportdata…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const needsAttentionCount = enrichedKunder.filter(
    (k) => k.oppfolgingStatus === "none" && (k.subtotal.forfalt_over90 > 0 || k.subtotal.forfalt_51_90 > 0),
  ).length;

  return (
    <div className="space-y-6">
      <ReportHeader
        reportId={reportId}
        tittel={data.tittel}
        firma={data.firma}
        aldersfordeltPer={data.aldersfordeltPer}
        generertDato={data.generertDato}
        format={metadata.format}
      />

      <ReportSummaryCards
        totals={data.firmaTotalt}
        needsAttentionCount={needsAttentionCount}
      />

      <ReportFilterBar
        search={search}
        onSearch={setSearch}
        aldersFilter={aldersFilter}
        onAldersFilter={setAldersFilter}
        oppfolgingFilter={oppfolgingFilter}
        onOppfolgingFilter={setOppfolgingFilter}
        sortField={sortField}
        onSortField={setSortField}
        totalAntall={enrichedKunder.length}
        filtrertAntall={filteredKunder.length}
      />

      <ReportTableAging
        kunder={filteredKunder}
        expandedKunder={expandedKunder}
        onToggle={handleToggle}
        firmaTotalt={data.firmaTotalt}
        entityLabel={isPayable ? "Leverandør" : "Kunde"}
        docInfo={docInfo}
        onViewDocuments={handleViewDocuments}
        onCreateTask={handleCreateTask}
        onSendPurring={handleSendPurring}
        onSendDocRequest={handleSendDocRequest}
        onSendStatement={handleSendStatement}
        onCreateInvoiceTask={handleCreateInvoiceTask}
        onSendInvoiceDocRequest={handleSendInvoiceDocRequest}
      />

      {/* Task creation dialog */}
      <FollowUpTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        title={taskTitle}
        onTitleChange={setTaskTitle}
        infoRows={
          taskContext
            ? [
                { label: "Kunde", value: taskContext.kundeNavn },
                { label: "Beløp", value: `${fmtNok(taskContext.amount)} kr` },
                { label: "Alderskategori", value: taskContext.agingCategory },
                ...(taskContext.invoiceNumber
                  ? [{ label: "Faktura", value: taskContext.invoiceNumber }]
                  : []),
              ]
            : []
        }
        onSubmit={handleTaskSubmit}
      />

      {/* Contact picker for purring / doc request / statement */}
      <ContactPickerDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        action={contactAction}
        kundeNavn={contactKunde?.navn ?? ""}
        defaultMessage={contactDefaultMsg}
        onConfirm={handleContactConfirm}
      />

      {/* Document files viewer */}
      <DocumentFilesDialog
        open={docDialogOpen}
        onOpenChange={setDocDialogOpen}
        kundeNavn={docDialogKunde?.navn ?? ""}
        requests={docDialogKunde ? (docRequests[docDialogKunde.kundeId] ?? []) : []}
      />
    </div>
  );
}
