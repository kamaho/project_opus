"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

interface ControlSummaryProps {
  overallStatus: string;
  totalChecked: number;
  totalDeviations: number;
  totalDeviationAmount: number;
  totalOutstanding?: number;
  totalOverdue?: number;
  overduePercentage?: number;
}

const STATUS_CONFIG = {
  ok: { icon: CheckCircle2, label: "Ingen avvik", className: "text-green-600 dark:text-green-400" },
  info: { icon: Info, label: "Merknader", className: "text-blue-600 dark:text-blue-400" },
  warning: { icon: AlertTriangle, label: "Avvik funnet", className: "text-amber-600 dark:text-amber-400" },
  error: { icon: XCircle, label: "Feil funnet", className: "text-red-600 dark:text-red-400" },
} as const;

const NOK = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export function ControlSummary({
  overallStatus,
  totalChecked,
  totalDeviations,
  totalDeviationAmount,
  totalOutstanding,
  totalOverdue,
  overduePercentage,
}: ControlSummaryProps) {
  const status = STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.ok;
  const Icon = status.icon;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", status.className)} />
        <span className={cn("text-sm font-semibold", status.className)}>{status.label}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Poster sjekket</p>
          <p className="font-mono tabular-nums font-medium">{totalChecked}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Avvik</p>
          <p className="font-mono tabular-nums font-medium">{totalDeviations}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Sum avvik</p>
          <p className="font-mono tabular-nums font-medium">{NOK.format(totalDeviationAmount)} kr</p>
        </div>
        {totalOutstanding != null && (
          <div>
            <p className="text-muted-foreground text-xs">Total utestående</p>
            <p className="font-mono tabular-nums font-medium">{NOK.format(totalOutstanding)} kr</p>
          </div>
        )}
        {totalOverdue != null && (
          <div>
            <p className="text-muted-foreground text-xs">Herav forfalt</p>
            <p className="font-mono tabular-nums font-medium">
              {NOK.format(totalOverdue)} kr
              {overduePercentage != null && <span className="text-muted-foreground ml-1">({overduePercentage}%)</span>}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
