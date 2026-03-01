"use client";

import { cn } from "@/lib/utils";
import type { RiskLevel } from "../mock-data";

const riskStyles: Record<RiskLevel, { bg: string; text: string; dot: string }> = {
  LOW:      { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500" },
  MEDIUM:   { bg: "bg-amber-50 dark:bg-amber-950/30",    text: "text-amber-700 dark:text-amber-400",     dot: "bg-amber-500" },
  HIGH:     { bg: "bg-orange-50 dark:bg-orange-950/30",   text: "text-orange-700 dark:text-orange-400",   dot: "bg-orange-500" },
  CRITICAL: { bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-700 dark:text-red-400",         dot: "bg-red-500" },
};

const riskLabels: Record<RiskLevel, string> = {
  LOW: "Lav",
  MEDIUM: "Middels",
  HIGH: "Høy",
  CRITICAL: "Kritisk",
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showLabel?: boolean;
}

export function RiskBadge({ level, className, showLabel = true }: RiskBadgeProps) {
  const styles = riskStyles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        styles.bg, styles.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", styles.dot, level === "CRITICAL" && "animate-pulse")} />
      {showLabel && riskLabels[level]}
    </span>
  );
}
