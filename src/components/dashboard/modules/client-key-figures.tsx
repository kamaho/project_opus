"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { FileStack, CheckCircle, AlertTriangle, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleProps } from "../types";

interface ClientStats {
  transactionsSet1: number;
  transactionsSet2: number;
  matchedCount: number;
  unmatchedCount: number;
  matchPercentage: number;
  totalDifference: number;
  lastReconciliation: string | null;
}

const fmtCompact = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

const fmtCurrency = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
  currencyDisplay: "narrowSymbol",
});

function StatCell({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof FileStack;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent ?? "bg-muted"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function ClientKeyFigures({ clientId }: ModuleProps) {
  const [data, setData] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/dashboard/clients/${clientId}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) {
    return (
      <Card className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-5 py-4">
            <Skeleton className="h-12" />
          </div>
        ))}
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="px-5 py-4">
        <p className="text-sm text-muted-foreground">Kunne ikke laste nøkkeltall.</p>
      </Card>
    );
  }

  const diffZero = data.totalDifference === 0;
  const diffNeg = data.totalDifference < 0;

  return (
    <Card className="grid grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0">
      <StatCell
        label="Transaksjoner"
        value={fmtCompact.format(data.transactionsSet1 + data.transactionsSet2)}
        icon={FileStack}
      />
      <StatCell
        label="Match"
        value={`${data.matchPercentage}%`}
        icon={CheckCircle}
        accent={data.matchPercentage >= 90 ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" : undefined}
      />
      <StatCell
        label="Uavstemte"
        value={fmtCompact.format(data.unmatchedCount)}
        icon={AlertTriangle}
        accent={data.unmatchedCount > 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" : undefined}
      />
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          diffZero
            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
        }`}>
          <TrendingDown className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={`text-lg font-semibold tabular-nums leading-tight ${
            diffZero ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}>
            {diffNeg ? "−" : ""}{fmtCurrency.format(Math.abs(data.totalDifference))}
          </p>
          <p className="text-xs text-muted-foreground">Differanse</p>
        </div>
      </div>
    </Card>
  );
}
