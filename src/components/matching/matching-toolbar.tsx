"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Link2, ChevronDown, Upload, FolderOpen, Maximize2 } from "lucide-react";

interface MatchingToolbarProps {
  onFileManager?: () => void;
}

export function MatchingToolbar({
  onFileManager,
}: MatchingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="gap-1">
          <Sparkles className="h-3.5 w-3.5" />
          Smart match <span className="text-muted-foreground text-xs">A</span>
        </Button>
        <Button size="sm" variant="outline" className="gap-1">
          <Link2 className="h-3.5 w-3.5" />
          Match <span className="text-muted-foreground text-xs">M</span>
        </Button>
        <Button size="sm" variant="outline">
          Transaksjonshandlinger
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto ml-auto sm:ml-0">
        <span className="text-muted-foreground text-sm whitespace-nowrap">Vis poster:</span>
        <div className="flex rounded-md border bg-background p-0.5 text-sm">
          <button
            type="button"
            className="rounded px-2 py-1 font-medium bg-primary text-primary-foreground"
          >
            Åpne
          </button>
          <button type="button" className="rounded px-2 py-1 text-muted-foreground hover:bg-muted">
            Lukkede
          </button>
          <button type="button" className="rounded px-2 py-1 text-muted-foreground hover:bg-muted">
            Åpne per dato
          </button>
        </div>
      </div>
      <div className="flex gap-1 ml-auto sm:ml-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onFileManager}
          title="Filbehandler"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Upload className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
