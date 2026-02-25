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
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  note_mention: <MessageSquare className="h-4 w-4" />,
  match_completed: <GitMerge className="h-4 w-4" />,
  import_completed: <FileUp className="h-4 w-4" />,
  assignment: <UserPlus className="h-4 w-4" />,
  deadline_reminder: <Clock className="h-4 w-4" />,
  system: <Info className="h-4 w-4" />,
};

const TYPE_COLOR: Record<string, string> = {
  note_mention: "text-blue-500 bg-blue-500/10",
  match_completed: "text-emerald-500 bg-emerald-500/10",
  import_completed: "text-emerald-500 bg-emerald-500/10",
  assignment: "text-amber-500 bg-amber-500/10",
  deadline_reminder: "text-red-500 bg-red-500/10",
  system: "text-muted-foreground bg-muted",
};

export function MobileNotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const { fmtDate: fmtD } = useFormatting();
  const fetchedRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) return;
      const data: Notification[] = await res.json();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchNotifications();
    }
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Varsler</h2>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-medium text-white tabular-nums">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1.5 text-muted-foreground"
            onClick={markAllAsRead}
            disabled={markingAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Merk alle som lest
          </Button>
        )}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
              <Bell className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Ingen varsler</p>
            <p className="text-xs text-muted-foreground/60 mt-1 text-center">
              Du vil motta varsler for matching, import og frister her.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 border-b last:border-b-0 transition-colors",
                !n.read && "bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
                  TYPE_COLOR[n.type] ?? TYPE_COLOR.system
                )}
              >
                {TYPE_ICON[n.type] ?? TYPE_ICON.system}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm leading-snug",
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
                  className="shrink-0 mt-1 p-1 rounded-md hover:bg-muted transition-colors"
                  title="Merk som lest"
                  onClick={() => markAsRead(n.id)}
                >
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
