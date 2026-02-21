"use client";

import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays, FolderOpen, PenLine, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ViewMode = "open" | "closed";

interface MatchingToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onFileManager?: () => void;
  onCreateTransaction?: () => void;
  closedBtnPulse?: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

export const MatchingToolbar = forwardRef<HTMLButtonElement, MatchingToolbarProps>(function MatchingToolbar({
  viewMode,
  onViewModeChange,
  onFileManager,
  onCreateTransaction,
  closedBtnPulse,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}, closedBtnRef) {
  const hasDateFilter = dateFrom || dateTo;
  return (
    <div className="flex items-center gap-2 border-b bg-muted/30 px-2 py-1.5" data-smart-info="Verktøylinjen for matching. Inneholder handlinger for å matche, søke og administrere poster.">
      <div className="flex items-center gap-2" data-smart-info="Veksle mellom å vise åpne (umatchede) poster eller lukkede (matchede) poster.">
        <span className="text-muted-foreground text-sm whitespace-nowrap">Vis poster:</span>
        <div className="flex rounded-md border bg-background p-0.5 text-sm">
          <button
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              viewMode === "open"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onViewModeChange("open")}
            data-smart-info="Vis åpne poster — transaksjoner som ennå ikke er matchet."
          >
            Åpne
          </button>
          <button
            ref={closedBtnRef}
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              viewMode === "closed"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
              closedBtnPulse && "closed-btn-pulse"
            )}
            onClick={() => onViewModeChange("closed")}
            data-smart-info="Vis lukkede poster — transaksjoner som allerede er matchet og avstemt."
          >
            Lukkede
          </button>
        </div>
      </div>
      <TooltipProvider>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="h-7 w-[118px] rounded-md border bg-transparent px-1.5 text-xs tabular-nums"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="h-7 w-[118px] rounded-md border bg-transparent px-1.5 text-xs tabular-nums"
            />
            {hasDateFilter && (
              <button
                type="button"
                className="p-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => { onDateFromChange(""); onDateToChange(""); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="w-px h-5 bg-border mx-0.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onCreateTransaction}
              >
                <PenLine className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Opprett korreksjonspost</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onFileManager}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Filbehandler</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
});
