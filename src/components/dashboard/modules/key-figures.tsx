"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import {
  Users,
  FileWarning,
  ListChecks,
  CalendarClock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useDashboardData } from "../dashboard-data-provider";

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  href,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  href: string;
  accent?: "red" | "amber" | "green";
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex flex-col gap-1.5 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-semibold tabular-nums leading-none tracking-tight">
        {value}
      </span>
      {sub && (
        <span
          className={cn(
            "text-[11px] leading-tight",
            accent === "red"
              ? "text-red-600 dark:text-red-400"
              : accent === "amber"
                ? "text-amber-600 dark:text-amber-400"
                : accent === "green"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
          )}
        >
          {sub}
        </span>
      )}
    </Link>
  );
}

export default function KeyFigures() {
  const { stats, tasks, deadlines, loading } = useDashboardData();
  const searchParams = useSearchParams();
  const cq = searchParams.get("companyId");
  const companyQuery = cq ? `companyId=${encodeURIComponent(cq)}` : "";

  const now = useMemo(() => new Date(), []);
  const monthPrefix = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    [now]
  );

  const taskStats = useMemo(() => {
    const open = tasks.filter((t) => t.status === "open").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
    ).length;
    return { open, inProgress, overdue };
  }, [tasks, now]);

  const deadlineInfo = useMemo(() => {
    const monthDls = deadlines
      .filter((d) => d.date?.startsWith(monthPrefix))
      .sort((a, b) => a.date.localeCompare(b.date));
    const thisMonth = monthDls.length;
    const overdue = deadlines.filter(
      (d) => typeof d.daysLeft === "number" && d.daysLeft < 0 && d.status !== "completed"
    ).length;
    const nearestDate = monthDls.length > 0 ? monthDls[0].date : null;
    return { thisMonth, overdue, nearestDate };
  }, [deadlines, monthPrefix]);

  if (loading) {
    return (
      <Card className="h-full p-4">
        <Skeleton className="h-4 w-16 mb-3" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </Card>
    );
  }

  const totalClients = stats?.totalClients ?? 0;
  const clientsWithIssues = stats?.activeReconciliations ?? 0;
  const totalUnmatched = stats?.totalUnmatched ?? 0;
  const openTasks = taskStats.open + taskStats.inProgress;
  const overdueTasks = taskStats.overdue;
  const deadlinesThisMonth = deadlineInfo.thisMonth;
  const overdueDeadlines = deadlineInfo.overdue;

  const appendCq = (base: string) => {
    if (!companyQuery) return base;
    return base.includes("?") ? `${base}&${companyQuery}` : `${base}?${companyQuery}`;
  };

  const calendarHref = deadlineInfo.nearestDate
    ? appendCq(`/dashboard/kalender?date=${deadlineInfo.nearestDate}`)
    : appendCq("/dashboard/kalender");

  return (
    <Card className="h-full p-4 flex flex-col">
      <p className="text-sm font-medium mb-3">Oversikt</p>
      <div className="grid grid-cols-2 gap-2 flex-1">
        <StatTile
          icon={Users}
          label="Klienter"
          value={totalClients}
          sub={
            clientsWithIssues > 0
              ? `${clientsWithIssues} med avvik`
              : totalClients > 0
                ? "Alle avstemt"
                : undefined
          }
          accent={clientsWithIssues > 0 ? "amber" : "green"}
          href={
            clientsWithIssues > 0
              ? appendCq("/dashboard/clients?filter=unmatched")
              : appendCq("/dashboard/clients")
          }
        />
        <StatTile
          icon={FileWarning}
          label="Uavstemte poster"
          value={totalUnmatched}
          sub={
            totalUnmatched > 0
              ? `på tvers av ${clientsWithIssues} klienter`
              : "Ingen avvik"
          }
          accent={totalUnmatched > 0 ? "red" : "green"}
          href={appendCq("/dashboard/clients?filter=unmatched")}
        />
        <StatTile
          icon={ListChecks}
          label="Åpne oppgaver"
          value={openTasks}
          sub={
            overdueTasks > 0
              ? `${overdueTasks} forfalt`
              : openTasks > 0
                ? "Ingen forfalt"
                : undefined
          }
          accent={overdueTasks > 0 ? "red" : undefined}
          href={appendCq("/dashboard/oppgaver?tab=all")}
        />
        <StatTile
          icon={CalendarClock}
          label="Frister denne mnd"
          value={deadlinesThisMonth}
          sub={
            overdueDeadlines > 0
              ? `${overdueDeadlines} forfalt`
              : deadlinesThisMonth > 0
                ? "Ingen forfalt"
                : undefined
          }
          accent={overdueDeadlines > 0 ? "red" : undefined}
          href={calendarHref}
        />
      </div>
    </Card>
  );
}
