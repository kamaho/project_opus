"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percent: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}

function getBarColor(percent: number): string {
  if (percent > 100) return "bg-red-500 dark:bg-red-400";
  if (percent > 85) return "bg-amber-500 dark:bg-amber-400";
  if (percent > 60) return "bg-blue-500 dark:bg-blue-400";
  return "bg-violet-500 dark:bg-violet-400";
}

function getTextColor(percent: number): string {
  if (percent > 100) return "text-red-600 dark:text-red-400";
  if (percent > 85) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function ProgressBar({ percent, className, showLabel = true, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(percent, 150);
  const width = Math.min(clamped, 100);
  const overflow = clamped > 100;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 rounded-full bg-muted overflow-hidden",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(percent))}
          style={{ width: `${width}%` }}
        />
        {overflow && (
          <div
            className="absolute inset-0 h-full rounded-full bg-red-500/20 dark:bg-red-400/20"
          />
        )}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium tabular-nums min-w-[3ch] text-right", getTextColor(percent))}>
          {percent}%
        </span>
      )}
    </div>
  );
}
