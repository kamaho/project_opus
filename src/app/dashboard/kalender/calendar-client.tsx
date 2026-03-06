"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
  Users,
  Bell,
  Flag,
  Copy,
  Check,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { DayPopover } from "./day-popover";
import { CalendarEventDialog, type CalendarEventData } from "./calendar-event-dialog";
import { CreateTaskDialog } from "@/app/dashboard/oppgaver/create-task-dialog";

/** Format a Date as "YYYY-MM-DD" using local timezone (avoids toISOString UTC shift). */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse "YYYY-MM-DD" into components without going through Date (timezone-safe). */
function parseDateParts(str: string): { y: number; m: number; d: number } | null {
  const parts = str.split("-");
  if (parts.length < 3) return null;
  return { y: parseInt(parts[0], 10), m: parseInt(parts[1], 10) - 1, d: parseInt(parts[2], 10) };
}

interface DeadlineRule {
  type?: "fixed_annual" | "offset_after_period";
  day: number | null;
  month?: number;
  offset_months?: number;
  relative_to?: string;
  months_after?: number;
  [key: string]: unknown;
}

interface Deadline {
  id: string;
  title: string;
  obligation: string;
  description: string | null;
  frequency: string;
  deadlineRule: DeadlineRule;
  periodStartMonth?: number | null;
  periodEndMonth?: number | null;
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
  events: CalendarEventData[];
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

const EVENT_COLOR_CLASS: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
};

const EVENT_TYPE_ICON = {
  meeting: Users,
  reminder: Bell,
  custom_deadline: Flag,
} as const;

function resolveDeadlineDates(deadline: Deadline, year: number, month: number): Date[] {
  const rule = deadline.deadlineRule;
  const dates: Date[] = [];
  const day = rule.day ?? 28;

  if (rule.type === "fixed_annual") {
    if (rule.month === month + 1) {
      dates.push(new Date(year, month, day));
    }
    return dates;
  }

  if (rule.type === "offset_after_period") {
    const offset = rule.offset_months ?? 0;

    if (deadline.frequency === "annual") {
      const deadlineMonth = 11 + offset;
      if (deadlineMonth % 12 === month) {
        dates.push(new Date(year, month, day));
      }
    } else if (deadline.frequency === "monthly") {
      const sourceMonth = month - offset;
      if (sourceMonth >= 0 && sourceMonth < 12) {
        dates.push(new Date(year, month, day));
      }
    } else if (deadline.frequency === "bimonthly") {
      const startMonth = deadline.periodStartMonth ?? 1;
      for (let pStart = startMonth - 1; pStart < 12; pStart += 2) {
        const pEnd = pStart + 1;
        const deadlineMonth = pEnd + offset;
        if (deadlineMonth === month) {
          dates.push(new Date(year, month, day));
        }
      }
    } else if (deadline.frequency === "quarterly") {
      for (let q = 0; q < 4; q++) {
        const qEnd = (q + 1) * 3 - 1;
        const deadlineMonth = qEnd + offset;
        if (deadlineMonth === month) {
          dates.push(new Date(year, month, day));
        }
      }
    }
    return dates;
  }

  // Legacy format (no type field): fall back to old logic
  if (deadline.frequency === "yearly" || deadline.frequency === "annual") {
    if (rule.month !== undefined && rule.month === month + 1) {
      dates.push(new Date(year, month, day));
    }
  } else if (deadline.frequency === "monthly") {
    if (rule.relative_to === "period_end" && rule.months_after) {
      const sourceMonth = month - rule.months_after;
      if (sourceMonth >= 0 && sourceMonth < 12) {
        dates.push(new Date(year, month, day));
      }
    } else {
      dates.push(new Date(year, month, day));
    }
  } else if (deadline.frequency === "bimonthly") {
    const startMonth = deadline.periodStartMonth ?? 1;
    for (let pStart = startMonth - 1; pStart < 12; pStart += 2) {
      const pEnd = pStart + 1;
      let deadlineMonth = pEnd;
      if (rule.relative_to === "period_end" && rule.months_after) {
        deadlineMonth = pEnd + rule.months_after;
      }
      if (deadlineMonth === month) {
        dates.push(new Date(year, month, day));
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
        dates.push(new Date(year, month, day));
      }
    }
  }

  return dates;
}

export function CalendarClient({
  deadlines,
  tasks: initialTasks,
  calendarEvents: initialEvents = [],
  teamCapacity = [],
}: {
  deadlines: Deadline[];
  tasks: TaskItem[];
  calendarEvents?: CalendarEventData[];
  teamCapacity?: TeamMember[];
}) {
  const today = new Date();
  const searchParams = useSearchParams();
  const highlightDateParam = searchParams.get("date");

  const initialDate = useMemo(() => {
    if (highlightDateParam) {
      const d = new Date(highlightDateParam + "T00:00:00");
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }, [highlightDateParam]);

  const [year, setYear] = useState(initialDate?.getFullYear() ?? today.getFullYear());
  const [month, setMonth] = useState(initialDate?.getMonth() ?? today.getMonth());
  const [highlightDay, setHighlightDay] = useState<number | null>(initialDate?.getDate() ?? null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlightDay !== null) {
      highlightTimerRef.current = setTimeout(() => {
        setHighlightDay(null);
      }, 2400);
      return () => {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      };
    }
  }, [highlightDay]);

  const [tasks, setTasks] = useState(initialTasks);
  const [events, setEvents] = useState(initialEvents);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogDate, setEventDialogDate] = useState<string | undefined>();
  const [eventDialogType, setEventDialogType] = useState<"meeting" | "reminder" | "custom_deadline">("meeting");
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDialogDate, setTaskDialogDate] = useState("");
  const [icalCopied, setIcalCopied] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  const goToPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const goToNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToToday = () => { setMonth(today.getMonth()); setYear(today.getFullYear()); };

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar-events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: e.title as string,
          description: e.description as string | null,
          type: e.type as string,
          startAt: e.startAt as string,
          endAt: e.endAt as string | null,
          allDay: e.allDay as boolean,
          color: e.color as string | null,
          createdBy: e.createdBy as string,
          attendees: (e.attendees as string[]) ?? [],
          reminderMinutesBefore: e.reminderMinutesBefore as number | null,
        })));
      }
    } catch { /* silent */ }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?status=open,in_progress,waiting");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          title: t.title as string,
          status: t.status as string,
          priority: t.priority as string,
          dueDate: t.dueDate as string | null,
          assigneeId: t.assigneeId as string | null,
        })));
      }
    } catch { /* silent */ }
  }, []);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (res.ok) {
      toast.success("Oppgave fullført");
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } else {
      toast.error("Kunne ikke fullføre oppgaven");
    }
  }, []);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const res = await fetch(`/api/calendar-events/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Hendelse slettet");
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } else {
      toast.error("Kunne ikke slette hendelsen");
    }
  }, []);

  const handleAddTask = useCallback((date: string) => {
    setTaskDialogDate(date);
    setTaskDialogOpen(true);
  }, []);

  const handleAddEvent = useCallback((date: string, type: "meeting" | "reminder" | "custom_deadline") => {
    setEventDialogDate(date);
    setEventDialogType(type);
    setEditingEvent(null);
    setEventDialogOpen(true);
  }, []);

  const handleEditEvent = useCallback((event: CalendarEventData) => {
    setEditingEvent(event);
    setEventDialogOpen(true);
  }, []);

  const handleCopyIcal = useCallback(async () => {
    const url = `${window.location.origin}/api/calendar/ics`;
    await navigator.clipboard.writeText(url);
    setIcalCopied(true);
    toast.success("Lenke kopiert til utklippstavlen");
    setTimeout(() => setIcalCopied(false), 3000);
  }, []);

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
        const p = parseDateParts(t.dueDate);
        if (!p) return false;
        return p.y === year && p.m === month && p.d === d;
      });

      const dayEvents = events.filter((e) => {
        const p = parseDateParts(toLocalDateStr(new Date(e.startAt)));
        if (!p) return false;
        return p.y === year && p.m === month && p.d === d;
      });

      days.push({ date, deadlines: dayDeadlines, tasks: dayTasks, events: dayEvents });
    }

    return days;
  }, [year, month, deadlines, tasks, events]);

  const isTodayDate = (d: Date) =>
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

  const todayStr = toLocalDateStr(today);
  const overdueTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    return t.dueDate < todayStr;
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
          Planlegg oppgaver, møter, påminnelser og se lovpålagte frister.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px] flex-1 min-h-0">
        {/* Calendar grid */}
        <div className="rounded-lg border bg-card flex flex-col min-h-0">
          <div className="relative flex items-center border-b px-4 py-2.5 shrink-0">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 pointer-events-auto">
                <Button variant="ghost" size="icon" className="size-8" onClick={goToPrev}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Popover open={monthPickerOpen} onOpenChange={(open) => { setMonthPickerOpen(open); if (open) setPickerYear(year); }}>
                  <PopoverTrigger asChild>
                    <button className="text-base font-semibold w-40 text-center rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer">
                      {MONTHS_NO[month]} {year}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="center">
                    <div className="flex items-center justify-between mb-2">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setPickerYear((y) => y - 1)}>
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <span className="text-sm font-semibold">{pickerYear}</span>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setPickerYear((y) => y + 1)}>
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {MONTHS_NO.map((mName, mIdx) => {
                        const isSelected = mIdx === month && pickerYear === year;
                        const isCurrent = mIdx === today.getMonth() && pickerYear === today.getFullYear();
                        return (
                          <button
                            key={mIdx}
                            onClick={() => { setMonth(mIdx); setYear(pickerYear); setMonthPickerOpen(false); }}
                            className={cn(
                              "rounded-md px-2 py-1.5 text-xs transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : isCurrent
                                  ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
                                  : "hover:bg-muted text-foreground"
                            )}
                          >
                            {mName.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="size-8" onClick={goToNext}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={goToToday}>
                I dag
              </Button>
            </div>
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
            {calendarDays.map((entry, i) => {
              const isHighlighted = entry !== null && highlightDay !== null && entry.date.getDate() === highlightDay;
              return (
              <div
                key={i}
                className={cn(
                  "border-b border-r text-xs overflow-hidden",
                  !entry && "bg-muted/10",
                  entry && isTodayDate(entry.date) && "bg-primary/5",
                  i % 7 === 6 && "border-r-0",
                  isHighlighted && "calendar-cell-pulse"
                )}
              >
                {entry ? (
                  <DayPopover
                    date={entry.date}
                    deadlines={entry.deadlines}
                    tasks={entry.tasks}
                    events={entry.events}
                    isToday={isTodayDate(entry.date)}
                    onAddTask={handleAddTask}
                    onAddEvent={handleAddEvent}
                    onEditEvent={handleEditEvent}
                    onDeleteEvent={handleDeleteEvent}
                    onCompleteTask={handleCompleteTask}
                  >
                    <button className="w-full h-full p-1.5 text-left hover:bg-muted/40 transition-colors cursor-pointer">
                      <span className={cn(
                        "inline-flex items-center justify-center size-6 rounded-full text-[11px] font-medium mb-0.5",
                        isTodayDate(entry.date) && "bg-primary text-primary-foreground"
                      )}>
                        {entry.date.getDate()}
                      </span>
                      <div className="space-y-0.5 overflow-hidden">
                        {entry.deadlines.map((dl) => (
                          <div
                            key={dl.id}
                            className={cn(
                              "flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate transition-colors",
                              isPast(entry.date)
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                            )}
                          >
                            <Scale className="size-2.5 shrink-0" />
                            <span className="truncate">{dl.title}</span>
                          </div>
                        ))}
                        {entry.events.map((ev) => {
                          const Icon = EVENT_TYPE_ICON[ev.type as keyof typeof EVENT_TYPE_ICON] ?? Bell;
                          const colorClass = ev.color ? EVENT_COLOR_CLASS[ev.color] ?? "bg-blue-500" : "bg-blue-500";
                          return (
                            <div
                              key={ev.id}
                              className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] truncate bg-muted/50"
                            >
                              <span className={cn("size-1.5 rounded-full shrink-0", colorClass)} />
                              <Icon className="size-2.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}
                        {entry.tasks.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] truncate bg-muted/50"
                          >
                            <span className={cn("size-1.5 rounded-full shrink-0", PRIORITY_COLOR[t.priority])} />
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                  </DayPopover>
                ) : (
                  <div className="w-full h-full p-1.5" />
                )}
              </div>
              );
            })}
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
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 text-[11px] text-red-600/80 dark:text-red-400/80"
                >
                  <button
                    onClick={() => handleCompleteTask(t.id)}
                    className="shrink-0 hover:text-green-500 transition-colors"
                    title="Marker som fullført"
                  >
                    <Circle className="size-3" />
                  </button>
                  <span className="truncate">{t.title}</span>
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
                <Users className="size-3 text-purple-500" />
                <span>Møte</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="size-3 text-blue-500" />
                <span>Påminnelse</span>
              </div>
              <div className="flex items-center gap-2">
                <Flag className="size-3 text-green-500" />
                <span>Intern frist</span>
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
                  const ini = `${(m.firstName ?? "")[0] ?? ""}${(m.lastName ?? "")[0] ?? ""}`.toUpperCase() || "?";
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
                            <AvatarFallback className="text-[9px]">{ini}</AvatarFallback>
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
                              const isTaskOverdue = t.dueDate && t.dueDate < todayStr;
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
                                        {parseDateParts(t.dueDate)?.d ?? ""}. {MONTHS_NO[parseDateParts(t.dueDate)?.m ?? 0].slice(0, 3).toLowerCase()}
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

          {/* iCal subscription */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Link2 className="size-3" />
              Kalender-abonnement
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Abonner på Revizo-kalenderen i Outlook, Google Calendar eller Apple Calendar.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1.5"
              onClick={handleCopyIcal}
            >
              {icalCopied ? (
                <>
                  <Check className="size-3 text-green-500" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  Kopier abonnementslenke
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Lim inn lenken i din kalenderapp under &quot;Abonner på kalender&quot; / &quot;Subscribe to calendar&quot;.
            </p>
          </div>
        </div>
      </div>

      {/* Event dialog */}
      <CalendarEventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        defaultDate={eventDialogDate}
        defaultType={eventDialogType}
        editingEvent={editingEvent}
        onSaved={refreshEvents}
      />

      {/* Task creation dialog (reusing existing) */}
      <CreateTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        companies={[]}
        clients={[]}
        editingTask={null}
        defaultDueDate={taskDialogDate}
        onSaved={refreshTasks}
      />
    </div>
  );
}
