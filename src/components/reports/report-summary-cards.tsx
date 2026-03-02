"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { AgingTotals } from "@/lib/reports/view-types";

interface ReportSummaryCardsProps {
  totals: AgingTotals;
  needsAttentionCount?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface CardProps {
  label: string;
  value: number;
  variant?: "default" | "warning" | "danger";
}

function SummaryCard({ label, value, variant = "default" }: CardProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3 sm:p-4 min-w-0">
      <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "mt-0.5 sm:mt-1 text-base sm:text-lg xl:text-xl font-semibold tabular-nums font-mono truncate",
          variant === "danger" && value > 0 && "text-red-500",
          variant === "warning" && value > 0 && "text-amber-500",
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function AttentionCard({ count }: { count: number }) {
  return (
    <div className={cn(
      "rounded-lg border px-3 py-3 sm:p-4 min-w-0",
      count > 0
        ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
        : "border-border bg-card",
    )}>
      <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1 truncate">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Trenger oppfølging
      </p>
      <p className={cn(
        "mt-0.5 sm:mt-1 text-base sm:text-lg xl:text-xl font-semibold truncate",
        count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      )}>
        {count} {count === 1 ? "kunde" : "kunder"}
      </p>
    </div>
  );
}

export function ReportSummaryCards({ totals, needsAttentionCount }: ReportSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
      <SummaryCard label="Total saldo" value={totals.saldo} />
      <SummaryCard label="Gjeldende" value={totals.gjeldende} />
      <SummaryCard label="Forfalt 1–30 d" value={totals.forfalt_1_30} />
      <SummaryCard label="Forfalt 31–50 d" value={totals.forfalt_31_50} variant="warning" />
      <SummaryCard label="Forfalt 51–90 d" value={totals.forfalt_51_90} variant="warning" />
      <SummaryCard label="Forfalt >90 d" value={totals.forfalt_over90} variant="danger" />
      {needsAttentionCount !== undefined && (
        <AttentionCard count={needsAttentionCount} />
      )}
    </div>
  );
}
