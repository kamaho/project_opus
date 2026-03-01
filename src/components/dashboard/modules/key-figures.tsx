"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Users, Scale, AlertTriangle, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleProps } from "../types";

interface AgencyStats {
  totalClients: number;
  activeReconciliations: number;
  totalUnmatched: number;
  totalDifference: number;
}

const fmtCompact = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

const fmtCurrency = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

export default function KeyFigures({ tenantId, clientId }: ModuleProps) {
  const [data, setData] = useState<AgencyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = clientId
      ? `/api/dashboard/clients/${clientId}/stats`
      : "/api/dashboard/agency/stats";

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenantId, clientId]);

  if (loading) {
    return (
      <Card className="self-start p-5">
        <p className="text-sm font-medium mb-4">Nøkkeltall</p>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="self-start p-5">
        <p className="text-sm text-muted-foreground">
          Kunne ikke laste nøkkeltall.
        </p>
      </Card>
    );
  }

  const diffZero = data.totalDifference === 0;
  const diffNeg = data.totalDifference < 0;

  const stats = [
    {
      label: "Klienter",
      value: fmtCompact.format(data.totalClients),
      icon: Users,
      bg: "bg-muted",
    },
    {
      label: "Aktive avstemminger",
      value: fmtCompact.format(data.activeReconciliations),
      icon: Scale,
      bg: "bg-muted",
    },
    {
      label: "Uavstemte poster",
      value: fmtCompact.format(data.totalUnmatched),
      icon: AlertTriangle,
      bg: data.totalUnmatched > 0
        ? "bg-amber-100 dark:bg-amber-950"
        : "bg-muted",
    },
    {
      label: "Differanse",
      value: `${diffNeg ? "−" : ""}${fmtCurrency.format(Math.abs(data.totalDifference))} kr`,
      icon: TrendingDown,
      bg: diffZero
        ? "bg-green-100 dark:bg-green-950"
        : "bg-red-100 dark:bg-red-950",
      color: diffZero
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <Card className="self-start p-5">
      <p className="text-sm font-medium text-muted-foreground mb-4">Nøkkeltall</p>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-lg ${s.bg} px-4 py-3`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-xl font-semibold tabular-nums ${s.color ?? ""}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
