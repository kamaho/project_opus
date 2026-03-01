"use client";

import { cn } from "@/lib/utils";
import { MOCK_TEAM_CAPACITY, type MockTeamMemberCapacity } from "../mock-data";
import { ProgressBar } from "../shared/progress-bar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const statusLabels: Record<MockTeamMemberCapacity["status"], string> = {
  AVAILABLE: "Ledig",
  NORMAL: "Normal",
  BUSY: "Opptatt",
  OVERLOADED: "Overbelastet",
};

const statusColors: Record<MockTeamMemberCapacity["status"], string> = {
  AVAILABLE: "text-violet-600 dark:text-violet-400",
  NORMAL: "text-blue-600 dark:text-blue-400",
  BUSY: "text-amber-600 dark:text-amber-400",
  OVERLOADED: "text-red-600 dark:text-red-400",
};

const roleLabels: Record<string, string> = {
  ACCOUNTANT: "Regnskapsfører",
  CONTROLLER: "Kontrollør",
  MANAGER: "Leder",
  ADMIN: "Admin",
};

export function TeamCapacityList() {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Teamkapasitet</h3>
      <div className="space-y-4">
        {MOCK_TEAM_CAPACITY.map((member) => (
          <div key={member.userId} className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar size="sm">
                <AvatarFallback className="text-[10px]">{member.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{member.name}</span>
                    <span className="text-[10px] text-muted-foreground">{roleLabels[member.role] ?? member.role}</span>
                  </div>
                  <span className={cn("text-xs font-medium", statusColors[member.status])}>
                    {statusLabels[member.status]}
                  </span>
                </div>
                <ProgressBar
                  percent={member.currentLoad.utilizationPercent}
                  size="sm"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pl-9 text-[10px] text-muted-foreground">
              <span>{member.currentLoad.assignedTasks} oppgaver</span>
              <span className="text-border">|</span>
              <span>{member.currentLoad.estimatedHours}t estimert</span>
              {member.taskBreakdown.overdue > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-red-600 dark:text-red-400">{member.taskBreakdown.overdue} forfalt</span>
                </>
              )}
              {member.taskBreakdown.changesNeeded > 0 && (
                <>
                  <span className="text-border">|</span>
                  <span className="text-amber-600 dark:text-amber-400">{member.taskBreakdown.changesNeeded} sendt tilbake</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
