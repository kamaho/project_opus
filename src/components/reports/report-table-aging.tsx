"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Circle, CheckCircle2, Mail, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomerGroup, AgingRow, AgingTotals, RiskLevel, OppfolgingStatus } from "@/lib/reports/view-types";
import { CustomerActionBar } from "./customer-action-bar";
import { InvoiceActionMenu } from "./invoice-action-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CustomerDocInfo {
  fileCount: number;
  pendingCount: number;
}

interface ReportTableAgingProps {
  kunder: CustomerGroup[];
  expandedKunder: Set<string>;
  onToggle: (kundeId: string) => void;
  firmaTotalt: AgingTotals;
  entityLabel?: string;
  docInfo?: Record<string, CustomerDocInfo>;
  onViewDocuments?: (kunde: CustomerGroup) => void;
  onCreateTask: (kunde: CustomerGroup) => void;
  onSendPurring: (kunde: CustomerGroup) => void;
  onSendDocRequest: (kunde: CustomerGroup) => void;
  onSendStatement: (kunde: CustomerGroup) => void;
  onCreateInvoiceTask: (row: AgingRow, kundeNavn: string) => void;
  onSendInvoiceDocRequest: (row: AgingRow, kundeNavn: string) => void;
}

function fmt(v: number): string {
  if (v === 0) return "–";
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "",
  medium: "bg-amber-50 dark:bg-amber-950/20",
  high: "bg-orange-50 dark:bg-orange-950/20",
  critical: "bg-red-50 dark:bg-red-950/20",
};

const RISK_BADGE: Record<RiskLevel, { label: string; className: string } | null> = {
  low: null,
  medium: { label: "Middels", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  high: { label: "Høy", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  critical: { label: "Kritisk", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

function StatusIndicator({ status }: { status: OppfolgingStatus }) {
  if (status === "none") return null;

  const config = {
    task_open: { icon: Circle, className: "text-amber-500", label: "Oppfølging pågår" },
    task_completed: { icon: CheckCircle2, className: "text-emerald-500", label: "Fullført" },
    doc_requested: { icon: Mail, className: "text-blue-500", label: "Dokumentasjon forespurt" },
  }[status];

  if (!config) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <config.icon className={cn("h-3.5 w-3.5 shrink-0", config.className)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}

function TotalsCells({ totals, bold }: { totals: AgingTotals; bold?: boolean }) {
  return (
    <>
      <td className={cn("px-3 py-2 text-right tabular-nums font-mono text-xs", bold && "font-bold")}>
        {fmt(totals.gjeldende)}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums font-mono text-xs", bold && "font-bold")}>
        {fmt(totals.forfalt_1_30)}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums font-mono text-xs", bold && "font-bold")}>
        {fmt(totals.forfalt_31_50)}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums font-mono text-xs", bold && "font-bold")}>
        {fmt(totals.forfalt_51_90)}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right tabular-nums font-mono text-xs",
          bold && "font-bold",
          totals.forfalt_over90 > 0 && "text-red-500",
        )}
      >
        {fmt(totals.forfalt_over90)}
      </td>
      <td className={cn("px-3 py-2 text-right tabular-nums font-mono text-xs", bold && "font-bold")}>
        {fmt(totals.saldo)}
      </td>
    </>
  );
}

export function ReportTableAging({
  kunder,
  expandedKunder,
  onToggle,
  firmaTotalt,
  entityLabel = "Kunde",
  docInfo,
  onViewDocuments,
  onCreateTask,
  onSendPurring,
  onSendDocRequest,
  onSendStatement,
  onCreateInvoiceTask,
  onSendInvoiceDocRequest,
}: ReportTableAgingProps) {
  const [hoveredKundeId, setHoveredKundeId] = useState<string | null>(null);
  const [hoveredRowIdx, setHoveredRowIdx] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th colSpan={4} className="sticky top-0 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              {entityLabel}
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              Gjeldende
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              1–30 d
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              31–50 d
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              51–90 d
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              &gt;90 d
            </th>
            <th className="sticky top-0 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
              Saldo
            </th>
          </tr>
        </thead>
        <tbody>
          {kunder.map((kunde) => {
            const expanded = expandedKunder.has(kunde.kundeId);
            return (
              <CustomerGroupRows
                key={kunde.kundeId}
                kunde={kunde}
                expanded={expanded}
                onToggle={() => onToggle(kunde.kundeId)}
                hoveredKundeId={hoveredKundeId}
                onHoverKunde={setHoveredKundeId}
                hoveredRowIdx={hoveredRowIdx}
                onHoverRow={setHoveredRowIdx}
                customerDocInfo={docInfo?.[kunde.kundeId]}
                onViewDocuments={onViewDocuments}
                onCreateTask={onCreateTask}
                onSendPurring={onSendPurring}
                onSendDocRequest={onSendDocRequest}
                onSendStatement={onSendStatement}
                onCreateInvoiceTask={onCreateInvoiceTask}
                onSendInvoiceDocRequest={onSendInvoiceDocRequest}
              />
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-muted/30">
            <td colSpan={5} className="px-3 py-2.5 text-xs font-bold">
              Firma totalt
            </td>
            <TotalsCells totals={firmaTotalt} bold />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CustomerGroupRows({
  kunde,
  expanded,
  onToggle,
  hoveredKundeId,
  onHoverKunde,
  hoveredRowIdx,
  onHoverRow,
  customerDocInfo,
  onViewDocuments,
  onCreateTask,
  onSendPurring,
  onSendDocRequest,
  onSendStatement,
  onCreateInvoiceTask,
  onSendInvoiceDocRequest,
}: {
  kunde: CustomerGroup;
  expanded: boolean;
  onToggle: () => void;
  hoveredKundeId: string | null;
  onHoverKunde: (id: string | null) => void;
  hoveredRowIdx: string | null;
  onHoverRow: (id: string | null) => void;
  customerDocInfo?: CustomerDocInfo;
  onViewDocuments?: (kunde: CustomerGroup) => void;
  onCreateTask: (kunde: CustomerGroup) => void;
  onSendPurring: (kunde: CustomerGroup) => void;
  onSendDocRequest: (kunde: CustomerGroup) => void;
  onSendStatement: (kunde: CustomerGroup) => void;
  onCreateInvoiceTask: (row: AgingRow, kundeNavn: string) => void;
  onSendInvoiceDocRequest: (row: AgingRow, kundeNavn: string) => void;
}) {
  const riskBadge = RISK_BADGE[kunde.riskLevel];
  const isHovered = hoveredKundeId === kunde.kundeId;

  return (
    <>
      <tr
        className={cn(
          "border-t border-border cursor-pointer transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-950/30 hover:outline hover:outline-1 hover:outline-blue-300/60 dark:hover:outline-blue-500/40 hover:-outline-offset-1 relative",
          RISK_STYLES[kunde.riskLevel],
        )}
        onClick={onToggle}
        onMouseEnter={() => onHoverKunde(kunde.kundeId)}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as HTMLElement | null;
          if (related?.closest?.(".row-action-bar")) return;
          onHoverKunde(null);
        }}
      >
        <td colSpan={4} className="px-3 py-2 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="truncate">
              {kunde.kundeId} – {kunde.navn}
            </span>
          </div>
        </td>
        <td className="px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            {riskBadge && (
              <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", riskBadge.className)}>
                {riskBadge.label}
              </span>
            )}
            <StatusIndicator status={kunde.oppfolgingStatus} />
            {customerDocInfo && customerDocInfo.fileCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-violet-600 hover:text-violet-700 dark:text-violet-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDocuments?.(kunde);
                    }}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-medium">{customerDocInfo.fileCount}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {customerDocInfo.fileCount} {customerDocInfo.fileCount === 1 ? "dokument" : "dokumenter"} mottatt
                  {customerDocInfo.pendingCount > 0 && `, ${customerDocInfo.pendingCount} venter`}
                </TooltipContent>
              </Tooltip>
            )}
            {customerDocInfo && customerDocInfo.pendingCount > 0 && customerDocInfo.fileCount === 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 text-amber-500">
                    <Mail className="h-3 w-3" />
                    <span className="text-[10px] font-medium">{customerDocInfo.pendingCount}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {customerDocInfo.pendingCount} forespørsel{customerDocInfo.pendingCount > 1 ? "er" : ""} venter svar
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </td>
        <TotalsCells totals={kunde.subtotal} bold />
        {isHovered && (
          <td className="p-0" style={{ position: "relative", width: 0 }}>
            <CustomerActionBar
              kunde={kunde}
              onCreateTask={onCreateTask}
              onSendPurring={onSendPurring}
              onSendStatement={onSendStatement}
            />
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-muted/60 dark:bg-muted/40">
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground" />
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground">Dok</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground">Ref.nr</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground">Dok.dato</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground">Forfall</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">Gjeldende</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">1–30 d</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">31–50 d</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">51–90 d</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">&gt;90 d</td>
          <td className="px-3 py-1 text-[10px] font-medium text-muted-foreground text-right">Saldo</td>
        </tr>
      )}
      {expanded &&
        kunde.rows.map((row, i) => {
          const rowKey = `${kunde.kundeId}-${i}`;
          const isRowHovered = hoveredRowIdx === rowKey;
          return (
            <tr
              key={i}
              className={cn(
                "border-t border-border/50 relative transition-colors hover:bg-blue-50/70 dark:hover:bg-blue-950/30 hover:outline hover:outline-1 hover:outline-blue-300/60 dark:hover:outline-blue-500/40 hover:-outline-offset-1",
                i % 2 === 0 ? "bg-background" : "bg-muted/20",
                row.saldo < 0 && "text-muted-foreground italic",
              )}
              onMouseEnter={() => onHoverRow(rowKey)}
              onMouseLeave={(e) => {
                const related = e.relatedTarget as HTMLElement | null;
                if (related?.closest?.(".row-action-bar")) return;
                onHoverRow(null);
              }}
            >
              <td className="px-3 py-1.5 text-xs" />
              <td className="px-3 py-1.5 text-xs">{row.dok}</td>
              <td className="px-3 py-1.5 text-xs font-mono">{row.ref}</td>
              <td className="px-3 py-1.5 text-xs whitespace-nowrap">{row.dokDato}</td>
              <td className="px-3 py-1.5 text-xs whitespace-nowrap">{row.forfallsDato}</td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono text-xs">
                {fmt(row.gjeldende)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono text-xs">
                {fmt(row.forfalt_1_30)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono text-xs">
                {fmt(row.forfalt_31_50)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono text-xs">
                {fmt(row.forfalt_51_90)}
              </td>
              <td
                className={cn(
                  "px-3 py-1.5 text-right tabular-nums font-mono text-xs",
                  row.forfalt_over90 > 0 && "text-red-500",
                )}
              >
                {fmt(row.forfalt_over90)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums font-mono text-xs font-medium">
                {fmt(row.saldo)}
              </td>
              {isRowHovered && (
                <td className="p-0" style={{ position: "relative", width: 0 }}>
                  <InvoiceActionMenu
                    row={row}
                    kundeNavn={kunde.navn}
                    onCreateTask={onCreateInvoiceTask}
                    onSendDocRequest={onSendInvoiceDocRequest}
                  />
                </td>
              )}
            </tr>
          );
        })}
      {expanded && (
        <tr className="border-t border-border bg-muted/50 dark:bg-muted/30">
          <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-right">
            {kunde.navn} total
          </td>
          <TotalsCells totals={kunde.subtotal} bold />
        </tr>
      )}
    </>
  );
}
