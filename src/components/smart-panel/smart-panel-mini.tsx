"use client";

import { usePathname } from "next/navigation";
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
  dragHandleProps: DragHandleProps;
}

export function SmartPanelMiniContent({
  onClose,
  onExpandToMedium,
  dragHandleProps,
}: SmartPanelMiniContentProps) {
  const pathname = usePathname();
  const { enabled: tutorialMode, setEnabled: setTutorialEnabled } = useTutorialMode();
  const actions = getMiniActionsForPath(pathname ?? "");

  return (
    <div className="h-full w-full flex items-center gap-1.5 px-1.5">
      {/* Drag handle */}
      <div
        className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
        {...dragHandleProps}
      >
        <GripHorizontal className="h-4 w-4" />
      </div>

      {/* AI search */}
      <button
        type="button"
        className="flex-1 flex items-center gap-2 cursor-text rounded-md bg-muted/30 h-8 px-2.5 hover:bg-muted/50 transition-colors min-w-0"
        onClick={onExpandToMedium}
      >
        <RevizoIcon size={14} className="opacity-50" />
        <span className="text-sm text-muted-foreground/50 truncate">
          Spør meg om hva som helst…
        </span>
      </button>

      <div className="h-5 w-px bg-border shrink-0" />

      {/* Quick actions */}
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

        {/* Tutorial toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7 shrink-0",
                tutorialMode ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTutorialEnabled(!tutorialMode)}
            >
              <GraduationCap className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tutorialMode ? "Tutorial aktiv" : "Tutorial"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="h-5 w-px bg-border shrink-0" />

      {/* Expand */}
      <PanelSizeToggle
        expanded={false}
        onClick={onExpandToMedium}
        className="h-7 w-7"
      />

      {/* Close */}
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
