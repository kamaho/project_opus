"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Scale, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleProps } from "../types";

interface SetBreakdown {
  setNumber: number;
  totalTransactions: number;
  matchedTransactions: number;
  totalAmount: number;
}

interface ReconciliationData {
  matchPercentage: number;
  totalTransactions: number;
  matchedTransactions: number;
  unmatchedTransactions: number;
  lastReconciliation: string | null;
  breakdown: SetBreakdown[];
}

const fmt = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ClientReconciliation({ clientId }: ModuleProps) {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/dashboard/clients/${clientId}/reconciliation`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemming</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemming</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Kunne ikke laste avstemmingsdata.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.totalTransactions === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemming</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p className="text-sm">Ingen transaksjoner importert ennå</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  let ringColor = "text-red-500";
  if (data.matchPercentage >= 90) ringColor = "text-green-500";
  else if (data.matchPercentage >= 70) ringColor = "text-yellow-500";

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (data.matchPercentage / 100) * circumference;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Scale className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Avstemming</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <div className="relative h-28 w-28 shrink-0">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-muted" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={ringColor.replace("text-", "stroke-")}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular-nums">{data.matchPercentage}%</span>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Totalt</span>
              <span className="tabular-nums font-medium">{data.totalTransactions}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Avstemte</span>
              <span className="tabular-nums font-medium text-green-600">{data.matchedTransactions}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">Uavstemte</span>
              <span className="tabular-nums font-medium text-red-600">{data.unmatchedTransactions}</span>
            </div>
            {data.breakdown.map((b) => (
              <div key={b.setNumber} className="flex justify-between gap-8">
                <span className="text-muted-foreground">Sett {b.setNumber}</span>
                <span className="tabular-nums">{fmt.format(b.totalAmount)} kr</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
