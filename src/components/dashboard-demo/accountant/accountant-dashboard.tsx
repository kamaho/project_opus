"use client";

import { XCircle, ListTodo, CornerDownLeft, CheckCircle2 } from "lucide-react";
import { MOCK_ACCOUNTANT_STATS, MOCK_ACCOUNTANT_PROGRESS } from "../mock-data";
import { StatCard } from "../shared/stat-card";
import { ProgressBar } from "../shared/progress-bar";
import { FocusTodayList } from "./focus-today-list";
import { ReturnedTasksList } from "./returned-tasks-list";
import { MyClientsWidget } from "./my-clients-widget";

export function AccountantDashboard() {
  const s = MOCK_ACCOUNTANT_STATS;
  const p = MOCK_ACCOUNTANT_PROGRESS;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Forfalt"
          value={s.overdue}
          icon={XCircle}
          variant="danger"
        />
        <StatCard
          label="Aktive oppgaver"
          value={s.active}
          icon={ListTodo}
          variant="info"
        />
        <StatCard
          label="Sendt tilbake"
          value={s.returned}
          icon={CornerDownLeft}
          variant="warning"
        />
        <StatCard
          label="Fullført denne uken"
          value={s.completedThisWeek}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {/* Main content: Focus list + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <FocusTodayList />
          <ReturnedTasksList />
        </div>
        <div className="space-y-4">
          {/* Progress widget */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-medium mb-3">Min progresjon</h3>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Denne uken</span>
                  <span className="font-medium tabular-nums">{p.weekCompletedPercent}%</span>
                </div>
                <ProgressBar percent={p.weekCompletedPercent} showLabel={false} size="sm" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Denne måneden</span>
                  <span className="font-medium tabular-nums">{p.monthCompletedPercent}%</span>
                </div>
                <ProgressBar percent={p.monthCompletedPercent} showLabel={false} size="sm" />
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Frister overholdt (90d)</span>
                  <span className="font-medium tabular-nums">{p.deadlinesKept.kept}/{p.deadlinesKept.total}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Snitt dager før frist</span>
                  <span className="font-medium tabular-nums">{p.avgDaysBeforeDeadline}d</span>
                </div>
              </div>
            </div>
          </div>
          <MyClientsWidget />
        </div>
      </div>
    </div>
  );
}
