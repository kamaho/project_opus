"use client";

import { useState, useCallback } from "react";
import { LayoutGrid, Grid3x3, Maximize2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type {
  LayoutType,
  DashboardType,
  DashboardModuleConfig,
} from "./types";

interface DashboardToolbarProps {
  currentLayout: LayoutType;
  availableModules: DashboardModuleConfig[];
  hiddenModules: string[];
  dashboardType: DashboardType;
}

const LAYOUT_OPTIONS: {
  value: LayoutType;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { value: "overview", label: "Oversikt", icon: LayoutGrid },
  { value: "compact", label: "Kompakt", icon: Grid3x3 },
  { value: "focus", label: "Fokus", icon: Maximize2 },
];

async function saveConfig(
  dashboardType: DashboardType,
  updates: { layout?: LayoutType; hiddenModules?: string[] }
) {
  const res = await fetch("/api/dashboard/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dashboardType, ...updates }),
  });
  if (!res.ok) throw new Error("Failed to save");
}

export function DashboardToolbar({
  currentLayout: initialLayout,
  availableModules,
  hiddenModules: initialHidden,
  dashboardType,
}: DashboardToolbarProps) {
  const [layout, setLayout] = useState<LayoutType>(initialLayout);
  const [hidden, setHidden] = useState<string[]>(initialHidden);

  const handleLayoutChange = useCallback(
    async (newLayout: LayoutType) => {
      setLayout(newLayout);
      try {
        await saveConfig(dashboardType, { layout: newLayout });
      } catch {
        toast.error("Kunne ikke lagre innstillinger");
        setLayout(layout);
      }
    },
    [dashboardType, layout]
  );

  const handleModuleToggle = useCallback(
    async (moduleId: string, visible: boolean) => {
      const next = visible
        ? hidden.filter((id) => id !== moduleId)
        : [...hidden, moduleId];
      setHidden(next);
      try {
        await saveConfig(dashboardType, { hiddenModules: next });
      } catch {
        toast.error("Kunne ikke lagre innstillinger");
        setHidden(hidden);
      }
    },
    [dashboardType, hidden]
  );

  return (
    <div className="flex items-center justify-end gap-2">
      <div className="hidden items-center rounded-lg border bg-muted/40 p-0.5 md:flex">
        {LAYOUT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = layout === opt.value;
          return (
            <Button
              key={opt.value}
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => handleLayoutChange(opt.value)}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">{opt.label}</span>
            </Button>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tilpass moduler</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Vis/skjul moduler
          </p>
          <div className="space-y-2">
            {availableModules.map((mod) => {
              const isVisible = !hidden.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked) =>
                      handleModuleToggle(mod.id, !!checked)
                    }
                  />
                  {mod.title}
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
