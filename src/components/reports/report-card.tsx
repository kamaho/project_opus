"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileInput,
  FileOutput,
  Receipt,
  Users,
  Palmtree,
  Download,
  Trash2,
  FileText,
  FileSpreadsheet,
  Loader2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportSummary } from "@/lib/reports/types";

const TYPE_ICONS: Record<string, LucideIcon> = {
  accounts_receivable: FileInput,
  accounts_payable: FileOutput,
  vat_summary: Receipt,
  payroll_summary: Users,
  holiday_pay: Palmtree,
};

const TYPE_LABELS: Record<string, string> = {
  accounts_receivable: "Kundefordringer",
  accounts_payable: "Leverandørgjeld",
  vat_summary: "MVA-oppstilling",
  payroll_summary: "Lønnsoppstilling",
  holiday_pay: "Feriepenger",
};

const WORKSPACE_TYPES = new Set(["accounts_receivable", "accounts_payable"]);

interface ReportCardProps {
  id: string;
  reportType: string;
  title: string;
  format: string;
  fileName: string;
  summary: ReportSummary;
  companyName: string;
  generatedAt: string;
  onDeleted?: () => void;
}

export function ReportCard({
  id,
  reportType,
  title,
  format,
  summary,
  companyName,
  generatedAt,
  onDeleted,
}: ReportCardProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = TYPE_ICONS[reportType] ?? FileText;
  const typeLabel = TYPE_LABELS[reportType] ?? reportType;
  const FormatIcon = format === "pdf" ? FileText : FileSpreadsheet;
  const hasWorkspace = WORKSPACE_TYPES.has(reportType);

  const formattedDate = new Date(generatedAt).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCardClick = () => {
    if (hasWorkspace) {
      router.push(`/dashboard/rapporter/${id}`);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/${id}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = title + (format === "pdf" ? ".pdf" : ".xlsx");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Er du sikker på at du vil slette denne rapporten?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reports/${id}`, { method: "DELETE" });
      if (res.ok) onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30",
        hasWorkspace && "cursor-pointer",
      )}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{typeLabel}</h3>
            <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
              <FormatIcon className="h-3 w-3" />
              {format}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {companyName} · {title}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {summary.highlights.slice(0, 3).map((h, i) => (
              <span key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{h.value}</span>{" "}
                {h.label.toLowerCase()}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              <span className="whitespace-nowrap">Generert {formattedDate}</span>
            </p>
            <div className="flex items-center gap-1">
              {hasWorkspace && (
                <span className="mr-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  Åpne
                  <ArrowRight className="h-3 w-3" />
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="ml-1">Last ned</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 w-7 p-0", deleting && "opacity-50")}
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
