"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization, useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Bell, Flag, Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toLocalDateStr } from "./calendar-client";

export interface CalendarEventData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  color: string | null;
  createdBy: string;
  attendees: string[];
  reminderMinutesBefore: number | null;
}

interface OrgMember {
  id: string;
  name: string;
  imageUrl?: string;
}

const EVENT_COLORS = [
  { value: "blue", label: "Blå", className: "bg-blue-500" },
  { value: "green", label: "Grønn", className: "bg-green-500" },
  { value: "purple", label: "Lilla", className: "bg-purple-500" },
  { value: "orange", label: "Oransje", className: "bg-orange-500" },
  { value: "red", label: "Rød", className: "bg-red-500" },
  { value: "pink", label: "Rosa", className: "bg-pink-500" },
];

const TYPE_CONFIG = {
  meeting: { label: "Møte", icon: Users, defaultColor: "purple" },
  reminder: { label: "Påminnelse", icon: Bell, defaultColor: "blue" },
  custom_deadline: { label: "Intern frist", icon: Flag, defaultColor: "green" },
} as const;

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

interface CalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  editingEvent?: CalendarEventData | null;
  defaultType?: "meeting" | "reminder" | "custom_deadline";
  onSaved: () => void;
}

export function CalendarEventDialog({
  open,
  onOpenChange,
  defaultDate,
  editingEvent,
  defaultType = "meeting",
  onSaved,
}: CalendarEventDialogProps) {
  const isEditing = !!editingEvent;
  const { user } = useUser();
  const { memberships } = useOrganization({ memberships: { pageSize: 50 } });

  const [type, setType] = useState<"meeting" | "reminder" | "custom_deadline">(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<string>("15");
  const [saving, setSaving] = useState(false);

  const members: OrgMember[] = (memberships?.data ?? []).map((m) => {
    const pub = m.publicUserData;
    return {
      id: pub?.userId ?? "",
      name: [pub?.firstName, pub?.lastName].filter(Boolean).join(" ") || "Ukjent",
      imageUrl: pub?.imageUrl ?? undefined,
    };
  });

  useEffect(() => {
    if (!open) return;

    if (editingEvent) {
      setType(editingEvent.type as "meeting" | "reminder" | "custom_deadline");
      setTitle(editingEvent.title);
      setDescription(editingEvent.description ?? "");
      const start = new Date(editingEvent.startAt);
      setDate(toLocalDateStr(start));
      setStartTime(start.toTimeString().slice(0, 5));
      if (editingEvent.endAt) {
        setEndTime(new Date(editingEvent.endAt).toTimeString().slice(0, 5));
      }
      setAllDay(editingEvent.allDay);
      setColor(editingEvent.color ?? "");
      setAttendees(editingEvent.attendees ?? []);
      setReminderMinutes(editingEvent.reminderMinutesBefore?.toString() ?? "15");
    } else {
      setType(defaultType);
      setTitle("");
      setDescription("");
      setDate(defaultDate ?? toLocalDateStr(new Date()));
      setStartTime("09:00");
      setEndTime("10:00");
      setAllDay(defaultType !== "meeting");
      setColor(TYPE_CONFIG[defaultType].defaultColor);
      setAttendees([]);
      setReminderMinutes("15");
    }
    setSaving(false);
  }, [open, editingEvent, defaultDate, defaultType]);

  const toggleAttendee = (userId: string) => {
    setAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);

    const startAt = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${startTime}:00`).toISOString();

    const endAt = type === "meeting" && !allDay
      ? new Date(`${date}T${endTime}:00`).toISOString()
      : undefined;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      startAt,
      endAt,
      allDay: allDay || type !== "meeting",
      color: color || undefined,
      attendees: type === "meeting" ? attendees : [],
      reminderMinutesBefore: type === "reminder" ? parseInt(reminderMinutes) || 15 : undefined,
    };

    try {
      const url = isEditing ? `/api/calendar-events/${editingEvent!.id}` : "/api/calendar-events";
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Feil ved lagring");

      toast.success(isEditing ? "Hendelse oppdatert" : "Hendelse opprettet");
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Kunne ikke lagre hendelsen");
    } finally {
      setSaving(false);
    }
  }, [title, description, type, date, startTime, endTime, allDay, color, attendees, reminderMinutes, isEditing, editingEvent, onOpenChange, onSaved]);

  const typeConfig = TYPE_CONFIG[type];
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeIcon className="size-4" />
            {isEditing ? "Rediger hendelse" : "Ny hendelse"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type selector */}
          <div className="flex gap-1 rounded-lg border p-1 bg-muted/30">
            {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG.meeting][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setType(key as "meeting" | "reminder" | "custom_deadline");
                    setAllDay(key !== "meeting");
                    setColor(cfg.defaultColor);
                  }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    type === key
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Tittel</Label>
            <Input
              id="event-title"
              placeholder={
                type === "meeting" ? "Møte med..." :
                type === "reminder" ? "Husk å..." :
                "Frist for..."
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="event-desc">Beskrivelse (valgfritt)</Label>
            <textarea
              id="event-desc"
              placeholder="Detaljer..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Date and time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dato</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {type === "meeting" && !allDay && (
              <div className="space-y-1.5">
                <Label>Tidspunkt</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="text-xs"
                  />
                  <span className="text-muted-foreground text-xs">–</span>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {type === "meeting" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="all-day"
                checked={allDay}
                onCheckedChange={(v) => setAllDay(v === true)}
              />
              <Label htmlFor="all-day" className="text-sm font-normal cursor-pointer">
                Hele dagen
              </Label>
            </div>
          )}

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Farge</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "size-6 rounded-full transition-all",
                    c.className,
                    color === c.value ? "ring-2 ring-offset-2 ring-foreground/30" : "opacity-60 hover:opacity-100"
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Attendees for meetings */}
          {type === "meeting" && members.length > 0 && (
            <div className="space-y-1.5">
              <Label>Deltakere</Label>
              <div className="rounded-md border p-2 max-h-40 overflow-y-auto space-y-1">
                {members.map((m) => {
                  const selected = attendees.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleAttendee(m.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors",
                        selected ? "bg-accent" : "hover:bg-muted/50"
                      )}
                    >
                      <Avatar size="sm">
                        {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.name} />}
                        <AvatarFallback>{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-left truncate">{m.name}</span>
                      {selected && (
                        <span className="text-xs text-primary font-medium">Invitert</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {attendees.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {attendees.length} {attendees.length === 1 ? "deltaker" : "deltakere"} valgt
                </p>
              )}
            </div>
          )}

          {/* Reminder setting */}
          {type === "reminder" && (
            <div className="space-y-1.5">
              <Label>Påminnelse</Label>
              <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Ved tidspunktet</SelectItem>
                  <SelectItem value="5">5 minutter før</SelectItem>
                  <SelectItem value="15">15 minutter før</SelectItem>
                  <SelectItem value="30">30 minutter før</SelectItem>
                  <SelectItem value="60">1 time før</SelectItem>
                  <SelectItem value="1440">1 dag før</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? "Lagrer..." : isEditing ? "Lagre endringer" : "Opprett"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
