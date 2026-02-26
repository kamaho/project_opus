"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useFormatting } from "@/contexts/ui-preferences-context";
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  GitMerge,
  FileUp,
  UserPlus,
  Clock,
  Info,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
  entityType: string | null;
  entityId: string | null;
  fromUserId: string | null;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  note_mention: <MessageSquare className="h-3.5 w-3.5" />,
  match_completed: <GitMerge className="h-3.5 w-3.5" />,
  import_completed: <FileUp className="h-3.5 w-3.5" />,
  assignment: <UserPlus className="h-3.5 w-3.5" />,
  deadline_reminder: <Clock className="h-3.5 w-3.5" />,
  system: <Info className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  note_mention: "text-blue-500 bg-blue-500/10",
  match_completed: "text-emerald-500 bg-emerald-500/10",
  import_completed: "text-emerald-500 bg-emerald-500/10",
  assignment: "text-amber-500 bg-amber-500/10",
  deadline_reminder: "text-red-500 bg-red-500/10",
  system: "text-muted-foreground bg-muted",
};

function NotificationIcon({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        TYPE_COLOR[type] ?? TYPE_COLOR.system
      )}
    >
      {TYPE_ICON[type] ?? TYPE_ICON.system}
    </span>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const { fmtDate: fmtD } = useFormatting();
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30");
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);

      if (initialLoadRef.current) {
        prevIdsRef.current = new Set(data.map((n) => n.id));
        initialLoadRef.current = false;
        return;
      }

      const prevIds = prevIdsRef.current;
      const newNotifications = data.filter(
        (n) => !prevIds.has(n.id) && !n.read
      );

      for (const n of newNotifications) {
        toast(n.title, {
          description: n.body ?? undefined,
          icon: TYPE_ICON[n.type] ?? TYPE_ICON.system,
          action: n.link
            ? {
                label: "Vis",
                onClick: () => {
                  const href = n.entityId
                    ? `${n.link}?highlight=${n.entityId}`
                    : n.link!;
                  window.location.href = href;
                },
              }
            : undefined,
        });
      }

      prevIdsRef.current = new Set(data.map((n) => n.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
  }, []);

  const markAllAsRead = useCallback(async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "nå";
    if (diffMins < 60) return `${diffMins}m siden`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}t siden`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d siden`;
    return fmtD(d);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-brand text-[10px] font-medium text-white flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" side="right" align="start" sideOffset={8}>
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Varsler</p>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={markAllAsRead}
                disabled={markingAll}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Merk alle som lest
              </Button>
            )}
            {unreadCount > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-auto">
          {loading && notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Laster…
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ingen varsler</p>
            </div>
          ) : (
            notifications.map((n) => {
              const href = n.link
                ? n.entityId
                  ? `${n.link}?highlight=${n.entityId}`
                  : n.link
                : null;

              const content = (
                <div className="flex items-start gap-2.5">
                  <NotificationIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-tight",
                        !n.read ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/50 mt-1 tabular-nums">
                      {formatTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      className="shrink-0 mt-1 p-0.5 rounded hover:bg-muted transition-colors"
                      title="Merk som lest"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                    >
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              );

              return (
                <div
                  key={n.id}
                  className={cn(
                    "px-3 py-2.5 border-b last:border-b-0 transition-colors",
                    !n.read && "bg-muted/30"
                  )}
                >
                  {href ? (
                    <Link
                      href={href}
                      className="block hover:opacity-80 transition-opacity"
                      onClick={() => {
                        if (!n.read) markAsRead(n.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
