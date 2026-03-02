"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
}

interface ControlRunnerDialogProps {
  companies: Company[];
  onCompleted?: () => void;
}

const CONTROL_TYPES = [
  { id: "accounts_receivable", label: "Kundefordringer", icon: ArrowDownToLine, description: "Aldersfordeling og avviksanalyse" },
  { id: "accounts_payable", label: "Leverandørgjeld", icon: ArrowUpFromLine, description: "Aldersfordeling og avviksanalyse" },
] as const;

export function ControlRunnerDialog({ companies, onCompleted }: ControlRunnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [reportFormat, setReportFormat] = useState<"pdf" | "excel" | "both">("both");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!selectedType || !selectedCompany) return;
    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/controls/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlType: selectedType,
          companyId: selectedCompany,
          generateReport: true,
          reportFormat,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Noe gikk galt. Prøv igjen.");
        return;
      }

      setOpen(false);
      setSelectedType(null);
      setSelectedCompany("");
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
