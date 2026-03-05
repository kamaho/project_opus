import { lazy } from "react";
import type { DashboardModuleConfig, DashboardType } from "./types";

export const moduleRegistry: Record<string, DashboardModuleConfig> = {
  "reconciliation-overview": {
    id: "reconciliation-overview",
    title: "Avstemmingsstatus",
    description: "Oversikt over avstemmingsstatus for alle klienter",
    component: lazy(() => import("./modules/reconciliation-overview")),
    dashboardType: "agency",
    defaultSize: "full",
  },
  "key-figures": {
    id: "key-figures",
    title: "Oversikt",
    description: "Nøkkeltall for klienter, uavstemte poster, oppgaver og frister",
    component: lazy(() => import("./modules/key-figures")),
    dashboardType: "agency",
    defaultSize: "medium",
  },
  deadlines: {
    id: "deadlines",
    title: "Krever oppmerksomhet",
    description: "Avvik og oppgaver som krever handling",
    component: lazy(() => import("./modules/deadlines")),
    dashboardType: "both",
    defaultSize: "medium",
  },
  "recent-activity": {
    id: "recent-activity",
    title: "Nylig aktivitet",
    description: "Siste importer, matchinger og rapporter",
    component: lazy(() => import("./modules/recent-activity")),
    dashboardType: "both",
    defaultSize: "full",
  },
  "client-reconciliation": {
    id: "client-reconciliation",
    title: "Avstemmingsstatus",
    description: "Avstemmingsstatus for denne klienten",
    component: lazy(() => import("./modules/client-reconciliation")),
    dashboardType: "client",
    defaultSize: "full",
  },
  "client-key-figures": {
    id: "client-key-figures",
    title: "Nøkkeltall",
    description: "Nøkkeltall for denne klienten",
    component: lazy(() => import("./modules/client-key-figures")),
    dashboardType: "client",
    defaultSize: "medium",
  },
  "deadline-widget": {
    id: "deadline-widget",
    title: "Frister",
    description: "Kommende frister med tidsgrupper og status",
    component: lazy(() => import("./modules/deadline-widget")),
    dashboardType: "agency",
    defaultSize: "full",
  },
  "client-deadlines": {
    id: "client-deadlines",
    title: "Frister",
    description: "Frister for denne klienten",
    component: lazy(() => import("./modules/client-deadlines")),
    dashboardType: "client",
    defaultSize: "medium",
  },
  "client-recent-activity": {
    id: "client-recent-activity",
    title: "Nylig aktivitet",
    description: "Siste aktivitet for denne klienten",
    component: lazy(() => import("./modules/client-recent-activity")),
    dashboardType: "client",
    defaultSize: "full",
  },
};

export function getModulesForDashboard(type: DashboardType) {
  return Object.values(moduleRegistry).filter(
    (m) => m.dashboardType === type || m.dashboardType === "both"
  );
}
