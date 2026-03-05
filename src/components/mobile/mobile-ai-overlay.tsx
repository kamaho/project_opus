"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileAiTab } from "./mobile-ai-tab";

interface MobileAiOverlayProps {
  onClose: () => void;
}

export function MobileAiOverlay({ onClose }: MobileAiOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        className={cn(
          "flex h-full flex-col transition-transform duration-200 ease-out",
          mounted ? "translate-y-0" : "translate-y-full"
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
          <h2 className="text-sm font-semibold">Revizo AI</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <MobileAiTab />
        </div>
      </div>
    </div>
  );
}

