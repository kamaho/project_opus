"use client";

import { Button } from "@/components/ui/button";
import { BarChart3, FolderPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionActionBarProps {
  count: number;
  onCompare: () => void;
  onCreateGroup: () => void;
  onCancel: () => void;
}

export function SelectionActionBar({
  count,
  onCompare,
  onCreateGroup,
  onCancel,
}: SelectionActionBarProps) {
  const canCompare = count >= 2;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      <span className="text-sm font-medium tabular-nums">
        {count} valgt
      </span>

      <div className="h-4 w-px bg-border" />

      <Button
        size="sm"
        onClick={onCompare}
        disabled={!canCompare}
        className="gap-1.5"
      >
        <BarChart3 className="h-3.5 w-3.5" />
        Sammenlign saldoer
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onCreateGroup}
        disabled={!canCompare}
        className="gap-1.5"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Opprett gruppe
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        className="gap-1.5 text-muted-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Avbryt
      </Button>
    </div>
  );
}
