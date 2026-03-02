"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, Info, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ControlCardProps {
  id: string;
  controlType: string;
  companyName: string;
  overallStatus: string;
  summary: {
    totalChecked: number;
    totalDeviations: number;
    totalDeviationAmount: number;
  };
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

const STATUS_CONFIG = {
  ok: { icon: CheckCircle2, label: "OK", className: "text-green-600 dark:text-green-400" },
  info: { icon: Info, label: "Merknader", className: "text-blue-600 dark:text-blue-400" },
  warning: { icon: AlertTriangle, label: "Avvik", className: "text-amber-600 dark:text-amber-400" },
  error: { icon: XCircle, label: "Feil", className: "text-red-600 dark:text-red-400" },
} as const;

export function ControlCard({
  id,
  controlType,
  companyName,
  overallStatus,
  summary,
  executedAt,
  reportPdfUrl,
  reportExcelUrl,
}: ControlCardProps) {
  const status = STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ok;
  const Icon = status.icon;
  const typeLabel = TYPE_LABELS[controlType] ?? controlType;
  const dateStr = executedAt
    ? new Date(executedAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{typeLabel}</h3>
          <p className="text-xs text-muted-foreground">{companyName}</p>
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", status.className)}>
          <Icon className="h-3.5 w-3.5" />
          <span>{status.label}</span>
          {summary.totalDeviations > 0 && (
            <span className="ml-0.5">({summary.totalDeviations})</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">Kjørt: {dateStr}</span>
        {summary.totalDeviationAmount > 0 && (
          <span>Sum avvik: {NOK.format(summary.totalDeviationAmount)} kr</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/dashboard/controls/${id}`}>
          <Button variant="outline" size="sm" className="text-xs h-7">
            Se detaljer
          </Button>
        </Link>
        {reportPdfUrl && (
          <a href={`/api/controls/results/${id}/download?format=pdf`}>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              <FileText className="h-3 w-3" />
              PDF
            </Button>
          </a>
        )}
        {reportExcelUrl && (
          <a href={`/api/controls/results/${id}/download?format=excel`}>
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              <FileSpreadsheet className="h-3 w-3" />
              Excel
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}
