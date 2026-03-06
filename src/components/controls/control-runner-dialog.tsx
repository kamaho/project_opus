"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, ArrowDownToLine, ArrowUpFromLine, Banknote, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
}

interface AccountOption {
  accountNumber: string;
  accountName: string;
  syncLevel: string;
}

interface ControlRunnerDialogProps {
  companies: Company[];
  onCompleted?: () => void;
}

const CONTROL_TYPES = [
  { id: "accounts_receivable", label: "Kundefordringer", icon: ArrowDownToLine, description: "Aldersfordeling og avviksanalyse", accountPrefix: "15" },
  { id: "accounts_payable", label: "Leverandørgjeld", icon: ArrowUpFromLine, description: "Aldersfordeling og avviksanalyse", accountPrefix: "24" },
  { id: "payroll_a07", label: "Lønnsavstemming", icon: Banknote, description: "Intern konsistenskontroll av lønnsdata", accountPrefix: null },
  { id: "periodization", label: "Periodisering", icon: CalendarClock, description: "Sjekker periodiseringskontoer", accountPrefix: null },
] as const;

export function ControlRunnerDialog({ companies, onCompleted }: ControlRunnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [companyAccounts, setCompanyAccounts] = useState<AccountOption[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel" | "both">("both");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTypeDef = CONTROL_TYPES.find((t) => t.id === selectedType);
  const accountPrefix = selectedTypeDef?.accountPrefix ?? null;

  const filteredAccounts = accountPrefix
    ? companyAccounts.filter(
        (a) => a.accountNumber.startsWith(accountPrefix) && a.syncLevel === "transactions"
      )
    : [];

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

  const handleRun = async () => {
    if (!selectedType || !selectedCompany) return;
    setRunning(true);
    setError(null);

    const body: Record<string, unknown> = {
      controlType: selectedType,
      companyId: selectedCompany,
      generateReport: true,
      reportFormat,
    };

    if (selectedAccount !== "all" && accountPrefix) {
      body.accountNumbers = [selectedAccount];
    }

    try {
      const res = await fetch("/api/controls/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }

      setOpen(false);
      setSelectedType(null);
      setSelectedCompany("");
      setSelectedAccount("all");
      onCompleted?.();
    } catch {
      setError("Nettverksfeil. Sjekk tilkoblingen og prøv igjen.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          Kjør kontroll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kjør kontroll</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Control type selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Kontrolltype</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTROL_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                      selectedType === type.id
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{type.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Company selection */}
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
            <p className="text-[11px] text-muted-foreground leading-snug">
              Selskapet må ha aktiv Tripletex-tilkobling med fakturadata for valgt kontrolltype.
            </p>
          </div>

          {/* Account selection — only for AR/AP */}
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
                      Alle {selectedTypeDef?.label.toLowerCase()}-kontoer ({filteredAccounts.length})
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

          {/* Report format */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Rapportformat</label>
            <Select value={reportFormat} onValueChange={(v) => setReportFormat(v as "pdf" | "excel" | "both")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">PDF + Excel</SelectItem>
                <SelectItem value="pdf">Kun PDF</SelectItem>
                <SelectItem value="excel">Kun Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <Button
            className="w-full"
            disabled={!selectedType || !selectedCompany || running}
            onClick={handleRun}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kjører kontroll...
              </>
            ) : (
              "Kjør kontroll"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
