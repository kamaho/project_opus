"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Users,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useDashboardData } from "../dashboard-data-provider";

type UrgencyLevel = "critical" | "warning" | "info";

const krFmt = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

interface AttentionItem {
  id: string;
  type: "overdue_deadline" | "low_match_client" | "overdue_task" | "upcoming_deadline";
  urgency: UrgencyLevel;
  title: string;
  subtitle: string;
  href: string;
  meta?: string;
}

const URGENCY_STYLES: Record<UrgencyLevel, { dot: string; bg: string; text: string }> = {
  critical: {
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-600 dark:text-red-400",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-600 dark:text-amber-400",
  },
  info: {
    dot: "bg-blue-500",
    bg: "",
    text: "text-blue-600 dark:text-blue-400",
  },
};

const TYPE_ICONS: Record<AttentionItem["type"], React.ElementType> = {
  overdue_deadline: CalendarClock,
  low_match_client: Users,
  overdue_task: ListChecks,
  upcoming_deadline: Clock,
};

const TYPE_LABELS: Record<AttentionItem["type"], string> = {
  overdue_deadline: "Forfalt frist",
  low_match_client: "Lav match",
  overdue_task: "Forfalt oppgave",
  upcoming_deadline: "Kommende frist",
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

export default function Deadlines() {
  const { reconciliation, deadlineInstances, tasks: taskData, loading } = useDashboardData();

  const items = useMemo<AttentionItem[]>(() => {
    const result: AttentionItem[] = [];
    const now = new Date();

    for (const d of deadlineInstances) {
      const days = daysUntil(d.dueDate);

      if (d.status === "overdue") {
        result.push({
          id: `deadline-overdue-${d.id}`,
          type: "overdue_deadline",
          urgency: "critical",
          title: `${d.template.name} — ${d.company.name}`,
          subtitle: `${Math.abs(days)} dager over frist`,
          href: `/dashboard/frister/${d.id}`,
          meta:
            d.taskSummary.total > 0
              ? `${d.taskSummary.completed}/${d.taskSummary.total} oppgaver`
              : undefined,
        });
      }
    }

    for (const c of reconciliation) {
      if (c.unmatchedCount > 0) {
        const amt = c.unmatchedAmount ?? 0;
        result.push({
          id: `recon-${c.clientId}`,
          type: "low_match_client",
          urgency: amt >= 100_000 ? "critical" : "warning",
          title: c.clientName,
          subtitle: `${krFmt.format(amt)} uavstemt — ${c.unmatchedCount} poster`,
          href: `/dashboard/clients/${c.clientId}`,
          meta: c.companyName,
        });
      }
    }

    for (const t of taskData) {
      if (t.dueDate && new Date(t.dueDate) < now && t.status !== "completed") {
        const daysPast = Math.ceil(
          (now.getTime() - new Date(t.dueDate).getTime()) / 86_400_000
        );
        result.push({
          id: `task-${t.id}`,
          type: "overdue_task",
          urgency: daysPast > 7 ? "critical" : "warning",
          title: t.title,
          subtitle: `${daysPast} dager forfalt`,
          href: "/dashboard/oppgaver?tab=all",
        });
      }
    }

    for (const d of deadlineInstances) {
      const days = daysUntil(d.dueDate);

      if (days >= 0 && days <= 7 && d.status !== "done") {
        result.push({
          id: `deadline-upcoming-${d.id}`,
          type: "upcoming_deadline",
          urgency: days <= 2 ? "warning" : "info",
          title: `${d.template.name} — ${d.company.name}`,
          subtitle:
            days === 0
              ? "I dag"
              : days === 1
                ? "I morgen"
                : `Om ${days} dager`,
          href: `/dashboard/frister/${d.id}`,
          meta:
            d.taskSummary.total > 0
              ? `${d.taskSummary.completed}/${d.taskSummary.total} oppgaver`
              : undefined,
        });
      }
    }

    const urgencyOrder: Record<UrgencyLevel, number> = { critical: 0, warning: 1, info: 2 };
    result.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return result;
  }, [reconciliation, deadlineInstances, taskData]);

  if (loading) {
    return (
      <Card className="h-full p-4">
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Krever oppmerksomhet</p>
          {items.length > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none",
                items.some((i) => i.urgency === "critical")
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              )}
            >
              {items.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Alt ser bra ut
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ingen avvik eller forfalt oppgaver
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              const styles = URGENCY_STYLES[item.urgency];

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors",
                    styles.bg || "hover:bg-muted/50"
                  )}
                >
                  <span className={cn("shrink-0 size-1.5 rounded-full", styles.dot)} />

                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{item.title}</span>
                      {item.meta && (
                        <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                          {item.meta}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-px">
                      <span className={cn("text-[10px]", styles.text)}>
                        {TYPE_LABELS[item.type]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
