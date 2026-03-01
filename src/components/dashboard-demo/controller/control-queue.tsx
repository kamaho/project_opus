"use client";

import { cn } from "@/lib/utils";
import { MOCK_CONTROL_QUEUE, type MockControlQueueItem } from "../mock-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, CornerDownLeft, Eye, RotateCcw, Clock } from "lucide-react";

const urgencyStyles: Record<MockControlQueueItem["urgencyLevel"], { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: "bg-red-100 dark:bg-red-900/40",    text: "text-red-700 dark:text-red-300",    label: "Kritisk" },
  HIGH:     { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "Haster" },
  NORMAL:   { bg: "bg-muted",                         text: "text-muted-foreground",              label: "Normal" },
};

function formatQueueTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)}t`;
  return `${Math.round(hours / 24)}d`;
}

function QueueItem({ item }: { item: MockControlQueueItem }) {
  const urgency = urgencyStyles[item.urgencyLevel];
  const checklistOk = item.checklist.completed === item.checklist.total;

  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-2",
        item.isRecheck && "border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/10",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Urgency badge */}
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", urgency.bg, urgency.text)}>
          {urgency.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{item.title}</span>
            {item.isRecheck && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">
                <RotateCcw className="size-2.5" />
                Re-kontroll
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{item.clientName}</p>
        </div>

        {/* Queue time */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Clock className="size-3" />
          {formatQueueTime(item.timeInQueueHours)}
        </div>
      </div>

      {/* Executor info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Utført av:</span>
        <Avatar size="sm">
          <AvatarFallback className="text-[9px]">{item.executedByInitials}</AvatarFallback>
        </Avatar>
        <span>{item.executedBy}</span>
        <span className="text-border">|</span>
        <span className={cn("tabular-nums", checklistOk ? "text-violet-600 dark:text-violet-400" : "text-amber-600 dark:text-amber-400")}>
          {item.checklist.completed}/{item.checklist.total} sjekkliste
        </span>
        {item.estimatedControlTimeMinutes && (
          <>
            <span className="text-border">|</span>
            <span>~{item.estimatedControlTimeMinutes} min</span>
          </>
        )}
      </div>

      {/* Executor note */}
      {item.executorNote && (
        <div className="rounded bg-muted/50 dark:bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium">Merknad: </span>{item.executorNote}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="xs">
          <Eye className="size-3" />
          Detaljer
        </Button>
        <Button variant="outline" size="xs" className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          <CornerDownLeft className="size-3" />
          Send tilbake
        </Button>
        <Button variant="default" size="xs">
          <Check className="size-3" />
          Godkjenn
        </Button>
      </div>
    </div>
  );
}

export function ControlQueue() {
  const sorted = [...MOCK_CONTROL_QUEUE].sort((a, b) => {
    if (a.isRecheck && !b.isRecheck) return -1;
    if (!a.isRecheck && b.isRecheck) return 1;
    const urgencyOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
    const diff = urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    if (diff !== 0) return diff;
    return b.timeInQueueHours - a.timeInQueueHours;
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Kontrollkø</h3>
        <span className="text-xs text-muted-foreground">{sorted.length} venter</span>
      </div>
      <div className="space-y-3">
        {sorted.map((item) => (
          <QueueItem key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
