"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Upload, Zap, FileText, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleProps } from "../types";

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  clientName: string;
  timestamp: string;
}

function formatRelative(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Nå";
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "I går";
  return `${days} d siden`;
}

const typeIcons: Record<string, typeof Upload> = {
  import: Upload,
  match: Zap,
  report: FileText,
};

export default function RecentActivity({ tenantId, clientId }: ModuleProps) {
  const [data, setData] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = clientId
      ? `/api/dashboard/clients/${clientId}/activity`
      : "/api/dashboard/agency/activity";

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenantId, clientId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Nylig aktivitet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Nylig aktivitet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Kunne ikke laste aktivitet.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Nylig aktivitet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p className="text-sm">Ingen aktivitet ennå</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Activity className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Nylig aktivitet</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {data.map((item) => {
            const Icon = typeIcons[item.type] ?? Activity;
            return (
              <li key={item.id} className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                  {formatRelative(item.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
