import type { DeadlineComputedStatus, TaskSummary } from "./types";

interface TaskForStatus {
  status: string; // "open" | "in_progress" | "waiting" | "completed" | "cancelled"
}

/**
 * Computes the aggregated status of a deadline based on its tasks.
 * Uses existing task status enum values (open, in_progress, waiting, completed, cancelled).
 * "cancelled" tasks are excluded from the calculation.
 */
export function computeDeadlineStatus(
  dueDate: Date | string,
  tasks: TaskForStatus[]
): DeadlineComputedStatus {
  const activeTasks = tasks.filter(t => t.status !== "cancelled");
  if (activeTasks.length === 0) return "not_started";
  
  const completed = activeTasks.filter(t => t.status === "completed").length;
  const open = activeTasks.filter(t => t.status === "open").length;
  const active = activeTasks.filter(t => t.status === "in_progress" || t.status === "waiting").length;
  const total = activeTasks.length;

  if (completed === total) return "done";

  const due = typeof dueDate === "string" ? new Date(dueDate + "T00:00:00") : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (due < today) return "overdue";
  
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  
  if (due <= threeDaysFromNow && open > 0) return "at_risk";
  if (active > 0 || completed > 0) return "on_track";
  
  return "not_started";
}

/**
 * Computes task summary counts for a set of tasks.
 */
export function computeTaskSummary(tasks: TaskForStatus[]): TaskSummary {
  const activeTasks = tasks.filter(t => t.status !== "cancelled");
  return {
    total: activeTasks.length,
    completed: activeTasks.filter(t => t.status === "completed").length,
    inProgress: activeTasks.filter(t => t.status === "in_progress").length,
    notStarted: activeTasks.filter(t => t.status === "open").length,
    blocked: activeTasks.filter(t => t.status === "waiting").length,
  };
}
