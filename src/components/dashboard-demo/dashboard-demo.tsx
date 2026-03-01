"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ManagerDashboard } from "./manager/manager-dashboard";
import { AccountantDashboard } from "./accountant/accountant-dashboard";
import { ControllerDashboard } from "./controller/controller-dashboard";
import { Users, Calculator, ShieldCheck } from "lucide-react";

type DashboardRole = "manager" | "accountant" | "controller";

const TABS: { id: DashboardRole; label: string; sublabel: string; icon: typeof Users }[] = [
  { id: "manager", label: "Daglig leder", sublabel: "Anna Nordby", icon: Users },
  { id: "accountant", label: "Regnskapsfører", sublabel: "Per Hansen", icon: Calculator },
  { id: "controller", label: "Kontrollør", sublabel: "Erik Sæther", icon: ShieldCheck },
];

export function DashboardDemo() {
  const [activeRole, setActiveRole] = useState<DashboardRole>("manager");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">RegnskapsFlow</h1>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Demo
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Fristintelligent oppgave- og teamstyring for regnskapsbyråer. Bytt mellom roller for å se de ulike dashboardene.
        </p>
      </div>

      {/* Role switcher */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        {TABS.map((tab) => {
          const isActive = activeRole === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveRole(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all",
                isActive
                  ? "bg-background shadow-sm text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              <Icon className="size-4" />
              <div className="text-left">
                <div className="text-sm leading-none">{tab.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{tab.sublabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dashboard content */}
      {activeRole === "manager" && <ManagerDashboard />}
      {activeRole === "accountant" && <AccountantDashboard />}
      {activeRole === "controller" && <ControllerDashboard />}
    </div>
  );
}
