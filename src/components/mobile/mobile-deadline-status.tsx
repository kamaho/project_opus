"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Clock,
  Loader2,
  RefreshCw,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
}

interface DeadlineTemplate {
  name: string;
  slug: string;
  category: string;
  description: string | null;
}

interface DeadlineCompany {
  id: string;
  name: string;
  orgNumber: string | null;
}

interface DeadlineWithSummary {
  id: string;
  tenantId: string;
  templateId: string;
  companyId: string;
  dueDate: string;
  periodLabel: string;
  status: "not_started" | "on_track" | "at_risk" | "overdue" | "done";
  assigneeId: string | null;
  completedAt: string | null;
  template: DeadlineTemplate;
  company: DeadlineCompany;
  taskSummary: TaskSummary;
}

interface DeadlineSummary {
  total: number;
  done: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  notStarted: number;
}

interface DeadlineResponse {
  deadlines: DeadlineWithSummary[];
  summary: DeadlineSummary;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  done: {
    label: "Ferdig",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/50",
    border: "border-green-200 dark:border-green-900",
  },
  on_track: {
    label: "På sporet",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-900",
  },
  at_risk: {
    label: "Risiko",
    color: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/50",
    border: "border-yellow-200 dark:border-yellow-900",
  },
  overdue: {
    label: "Forfalt",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    border: "border-red-200 dark:border-red-900",
  },
  not_started: {
    label: "Ikke startet",
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-muted",
  },
};

const STATUS_PRIORITY: Record<string, number> = {
  overdue: 0,
  at_risk: 1,
  on_track: 2,
  not_started: 3,
  done: 4,
};

function worstStatus(deadlines: DeadlineWithSummary[]): number {
  return Math.min(...deadlines.map((d) => STATUS_PRIORITY[d.status] ?? 5));
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

export function MobileDeadlineStatus() {
  const [data, setData] = useState<DeadlineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      const to = new Date(now);
      to.setDate(to.getDate() + 90);

      const fromStr = from.toISOString().split("T")[0];
      const toStr = to.toISOString().split("T")[0];

      const res = await fetch(
        `/api/deadlines?from=${fromStr}&to=${toStr}`
      );
      if (res.ok) {
        const json: DeadlineResponse = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch deadlines:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="space-y-2 px-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.deadlines.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <h2 className="text-base font-semibold">Frister</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <Calendar className="mb-3 h-12 w-12" />
          <p className="text-sm">Ingen frister funnet</p>
        </div>
      </div>
    );
  }

  const { deadlines, summary } = data;

  const grouped = deadlines.reduce<Record<string, DeadlineWithSummary[]>>(
    (acc, d) => {
      const key = d.company.id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    },
    {}
  );

  const sortedCompanies = Object.entries(grouped).sort(
    ([, a], [, b]) => worstStatus(a) - worstStatus(b)
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Frister</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {summary.total} frister &middot;{" "}
            {summary.overdue > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {summary.overdue} forfalt
              </span>
            )}
            {summary.overdue > 0 && summary.atRisk > 0 && ", "}
            {summary.atRisk > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                {summary.atRisk} i risiko
              </span>
            )}
            {summary.overdue === 0 && summary.atRisk === 0 && (
              <span className="text-green-600 dark:text-green-400 font-medium">
                alt på sporet
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
        <SummaryCard
          count={summary.overdue}
          label="Forfalt"
          variant="red"
        />
        <SummaryCard
          count={summary.atRisk}
          label="Risiko"
          variant="yellow"
        />
        <SummaryCard
          count={summary.onTrack + summary.notStarted}
          label="På sporet"
          variant="blue"
        />
        <SummaryCard
          count={summary.done}
          label="Ferdig"
          variant="green"
        />
      </div>

      {/* Grouped by company */}
      <div className="flex-1 space-y-1 px-4 pb-4 pt-2">
        {sortedCompanies.map(([companyId, companyDeadlines]) => {
          const company = companyDeadlines[0].company;
          const isExpanded = expandedCompany === companyId || expandedCompany === null;
          const companyOverdue = companyDeadlines.filter(
            (d) => d.status === "overdue"
          ).length;
          const companyAtRisk = companyDeadlines.filter(
            (d) => d.status === "at_risk"
          ).length;

          return (
            <section key={companyId}>
              <button
                onClick={() =>
                  setExpandedCompany(
                    expandedCompany === companyId ? null : companyId
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/50 transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    !isExpanded && "-rotate-90"
                  )}
                />
                <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  {company.name}
                </span>
                {companyOverdue > 0 && (
                  <span className="text-[10px] font-medium text-red-600 dark:text-red-400 tabular-nums">
                    {companyOverdue} forfalt
                  </span>
                )}
                {companyAtRisk > 0 && (
                  <span className="text-[10px] font-medium text-yellow-600 dark:text-yellow-400 tabular-nums">
                    {companyAtRisk} risiko
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="space-y-2 pb-2">
                  {companyDeadlines
                    .sort(
                      (a, b) =>
                        (STATUS_PRIORITY[a.status] ?? 5) -
                        (STATUS_PRIORITY[b.status] ?? 5)
                    )
                    .map((d) => (
                      <DeadlineCard key={d.id} deadline={d} />
                    ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  count,
  label,
  variant,
}: {
  count: number;
  label: string;
  variant: "red" | "yellow" | "blue" | "green";
}) {
  const styles = {
    red: "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400",
    yellow:
      "border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400",
    blue: "border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400",
    green:
      "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-2 text-center",
        styles[variant]
      )}
    >
      <p className="text-lg font-bold tabular-nums">{count}</p>
      <p className="text-[9px] font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function DeadlineCard({ deadline: d }: { deadline: DeadlineWithSummary }) {
  const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.not_started;
  const days = daysUntil(d.dueDate);
  const progressPct =
    d.taskSummary.total > 0
      ? Math.round(
          (d.taskSummary.completed / d.taskSummary.total) * 100
        )
      : 0;

  return (
    <div className={cn("rounded-xl border p-3", cfg.border, cfg.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {d.template.name}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                cfg.color,
                d.status === "done"
                  ? "bg-green-100 dark:bg-green-900/50"
                  : d.status === "overdue"
                    ? "bg-red-100 dark:bg-red-900/50"
                    : d.status === "at_risk"
                      ? "bg-yellow-100 dark:bg-yellow-900/50"
                      : d.status === "on_track"
                        ? "bg-blue-100 dark:bg-blue-900/50"
                        : "bg-muted"
              )}
            >
              {cfg.label}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {dateFmt.format(new Date(d.dueDate + "T00:00:00"))}
            </span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                days < 0
                  ? "text-red-600 dark:text-red-400"
                  : days <= 3
                    ? "text-red-600 dark:text-red-400"
                    : days <= 7
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-muted-foreground"
              )}
            >
              {days < 0 ? (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {Math.abs(days)}d forfalt
                </span>
              ) : days === 0 ? (
                "I dag"
              ) : (
                `${days} dager igjen`
              )}
            </span>
            {d.periodLabel && (
              <span className="text-[10px] text-muted-foreground/70">
                {d.periodLabel}
              </span>
            )}
          </div>
        </div>

        {d.assigneeId && (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            title="Ansvarlig tildelt"
          >
            <User className="h-3 w-3" />
          </div>
        )}
      </div>

      {d.taskSummary.total > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background/50">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                d.status === "done"
                  ? "bg-green-500"
                  : d.status === "overdue"
                    ? "bg-red-500"
                    : d.status === "at_risk"
                      ? "bg-yellow-500"
                      : "bg-blue-500"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
            {d.taskSummary.completed}/{d.taskSummary.total} oppgaver
          </span>
        </div>
      )}
    </div>
  );
}
