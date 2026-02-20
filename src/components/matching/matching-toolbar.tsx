"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Link2, ChevronDown, Upload, FolderOpen, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "open" | "closed";

interface MatchingToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onMatch?: () => void;
  matchDisabled?: boolean;
  onFileManager?: () => void;
}

export function MatchingToolbar({
  viewMode,
  onViewModeChange,
  onMatch,
  matchDisabled = true,
  onFileManager,
}: MatchingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2" data-smart-info="Verktøylinjen for matching. Inneholder handlinger for å matche, søke og administrere poster.">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1" disabled data-smart-info="Smart match analyserer automatisk transaksjonene og foreslår matchinger basert på beløp, dato og tekst.">
          <Sparkles className="h-3.5 w-3.5" />
          Smart match <span className="text-muted-foreground text-xs">A</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={matchDisabled}
          onClick={onMatch}
          data-smart-info="Match kobler markerte poster fra begge mengder. Summen må være 0 for å matche. Hurtigtast: M"
        >
          <Link2 className="h-3.5 w-3.5" />
          Match <span className="text-muted-foreground text-xs">M</span>
        </Button>
        <Button size="sm" variant="outline" disabled data-smart-info="Transaksjonshandlinger lar deg utføre masseoperasjoner på markerte transaksjoner.">
          Transaksjonshandlinger
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto" data-smart-info="Veksle mellom å vise åpne (umatchede) poster eller lukkede (matchede) poster.">
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
            type="button"
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              viewMode === "closed"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
            onClick={() => onViewModeChange("closed")}
            data-smart-info="Vis lukkede poster — transaksjoner som allerede er matchet og avstemt."
          >
            Lukkede
          </button>
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onFileManager}
          data-smart-info="Filbehandler — administrer importerte filer, se importhistorikk og slett filer."
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled data-smart-info="Last opp fil — importer ny fil til en av mengdene.">
          <Upload className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled data-smart-info="Fullskjerm — utvid matchingvisningen til hele skjermen.">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
