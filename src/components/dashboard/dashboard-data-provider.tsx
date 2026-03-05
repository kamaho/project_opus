"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

/* ── Shared types ──────────────────────────────────────────────── */

export interface AgencyStats {
  totalClients: number;
  activeReconciliations: number;
  totalUnmatched: number;
  totalDifference: number;
}

export interface ReconciliationRow {
  clientId: string;
  clientName: string;
  companyName: string;
  unmatchedCount: number;
  unmatchedAmount: number;
  lastActivity: string | null;
  status: string;
}

export interface ReconciliationData {
  clients: ReconciliationRow[];
  totalClients: number;
}

export type { DeadlineWithSummary as DeadlineInstanceRow } from "@/lib/deadlines/types";
export type { DeadlineListResponse } from "@/lib/deadlines/types";

import type { DeadlineWithSummary } from "@/lib/deadlines/types";

export interface DeadlinesSummary {
  total: number;
  done: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  notStarted: number;
}

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  clientId?: string | null;
  [key: string]: unknown;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  clientName: string;
  timestamp: string;
}

/* ── Context value ─────────────────────────────────────────────── */

interface DashboardData {
  stats: AgencyStats | null;
  reconciliation: ReconciliationRow[];
  totalClients: number;
  deadlineInstances: DeadlineWithSummary[];
  deadlinesSummary: DeadlinesSummary | null;
  tasks: TaskRow[];
  activity: ActivityItem[];
  loading: boolean;
  refresh: () => void;
}

const DashboardDataContext = createContext<DashboardData | null>(null);

/* ── Module-level cache ────────────────────────────────────────── */

interface CachedDashboard {
  tenantId: string;
  companyId: string | undefined;
  stats: AgencyStats | null;
  reconciliation: ReconciliationRow[];
  totalClients: number;
  deadlineInstances: DeadlineWithSummary[];
  deadlinesSummary: DeadlinesSummary | null;
  tasks: TaskRow[];
  activity: ActivityItem[];
  ts: number;
}

let cache: CachedDashboard | null = null;
const CACHE_TTL = 60_000;

/* ── Provider ──────────────────────────────────────────────────── */

export function DashboardDataProvider({
  tenantId,
  clientId,
  companyId,
  children,
}: {
  tenantId: string;
  clientId?: string;
  companyId?: string;
  children: ReactNode;
}) {
  const hasFresh = cache && cache.tenantId === tenantId && cache.companyId === companyId && Date.now() - cache.ts < CACHE_TTL;

  const [stats, setStats] = useState<AgencyStats | null>(cache?.stats ?? null);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>(cache?.reconciliation ?? []);
  const [totalClients, setTotalClients] = useState<number>(cache?.totalClients ?? 0);
  const [deadlineInstances, setDeadlineInstances] = useState<DeadlineWithSummary[]>(cache?.deadlineInstances ?? []);
  const [deadlinesSummary, setDeadlinesSummary] = useState<DeadlinesSummary | null>(cache?.deadlinesSummary ?? null);
  const [tasks, setTasks] = useState<TaskRow[]>(cache?.tasks ?? []);
  const [activity, setActivity] = useState<ActivityItem[]>(cache?.activity ?? []);
  const [loading, setLoading] = useState(!hasFresh);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAll = useCallback(
    (force = false, signal?: AbortSignal) => {
      if (!force && cache && cache.tenantId === tenantId && cache.companyId === companyId && Date.now() - cache.ts < CACHE_TTL) {
        setLoading(false);
        return;
      }

      const cq = companyId ? `companyId=${encodeURIComponent(companyId)}` : "";
      const q = (base: string) => {
        if (!cq) return base;
        return base.includes("?") ? `${base}&${cq}` : `${base}?${cq}`;
      };

      const activityUrl = clientId
        ? `/api/dashboard/clients/${clientId}/activity`
        : "/api/dashboard/agency/activity";

      const safeFetch = <T,>(url: string, fallback: T): Promise<T> =>
        fetch(url, { signal })
          .then((r) => (r.ok ? r.json() as Promise<T> : fallback))
          .catch(() => fallback);

      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const toDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

      Promise.all([
        safeFetch(q("/api/dashboard/agency/stats"), null),
        safeFetch<ReconciliationData>(q("/api/dashboard/agency/reconciliation"), { clients: [], totalClients: 0 }),
        safeFetch(q("/api/tasks?status=open,in_progress,waiting"), []),
        safeFetch(q(activityUrl), []),
        safeFetch<{ deadlines: DeadlineWithSummary[]; summary: DeadlinesSummary | null }>(q(`/api/deadlines?from=${fromDate}&to=${toDate}`), { deadlines: [], summary: null }),
      ])
        .then(([s, r, t, a, dlData]) => {
          if (!mountedRef.current) return;

          const newStats = s ?? null;
          const reconData = r as ReconciliationData | null;
          const newRecon = Array.isArray(reconData?.clients) ? reconData.clients : [];
          const newTotalClients = reconData?.totalClients ?? 0;
          const newTasks = Array.isArray(t) ? t : [];
          const newActivity = Array.isArray(a) ? a : [];
          const newDeadlineInstances = Array.isArray(dlData?.deadlines) ? dlData.deadlines : [];
          const newDeadlinesSummary = dlData?.summary ?? null;

          setStats(newStats);
          setReconciliation(newRecon);
          setTotalClients(newTotalClients);
          setDeadlineInstances(newDeadlineInstances);
          setDeadlinesSummary(newDeadlinesSummary);
          setTasks(newTasks);
          setActivity(newActivity);

          cache = {
            tenantId,
            companyId,
            stats: newStats,
            reconciliation: newRecon,
            totalClients: newTotalClients,
            deadlineInstances: newDeadlineInstances,
            deadlinesSummary: newDeadlinesSummary,
            tasks: newTasks,
            activity: newActivity,
            ts: Date.now(),
          };
        })
        .catch((err) => {
          if (mountedRef.current) console.error("[DashboardData] fetch failed:", err);
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false);
        });
    },
    [tenantId, clientId, companyId]
  );

  useEffect(() => {
    fetchAll(false, undefined);
  }, [fetchAll]);

  return (
    <DashboardDataContext.Provider
      value={{ stats, reconciliation, totalClients, deadlineInstances, deadlinesSummary, tasks, activity, loading, refresh: () => fetchAll(true, undefined) }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────── */

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within <DashboardDataProvider>");
  }
  return ctx;
}
