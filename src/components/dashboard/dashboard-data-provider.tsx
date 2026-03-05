"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

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
  matchPercentage: number;
  unmatchedCount: number;
  lastActivity: string | null;
  status: string;
}

export interface DeadlineStatus {
  deadlineId: string;
  title: string;
  date: string;
  daysLeft: number;
  source: string;
  status: string;
  taskSummary: { total: number; completed: number; inProgress: number; overdue: number };
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeId: string | null;
    dueDate: string | null;
    completedAt: string | null;
  }[];
}

export type { DeadlineWithSummary as DeadlineInstanceRow } from "@/lib/deadlines/types";
export type { DeadlineListResponse } from "@/lib/deadlines/types";

import type { DeadlineWithSummary, DeadlineListResponse } from "@/lib/deadlines/types";

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
  deadlines: DeadlineStatus[];
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
  companyId: string | undefined;
  stats: AgencyStats | null;
  reconciliation: ReconciliationRow[];
  deadlines: DeadlineStatus[];
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
  clientId,
  companyId,
  children,
}: {
  clientId?: string;
  companyId?: string;
  children: ReactNode;
}) {
  const hasFresh = cache && cache.companyId === companyId && Date.now() - cache.ts < CACHE_TTL;

  const [stats, setStats] = useState<AgencyStats | null>(cache?.stats ?? null);
  const [reconciliation, setReconciliation] = useState<ReconciliationRow[]>(cache?.reconciliation ?? []);
  const [deadlines, setDeadlines] = useState<DeadlineStatus[]>(cache?.deadlines ?? []);
  const [deadlineInstances, setDeadlineInstances] = useState<DeadlineWithSummary[]>(cache?.deadlineInstances ?? []);
  const [deadlinesSummary, setDeadlinesSummary] = useState<DeadlinesSummary | null>(cache?.deadlinesSummary ?? null);
  const [tasks, setTasks] = useState<TaskRow[]>(cache?.tasks ?? []);
  const [activity, setActivity] = useState<ActivityItem[]>(cache?.activity ?? []);
  const [loading, setLoading] = useState(!hasFresh);

  const fetchAll = useCallback(
    (force = false, signal?: AbortSignal) => {
      if (!force && cache && cache.companyId === companyId && Date.now() - cache.ts < CACHE_TTL) {
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

      const safeFetch = (url: string, fallback: unknown) =>
        fetch(url, { signal })
          .then((r) => (r.ok ? r.json() : fallback))
          .catch(() => fallback);

      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const toDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

      Promise.all([
        safeFetch(q("/api/dashboard/agency/stats"), null),
        safeFetch(q("/api/dashboard/agency/reconciliation"), []),
        safeFetch(q("/api/dashboard/deadline-status"), []),
        safeFetch(q("/api/tasks?status=open,in_progress,waiting"), []),
        safeFetch(q(activityUrl), []),
        safeFetch(q(`/api/deadlines?from=${fromDate}&to=${toDate}`), { deadlines: [], summary: null }),
      ])
        .then(([s, r, d, t, a, dlData]) => {
          if (signal?.aborted) return;

          const newStats = s ?? null;
          const newRecon = Array.isArray(r) ? r : [];
          const newDeadlines = Array.isArray(d) ? d : [];
          const newTasks = Array.isArray(t) ? t : [];
          const newActivity = Array.isArray(a) ? a : [];
          const newDeadlineInstances = Array.isArray(dlData?.deadlines) ? dlData.deadlines : [];
          const newDeadlinesSummary = dlData?.summary ?? null;

          setStats(newStats);
          setReconciliation(newRecon);
          setDeadlines(newDeadlines);
          setDeadlineInstances(newDeadlineInstances);
          setDeadlinesSummary(newDeadlinesSummary);
          setTasks(newTasks);
          setActivity(newActivity);

          cache = {
            companyId,
            stats: newStats,
            reconciliation: newRecon,
            deadlines: newDeadlines,
            deadlineInstances: newDeadlineInstances,
            deadlinesSummary: newDeadlinesSummary,
            tasks: newTasks,
            activity: newActivity,
            ts: Date.now(),
          };
        })
        .catch((err) => {
          if (!signal?.aborted) console.error("[DashboardData] fetch failed:", err);
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false);
        });
    },
    [clientId, companyId]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetchAll(false, controller.signal);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [fetchAll]);

  return (
    <DashboardDataContext.Provider
      value={{ stats, reconciliation, deadlines, deadlineInstances, deadlinesSummary, tasks, activity, loading, refresh: () => fetchAll(true, undefined) }}
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
