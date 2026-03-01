"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Scale, FileQuestion } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModuleProps } from "../types";
import Link from "next/link";

interface ReconciliationRow {
  clientId: string;
  clientName: string;
  companyName: string;
  matchPercentage: number;
  unmatchedCount: number;
  lastActivity: string | null;
  status: string;
}

function ProgressBar({ value }: { value: number }) {
  let bg = "bg-red-500";
  if (value >= 90) bg = "bg-green-500";
  else if (value >= 70) bg = "bg-yellow-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}

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

export default function ReconciliationOverview({ tenantId }: ModuleProps) {
  const [data, setData] = useState<ReconciliationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/agency/reconciliation")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenantId]);

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

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Kunne ikke laste avstemmingsdata.</p>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p className="text-sm">Ingen klienter ennå</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Scale className="h-5 w-5 text-muted-foreground" />
        <CardTitle className="text-base">Avstemmingsstatus</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="px-6 pb-2 text-left font-medium">Klient</th>
              <th className="px-4 pb-2 text-left font-medium">Selskap</th>
              <th className="px-4 pb-2 text-left font-medium">Status</th>
              <th className="px-4 pb-2 text-right font-medium">Uavstemte</th>
              <th className="px-4 pb-2 text-right font-medium">Sist aktiv</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.clientId}
                className="border-b last:border-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-6 py-2.5 font-medium">
                  <Link
                    href={`/dashboard/clients/${row.clientId}/matching`}
                    className="hover:underline"
                  >
                    {row.clientName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.companyName}</td>
                <td className="px-4 py-2.5">
                  <ProgressBar value={row.matchPercentage} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.unmatchedCount}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {formatRelative(row.lastActivity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
