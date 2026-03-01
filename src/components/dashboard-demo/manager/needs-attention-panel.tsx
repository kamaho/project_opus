"use client";

import { cn } from "@/lib/utils";
import { MOCK_SUGGESTED_ACTIONS, type MockSuggestedAction } from "../mock-data";
import { ArrowRightLeft, AlertTriangle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const typeIcons: Record<MockSuggestedAction["type"], typeof ArrowRightLeft> = {
  REASSIGN: ArrowRightLeft,
  ESCALATE: AlertTriangle,
  ASSIGN: UserPlus,
};

const typeLabels: Record<MockSuggestedAction["type"], string> = {
  REASSIGN: "Omfordel",
  ESCALATE: "Eskaler",
  ASSIGN: "Tildel",
};

export function NeedsAttentionPanel() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Trenger handling</h3>
      <div className="space-y-3">
        {MOCK_SUGGESTED_ACTIONS.map((action, idx) => {
          const Icon = typeIcons[action.type];
          return (
            <div
              key={idx}
              className={cn(
                "rounded-md border p-3 space-y-2",
                action.priority === "HIGH" && "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20",
                action.priority === "MEDIUM" && "border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20",
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn(
                  "mt-0.5 rounded-md p-1",
                  action.priority === "HIGH" ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" : "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
                )}>
                  <Icon className="size-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] font-medium uppercase tracking-wide",
                      action.priority === "HIGH" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400",
                    )}>
                      {action.priority === "HIGH" ? "Haster" : "Anbefalt"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{typeLabels[action.type]}</span>
                  </div>
                  <p className="text-sm mt-0.5">{action.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="xs">Se oppgave</Button>
                <Button variant="outline" size="xs">
                  {action.type === "REASSIGN" ? "Omfordel" : action.type === "ASSIGN" ? "Tildel" : "Se detaljer"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
