"use client";

import { MOCK_CONTROLLER_THROUGHPUT } from "../mock-data";
import { ProgressBar } from "../shared/progress-bar";

export function ThroughputWidget() {
  const t = MOCK_CONTROLLER_THROUGHPUT;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Gjennomstrømning</h3>
      <div className="space-y-4">
        {/* This week */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Denne uken</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <span className="text-lg font-semibold tabular-nums text-violet-600 dark:text-violet-400">{t.thisWeek.approved}</span>
              <p className="text-[10px] text-muted-foreground">Godkjent</p>
            </div>
            <div className="text-center">
              <span className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">{t.thisWeek.returned}</span>
              <p className="text-[10px] text-muted-foreground">Sendt tilbake</p>
            </div>
          </div>
        </div>

        {/* This month */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Denne måneden</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Godkjent ved 1. kontroll</span>
              <span className="font-medium tabular-nums">{t.thisMonth.firstPassRate}%</span>
            </div>
            <ProgressBar percent={t.thisMonth.firstPassRate} showLabel={false} size="sm" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Totalt behandlet</span>
              <span className="font-medium tabular-nums">{t.thisMonth.approved + t.thisMonth.returned}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Snitt kontrolltid</span>
              <span className="font-medium tabular-nums">{t.avgControlTimeMinutes} min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
