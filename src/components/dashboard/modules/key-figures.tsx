"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Bell,
  Users,
  Flag,
  ArrowUpDown,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NavArrowButton } from "@/components/ui/nav-arrow-button";
import type { ModuleProps } from "../types";
import Link from "next/link";

interface UpcomingEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  type: "task" | "deadline" | "meeting" | "reminder" | "custom_deadline";
  priority?: "low" | "medium" | "high" | "critical";
  status?: string;
  category?: string;
  assigneeId?: string | null;
  assigneeName?: string;
  attendees?: string[];
  createdBy?: string;
  companyName?: string;
  clientName?: string;
  daysLeft: number;
  deadlineStatus?: "completed" | "in_progress" | "overdue" | "not_started" | "no_tasks";
  taskProgress?: { completed: number; total: number };
}

type SortMode = "days" | "critical";
type FilterMode = "all" | "mine";

const TYPE_ICONS: Record<string, typeof Calendar> = {
  task: CheckCircle2,
  deadline: Calendar,
  meeting: Users,
  reminder: Bell,
  custom_deadline: Flag,
};

const TYPE_LABELS: Record<string, string> = {
  task: "Oppgave",
  deadline: "Frist",
  meeting: "Møte",
  reminder: "Påminnelse",
  custom_deadline: "Egendefinert frist",
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function daysUntil(dateStr: string) {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

function getUrgencyColor(days: number) {
  if (days < 0) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (days === 0) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
  if (days <= 3) return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
  if (days <= 7) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
  return "bg-muted text-muted-foreground";
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritisk",
  high: "Høy",
  medium: "Medium",
  low: "Lav",
};

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
});

const dateTimeFmt = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const NORWEGIAN_DEADLINES = [
  { id: "mva-1", title: "MVA-melding 1. termin", date: "2026-04-10" },
  { id: "mva-2", title: "MVA-melding 2. termin", date: "2026-06-10" },
  { id: "mva-3", title: "MVA-melding 3. termin", date: "2026-08-31" },
  { id: "mva-4", title: "MVA-melding 4. termin", date: "2026-10-10" },
  { id: "mva-5", title: "MVA-melding 5. termin", date: "2026-12-10" },
  { id: "mva-6", title: "MVA-melding 6. termin", date: "2027-02-10" },
  { id: "aksjonaer", title: "Aksjonærregisteroppgaven", date: "2026-01-31" },
  { id: "arsregnskap", title: "Årsregnskap til Brønnøysund", date: "2026-07-31" },
  { id: "skattemelding-as", title: "Skattemelding AS", date: "2026-05-31" },
  { id: "a-melding", title: "A-melding", date: "2026-03-05" },
];

const MAX_VISIBLE = 8;

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function KeyFigures({ tenantId }: ModuleProps) {
  const { userId: currentUserId } = useAuth();

  const [tasks, setTasks] = useState<UpcomingEvent[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<UpcomingEvent[]>([]);
  const [deadlineStatusMap, setDeadlineStatusMap] = useState<
    Map<string, { status: string; completed: number; total: number }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("days");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);

  useEffect(() => {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + 60);
    const from = now.toISOString();
    const to = horizon.toISOString();

    const taskFetch = fetch("/api/tasks?status=open,in_progress,waiting")
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          rows: Array<{
            id: string;
            title: string;
            description?: string;
            dueDate?: string;
            priority?: string;
            status?: string;
            category?: string;
            assigneeId?: string | null;
            companyName?: string;
            clientName?: string;
          }>
        ) =>
          rows
            .filter((t) => t.dueDate)
            .map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              date: t.dueDate!,
              type: "task" as const,
              priority: t.priority as UpcomingEvent["priority"],
              status: t.status,
              category: t.category,
              assigneeId: t.assigneeId,
              companyName: t.companyName,
              clientName: t.clientName,
              daysLeft: daysUntil(t.dueDate!),
            }))
      )
      .catch(() => [] as UpcomingEvent[]);

    const calFetch = fetch(`/api/calendar-events?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          rows: Array<{
            id: string;
            title: string;
            description?: string;
            startAt: string;
            endAt?: string;
            type: string;
            createdBy: string;
            attendees?: string[];
          }>
        ) =>
          rows.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            date: e.startAt,
            endDate: e.endAt,
            type: e.type as UpcomingEvent["type"],
            createdBy: e.createdBy,
            attendees: e.attendees ?? [],
            assigneeId: e.createdBy,
            daysLeft: daysUntil(e.startAt),
          }))
      )
      .catch(() => [] as UpcomingEvent[]);

    const deadlineStatusFetch = fetch("/api/dashboard/deadline-status")
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (
          rows: Array<{
            deadlineId: string;
            status: string;
            taskSummary: { completed: number; total: number };
          }>
        ) => {
          const map = new Map<string, { status: string; completed: number; total: number }>();
          for (const r of rows) {
            map.set(r.deadlineId, {
              status: r.status,
              completed: r.taskSummary.completed,
              total: r.taskSummary.total,
            });
          }
          return map;
        }
      )
      .catch(() => new Map<string, { status: string; completed: number; total: number }>());

    Promise.all([taskFetch, calFetch, deadlineStatusFetch]).then(([t, c, dsMap]) => {
      setTasks(t);
      setCalendarEvents(c);
      setDeadlineStatusMap(dsMap);
      setLoading(false);
    });
  }, [tenantId]);

  const allEvents = useMemo(() => {
    const deadlineEvents: UpcomingEvent[] = NORWEGIAN_DEADLINES.map((d) => {
      const ds = deadlineStatusMap.get(d.id);
      return {
        id: d.id,
        title: d.title,
        description: "Lovpålagt frist",
        date: d.date,
        type: "deadline" as const,
        priority: "high" as const,
        daysLeft: daysUntil(d.date),
        deadlineStatus: ds?.status as UpcomingEvent["deadlineStatus"],
        taskProgress: ds ? { completed: ds.completed, total: ds.total } : undefined,
      };
    });

    let all = [...tasks, ...calendarEvents, ...deadlineEvents].filter(
      (e) => e.daysLeft >= -1
    );

    if (filterMode === "mine" && currentUserId) {
      all = all.filter((e) => {
        if (e.assigneeId === currentUserId) return true;
        if (e.createdBy === currentUserId) return true;
        if (e.attendees?.includes(currentUserId)) return true;
        if (e.type === "deadline") return true;
        return false;
      });
    }

    if (sortMode === "critical") {
      return all.sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority ?? "medium"] ?? 2;
        const pb = PRIORITY_ORDER[b.priority ?? "medium"] ?? 2;
        if (pa !== pb) return pa - pb;
        return a.daysLeft - b.daysLeft;
      });
    }

    return all.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tasks, calendarEvents, deadlineStatusMap, sortMode, filterMode, currentUserId]);

  const visible = allEvents.slice(0, MAX_VISIBLE);

  const handleEventClick = useCallback((ev: UpcomingEvent) => {
    setSelectedEvent(ev);
  }, []);

  if (loading) {
    return (
      <Card className="p-5">
        <p className="text-sm font-medium mb-4">Kommende hendelser</p>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">
            Kommende hendelser
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setSortMode((m) => (m === "days" ? "critical" : "days"))
              }
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortMode === "days" ? "Dager" : "Kritisk"}
            </button>
            <div className="flex items-center rounded-md border text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-1 rounded-l-md transition-colors ${
                  filterMode === "all"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Alle
              </button>
              <button
                onClick={() => setFilterMode("mine")}
                className={`px-2 py-1 rounded-r-md transition-colors ${
                  filterMode === "mine"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mine
              </button>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <Calendar className="h-10 w-10" />
            <p className="text-sm">Ingen kommende hendelser</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {visible.map((ev) => {
              const Icon = TYPE_ICONS[ev.type] ?? Calendar;
              const hasAssignee = ev.assigneeId || (ev.attendees && ev.attendees.length > 0);
              return (
                <li
                  key={`${ev.type}-${ev.id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group cursor-pointer"
                  onClick={() => handleEventClick(ev)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{ev.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {TYPE_LABELS[ev.type]}
                      </span>
                      {ev.priority && ev.priority !== "low" && (
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-4 ${getPriorityColor(ev.priority)}`}
                        >
                          {PRIORITY_LABELS[ev.priority] ?? ev.priority}
                        </Badge>
                      )}
                      {ev.deadlineStatus && ev.deadlineStatus !== "no_tasks" && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0 h-4 rounded-full",
                            ev.deadlineStatus === "completed" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
                            ev.deadlineStatus === "in_progress" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                            ev.deadlineStatus === "overdue" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
                            ev.deadlineStatus === "not_started" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
                          )}
                        >
                          {ev.deadlineStatus === "completed" && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {ev.deadlineStatus === "overdue" && <AlertTriangle className="h-2.5 w-2.5" />}
                          {ev.taskProgress && (
                            <span className="tabular-nums">{ev.taskProgress.completed}/{ev.taskProgress.total}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {hasAssignee && (
                    <div className="flex -space-x-1.5 shrink-0">
                      {ev.attendees && ev.attendees.length > 0 ? (
                        ev.attendees.slice(0, 3).map((uid, i) => (
                          <Avatar key={uid} className="h-5 w-5 border-2 border-background">
                            <AvatarFallback className="text-[9px] bg-muted">
                              {String.fromCharCode(65 + i)}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : ev.assigneeId ? (
                        <Avatar className="h-5 w-5 border-2 border-background">
                          <AvatarFallback className="text-[9px] bg-muted">
                            {initials(ev.assigneeName)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {dateFmt.format(new Date(ev.date))}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap ${getUrgencyColor(ev.daysLeft)}`}
                    >
                      {ev.daysLeft < 0 ? (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {Math.abs(ev.daysLeft)}d siden
                        </span>
                      ) : ev.daysLeft === 0 ? (
                        <span className="flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" />
                          I dag
                        </span>
                      ) : (
                        `${ev.daysLeft}d`
                      )}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/kalender?date=${ev.date.split("T")[0]}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  >
                    <NavArrowButton />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-auto pt-3 flex items-center justify-center">
          <Link
            href="/dashboard/kalender"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {allEvents.length > MAX_VISIBLE
              ? `Vis alle ${allEvents.length} hendelser`
              : "Vis kalender"}
            <NavArrowButton className="scale-75" />
          </Link>
        </div>
      </Card>

      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      >
        {selectedEvent && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = TYPE_ICONS[selectedEvent.type] ?? Calendar;
                  return <Icon className="h-5 w-5 text-muted-foreground" />;
                })()}
                <DialogTitle className="text-base">{selectedEvent.title}</DialogTitle>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[selectedEvent.type]}
                </Badge>
                {selectedEvent.priority && selectedEvent.priority !== "low" && (
                  <Badge
                    variant="secondary"
                    className={`text-xs ${getPriorityColor(selectedEvent.priority)}`}
                  >
                    {PRIORITY_LABELS[selectedEvent.priority]}
                  </Badge>
                )}
                {selectedEvent.status && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {selectedEvent.status === "open"
                      ? "Åpen"
                      : selectedEvent.status === "in_progress"
                        ? "Pågår"
                        : selectedEvent.status === "waiting"
                          ? "Venter"
                          : selectedEvent.status}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Dato</p>
                  <p className="tabular-nums">
                    {dateTimeFmt.format(new Date(selectedEvent.date))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">
                    Dager igjen
                  </p>
                  <p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getUrgencyColor(selectedEvent.daysLeft)}`}
                    >
                      {selectedEvent.daysLeft < 0
                        ? `${Math.abs(selectedEvent.daysLeft)} dager siden`
                        : selectedEvent.daysLeft === 0
                          ? "I dag"
                          : `${selectedEvent.daysLeft} dager`}
                    </span>
                  </p>
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Beskrivelse
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedEvent.description}
                  </p>
                </div>
              )}

              {(selectedEvent.companyName || selectedEvent.clientName) && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedEvent.companyName && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">
                        Selskap
                      </p>
                      <p>{selectedEvent.companyName}</p>
                    </div>
                  )}
                  {selectedEvent.clientName && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">
                        Klient
                      </p>
                      <p>{selectedEvent.clientName}</p>
                    </div>
                  )}
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Deltakere
                  </p>
                  <div className="flex -space-x-2">
                    {selectedEvent.attendees.map((uid, i) => (
                      <Avatar key={uid} className="h-7 w-7 border-2 border-background">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {String.fromCharCode(65 + i)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Link
                  href={`/dashboard/kalender?date=${selectedEvent.date.split("T")[0]}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSelectedEvent(null)}
                >
                  Gå til kalender
                  <NavArrowButton className="scale-90" />
                </Link>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
