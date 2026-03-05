"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  Scale,
  Users,
  ArrowRight,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgencyStats {
  totalClients: number;
  activeReconciliations: number;
  totalUnmatched: number;
  totalDifference: number;
}

interface DeadlineSummary {
  total: number;
  done: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  notStarted: number;
}

interface DeadlineItem {
  id: string;
  dueDate: string;
  status: "not_started" | "on_track" | "at_risk" | "overdue" | "done";
  template: { name: string };
  company: { name: string };
  taskSummary: { total: number; completed: number };
}

interface ReconciliationRow {
  clientId: string;
  clientName: string;
  companyName: string;
  unmatchedCount: number;
  unmatchedAmount: number;
}

interface ReconciliationResponse {
  clients: ReconciliationRow[];
  totalClients: number;
}

interface AttentionItem {
  id: string;
  type: "deadline" | "client";
  score: number;
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

type TabId = "oversikt" | "klienter" | "frister" | "varsler";

interface MobileOverviewTabProps {
  onNavigate: (tab: TabId) => void;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

function buildAttentionItems(
  deadlines: DeadlineItem[],
  clients: ReconciliationRow[]
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const d of deadlines) {
    const days = daysUntil(d.dueDate);

    if (d.status === "overdue") {
      items.push({
        id: `deadline-${d.id}`,
        type: "deadline",
        score: 100 + Math.abs(days),
        label: `${d.template.name} — ${d.company.name}`,
        detail: `${Math.abs(days)} dager forfalt`,
        severity: "critical",
      });
    } else if (d.status === "at_risk") {
      items.push({
        id: `deadline-${d.id}`,
        type: "deadline",
        score: 50 + Math.max(0, 7 - days),
        label: `${d.template.name} — ${d.company.name}`,
        detail: `${days} dager igjen`,
        severity: "warning",
      });
    }
  }

  for (const c of clients) {
    if (c.unmatchedCount <= 0) continue;

    const score = Math.min(c.unmatchedAmount / 1000, 80);
    const severity: AttentionItem["severity"] =
      c.unmatchedAmount >= 100_000 ? "critical" : c.unmatchedAmount >= 10_000 ? "warning" : "info";

    items.push({
      id: `client-${c.clientId}`,
      type: "client",
      score,
      label: c.clientName,
      detail: `${krFmt.format(c.unmatchedAmount)} uavstemt · ${c.unmatchedCount} poster`,
      severity,
    });
  }

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 10);
}

const krFmt = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

export function MobileOverviewTab({ onNavigate }: MobileOverviewTabProps) {
  const [stats, setStats] = useState<AgencyStats | null>(null);
  const [deadlineSummary, setDeadlineSummary] = useState<DeadlineSummary | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [clients, setClients] = useState<ReconciliationRow[]>([]);
  const [reconTotalClients, setReconTotalClients] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDeadlines, setLoadingDeadlines] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const now = new Date();
    const to = new Date(now);
    to.setDate(to.getDate() + 60);
    const toStr = to.toISOString().split("T")[0];
    const fromStr = now.toISOString().split("T")[0];

    const statsPromise = fetch("/api/dashboard/agency/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch(() => setLoadingStats(false));

    const deadlinesPromise = fetch(
      `/api/deadlines?from=${fromStr}&to=${toStr}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setDeadlineSummary(data.summary);
          setDeadlines(data.deadlines);
        }
        setLoadingDeadlines(false);
      })
      .catch(() => setLoadingDeadlines(false));

    const clientsPromise = fetch("/api/dashboard/agency/reconciliation")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReconciliationResponse | null) => {
        if (data) {
          setClients(data.clients);
          setReconTotalClients(data.totalClients);
        }
        setLoadingClients(false);
      })
      .catch(() => setLoadingClients(false));

    await Promise.all([statsPromise, deadlinesPromise, clientsPromise]);
    if (isRefresh) setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const attentionItems = buildAttentionItems(deadlines, clients);
  const clientsWithIssues = clients.filter((c) => c.unmatchedCount > 0);
  const totalAttention =
    (deadlineSummary?.overdue ?? 0) +
    (deadlineSummary?.atRisk ?? 0) +
    clientsWithIssues.length;

  const allGood = !loadingStats && !loadingDeadlines && !loadingClients && totalAttention === 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
        <h2 className="text-base font-semibold">Oversikt</h2>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Health banner */}
      {loadingStats && loadingDeadlines && loadingClients ? (
        <div className="mx-4 mt-4 h-14 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div
          className={cn(
            "mx-4 mt-4 flex items-center gap-3 rounded-lg border p-3",
            allGood
              ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          )}
        >
          {allGood ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium",
                allGood
                  ? "text-green-800 dark:text-green-300"
                  : "text-amber-800 dark:text-amber-300"
              )}
            >
              {allGood
                ? "Alt er i orden"
                : `${totalAttention} ${totalAttention === 1 ? "ting" : "ting"} trenger oppmerksomhet`}
            </p>
            {allGood && stats && (
              <p className="text-xs text-green-700/70 dark:text-green-400/70">
                {stats.totalClients} klienter, ingen forfalt frister
              </p>
            )}
          </div>
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 px-4 pt-4">
        {loadingStats ? (
          <>
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </>
        ) : stats ? (
          <>
            <MetricCard
              icon={Users}
              label="Klienter"
              value={stats.totalClients}
              sub={
                stats.activeReconciliations > 0
                  ? `${stats.activeReconciliations} trenger oppmerksomhet`
                  : "Alle avstemt"
              }
              subColor={
                stats.activeReconciliations > 0 ? "warning" : "ok"
              }
              onClick={() => onNavigate("klienter")}
            />
            <MetricCard
              icon={Scale}
              label="Uavstemte poster"
              value={stats.totalUnmatched}
              sub={
                stats.totalDifference !== 0
                  ? krFmt.format(Math.abs(stats.totalDifference))
                  : "Ingen differanse"
              }
              subColor={stats.totalUnmatched > 0 ? "warning" : "ok"}
            />
          </>
        ) : null}

        {loadingDeadlines ? (
          <>
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </>
        ) : deadlineSummary ? (
          <>
            <MetricCard
              icon={Calendar}
              label="Frister"
              value={deadlineSummary.total}
              sub={
                deadlineSummary.overdue > 0
                  ? `${deadlineSummary.overdue} forfalt`
                  : deadlineSummary.atRisk > 0
                    ? `${deadlineSummary.atRisk} i risiko`
                    : "Alt på sporet"
              }
              subColor={
                deadlineSummary.overdue > 0
                  ? "critical"
                  : deadlineSummary.atRisk > 0
                    ? "warning"
                    : "ok"
              }
              onClick={() => onNavigate("frister")}
            />
            <MetricCard
              icon={TrendingDown}
              label="Differanse"
              value={krFmt.format(Math.abs(stats?.totalDifference ?? 0))}
              sub={
                (stats?.totalDifference ?? 0) === 0
                  ? "Ingen avvik"
                  : "Totalt uavstemte beløp"
              }
              subColor={(stats?.totalDifference ?? 0) === 0 ? "ok" : "warning"}
              isAmount
            />
          </>
        ) : null}
      </div>

      {/* Attention list */}
      {!loadingDeadlines && !loadingClients && attentionItems.length > 0 && (
        <section className="px-4 pt-5 pb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Trenger oppmerksomhet
          </h3>
          <div className="space-y-1.5">
            {attentionItems.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  onNavigate(item.type === "deadline" ? "frister" : "klienter")
                }
                className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    item.severity === "critical"
                      ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      : item.severity === "warning"
                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                  )}
                >
                  {item.type === "deadline" ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : (
                    <Scale className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>

          {/* "See all" links */}
          <div className="mt-3 flex gap-2">
            {deadlines.some((d) => d.status === "overdue" || d.status === "at_risk") && (
              <button
                onClick={() => onNavigate("frister")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Se alle frister &rarr;
              </button>
            )}
            {clientsWithIssues.length > 0 && (
              <button
                onClick={() => onNavigate("klienter")}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Se alle klienter &rarr;
              </button>
            )}
          </div>
        </section>
      )}

      {/* All good state */}
      {!loadingDeadlines &&
        !loadingClients &&
        attentionItems.length === 0 &&
        stats && (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">Ingenting krever oppmerksomhet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Alle klienter er avstemt og alle frister er på sporet.
            </p>
          </div>
        )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  subColor,
  onClick,
  isAmount,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  sub: string;
  subColor: "ok" | "warning" | "critical";
  onClick?: () => void;
  isAmount?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 text-left transition-colors",
        onClick && "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "mt-1 font-bold",
          isAmount ? "text-base font-mono tabular-nums" : "text-xl tabular-nums"
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[11px]",
          subColor === "critical"
            ? "text-red-600 dark:text-red-400 font-medium"
            : subColor === "warning"
              ? "text-yellow-600 dark:text-yellow-400 font-medium"
              : "text-muted-foreground"
        )}
      >
        {sub}
      </p>
    </Comp>
  );
}
