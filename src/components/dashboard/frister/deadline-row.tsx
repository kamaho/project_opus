"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import StatusBadge from "./status-badge";
import DaysRemaining from "./days-remaining";
import type { DeadlineWithSummary } from "@/lib/deadlines/types";

interface Props {
  deadline: DeadlineWithSummary;
}

export default function DeadlineRow({ deadline: dl }: Props) {
  const { total, completed } = dl.taskSummary;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Link
      href={`/dashboard/frister/${dl.id}`}
      prefetch={false}
      className="group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <StatusBadge status={dl.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{dl.template.name}</span>
          <span className="text-xs text-muted-foreground truncate">{dl.periodLabel}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">{dl.company.name}</span>
          {total > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    dl.status === "done" ? "bg-emerald-500" :
                    dl.status === "overdue" ? "bg-red-500" :
                    dl.status === "at_risk" ? "bg-amber-500" : "bg-blue-500"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {completed}/{total}
              </span>
            </div>
          )}
        </div>
      </div>

      <DaysRemaining dueDate={dl.dueDate} status={dl.status} />

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
