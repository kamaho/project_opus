"use client";

import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Timer,
  Pause,
  AlertCircle,
  Scale,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Deadline {
  id: string;
  title: string;
  obligation: string;
  description: string | null;
  frequency: string;
  deadlineRule: { day: number; month?: number; relative_to?: string; months_after?: number };
  periodStartMonth: number | null;
  periodEndMonth: number | null;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId?: string | null;
}

interface DayEntry {
  date: Date;
  deadlines: { id: string; title: string; obligation: string }[];
  tasks: TaskItem[];
}

interface TeamMember {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  open: number;
  inProgress: number;
  overdue: number;
}

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTHS_NO = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-muted-foreground/40",
};

function resolveDeadlineDates(deadline: Deadline, year: number, month: number): Date[] {
  const rule = deadline.deadlineRule;
  const dates: Date[] = [];

  if (deadline.frequency === "yearly") {
    if (rule.month !== undefined && rule.month === month + 1) {
      dates.push(new Date(year, month, rule.day));
    }
  } else if (deadline.frequency === "monthly") {
    if (rule.relative_to === "period_end" && rule.months_after) {
      const deadlineMonth = month + rule.months_after;
      if (deadlineMonth >= 12) return dates;
      const d = new Date(year, month + rule.months_after, rule.day);
      if (d.getMonth() === month) dates.push(d);
    } else {
      dates.push(new Date(year, month, rule.day));
    }
  } else if (deadline.frequency === "bimonthly") {
    const startMonth = deadline.periodStartMonth ?? 1;
    const periodLength = 2;
    for (let pStart = startMonth - 1; pStart < 12; pStart += periodLength) {
      const pEnd = pStart + periodLength - 1;
      let deadlineMonth = pEnd;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = pEnd + rule.months_after;
      }
      if (deadlineMonth === month) {
        dates.push(new Date(year, month, rule.day));
      }
    }
  } else if (deadline.frequency === "quarterly") {
    for (let q = 0; q < 4; q++) {
      const qEnd = (q + 1) * 3 - 1;
      let deadlineMonth = qEnd;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = qEnd + rule.months_after;
      }
      if (deadlineMonth === month) {
        dates.push(new Date(year, month, rule.day));
      }
    }
  }

  return dates;
}

export function CalendarClient({
  deadlines,
  tasks,
  teamCapacity = [],
}: {
  deadlines: Deadline[];
  tasks: TaskItem[];
  teamCapacity?: TeamMember[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (DayEntry | null)[] = [];

    for (let i = 0; i < startOffset; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dayDeadlines: DayEntry["deadlines"] = [];

      for (const dl of deadlines) {
        const dlDates = resolveDeadlineDates(dl, year, month);
        for (const dlDate of dlDates) {
          if (dlDate.getDate() === d) {
            dayDeadlines.push({ id: dl.id, title: dl.title, obligation: dl.obligation });
          }
        }
      }

      const dayTasks = tasks.filter((t) => {
        if (!t.dueDate) return false;
        const td = new Date(t.dueDate);
        return td.getFullYear() === year && td.getMonth() === month && td.getDate() === d;
      });

      days.push({ date, deadlines: dayDeadlines, tasks: dayTasks });
    }

    return days;
  }, [year, month, deadlines, tasks]);

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const isPast = (d: Date) => {
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < todayDate;
  };

  const upcomingDeadlines = useMemo(() => {
    const upcoming: { title: string; date: Date }[] = [];
    for (const dl of deadlines) {
      for (let m = month; m <= Math.min(month + 2, 11); m++) {
        const dates = resolveDeadlineDates(dl, year, m);
        for (const d of dates) {
          if (d >= today) upcoming.push({ title: dl.title, date: d });
        }
      }
    }
    upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcoming.slice(0, 8);
  }, [deadlines, year, month, today]);

  const overdueTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < todayDate;
  });

  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const weekCount = Math.ceil(calendarDays.length / 7);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Kalender</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Oversikt over lovpålagte frister og oppgavefrister.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px] flex-1 min-h-0">
        {/* Calendar grid */}
        <div className="rounded-lg border bg-card flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="size-8" onClick={goToPrev}>
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="text-base font-semibold w-40 text-center">
                {MONTHS_NO[month]} {year}
              </h2>
              <Button variant="ghost" size="icon" className="size-8" onClick={goToNext}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              I dag
            </Button>
          </div>
          <div className="grid grid-cols-7 shrink-0">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                {wd}
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-7 flex-1 min-h-0"
            style={{ gridTemplateRows: `repeat(${weekCount}, 1fr)` }}
          >
            {calendarDays.map((entry, i) => (
              <div
                key={i}
                className={cn(
                  "border-b border-r p-1.5 text-xs overflow-hidden",
                  !entry && "bg-muted/10",
                  entry && isToday(entry.date) && "bg-primary/5",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                {entry && (
                  <>
                    <span className={cn(
                      "inline-flex items-center justify-center size-6 rounded-full text-[11px] font-medium mb-0.5",
                      isToday(entry.date) && "bg-primary text-primary-foreground"
                    )}>
                      {entry.date.getDate()}
                    </span>
                    <div className="space-y-0.5 overflow-hidden">
                      {entry.deadlines.map((dl) => (
                        <div
                          key={dl.id}
                          className={cn(
                            "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate",
                            isPast(entry.date)
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          )}
                          title={dl.title}
                        >
                          <Scale className="size-2.5 shrink-0" />
                          <span className="truncate">{dl.title}</span>
                        </div>
                      ))}
                      {entry.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] truncate bg-muted/50"
                          title={t.title}
                        >
                          <span className={cn("size-1.5 rounded-full shrink-0", PRIORITY_COLOR[t.priority])} />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 overflow-y-auto">
          {overdueTasks.length > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="size-3.5" />
                {overdueTasks.length} forfalte oppgaver
              </div>
              {overdueTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="text-[11px] text-red-600/80 dark:text-red-400/80 truncate">
                  {t.title}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border bg-card p-3 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground">Kommende frister</h3>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Ingen frister de neste 3 månedene.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((dl, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <Scale className="size-3 text-amber-500 shrink-0" />
                      <span className="truncate">{dl.title}</span>
                    </span>
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap ml-2">
                      {dl.date.getDate()}. {MONTHS_NO[dl.date.getMonth()].slice(0, 3).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-3 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground">Fargekoder</h3>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <Scale className="size-3 text-amber-500" />
                <span>Lovpålagt frist</span>
              </div>
              <div className="flex items-center gap-2">
                <Scale className="size-3 text-red-500" />
                <span>Forfalt lovpålagt frist</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-red-500" />
                <span>Kritisk oppgave</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-orange-500" />
                <span>Høy prioritet</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-blue-500" />
                <span>Medium prioritet</span>
              </div>
            </div>
          </div>

          {teamCapacity.length > 0 && (
            <div className="rounded-lg border bg-card p-3 space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">Teamkapasitet</h3>
              <div className="space-y-1">
                {teamCapacity.map((m) => {
                  const totalActive = m.open + m.inProgress;
                  const capacityPct = Math.min(100, (totalActive / Math.max(1, totalActive + 3)) * 100);
                  const initials = `${(m.firstName ?? "")[0] ?? ""}${(m.lastName ?? "")[0] ?? ""}`.toUpperCase() || "?";
                  const fullName = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Ukjent";
                  const isExpanded = expandedMemberId === m.userId;
                  const memberTasks = tasks.filter((t) => t.assigneeId === m.userId);

                  return (
                    <div key={m.userId}>
                      <button
                        type="button"
                        onClick={() => setExpandedMemberId(isExpanded ? null : m.userId)}
                        className="w-full text-left rounded-md px-1.5 py-1.5 -mx-1.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5 shrink-0">
                            {m.imageUrl && <AvatarImage src={m.imageUrl} alt={fullName} />}
                            <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] font-medium truncate flex-1">{fullName}</span>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{totalActive}</span>
                          <ChevronDown className={cn(
                            "size-3 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                capacityPct > 80 ? "bg-red-500" :
                                capacityPct > 50 ? "bg-amber-500" :
                                "bg-green-500"
                              )}
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                          {m.overdue > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-red-500 font-medium tabular-nums">
                              <AlertCircle className="size-2.5" />
                              {m.overdue}
                            </span>
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="ml-7 mt-1 mb-2 space-y-1">
                          {memberTasks.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground py-1">Ingen tildelte oppgaver.</p>
                          ) : (
                            memberTasks.map((t) => {
                              const isTaskOverdue = t.dueDate && new Date(t.dueDate) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                              const statusIcon = t.status === "in_progress"
                                ? <Timer className="size-2.5 text-amber-500 shrink-0" />
                                : t.status === "waiting"
                                ? <Pause className="size-2.5 text-muted-foreground shrink-0" />
                                : <Circle className="size-2.5 text-blue-500 shrink-0" />;

                              return (
                                <div
                                  key={t.id}
                                  className={cn(
                                    "flex items-start gap-1.5 rounded px-1.5 py-1 text-[10px]",
                                    isTaskOverdue ? "bg-red-500/5" : "bg-muted/30"
                                  )}
                                >
                                  <span className="mt-0.5">{statusIcon}</span>
                                  <div className="flex-1 min-w-0">
                                    <span className="block truncate">{t.title}</span>
                                    {t.dueDate && (
                                      <span className={cn(
                                        "tabular-nums",
                                        isTaskOverdue ? "text-red-500" : "text-muted-foreground"
                                      )}>
                                        {new Date(t.dueDate).getDate()}. {MONTHS_NO[new Date(t.dueDate).getMonth()].slice(0, 3).toLowerCase()}
                                      </span>
                                    )}
                                  </div>
                                  <span className={cn("size-1.5 rounded-full shrink-0 mt-1", PRIORITY_COLOR[t.priority])} />
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
