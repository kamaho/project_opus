"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Scale, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useDashboardData } from "../dashboard-data-provider";

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
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return `${days} d siden`;
}

export default function ReconciliationOverview() {
  const { reconciliation: data, totalClients, loading } = useDashboardData();

  const clientsWithIssues = useMemo(
    () => data.filter((r) => r.unmatchedCount > 0),
    [data]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const issueCount = clientsWithIssues.length;
  const totalUnmatchedAmount = clientsWithIssues.reduce(
    (sum, r) => sum + r.unmatchedAmount,
    0
  );

  if (issueCount === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Alle {totalClients} kontoer er avstemt
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ingen uavstemte poster
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleClients = clientsWithIssues.slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
          <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums leading-none bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {issueCount} av {totalClients}
          </span>
        </div>
        <Link
          href="/dashboard/clients"
          prefetch={false}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Se alle
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex items-center justify-between px-6 pb-3">
          <p className="text-xs text-muted-foreground">
            {issueCount} klient{issueCount !== 1 ? "er" : ""} med avvik
          </p>
          <p className="text-xs font-medium font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {krFmt.format(totalUnmatchedAmount)}
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="px-6 pb-2 text-left font-medium">Klient</th>
              <th className="px-4 pb-2 text-right font-medium">Poster</th>
              <th className="px-4 pb-2 text-right font-medium">Beløp</th>
              <th className="px-4 pb-2 text-right font-medium">Sist aktiv</th>
            </tr>
          </thead>
          <tbody>
            {visibleClients.map((row) => (
              <tr
                key={row.clientId}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-6 py-2.5">
                  <Link
                    href={`/dashboard/clients/${row.clientId}/matching`}
                    className="hover:underline"
                  >
                    <span className="font-medium">{row.clientName}</span>
                  </Link>
                  <p className="text-xs text-muted-foreground">{row.companyName}</p>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.unmatchedCount}
                </td>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right font-mono tabular-nums font-medium",
                    row.unmatchedAmount > 0 &&
                      "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {krFmt.format(row.unmatchedAmount)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
                  {formatRelative(row.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {issueCount > 10 && (
          <div className="px-6 pt-2 pb-1">
            <Link
              href="/dashboard/clients"
              prefetch={false}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              +{issueCount - 10} klienter til &rarr;
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
