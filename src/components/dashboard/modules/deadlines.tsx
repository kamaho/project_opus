"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  Loader2,
  FileQuestion,
  ChevronDown,
} from "lucide-react";
import { NavArrowButton } from "@/components/ui/nav-arrow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

interface DeadlineTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

interface DeadlineStatus {
  deadlineId: string;
  title: string;
  date: string;
  daysLeft: number;
  source: "regulatory" | "custom_deadline";
  status: "completed" | "in_progress" | "overdue" | "not_started" | "no_tasks";
  taskSummary: TaskSummary;
  tasks: DeadlineTask[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  completed: {
    label: "Ferdig",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-950",
  },
  in_progress: {
    label: "Pågår",
    icon: Loader2,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950",
  },
  overdue: {
    label: "Forfalt",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-950",
  },
  not_started: {
    label: "Ikke påbegynt",
    icon: Circle,
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-100 dark:bg-yellow-950",
  },
  no_tasks: {
    label: "Ingen oppgaver",
    icon: Circle,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

export default function Deadlines() {
  const [data, setData] = useState<DeadlineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassed, setShowPassed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/deadline-status")
      .then((r) => (r.ok ? r.json() : []))
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      setData((prev) =>
        prev.map((d) => {
          const taskIdx = d.tasks.findIndex((t) => t.id === taskId);
          if (taskIdx === -1) return d;
          const updatedTasks = [...d.tasks];
          updatedTasks[taskIdx] = { ...updatedTasks[taskIdx], status: "completed", completedAt: new Date().toISOString() };
          const completed = updatedTasks.filter((t) => t.status === "completed").length;
          const inProgress = updatedTasks.filter((t) => t.status === "in_progress").length;
          const total = updatedTasks.length;
          const allDone = completed === total;
          return {
            ...d,
            tasks: updatedTasks,
            taskSummary: { ...d.taskSummary, completed, inProgress, overdue: d.taskSummary.overdue > 0 && !allDone ? d.taskSummary.overdue : 0 },
            status: allDone ? "completed" : d.status,
          };
        })
      );
    }
  }, []);

  const filtered = showPassed ? data : data.filter((d) => d.daysLeft >= -7);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Frister</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Frister</CardTitle>
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowPassed(!showPassed)}
        >
          {showPassed ? "Skjul passerte" : "Vis passerte"}
        </button>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p className="text-sm">Ingen kommende frister</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filtered.map((d) => {
              const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.no_tasks;
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === `${d.deadlineId}-${d.date}`;
              const uniqueKey = `${d.deadlineId}-${d.date}`;

              return (
                <li key={uniqueKey}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : uniqueKey)}
                    className="w-full flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Calendar
                      className={cn(
                        "h-4 w-4 shrink-0",
                        d.daysLeft < 0
                          ? "text-muted-foreground"
                          : d.daysLeft < 7
                            ? "text-red-600"
                            : d.daysLeft < 30
                              ? "text-yellow-600"
                              : "text-muted-foreground"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">{d.title}</span>
                      {d.taskSummary.total > 0 && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[100px]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                d.status === "completed"
                                  ? "bg-green-500"
                                  : d.status === "overdue"
                                    ? "bg-red-500"
                                    : "bg-blue-500"
                              )}
                              style={{
                                width: `${(d.taskSummary.completed / d.taskSummary.total) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {d.taskSummary.completed}/{d.taskSummary.total}
                          </span>
                        </div>
                      )}
                    </div>

                    <span
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                        cfg.bg,
                        cfg.color
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </span>

                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                      {dateFmt.format(new Date(d.date + "T00:00:00"))}
                    </span>

                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap shrink-0",
                        d.daysLeft < 0
                          ? "bg-muted text-muted-foreground"
                          : d.daysLeft <= 3
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                            : d.daysLeft <= 7
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      {d.daysLeft < 0 ? (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {Math.abs(d.daysLeft)}d siden
                        </span>
                      ) : d.daysLeft === 0 ? (
                        "I dag"
                      ) : (
                        `${d.daysLeft}d`
                      )}
                    </span>

                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="ml-6 mb-2 mt-1 space-y-1">
                      {d.tasks.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground py-1 px-2">
                          Ingen oppgaver koblet til denne fristen.
                        </p>
                      ) : (
                        d.tasks.map((t) => {
                          const isDone = t.status === "completed";
                          return (
                            <div
                              key={t.id}
                              className={cn(
                                "flex items-center gap-2 rounded px-2 py-1.5 text-[11px]",
                                isDone ? "bg-green-500/5" : "bg-muted/30"
                              )}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isDone) handleCompleteTask(t.id);
                                }}
                                disabled={isDone}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  isDone
                                    ? "text-green-500"
                                    : "text-muted-foreground hover:text-green-500"
                                )}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <Circle className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <span
                                className={cn(
                                  "flex-1 truncate",
                                  isDone && "line-through text-muted-foreground"
                                )}
                              >
                                {t.title}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 size-1.5 rounded-full",
                                  t.priority === "critical"
                                    ? "bg-red-500"
                                    : t.priority === "high"
                                      ? "bg-orange-500"
                                      : t.priority === "medium"
                                        ? "bg-blue-500"
                                        : "bg-muted-foreground/40"
                                )}
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 flex items-center justify-center">
          <Link
            href="/dashboard/kalender"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Vis kalender
            <NavArrowButton className="scale-75" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
