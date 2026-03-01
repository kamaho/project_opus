"use client";

import { Inbox, AlertTriangle, CheckCircle2, CornerDownLeft } from "lucide-react";
import { MOCK_CONTROLLER_STATS } from "../mock-data";
import { StatCard } from "../shared/stat-card";
import { ControlQueue } from "./control-queue";
import { ThroughputWidget } from "./throughput-widget";
import { BottleneckAlert } from "./bottleneck-alert";

export function ControllerDashboard() {
  const s = MOCK_CONTROLLER_STATS;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="I kø"
          value={s.inQueue}
          icon={Inbox}
          variant="info"
        />
        <StatCard
          label="Haster"
          value={s.urgent}
          icon={AlertTriangle}
          variant="danger"
        />
        <StatCard
          label="Godkjent denne uken"
          value={s.approvedThisWeek}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Sendt tilbake denne uken"
          value={s.returnedThisWeek}
          icon={CornerDownLeft}
          variant="warning"
        />
      </div>

      {/* Bottleneck alert */}
      <BottleneckAlert />

      {/* Main content: Queue + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ControlQueue />
        </div>
        <div>
          <ThroughputWidget />
        </div>
      </div>
    </div>
  );
}
