"use client";

import { cn } from "@/lib/utils";
import { MOCK_FOCUS_TASKS, DEADLINE_TYPE_LABELS, type MockTask } from "../mock-data";
import { RiskBadge } from "../shared/risk-badge";
import { DeadlineCountdown } from "../shared/deadline-countdown";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

function ChecklistProgress({ total, completed }: { total: number; completed: number }) {
  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", pct === 100 ? "bg-violet-500" : pct > 50 ? "bg-blue-500" : "bg-muted-foreground/40")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{completed}/{total}</span>
    </div>
  );
}

function TaskRow({ task }: { task: MockTask }) {
  const isStarted = task.status === "IN_PROGRESS";
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/50 transition-colors group">
      <RiskBadge level={task.riskLevel} showLabel={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{task.title}</span>
          {task.deadlineType && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {DEADLINE_TYPE_LABELS[task.deadlineType]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span>{task.clientName}</span>
          <span className="text-border">|</span>
          <DeadlineCountdown dueDate={task.dueDate} />
          <span className="text-border">|</span>
          <ChecklistProgress total={task.checklist.total} completed={task.checklist.completed} />
        </div>
      </div>
      <Button variant="ghost" size="xs" className="opacity-0 group-hover:opacity-100 transition-opacity">
        {isStarted ? "Fortsett" : "Start"}
        <ChevronRight className="size-3" />
      </Button>
    </div>
  );
}

export function FocusTodayList() {
  const tasks = [...MOCK_FOCUS_TASKS].sort((a, b) => b.riskScore - a.riskScore);

  const critical = tasks.filter((t) => t.riskLevel === "CRITICAL" || t.riskLevel === "HIGH");
  const medium = tasks.filter((t) => t.riskLevel === "MEDIUM");
  const low = tasks.filter((t) => t.riskLevel === "LOW");

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Fokus i dag</h3>
      <div className="space-y-4">
        {critical.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400 mb-1 px-3">
              Trenger umiddelbar handling
            </p>
            <div className="space-y-0.5">
              {critical.map((t) => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        )}
        {medium.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1 px-3">
              Denne uken
            </p>
            <div className="space-y-0.5">
              {medium.map((t) => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        )}
        {low.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1 px-3">
              Planlagt
            </p>
            <div className="space-y-0.5">
              {low.map((t) => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
