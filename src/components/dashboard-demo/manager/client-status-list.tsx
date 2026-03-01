"use client";

import { cn } from "@/lib/utils";
import { MOCK_CLIENTS, type MockClient } from "../mock-data";

const healthStyles: Record<MockClient["status"], { dot: string; label: string }> = {
  ON_TRACK: { dot: "bg-violet-500", label: "I rute" },
  AT_RISK:  { dot: "bg-amber-500",   label: "Risiko" },
  OVERDUE:  { dot: "bg-red-500",     label: "Forfalt" },
};

export function ClientStatusList() {
  const sorted = [...MOCK_CLIENTS].sort((a, b) => {
    const order: Record<string, number> = { OVERDUE: 0, AT_RISK: 1, ON_TRACK: 2 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Klientstatus</h3>
      <div className="space-y-1">
        {sorted.map((client) => {
          const health = healthStyles[client.status];
          return (
            <div
              key={client.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors"
            >
              <span className={cn("size-2 rounded-full shrink-0", health.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{client.name}</span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    client.status === "OVERDUE" && "text-red-600 dark:text-red-400",
                    client.status === "AT_RISK" && "text-amber-600 dark:text-amber-400",
                    client.status === "ON_TRACK" && "text-violet-600 dark:text-violet-400",
                  )}>
                    {health.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{client.companyType}</span>
                  <span className="text-border">|</span>
                  <span>{client.totalActiveTasks} aktive</span>
                  {client.overdueCount > 0 && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-red-600 dark:text-red-400">{client.overdueCount} forfalt</span>
                    </>
                  )}
                  {client.nextDeadline && (
                    <>
                      <span className="text-border">|</span>
                      <span>Neste: {client.nextDeadline.typeLabel} {new Date(client.nextDeadline.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
