"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Scale,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ReconciliationRow {
  clientId: string;
  clientName: string;
  companyName: string;
  unmatchedCount: number;
  unmatchedAmount: number;
  lastActivity: string | null;
  status: string;
}

interface ReconciliationResponse {
  clients: ReconciliationRow[];
  totalClients: number;
}

const krFmt = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
});

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

export function MobileReconciliationTab() {
  const [data, setData] = useState<ReconciliationRow[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard/agency/reconciliation");
      if (res.ok) {
        const json: ReconciliationResponse = await res.json();
        setData(json.clients);
        setTotalClients(json.totalClients);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="mx-4 mt-3 h-10 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mx-4 h-16 animate-pulse border-b" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-muted-foreground">
        <Scale className="h-8 w-8" />
        <p className="text-sm">Kunne ikke laste avstemmingsdata.</p>
      </div>
    );
  }

  const clientsWithIssues = data.filter((r) => r.unmatchedCount > 0);
  const issueCount = clientsWithIssues.length;
  const allGreen = issueCount === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">Klienter</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {allGreen
              ? `Alle ${totalClients} kontoer avstemt`
              : `${issueCount} av ${totalClients} med avvik`}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
        </button>
      </div>

      {/* Summary banner */}
      <div
        className={cn(
          "shrink-0 px-4 py-2.5 border-b",
          allGreen
            ? "bg-green-50 dark:bg-green-950/20"
            : "bg-amber-50 dark:bg-amber-950/20"
        )}
      >
        <div className="flex items-center gap-2">
          {allGreen ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-xs font-medium">
            {allGreen
              ? "Alle kontoer er avstemt"
              : `${issueCount} klient${issueCount === 1 ? "" : "er"} med uavstemte poster`}
          </span>
        </div>
      </div>

      {/* Client list -- only those with issues */}
      <div className="flex-1 overflow-y-auto">
        {allGreen ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium">Ingenting å jobbe med</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Alle {totalClients} kontoer er avstemt.
            </p>
          </div>
        ) : (
          clientsWithIssues.map((row) => (
            <Link
              key={row.clientId}
              href={`/dashboard/clients/${row.clientId}/matching`}
              className="flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {row.clientName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.companyName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">
                  {krFmt.format(row.unmatchedAmount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.unmatchedCount} poster
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(row.lastActivity)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
