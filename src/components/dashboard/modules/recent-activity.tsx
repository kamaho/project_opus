"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Upload, Zap, FileText, FileQuestion, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "../dashboard-data-provider";

const PAGE_SIZE = 5;

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

export default function RecentActivity() {
  const { activity: data, loading } = useDashboardData();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = data.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Nylig aktivitet</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0 && !loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Nylig aktivitet</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-col items-center gap-1.5 py-4 text-muted-foreground">
            <FileQuestion className="h-8 w-8" />
            <p className="text-xs">Ingen aktivitet ennå</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm">Nylig aktivitet</CardTitle>
        {data.length > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ({data.length})
          </span>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        <ul className="space-y-0.5">
          {pageItems.map((item) => {
            const Icon = typeIcons[item.type] ?? Activity;
            return (
              <li key={item.id} className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted/50 transition-colors">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted shrink-0">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelative(item.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>

        {totalPages > 1 && (
          <div className="mt-2 flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {safePage + 1}/{totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
