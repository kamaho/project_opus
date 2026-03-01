"use client";

import { GraduationCap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";

export function SidebarTutorialToggle() {
  const { enabled, setEnabled } = useTutorialMode();

  return (
    <div className="flex items-center justify-between gap-2">
      <Label
        htmlFor="tutorial-mode"
        className="text-xs text-sidebar-foreground/80 font-normal cursor-pointer flex items-center gap-1.5"
      >
        <GraduationCap className="h-3.5 w-3.5 text-sidebar-foreground/70" />
        Tutorial-modus
      </Label>
      <Switch
        id="tutorial-mode"
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-label="Slå tutorial-modus av eller på"
      />
    </div>
  );
}
