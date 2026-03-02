"use client";

import { useState, useEffect, useCallback } from "react";
import { ControlCard } from "./control-card";
import { Skeleton } from "@/components/ui/skeleton";

interface ControlResult {
  id: string;
  companyId: string;
  companyName: string;
  controlType: string;
  overallStatus: string;
  summary: { totalChecked: number; totalDeviations: number; totalDeviationAmount: number };
  executedAt: string;
  reportPdfUrl: string | null;
  reportExcelUrl: string | null;
}

interface ControlListProps {
  companyFilter?: string;
  typeFilter?: string;
}

export function ControlList({ companyFilter, typeFilter }: ControlListProps) {
  const [results, setResults] = useState<ControlResult[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (companyFilter) params.set("companyId", companyFilter);
      if (typeFilter) params.set("controlType", typeFilter);
      const res = await fetch(`/api/controls/results?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {
      console.error("[ControlList] Failed to fetch results");
    } finally {
      setLoading(false);
    }
  }, [companyFilter, typeFilter]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Ingen kontroller kjørt ennå. Trykk «Kjør kontroll» for å starte.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {results.map((r) => (
        <ControlCard
          key={r.id}
          id={r.id}
          controlType={r.controlType}
          companyName={r.companyName}
          overallStatus={r.overallStatus}
          summary={r.summary}
          executedAt={r.executedAt}
          reportPdfUrl={r.reportPdfUrl}
          reportExcelUrl={r.reportExcelUrl}
        />
      ))}
    </div>
  );
}
