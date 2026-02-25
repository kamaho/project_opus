"use client";

import { forwardRef } from "react";
import { CalendarClock, CalendarDays, Unlink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartMatchButton } from "@/components/matching/smart-match-button";

export type ViewMode = "open" | "closed";

interface MatchingToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  closedBtnPulse?: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSmartMatch?: () => void;
  smartMatchLoading?: boolean;
  onUnmatchAll?: () => void;
  unmatchAllLoading?: boolean;
  hasMatches?: boolean;
  onAgentSettings?: () => void;
}

export const MatchingToolbar = forwardRef<HTMLButtonElement, MatchingToolbarProps>(function MatchingToolbar({
  viewMode,
  onViewModeChange,
  closedBtnPulse,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onSmartMatch,
  smartMatchLoading,
  onUnmatchAll,
  unmatchAllLoading,
  hasMatches,
  onAgentSettings,
}, closedBtnRef) {
  const hasDateFilter = dateFrom || dateTo;
  return (
    <div className="relative flex items-center border-b bg-muted/30 px-2 py-1.5 min-w-0 overflow-hidden" data-smart-info="Verktøylinjen for matching. Inneholder handlinger for å matche, søke og administrere poster.">
      {/* Venstre: Åpne / Lukkede */}
      <div className="flex items-center gap-2" data-smart-info="Veksle mellom å vise åpne (umatchede) poster eller lukkede (matchede) poster.">
        <span className="text-muted-foreground text-sm whitespace-nowrap">Vis poster:</span>
        <div className="flex rounded-md border bg-background p-0.5 text-sm">
          <button
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              viewMode === "open"
                ? "bg-muted text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
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
                ? "bg-muted text-foreground"
                : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50",
              closedBtnPulse && "closed-btn-pulse"
            )}
            onClick={() => onViewModeChange("closed")}
            data-smart-info="Vis lukkede poster — transaksjoner som allerede er matchet og avstemt."
          >
            Lukkede
          </button>
        </div>
      </div>

      {/* Midt: Absolutt posisjonert på 50% — sentrert over skillelinjen mellom M1/M2 */}
      <div className="absolute left-1/2 -translate-x-1/2 z-10">
        {onSmartMatch && viewMode === "open" && (
          <SmartMatchButton onClick={onSmartMatch} loading={smartMatchLoading} />
        )}
        {onUnmatchAll && viewMode === "closed" && hasMatches && (
          <button
            type="button"
            disabled={unmatchAllLoading}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
              "text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50"
            )}
            onClick={onUnmatchAll}
          >
            <Unlink className="h-3.5 w-3.5" />
            {unmatchAllLoading ? "Opphever\u2026" : "Opphev alle"}
          </button>
        )}
      </div>

      {/* Høyre: Agent + Datovelger */}
      <div className="flex items-center gap-1 ml-auto">
        {onAgentSettings && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mr-1"
            onClick={onAgentSettings}
            data-smart-info="Åpne innstillinger for Reviz — automatisk Smart Match og rapportering på e-post."
          >
            <CalendarClock className="h-3.5 w-3.5" />
            Agent
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-7 w-[118px] rounded-md border bg-transparent px-1.5 text-xs tabular-nums"
        />
        <span className="text-xs text-muted-foreground">{"\u2013"}</span>
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
    </div>
  );
});
