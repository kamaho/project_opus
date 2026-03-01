"use client";

import { cn } from "@/lib/utils";
import { MOCK_CLIENTS } from "../mock-data";

const statusStyles: Record<string, { dot: string; label: string }> = {
  ON_TRACK: { dot: "bg-violet-500", label: "I rute" },
  AT_RISK:  { dot: "bg-amber-500",   label: "Risiko" },
  OVERDUE:  { dot: "bg-red-500",     label: "Forfalt" },
};

export function MyClientsWidget() {
  const myClients = MOCK_CLIENTS.filter(
    (c) => c.assignedAccountant === "Per Hansen",
  );

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Mine klienter</h3>
      <div className="space-y-1.5">
        {myClients.map((client) => {
          const health = statusStyles[client.status];
          return (
            <div
              key={client.id}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <span className={cn("size-1.5 rounded-full shrink-0", health.dot)} />
              <span className="text-sm truncate flex-1">{client.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {client.totalActiveTasks} oppg.
              </span>
              {client.nextDeadline && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(client.nextDeadline.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
