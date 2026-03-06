"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Plus,
  CheckCircle2,
  Circle,
  Timer,
  Pause,
  Scale,
  Users,
  Bell,
  Flag,
  ListTodo,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OBLIGATION_ROUTE } from "@/lib/constants/navigation";
import type { CalendarEventData } from "./calendar-event-dialog";
import { toLocalDateStr } from "./calendar-client";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId?: string | null;
}

interface DeadlineEntry {
  id: string;
  title: string;
  obligation: string;
}

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

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];

interface DayPopoverProps {
  date: Date;
  deadlines: DeadlineEntry[];
  tasks: TaskItem[];
  events: CalendarEventData[];
  isToday: boolean;
  children: React.ReactNode;
  onAddTask: (date: string) => void;
  onAddEvent: (date: string, type: "meeting" | "reminder" | "custom_deadline") => void;
  onEditEvent: (event: CalendarEventData) => void;
  onDeleteEvent: (eventId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

export function DayPopover({
  date,
  deadlines,
  tasks,
  events,
  isToday,
  children,
  onAddTask,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onCompleteTask,
}: DayPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const dateStr = toLocalDateStr(date);
  const dayLabel = `${date.getDate()}. ${MONTHS_SHORT[date.getMonth()]}`;
  const hasContent = deadlines.length > 0 || tasks.length > 0 || events.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        side="right"
        sideOffset={4}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h3 className={cn(
            "text-sm font-semibold",
            isToday && "text-primary"
          )}>
            {dayLabel}
            {isToday && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(i dag)</span>}
          </h3>
        </div>

        {/* Content */}
        <div className="max-h-72 overflow-y-auto p-2 space-y-1.5">
          {/* Deadlines */}
          {deadlines.map((dl) => {
            const route = OBLIGATION_ROUTE[dl.obligation];
            const inner = (
              <>
                <Scale className="size-3 text-amber-600 shrink-0" />
                <span className="truncate font-medium text-amber-700 dark:text-amber-400 flex-1">{dl.title}</span>
                {route && (
                  <ArrowRight className="size-3 text-amber-600/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </>
            );
            const cls = cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 bg-amber-500/10 text-[11px] transition-colors",
              route && "cursor-pointer hover:bg-amber-500/20"
            );
            return route ? (
              <Link key={dl.id} href={route} className={cls} onClick={() => setOpen(false)}>
                {inner}
              </Link>
            ) : (
              <div key={dl.id} className={cls}>{inner}</div>
            );
          })}

          {/* Calendar events */}
          {events.map((ev) => {
            const Icon = EVENT_TYPE_ICON[ev.type as keyof typeof EVENT_TYPE_ICON] ?? Bell;
            const colorClass = ev.color ? EVENT_COLOR_CLASS[ev.color] ?? "bg-blue-500" : "bg-blue-500";
            const startTime = !ev.allDay
              ? new Date(ev.startAt).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })
              : null;

            return (
              <div
                key={ev.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer text-[11px] transition-colors"
                onClick={() => { onEditEvent(ev); setOpen(false); }}
              >
                <span className={cn("size-2 rounded-full shrink-0", colorClass)} />
                <Icon className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{ev.title}</span>
                {startTime && (
                  <span className="text-muted-foreground tabular-nums">{startTime}</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEvent(ev.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })}

          {/* Tasks */}
          {tasks.map((t) => {
            const isCompleted = t.status === "completed";
            const StatusIcon = isCompleted ? CheckCircle2 :
              t.status === "in_progress" ? Timer :
              t.status === "waiting" ? Pause : Circle;
            const statusColor = isCompleted ? "text-green-500" :
              t.status === "in_progress" ? "text-amber-500" :
              t.status === "waiting" ? "text-muted-foreground" : "text-blue-500";

            return (
              <div
                key={t.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 text-[11px] transition-colors"
              >
                <button
                  onClick={() => onCompleteTask(t.id)}
                  className="shrink-0"
                  title={isCompleted ? "Allerede fullført" : "Marker som fullført"}
                >
                  <StatusIcon className={cn("size-3.5", statusColor)} />
                </button>
                <span className={cn("size-1.5 rounded-full shrink-0", PRIORITY_COLOR[t.priority])} />
                <span className={cn("truncate flex-1", isCompleted && "line-through opacity-60")}>
                  {t.title}
                </span>
              </div>
            );
          })}

          {!hasContent && (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              Ingen hendelser denne dagen
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t p-2 grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { onAddTask(dateStr); setOpen(false); }}
          >
            <ListTodo className="size-3" />
            Oppgave
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { onAddEvent(dateStr, "meeting"); setOpen(false); }}
          >
            <Users className="size-3" />
            Møte
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { onAddEvent(dateStr, "reminder"); setOpen(false); }}
          >
            <Bell className="size-3" />
            Påminnelse
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => { onAddEvent(dateStr, "custom_deadline"); setOpen(false); }}
          >
            <Flag className="size-3" />
            Frist
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
