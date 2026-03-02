"use client";

import { useCallback, useState } from "react";
import { ControlSummary } from "./control-summary";
import { AgingChart } from "./aging-chart";
import { DeviationList, type Deviation } from "./deviation-list";
import { FollowUpTaskDialog, type FollowUpPayload } from "@/components/tasks/follow-up-task-dialog";
import { ContactPickerDialog, type ContactAction } from "@/components/reports/contact-picker-dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

interface ControlDetailProps {
  id: string;
  controlType: string;
  companyName: string;
  overallStatus: string;
  summary: {
    totalChecked: number;
    totalDeviations: number;
    totalDeviationAmount: number;
  };
  deviations: Deviation[];
  metadata: {
    totalOutstanding?: number;
    totalOverdue?: number;
    overduePercentage?: number;
    agingBuckets?: AgingBucket[];
  };
  sourceSystem: string;
  executedAt: string;
  reportPdfUrl: string | null;
  reportExcelUrl: string | null;
}

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

const TYPE_LABELS: Record<string, string> = {
  accounts_receivable: "Kundefordringer",
  accounts_payable: "Leverandørgjeld",
  payroll_a07: "Lønnsavstemming",
  vat_reconciliation: "MVA-avstemming",
  holiday_pay: "Feriepenger",
};

export function ControlDetail({
  id,
  controlType,
  companyName,
  overallStatus,
  summary,
  deviations,
  metadata,
  sourceSystem,
  executedAt,
  reportPdfUrl,
  reportExcelUrl,
}: ControlDetailProps) {
  const typeLabel = TYPE_LABELS[controlType] ?? controlType;
  const dateStr = executedAt
    ? new Date(executedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInfoRows, setTaskInfoRows] = useState<{ label: string; value: string }[]>([]);
  const [activeDeviation, setActiveDeviation] = useState<Deviation | null>(null);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactAction, setContactAction] = useState<ContactAction>("purring");
  const [contactKundeNavn, setContactKundeNavn] = useState("");
  const [contactDefaultMessage, setContactDefaultMessage] = useState("");

  const handleCreateTask = useCallback((dev: Deviation) => {
    setActiveDeviation(dev);
    setTaskTitle(`Følg opp: ${dev.description.slice(0, 80)}`);
    setTaskInfoRows([
      { label: "Kontroll", value: `${TYPE_LABELS[controlType] ?? controlType} – ${companyName}` },
      { label: "Avvik", value: dev.description },
      { label: "Referanse", value: dev.reference },
      { label: "Beløp", value: `${NOK.format(dev.amount)} kr` },
    ]);
    setTaskDialogOpen(true);
  }, [controlType, companyName]);

  const handleSendMessage = useCallback((dev: Deviation) => {
    setActiveDeviation(dev);
    setContactAction("purring");
    const kundeNavn = extractCustomerName(dev.description) ?? dev.reference;
    setContactKundeNavn(kundeNavn);
    setContactDefaultMessage(
      `Hei,\n\nVi viser til utestående beløp på ${NOK.format(dev.amount)} kr (ref: ${dev.reference}) for ${companyName}.\n\nVennligst ta kontakt dersom det er spørsmål.\n\nMed vennlig hilsen`
    );
    setContactDialogOpen(true);
  }, [companyName]);

  const handleRequestDoc = useCallback((dev: Deviation) => {
    setActiveDeviation(dev);
    setContactAction("dokumentforespørsel");
    const kundeNavn = extractCustomerName(dev.description) ?? dev.reference;
    setContactKundeNavn(kundeNavn);
    setContactDefaultMessage(
      `Hei,\n\nVi mangler dokumentasjon knyttet til ref: ${dev.reference} (${NOK.format(dev.amount)} kr) for ${companyName}.\n\nVennligst last opp relevante dokumenter via lenken nedenfor.\n\nMed vennlig hilsen`
    );
    setContactDialogOpen(true);
  }, [companyName]);

  const handleTaskSubmit = useCallback(async (payload: FollowUpPayload): Promise<boolean> => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          category: payload.category,
          assigneeId: payload.assigneeId,
          externalContactId: payload.externalContactId,
          notifyExternal: payload.notifyExternal,
          metadata: {
            source: "control",
            controlResultId: id,
            controlType,
            deviationId: activeDeviation?.id,
            deviationRef: activeDeviation?.reference,
          },
        }),
      });
      if (!res.ok) throw new Error("Kunne ikke opprette oppgave");
      toast.success("Oppgave opprettet");
      return true;
    } catch {
      toast.error("Feil ved opprettelse av oppgave");
      return false;
    }
  }, [id, controlType, activeDeviation]);

  const handleContactConfirm = useCallback(async (contact: { id: string; name: string; email: string; company: string | null }, message?: string) => {
    try {
      const res = await fetch("/api/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.id,
          contactEmail: contact.email,
          contactName: contact.name,
          message,
          action: contactAction,
          metadata: {
            source: "control",
            controlResultId: id,
            controlType,
            companyName,
            deviationId: activeDeviation?.id,
            deviationRef: activeDeviation?.reference,
            deviationAmount: activeDeviation?.amount,
          },
        }),
      });
      if (!res.ok) throw new Error("Sending feilet");
      toast.success(contactAction === "purring" ? "Purring sendt" : "Dokumentasjonsforespørsel sendt");
    } catch {
      toast.error("Kunne ikke sende melding");
    }
  }, [contactAction, id, controlType, companyName, activeDeviation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/controls">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">{typeLabel}</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-9">
            {companyName} &middot; {dateStr} &middot; Kilde: {sourceSystem}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reportPdfUrl && (
            <a href={`/api/controls/results/${id}/download?format=pdf`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Last ned PDF
              </Button>
            </a>
          )}
          {reportExcelUrl && (
            <a href={`/api/controls/results/${id}/download?format=excel`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Last ned Excel
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Summary */}
      <ControlSummary
        overallStatus={overallStatus}
        totalChecked={summary.totalChecked}
        totalDeviations={summary.totalDeviations}
        totalDeviationAmount={summary.totalDeviationAmount}
        totalOutstanding={metadata.totalOutstanding}
        totalOverdue={metadata.totalOverdue}
        overduePercentage={metadata.overduePercentage}
      />

      {/* Aging chart */}
      {metadata.agingBuckets && metadata.agingBuckets.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <AgingChart buckets={metadata.agingBuckets} />
        </div>
      )}

      {/* Deviations */}
      <div className="rounded-lg border bg-card p-4">
        <DeviationList
          deviations={deviations}
          onCreateTask={handleCreateTask}
          onSendMessage={handleSendMessage}
          onRequestDoc={handleRequestDoc}
        />
      </div>

      {/* Task follow-up dialog */}
      <FollowUpTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        title={taskTitle}
        onTitleChange={setTaskTitle}
        clientName={companyName}
        infoRows={taskInfoRows}
        onSubmit={handleTaskSubmit}
      />

      {/* Contact messaging dialog */}
      <ContactPickerDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        action={contactAction}
        kundeNavn={contactKundeNavn}
        defaultMessage={contactDefaultMessage}
        onConfirm={handleContactConfirm}
      />
    </div>
  );
}

function extractCustomerName(description: string): string | null {
  const match = description.match(/fra\s+(.+?)\s+er\s+/i);
  return match?.[1] ?? null;
}
