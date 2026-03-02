"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReportCard } from "./report-card";
import { ReportGeneratorDialog } from "./report-generator-dialog";
import { reportTypes } from "@/lib/reports/report-registry";
import type { ReportSummary } from "@/lib/reports/types";
import { FileText, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface ReportRow {
  id: string;
  reportType: string;
  title: string;
  format: string;
  fileName: string;
  summary: ReportSummary;
  companyId: string;
  companyName: string;
  generatedAt: string;
}

interface ReportListProps {
  companies: Company[];
}

export function ReportList({ companies }: ReportListProps) {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("reportType", filterType);
      if (filterCompany !== "all") params.set("companyId", filterCompany);
      params.set("limit", "50");

      const res = await fetch(`/api/reports?${params}`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCompany]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = reports;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Rapporter</h1>
        <ReportGeneratorDialog companies={companies} onGenerated={fetchReports} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle typer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle typer</SelectItem>
            {reportTypes.map((rt) => (
              <SelectItem key={rt.id} value={rt.id}>
                {rt.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Alle selskaper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle selskaper</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Ingen rapporter generert ennå</p>
          <p className="text-xs text-muted-foreground mt-1">
            Klikk «Ny rapport» for å generere din første rapport.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <ReportCard
              key={r.id}
              id={r.id}
              reportType={r.reportType}
              title={r.title}
              format={r.format}
              fileName={r.fileName}
              summary={r.summary}
              companyName={r.companyName}
              generatedAt={r.generatedAt}
              onDeleted={fetchReports}
            />
          ))}
        </div>
      )}
    </div>
  );
}
