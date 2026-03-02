"use client";

import { useEffect, useState } from "react";
import { Scale, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ReconciliationRow {
  clientId: string;
  clientName: string;
  companyName: string;
  matchPercentage: number;
  unmatchedCount: number;
  lastActivity: string | null;
  status: string;
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Nå";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t`;
  const days = Math.floor(hrs / 24);
  return `${days} d`;
}

function StatusIcon({ percentage }: { percentage: number }) {
  if (percentage >= 90) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (percentage >= 70) return <Clock className="h-4 w-4 text-yellow-500" />;
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
}

export function MobileReconciliationTab() {
  const [data, setData] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/agency/reconciliation")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-6">
        <Scale className="h-8 w-8" />
        <p className="text-sm">Kunne ikke laste avstemmingsdata.</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground px-6">
        <Scale className="h-8 w-8" />
        <p className="text-sm">Ingen klienter ennå</p>
      </div>
    );
  }

  const allGreen = data.every((r) => r.matchPercentage >= 90);
  const attentionCount = data.filter((r) => r.matchPercentage < 90).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary banner */}
      <div className={cn(
        "shrink-0 px-4 py-3 border-b",
        allGreen ? "bg-green-50 dark:bg-green-950/20" : "bg-amber-50 dark:bg-amber-950/20"
      )}>
        <div className="flex items-center gap-2">
          {allGreen ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-sm font-medium">
            {allGreen
              ? "Alt er i orden"
              : `${attentionCount} klient${attentionCount === 1 ? "" : "er"} trenger oppmerksomhet`}
          </span>
        </div>
      </div>

      {/* Client list */}
      <div className="flex-1 overflow-y-auto">
        {data.map((row) => (
          <Link
            key={row.clientId}
            href={`/dashboard/clients/${row.clientId}/matching`}
            className="flex items-center gap-3 px-4 py-3 border-b hover:bg-muted/50 transition-colors"
          >
            <StatusIcon percentage={row.matchPercentage} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{row.clientName}</p>
              <p className="text-xs text-muted-foreground truncate">{row.companyName}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-mono tabular-nums font-medium">
                {row.matchPercentage}%
              </p>
              {row.unmatchedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {row.unmatchedCount} uavstemte
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelative(row.lastActivity)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
