"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: string; color: string; bg: string; borderColor: string }
> = {
  completed: {
    label: "Ferdig",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/50",
    borderColor: "border-green-200 dark:border-green-900",
  },
  in_progress: {
    label: "Pågår",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    borderColor: "border-blue-200 dark:border-blue-900",
  },
  overdue: {
    label: "Forfalt",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    borderColor: "border-red-200 dark:border-red-900",
  },
  not_started: {
    label: "Ikke påbegynt",
    color: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/50",
    borderColor: "border-yellow-200 dark:border-yellow-900",
  },
  no_tasks: {
    label: "Ingen oppgaver",
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    borderColor: "border-muted",
  },
};

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

export function MobileDeadlineStatus() {
  const [data, setData] = useState<DeadlineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/deadline-status");
      if (res.ok) {
        const rows = await res.json();
        setData(rows);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const upcoming = data.filter((d) => d.daysLeft >= 0);
  const passed = data.filter((d) => d.daysLeft < 0 && d.daysLeft >= -30);

  const totalOverdue = data.filter((d) => d.status === "overdue").length;
  const totalCompleted = data.filter((d) => d.status === "completed").length;
  const totalInProgress = data.filter((d) => d.status === "in_progress" || d.status === "not_started").length;

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      setData((prev) =>
        prev.map((d) => {
          const idx = d.tasks.findIndex((t) => t.id === taskId);
          if (idx === -1) return d;
          const updated = [...d.tasks];
          updated[idx] = { ...updated[idx], status: "completed", completedAt: new Date().toISOString() };
          const comp = updated.filter((t) => t.status === "completed").length;
          const total = updated.length;
          return {
            ...d,
            tasks: updated,
            taskSummary: { ...d.taskSummary, completed: comp, inProgress: updated.filter((t) => t.status === "in_progress").length },
            status: comp === total ? "completed" : d.status,
          };
        })
      );
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Friststatus</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Oversikt over frister og oppgaver
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 px-4 pt-4 pb-2">
        <div className="rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400">
            {totalOverdue}
          </p>
          <p className="text-[10px] text-red-600/80 dark:text-red-400/80 font-medium mt-0.5">
            Forfalt
          </p>
        </div>
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {totalInProgress}
          </p>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium mt-0.5">
            Aktive
          </p>
        </div>
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-green-700 dark:text-green-400">
            {totalCompleted}
          </p>
          <p className="text-[10px] text-green-600/80 dark:text-green-400/80 font-medium mt-0.5">
            Fullført
          </p>
        </div>
      </div>

      {/* Deadline list */}
      <div className="flex-1 px-4 pb-4 space-y-4">
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Kommende frister
            </h3>
            <div className="space-y-2">
              {upcoming.map((d) => (
                <DeadlineCard
                  key={`${d.deadlineId}-${d.date}`}
                  deadline={d}
                  expanded={expandedId === `${d.deadlineId}-${d.date}`}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === `${d.deadlineId}-${d.date}`
                        ? null
                        : `${d.deadlineId}-${d.date}`
                    )
                  }
                  onCompleteTask={handleCompleteTask}
                />
              ))}
            </div>
          </section>
        )}

        {/* Passed */}
        {passed.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Nylig passerte
            </h3>
            <div className="space-y-2">
              {passed.map((d) => (
                <DeadlineCard
                  key={`${d.deadlineId}-${d.date}`}
                  deadline={d}
                  expanded={expandedId === `${d.deadlineId}-${d.date}`}
                  onToggle={() =>
                    setExpandedId(
                      expandedId === `${d.deadlineId}-${d.date}`
                        ? null
                        : `${d.deadlineId}-${d.date}`
                    )
                  }
                  onCompleteTask={handleCompleteTask}
                />
              ))}
            </div>
          </section>
        )}

        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-3" />
            <p className="text-sm">Ingen frister funnet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DeadlineCard({
  deadline: d,
  expanded,
  onToggle,
  onCompleteTask,
}: {
  deadline: DeadlineStatus;
  expanded: boolean;
  onToggle: () => void;
  onCompleteTask: (taskId: string) => void;
}) {
  const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.no_tasks;
  const progressPct =
    d.taskSummary.total > 0
      ? Math.round((d.taskSummary.completed / d.taskSummary.total) * 100)
      : 0;

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        cfg.borderColor,
        cfg.bg
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{d.title}</span>
            <span
              className={cn(
                "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                cfg.color,
                d.status === "completed"
                  ? "bg-green-100 dark:bg-green-900/50"
                  : d.status === "overdue"
                    ? "bg-red-100 dark:bg-red-900/50"
                    : d.status === "in_progress"
                      ? "bg-blue-100 dark:bg-blue-900/50"
                      : "bg-muted"
              )}
            >
              {cfg.label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-muted-foreground">
              {dateFmt.format(new Date(d.date + "T00:00:00"))}
            </span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                d.daysLeft < 0
                  ? "text-muted-foreground"
                  : d.daysLeft <= 3
                    ? "text-red-600 dark:text-red-400"
                    : d.daysLeft <= 7
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-muted-foreground"
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
                `${d.daysLeft} dager`
              )}
            </span>
          </div>

          {d.taskSummary.total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-background/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    d.status === "completed"
                      ? "bg-green-500"
                      : d.status === "overdue"
                        ? "bg-red-500"
                        : "bg-blue-500"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {d.taskSummary.completed}/{d.taskSummary.total} oppgaver
              </span>
            </div>
          )}
        </div>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground mt-1 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-1.5">
          {d.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              Ingen oppgaver koblet til denne fristen ennå.
            </p>
          ) : (
            d.tasks.map((t) => {
              const isDone = t.status === "completed";
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs",
                    isDone ? "bg-green-500/5" : "bg-background/50"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isDone) onCompleteTask(t.id);
                    }}
                    disabled={isDone}
                    className={cn(
                      "shrink-0 transition-colors",
                      isDone
                        ? "text-green-500"
                        : "text-muted-foreground active:text-green-500"
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
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
                      "shrink-0 size-2 rounded-full",
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
    </div>
  );
}
