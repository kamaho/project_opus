"use client";

import { cn } from "@/lib/utils";
import {
  MOCK_HEATMAP,
  DEADLINE_TYPE_LABELS,
  type DeadlineType,
  type MockHeatmapCell,
} from "../mock-data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const intensityStyles: Record<MockHeatmapCell["intensity"], string> = {
  NONE:     "bg-muted/50 dark:bg-muted/20",
  LOW:      "bg-violet-100 dark:bg-violet-900/40",
  MEDIUM:   "bg-amber-100 dark:bg-amber-900/40",
  HIGH:     "bg-orange-200 dark:bg-orange-900/40",
  CRITICAL: "bg-red-200 dark:bg-red-900/50",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
const DEADLINE_TYPES: DeadlineType[] = ["MVA", "A_MELDING", "SKATTEMELDING", "ARSREGNSKAP", "AKSJONAER"];
const CURRENT_MONTH = new Date().getMonth();

export function DeadlineHeatmap() {
  const cellMap = new Map<string, MockHeatmapCell>();
  for (const cell of MOCK_HEATMAP) {
    cellMap.set(`${cell.deadlineType}-${cell.month}`, cell);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Frist-heatmap 2026</h3>
      <div className="overflow-x-auto">
        <TooltipProvider>
          <div className="min-w-[640px]">
            {/* Month headers */}
            <div className="grid gap-1" style={{ gridTemplateColumns: "140px repeat(12, 1fr)" }}>
              <div />
              {MONTHS.map((m, i) => (
                <div
                  key={m}
                  className={cn(
                    "text-[10px] font-medium text-center py-1",
                    i === CURRENT_MONTH
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {m}
                </div>
              ))}
            </div>

            {/* Rows per deadline type */}
            {DEADLINE_TYPES.map((type) => (
              <div
                key={type}
                className="grid gap-1 mt-1"
                style={{ gridTemplateColumns: "140px repeat(12, 1fr)" }}
              >
                <div className="text-xs text-muted-foreground flex items-center pr-2 truncate">
                  {DEADLINE_TYPE_LABELS[type]}
                </div>
                {MONTHS.map((_, monthIdx) => {
                  const cell = cellMap.get(`${type}-${monthIdx}`);
                  const count = cell?.count ?? 0;
                  const intensity = cell?.intensity ?? "NONE";

                  return (
                    <Tooltip key={monthIdx}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium tabular-nums cursor-default transition-colors",
                            intensityStyles[intensity],
                            count === 0 && "text-muted-foreground/40",
                            count > 0 && intensity === "CRITICAL" && "text-red-700 dark:text-red-300",
                            count > 0 && intensity === "HIGH" && "text-orange-700 dark:text-orange-300",
                            count > 0 && intensity === "MEDIUM" && "text-amber-700 dark:text-amber-300",
                            count > 0 && intensity === "LOW" && "text-violet-700 dark:text-violet-300",
                            monthIdx === CURRENT_MONTH && "ring-1 ring-foreground/20",
                          )}
                        >
                          {count > 0 ? count : ""}
                        </div>
                      </TooltipTrigger>
                      {count > 0 && cell && (
                        <TooltipContent side="top">
                          <div className="text-xs space-y-0.5">
                            <div className="font-medium">{cell.deadlineTypeLabel} – {cell.monthLabel}</div>
                            <div>{cell.count} frister | {cell.completedCount} fullf. | {cell.overdueCount} forfalt</div>
                            <div>~{cell.estimatedHours}t estimert</div>
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
