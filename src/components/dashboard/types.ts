import { type ComponentType } from "react";

export type ModuleSize = "small" | "medium" | "large" | "full";
export type DashboardType = "agency" | "client";
export type LayoutType = "overview" | "compact" | "focus";

export interface ModuleProps {
  tenantId: string;
  clientId?: string;
  companyId?: string;
  size: ModuleSize;
}

export interface DashboardModuleConfig {
  id: string;
  title: string;
  description: string;
  component: ComponentType<ModuleProps>;
  dashboardType: DashboardType | "both";
  defaultSize: ModuleSize;
}

export interface DashboardConfig {
  layout: LayoutType;
  hiddenModules: string[];
  moduleSettings: Record<string, unknown>;
}

export interface LayoutProps {
  modules: DashboardModuleConfig[];
  tenantId: string;
  clientId?: string;
  companyId?: string;
}
