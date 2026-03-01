"use client";

import { BarChart3, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";
import { MOCK_MANAGER_STATS } from "../mock-data";
import { StatCard } from "../shared/stat-card";
import { DeadlineHeatmap } from "./deadline-heatmap";
import { TeamCapacityList } from "./team-capacity-list";
import { NeedsAttentionPanel } from "./needs-attention-panel";
import { ClientStatusList } from "./client-status-list";

export function ManagerDashboard() {
  const s = MOCK_MANAGER_STATS;

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Aktive oppgaver"
          value={s.activeTasks}
          icon={BarChart3}
          variant="info"
          trend={{ direction: "down", label: "12 færre enn forrige uke" }}
        />
        <StatCard
          label="Forfaller denne uken"
          value={s.urgentThisWeek}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          label="Forfalt"
          value={s.overdue}
          icon={XCircle}
          variant="danger"
          trend={{ direction: "up", label: "1 mer enn forrige uke" }}
        />
        <StatCard
          label="Fristoverholdelse"
          value={`${s.complianceRateMonth}%`}
          icon={ShieldCheck}
          variant={s.complianceRateMonth >= 95 ? "success" : s.complianceRateMonth >= 85 ? "warning" : "danger"}
          trend={{ direction: "down", label: "fra 94 % forrige mnd" }}
        />
      </div>

      {/* Heatmap */}
      <DeadlineHeatmap />

      {/* Two-column: Team + Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamCapacityList />
        <NeedsAttentionPanel />
      </div>

      {/* Client status */}
      <ClientStatusList />
    </div>
  );
}
