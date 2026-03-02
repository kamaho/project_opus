"use client";

import { cn } from "@/lib/utils";
import { reportTypes } from "@/lib/reports/report-registry";
import type { ReportType } from "@/lib/reports/types";
import {
  FileInput,
  FileOutput,
  Receipt,
  Users,
  Palmtree,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  FileInput,
  FileOutput,
  Receipt,
  Users,
  Palmtree,
};

interface ReportTypePickerProps {
  value: ReportType | null;
  onChange: (value: ReportType) => void;
}

export function ReportTypePicker({ value, onChange }: ReportTypePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {reportTypes.map((rt) => {
        const Icon = ICON_MAP[rt.icon] ?? FileInput;
        const selected = value === rt.id;
        return (
          <button
            key={rt.id}
            type="button"
            onClick={() => onChange(rt.id)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/30 hover:bg-muted/40"
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{rt.title}</p>
              <p className="text-xs text-muted-foreground leading-snug">
                {rt.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
