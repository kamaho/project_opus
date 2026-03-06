"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, ChevronRight, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useDashboardData, type DeadlineInstanceRow } from "../dashboard-data-provider";

const STATUS_COLORS: Record<string, { dot: string; text: string }> = {
  done: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  on_track: { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  at_risk: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  overdue: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  not_started: { dot: "bg-gray-400", text: "text-muted-foreground" },
};

const STATUS_LABELS: Record<string, string> = {
  done: "Ferdig",
  on_track: "På sporet",
  at_risk: "Risiko",
  overdue: "Forfalt",
  not_started: "Ikke startet",
};

interface TimeGroup {
  label: string;
  from: string;
  to: string;
  deadlines: DeadlineInstanceRow[];
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getTimeGroups(deadlines: DeadlineInstanceRow[]): TimeGroup[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const thisWeekEnd = new Date(monday);
  thisWeekEnd.setDate(monday.getDate() + 6);

  const nextWeekStart = new Date(thisWeekEnd);
  nextWeekStart.setDate(thisWeekEnd.getDate() + 1);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const fmt = toLocalDateStr;

  const restOfMonthStart = new Date(nextWeekEnd);
  restOfMonthStart.setDate(restOfMonthStart.getDate() + 1);

  const groups: TimeGroup[] = [
    { label: "Denne uken", from: fmt(monday), to: fmt(thisWeekEnd), deadlines: [] },
    { label: "Neste uke", from: fmt(nextWeekStart), to: fmt(nextWeekEnd), deadlines: [] },
    { label: "Resten av måneden", from: fmt(restOfMonthStart), to: fmt(monthEnd), deadlines: [] },
  ];

  for (const dl of deadlines) {
    const d = dl.dueDate.slice(0, 10);
    if (d >= groups[0].from && d <= groups[0].to) groups[0].deadlines.push(dl);
    else if (d >= groups[1].from && d <= groups[1].to) groups[1].deadlines.push(dl);
    else if (d > groups[1].to && d <= groups[2].to) groups[2].deadlines.push(dl);
  }

  return groups.filter((g) => g.deadlines.length > 0);
}

function GroupSection({ group }: { group: TimeGroup }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {group.label}
        </span>
        <Link
          href={`/dashboard/frister?from=${group.from}&to=${group.to}`}
          prefetch={false}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Se alle
        </Link>
      </div>
      <div className="space-y-0.5">
        {group.deadlines.slice(0, 5).map((dl) => {
          const colors = STATUS_COLORS[dl.status] ?? STATUS_COLORS.not_started;
          const dueDateStr = dl.dueDate.slice(0, 10);
          const dueDate = new Date(dueDateStr + "T00:00:00");
          const formattedDate = dueDate.toLocaleDateString("nb-NO", {
            day: "numeric",
            month: "short",
          });
          const { total, completed } = dl.taskSummary;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

          return (
            <Link
              key={dl.id}
              href={`/dashboard/frister/${dl.id}`}
              prefetch={false}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              <span className={cn("shrink-0 size-1.5 rounded-full", colors.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium truncate">
                    {dl.template.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {dl.company.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-px">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formattedDate}
                  </span>
                  {total > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            dl.status === "done"
                              ? "bg-emerald-500"
                              : dl.status === "overdue"
                                ? "bg-red-500"
                                : "bg-blue-500"
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {completed}/{total}
                      </span>
                    </div>
                  )}
                  <span className={cn("text-[10px]", colors.text)}>
                    {STATUS_LABELS[dl.status]}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          );
        })}
        {group.deadlines.length > 5 && (
          <Link
            href={`/dashboard/frister?from=${group.from}&to=${group.to}`}
            prefetch={false}
            className="block text-center text-[10px] text-muted-foreground hover:text-foreground py-1"
          >
            +{group.deadlines.length - 5} til
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DeadlineWidget() {
  const { deadlineInstances, deadlinesSummary, loading } = useDashboardData();

  const groups = useMemo(() => getTimeGroups(deadlineInstances), [deadlineInstances]);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasDeadlines = deadlineInstances.length > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Frister
            </CardTitle>
            {deadlinesSummary && deadlinesSummary.overdue > 0 && (
              <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                {deadlinesSummary.overdue} forfalt
              </span>
            )}
          </div>
          <Link
            href="/dashboard/frister"
            prefetch={false}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Se alle
          </Link>
        </div>
        {deadlinesSummary && hasDeadlines && (
          <div className="flex gap-3 mt-1">
            {deadlinesSummary.done > 0 && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                {deadlinesSummary.done} ferdig
              </span>
            )}
            {deadlinesSummary.onTrack > 0 && (
              <span className="text-[10px] text-blue-600 dark:text-blue-400 tabular-nums">
                {deadlinesSummary.onTrack} på sporet
              </span>
            )}
            {deadlinesSummary.atRisk > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 tabular-nums">
                {deadlinesSummary.atRisk} risiko
              </span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
        {!hasDeadlines ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="rounded-full bg-muted p-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Ingen kommende frister</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Frister genereres automatisk for dine klienter
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Ingen frister denne måneden
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {deadlineInstances.length} frist{deadlineInstances.length !== 1 ? "er" : ""} totalt i perioden
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <GroupSection key={g.label} group={g} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
