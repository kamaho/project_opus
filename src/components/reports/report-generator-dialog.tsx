"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ReportTypePicker } from "./report-type-picker";
import { getReportTypeDefinition } from "@/lib/reports/report-registry";
import type { ReportType, ReportFormat } from "@/lib/reports/types";
import { Plus, Loader2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface ReportGeneratorDialogProps {
  companies: Company[];
  onGenerated?: () => void;
}

export function ReportGeneratorDialog({ companies, onGenerated }: ReportGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeDef = selectedType ? getReportTypeDefinition(selectedType) : null;
  const needsDate = typeDef?.requiredParams.includes("asOfDate");
  const needsYear = typeDef?.requiredParams.includes("periodYear");
  const needsMonth = typeDef?.requiredParams.includes("periodMonth");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    "Januar", "Februar", "Mars", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Desember",
  ];

  const handleGenerate = useCallback(async () => {
    if (!selectedType || !selectedCompany) return;
    setError(null);
    setRunning(true);

    try {
      const body: Record<string, unknown> = {
        reportType: selectedType,
        companyId: selectedCompany,
        format,
      };
      if (needsDate) body.asOfDate = new Date(asOfDate).toISOString();
      if (needsYear) body.periodYear = periodYear;
      if (needsMonth) body.periodMonth = periodMonth;

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generering feilet");
      }

      setOpen(false);
      setSelectedType(null);
      setSelectedCompany("");
      onGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setRunning(false);
    }
  }, [selectedType, selectedCompany, format, asOfDate, periodYear, periodMonth, needsDate, needsYear, needsMonth, onGenerated]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Ny rapport
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generer rapport</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Rapporttype</label>
            <ReportTypePicker value={selectedType} onChange={setSelectedType} />
          </div>

          {selectedType && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Selskap</label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Velg selskap" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selskapet må ha aktiv regnskapssystem-tilkobling.
                </p>
              </div>

              {needsDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Per dato</label>
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {needsYear && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">År</label>
                  <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {needsMonth && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Måned</label>
                  <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={format === "pdf" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormat("pdf")}
                  >
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant={format === "excel" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormat("excel")}
                  >
                    Excel
                  </Button>
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button
            className="w-full"
            disabled={!selectedType || !selectedCompany || running}
            onClick={handleGenerate}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Genererer...
              </>
            ) : (
              "Generer rapport"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
