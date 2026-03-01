"use client";

import { Star, ArrowRight } from "lucide-react";
import type { NavItemTier } from "@/lib/constants/navigation";

interface PlanBadgeProps {
  tier: NavItemTier;
  clientCount: number;
  clientLimit: number | null;
}

export function PlanBadge({ tier, clientCount, clientLimit }: PlanBadgeProps) {
  const tierLabel = tier === "STARTER" ? "Starter" : tier === "PRO" ? "Pro" : "Enterprise";
  const pct = clientLimit ? Math.min((clientCount / clientLimit) * 100, 100) : 0;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground">
          <Star className="size-3.5" />
          {tierLabel}
        </span>
        {clientLimit !== null && (
          <span className="text-[11px] text-sidebar-foreground/60">
            {clientCount} av {clientLimit} klienter
          </span>
        )}
      </div>

      {clientLimit !== null && (
        <div className="h-1.5 w-full rounded-full bg-sidebar-accent">
          <div
            className="h-1.5 rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {tier === "STARTER" && (
        <button className="flex w-full items-center justify-center gap-1 rounded-md border border-sidebar-border px-2 py-1.5 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          Oppgrader til Pro
          <ArrowRight className="size-3" />
        </button>
      )}
    </div>
  );
}
