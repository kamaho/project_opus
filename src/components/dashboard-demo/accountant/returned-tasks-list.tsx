"use client";

import { cn } from "@/lib/utils";
import { MOCK_RETURNED_TASKS } from "../mock-data";
import { DeadlineCountdown } from "../shared/deadline-countdown";
import { CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReturnedTasksList() {
  if (MOCK_RETURNED_TASKS.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <CornerDownLeft className="size-4 text-amber-500" />
        <h3 className="text-sm font-medium">Sendt tilbake fra kontroll</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
          {MOCK_RETURNED_TASKS.length}
        </span>
      </div>
      <div className="space-y-3">
        {MOCK_RETURNED_TASKS.map((task) => (
          <div
            key={task.id}
            className={cn(
              "rounded-md border p-3 space-y-2",
              task.isUrgent
                ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20"
                : "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {task.isUrgent && (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400">Haster</span>
                  )}
                  <span className="text-sm font-medium truncate">{task.title}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {task.clientName} &middot; <DeadlineCountdown dueDate={task.dueDate} />
                </div>
              </div>
            </div>

            <div className="rounded bg-muted/50 dark:bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {task.returnedBy}
                </span>
                <span className="text-[10px] text-muted-foreground/60">&middot;</span>
                <span className={cn(
                  "text-[10px] font-medium",
                  task.isUrgent ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                )}>
                  {task.categoryLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{task.comment}</p>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="xs">
                Korriger
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
