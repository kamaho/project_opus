"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  GripHorizontal,
  X,
  GraduationCap,
  Search,
  Zap,
  CircleAlert,
  Upload,
  Columns3,
  FileDown,
  Plus,
  Calendar,
  Users,
  GitBranch,
  ArrowUpDown,
  Play,
  Palette,
  User,
  Building2,
  Scale,
  Download,
  Square,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { PanelSizeToggle } from "./panel-size-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RevizoIcon } from "@/components/ui/revizo-icon";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Dispatched by mini panel quick-action icons. Pages listen and act. */
export const SMART_PANEL_ACTION_EVENT = "smart-panel:action";

export function dispatchSmartPanelAction(actionId: string) {
  window.dispatchEvent(
    new CustomEvent(SMART_PANEL_ACTION_EVENT, { detail: { id: actionId } })
  );
}

export const MINI_WIDTH = 520;
export const MINI_HEIGHT = 44;

interface MiniQuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
}

function getMiniActionsForPath(pathname: string): MiniQuickAction[] {
  if (pathname.includes("/matching") && pathname.includes("/clients/")) {
    return [
      { id: "search", icon: Search, label: "Søk i poster" },
      { id: "smart-match", icon: Zap, label: "Smart Match" },
      { id: "unmatched", icon: CircleAlert, label: "Umatchede" },
    ];
  }
  if (pathname.includes("/import") && pathname.includes("/clients/")) {
    return [
      { id: "upload", icon: Upload, label: "Last opp" },
      { id: "columns", icon: Columns3, label: "Kolonner" },
      { id: "import", icon: FileDown, label: "Importer" },
    ];
  }
  if (pathname.includes("/matching-rules")) {
    return [
      { id: "new-rule", icon: Plus, label: "Ny regel" },
      { id: "test", icon: Play, label: "Test" },
      { id: "sort", icon: ArrowUpDown, label: "Prioriter" },
    ];
  }
  if (pathname.includes("/clients") && !pathname.includes("/matching") && !pathname.includes("/import")) {
    return [
      { id: "search", icon: Search, label: "Søk" },
      { id: "new-client", icon: Plus, label: "Ny klient" },
      { id: "deadlines", icon: Calendar, label: "Frister" },
    ];
  }
  if (pathname.includes("/mva-avstemming")) {
    return [
      { id: "period", icon: Calendar, label: "Periode" },
      { id: "compare", icon: Scale, label: "Sammenlign" },
      { id: "export", icon: Download, label: "Eksporter" },
    ];
  }
  if (pathname.includes("/settings")) {
    return [
      { id: "appearance", icon: Palette, label: "Utseende" },
      { id: "profile", icon: User, label: "Profil" },
      { id: "org", icon: Building2, label: "Organisasjon" },
    ];
  }
  return [
    { id: "clients", icon: Users, label: "Klienter" },
    { id: "rules", icon: GitBranch, label: "Regler" },
    { id: "deadlines", icon: Calendar, label: "Frister" },
  ];
}

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

interface SmartPanelMiniContentProps {
  onClose: () => void;
  onExpandToMedium: () => void;
  onExpandToTutorials?: () => void;
  onModeChange?: (mode: "mini" | "medium") => void;
  dragHandleProps: DragHandleProps;
  isAdmin?: boolean;
}

export function SmartPanelMiniContent({
  onClose,
  onExpandToMedium,
  onExpandToTutorials,
  onModeChange,
  dragHandleProps,
  isAdmin = false,
}: SmartPanelMiniContentProps) {
  const pathname = usePathname();
  const tutorial = useTutorialMode();
  const actions = getMiniActionsForPath(pathname ?? "");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // --- Recording toolbar ---
  if (tutorial.mode === "recording") {
    return (
      <div className="h-full w-full flex items-center gap-1.5 px-1.5">
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          {...dragHandleProps}
        >
          <GripHorizontal className="h-4 w-4" />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 px-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-medium text-red-500 shrink-0">Opptak</span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {tutorial.recordedSteps.length} steg
          </span>
          <span className="text-xs text-muted-foreground/50 truncate">
            Klikk på elementer for å legge til steg
          </span>
        </div>

        <Button
          size="sm"
          variant="destructive"
          className="h-7 gap-1.5 text-xs shrink-0"
          onClick={() => {
            if (tutorial.recordedSteps.length > 0) {
              setShowSaveDialog(true);
            } else {
              tutorial.stopRecording();
              tutorial.clearRecording();
            }
          }}
        >
          <Square className="h-3 w-3" />
          Stopp
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-foreground"
          onClick={() => {
            tutorial.stopRecording();
            tutorial.clearRecording();
          }}
          aria-label="Avbryt opptak"
        >
          <X className="h-3 w-3" />
        </Button>

        {showSaveDialog && (
          <TutorialSaveDialogLazy
            open={showSaveDialog}
            onOpenChange={setShowSaveDialog}
          />
        )}
      </div>
    );
  }

  // --- Playback toolbar ---
  if (tutorial.mode === "playing") {
    const step = tutorial.playbackSteps[tutorial.currentStepIndex];
    const total = tutorial.playbackSteps.length;
    return (
      <div className="h-full w-full flex items-center gap-1.5 px-1.5">
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
          {...dragHandleProps}
        >
          <GripHorizontal className="h-4 w-4" />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 px-2">
          <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium truncate">
            {step?.title ?? tutorial.activeTutorialName}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {tutorial.currentStepIndex + 1}/{total}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={tutorial.prevStep}
            disabled={tutorial.currentStepIndex === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={tutorial.nextStep}
            disabled={tutorial.currentStepIndex === total - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs shrink-0 text-muted-foreground"
          onClick={tutorial.stopPlayback}
        >
          Avslutt
        </Button>
      </div>
    );
  }

  const handleTutorialClick = () => {
    if (onExpandToTutorials) {
      onExpandToTutorials();
    } else {
      onExpandToMedium();
    }
  };

  return (
    <div className="h-full w-full flex items-center gap-1.5 px-1.5">
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
        {...dragHandleProps}
      >
        <GripHorizontal className="h-4 w-4" />
      </div>

      <button
        type="button"
        className="flex-1 flex items-center gap-2 cursor-text rounded-md bg-muted/30 h-8 px-2.5 hover:bg-muted/50 transition-colors min-w-0"
        onClick={onExpandToMedium}
      >
        <RevizoIcon size={14} className="opacity-50" />
        <span className="text-sm text-muted-foreground/50 truncate">
          Spør Revizo om hva som helst…
        </span>
      </button>

      <div className="h-5 w-px bg-border shrink-0" />

      <TooltipProvider delayDuration={200}>
        <div className="flex items-center shrink-0">
          {actions.map((action) => (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => dispatchSmartPanelAction(action.id)}
                >
                  <action.icon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {action.label}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleTutorialClick}
            >
              <GraduationCap className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Tutorial
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-5 w-px bg-border shrink-0" />

      <PanelSizeToggle
        expanded={false}
        onClick={onExpandToMedium}
        className="h-7 w-7"
      />

      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 shrink-0 text-muted-foreground/40 hover:text-foreground"
        onClick={onClose}
        aria-label="Lukk"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

import dynamic from "next/dynamic";
const TutorialSaveDialogLazy = dynamic(
  () => import("@/components/tutorial/tutorial-save-dialog").then((m) => m.TutorialSaveDialog),
  { ssr: false }
);
