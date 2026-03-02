"use client";

import { ListTodo, Mail, FileText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { CustomerGroup } from "@/lib/reports/view-types";

interface CustomerActionBarProps {
  kunde: CustomerGroup;
  onCreateTask: (kunde: CustomerGroup) => void;
  onSendPurring: (kunde: CustomerGroup) => void;
  onSendStatement: (kunde: CustomerGroup) => void;
}

const actions = [
  { key: "task" as const, icon: ListTodo, label: "Opprett oppgave" },
  { key: "purring" as const, icon: Mail, label: "Send purring" },
  { key: "statement" as const, icon: FileText, label: "Kontoutskrift" },
];

export function CustomerActionBar({
  kunde,
  onCreateTask,
  onSendPurring,
  onSendStatement,
}: CustomerActionBarProps) {
  const handlers: Record<string, () => void> = {
    task: () => onCreateTask(kunde),
    purring: () => onSendPurring(kunde),
    statement: () => onSendStatement(kunde),
  };

  return (
    <TooltipProvider>
      <div
        className="row-action-bar absolute right-2 -top-5 overflow-hidden rounded-md border bg-background shadow-sm z-20"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-px">
          {actions.map((a) => (
            <Tooltip key={a.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlers[a.key]();
                  }}
                >
                  <a.icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {a.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
