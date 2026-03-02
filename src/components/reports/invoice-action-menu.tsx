"use client";

import { ListTodo, FileUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { AgingRow } from "@/lib/reports/view-types";

interface InvoiceActionMenuProps {
  row: AgingRow;
  kundeNavn: string;
  onCreateTask: (row: AgingRow, kundeNavn: string) => void;
  onSendDocRequest: (row: AgingRow, kundeNavn: string) => void;
}

export function InvoiceActionMenu({
  row,
  kundeNavn,
  onCreateTask,
  onSendDocRequest,
}: InvoiceActionMenuProps) {
  return (
    <TooltipProvider>
      <div
        className="row-action-bar absolute right-2 -top-5 overflow-hidden rounded-md border bg-background shadow-sm z-20"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-px">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateTask(row, kundeNavn);
                }}
              >
                <ListTodo className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Opprett oppgave
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendDocRequest(row, kundeNavn);
                }}
              >
                <FileUp className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Dokumentforespørsel
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
