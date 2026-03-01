"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

type Variant = "danger" | "warning" | "info" | "success" | "neutral";

const variantStyles: Record<Variant, { bg: string; text: string; icon: string }> = {
  danger:  { bg: "bg-red-50 dark:bg-red-950/30",     text: "text-red-700 dark:text-red-400",     icon: "text-red-500 dark:text-red-400" },
  warning: { bg: "bg-amber-50 dark:bg-amber-950/30",  text: "text-amber-700 dark:text-amber-400", icon: "text-amber-500 dark:text-amber-400" },
  info:    { bg: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-700 dark:text-blue-400",   icon: "text-blue-500 dark:text-blue-400" },
  success: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", icon: "text-violet-500 dark:text-violet-400" },
  neutral: { bg: "bg-muted",                          text: "text-foreground",                   icon: "text-muted-foreground" },
};

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  variant?: Variant;
  trend?: { direction: "up" | "down"; label: string };
  className?: string;
}

export function StatCard({ label, value, icon: Icon, variant = "neutral", trend, className }: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("rounded-lg border p-4 flex flex-col gap-2", styles.bg, className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn("size-4", styles.icon)} />
      </div>
      <div className={cn("text-2xl font-semibold tabular-nums", styles.text)}>
        {value}
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend.direction === "up" ? (
            <TrendingUp className="size-3 text-violet-500" />
          ) : (
            <TrendingDown className="size-3 text-red-500" />
          )}
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  );
}
