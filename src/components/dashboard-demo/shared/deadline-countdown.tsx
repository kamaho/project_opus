"use client";

import { cn } from "@/lib/utils";

interface DeadlineCountdownProps {
  dueDate: string;
  className?: string;
}

export function DeadlineCountdown({ dueDate, className }: DeadlineCountdownProps) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  let colorClass: string;

  if (diffDays < 0) {
    label = `Forfalt ${Math.abs(diffDays)}d`;
    colorClass = "text-red-600 dark:text-red-400";
  } else if (diffDays === 0) {
    label = "I dag";
    colorClass = "text-red-600 dark:text-red-400";
  } else if (diffDays === 1) {
    label = "I morgen";
    colorClass = "text-orange-600 dark:text-orange-400";
  } else if (diffDays <= 3) {
    label = `${diffDays}d igjen`;
    colorClass = "text-orange-600 dark:text-orange-400";
  } else if (diffDays <= 7) {
    label = `${diffDays}d igjen`;
    colorClass = "text-amber-600 dark:text-amber-400";
  } else {
    label = `${diffDays}d igjen`;
    colorClass = "text-muted-foreground";
  }

  return (
    <span className={cn("text-xs font-medium tabular-nums", colorClass, className)}>
      {label}
    </span>
  );
}
