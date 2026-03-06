"use client";

import { useState, useEffect, useCallback } from "react";
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

interface AccountOption {
  accountNumber: string;
  accountName: string;
  syncLevel: string;
}

const REPORT_ACCOUNT_PREFIX: Partial<Record<ReportType, string>> = {
  accounts_receivable: "15",
  accounts_payable: "24",
};

const REPORT_ACCOUNT_LABEL: Partial<Record<ReportType, string>> = {
  accounts_receivable: "kundefordrings",
  accounts_payable: "leverandørgjeld",
};

interface ReportGeneratorDialogProps {
  companies: Company[];
  onGenerated?: () => void;
}

export function ReportGeneratorDialog({ companies, onGenerated }: ReportGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [companyAccounts, setCompanyAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [asOfDate, setAsOfDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeDef = selectedType ? getReportTypeDefinition(selectedType) : null;
  const needsDate = typeDef?.requiredParams.includes("asOfDate");
  const needsYear = typeDef?.requiredParams.includes("periodYear");
  const needsMonth = typeDef?.requiredParams.includes("periodMonth");

  const accountPrefix = selectedType ? REPORT_ACCOUNT_PREFIX[selectedType] ?? null : null;

  const filteredAccounts = accountPrefix
    ? companyAccounts.filter(
        (a) => a.accountNumber.startsWith(accountPrefix) && a.syncLevel === "transactions"
      )
    : [];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    "Januar", "Februar", "Mars", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Desember",
  ];

  useEffect(() => {
    if (!selectedCompany) {
      setCompanyAccounts([]);
      setSelectedAccount("all");
      return;
    }

    let cancelled = false;
    setLoadingAccounts(true);

    fetch(`/api/companies/${selectedCompany}/accounts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: AccountOption[]) => {
        if (!cancelled) setCompanyAccounts(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCompanyAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });

    return () => { cancelled = true; };
  }, [selectedCompany]);

  useEffect(() => {
    setSelectedAccount("all");
  }, [selectedType]);

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
      if (selectedAccount !== "all" && accountPrefix) {
        body.accountNumbers = [selectedAccount];
      }

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
      setSelectedAccount("all");
      onGenerated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setRunning(false);
    }
  }, [selectedType, selectedCompany, selectedAccount, accountPrefix, format, asOfDate, periodYear, periodMonth, needsDate, needsYear, needsMonth, onGenerated]);

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

              {/* Account selection — only for AR/AP report types */}
              {accountPrefix && selectedCompany && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Konto</label>
                  {loadingAccounts ? (
                    <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Henter kontoer...
                    </div>
                  ) : filteredAccounts.length > 0 ? (
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          Alle {REPORT_ACCOUNT_LABEL[selectedType] ?? ""}-kontoer ({filteredAccounts.length})
                        </SelectItem>
                        {filteredAccounts.map((a) => (
                          <SelectItem key={a.accountNumber} value={a.accountNumber}>
                            <span className="font-mono tabular-nums">{a.accountNumber}</span>
                            {" "}
                            {a.accountName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ingen importerte {accountPrefix}xx-kontoer funnet for dette selskapet.
                    </p>
                  )}
                </div>
              )}

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
