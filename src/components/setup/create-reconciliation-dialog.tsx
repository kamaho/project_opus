"use client";

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CreateReconciliationDialogRef {
  open: () => void;
}

interface CreateReconciliationDialogProps {
  noTrigger?: boolean;
}

interface ReconciliationItem {
  name: string;
  set1AccountNumber: string;
  set1Name: string;
  set1Type: "ledger" | "bank";
  set2AccountNumber: string;
  set2Name: string;
  set2Type: "ledger" | "bank";
}

interface CompanyOption {
  id: string;
  name: string;
}

const DEFAULT_ITEM: ReconciliationItem = {
  name: "",
  set1AccountNumber: "",
  set1Name: "Hovedbok",
  set1Type: "ledger",
  set2AccountNumber: "",
  set2Name: "Bank",
  set2Type: "bank",
};

export const CreateReconciliationDialog = forwardRef<
  CreateReconciliationDialogRef,
  CreateReconciliationDialogProps
>(function CreateReconciliationDialog({ noTrigger }, ref) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [items, setItems] = useState<ReconciliationItem[]>([{ ...DEFAULT_ITEM }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }), []);

  useEffect(() => {
    if (!open) return;
    setItems([{ ...DEFAULT_ITEM }]);
    setError(null);
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data: CompanyOption[]) => {
        const list = Array.isArray(data) ? data.filter((c) => c.id && c.name) : [];
        setCompanies(list);
        if (list.length === 1) setSelectedCompanyId(list[0].id);
        else setSelectedCompanyId("");
      })
      .catch(() => setCompanies([]));
  }, [open]);

  function update(idx: number, field: keyof ReconciliationItem, value: string) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addItem() {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  }

  function removeItem(idx: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSubmit =
    selectedCompanyId &&
    items.every(
      (r) =>
        r.name.trim().length > 0 &&
        r.set1AccountNumber.trim().length > 0 &&
        r.set2AccountNumber.trim().length > 0
    );

  const handleSubmit = useCallback(async () => {
    if (!selectedCompanyId) return;
    setSubmitting(true);
    setError(null);

    try {
      let firstClientId: string | null = null;
      for (const rec of items) {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: selectedCompanyId,
            name: rec.name.trim(),
            set1: {
              accountNumber: rec.set1AccountNumber.trim(),
              name: rec.set1Name.trim(),
              type: rec.set1Type,
            },
            set2: {
              accountNumber: rec.set2AccountNumber.trim(),
              name: rec.set2Name.trim(),
              type: rec.set2Type,
            },
          }),
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (body as { error?: string }).error || "Kunne ikke opprette klient"
          );
        }
        if (!firstClientId) firstClientId = (body as { id: string }).id;
      }

      setOpen(false);
      if (firstClientId) {
        router.push(`/dashboard/clients/${firstClientId}/matching`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedCompanyId, items, router]);

  const trigger = (
    <button
      type="button"
      className={cn("rpt-btn")}
      onClick={() => setOpen(true)}
      data-smart-info="Ny klient — opprett en ny klient (avstemmingsenhet)."
    >
      <div className="rpt-dots" />
      <Plus className="rpt-icon" />
      <span className="rpt-text">Ny klient</span>
    </button>
  );

  return (
    <>
      {!noTrigger && trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Opprett klient</DialogTitle>
            <DialogDescription>
              Sett opp en ny avstemming med to kontoer som skal avstemmes mot hverandre.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Company selector — only shown if multiple companies */}
            {companies.length > 1 && (
              <div className="space-y-1.5">
                <Label>Selskap</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
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
              </div>
            )}

            {companies.length === 1 && (
              <p className="text-sm text-muted-foreground">
                Klienten opprettes under <span className="font-medium text-foreground">{companies[0].name}</span>.
              </p>
            )}

            {/* Reconciliation items */}
            {items.map((rec, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Klient {items.length > 1 ? idx + 1 : ""}
                    </span>
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon-xs" onClick={() => removeItem(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Navn på klient / avstemming</Label>
                  <Input
                    placeholder="F.eks. 1920 - Bankavstemming"
                    value={rec.name}
                    onChange={(e) => update(idx, "name", e.target.value)}
                    autoFocus={idx === 0}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 rounded-md border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                      Mengde 1
                    </span>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonummer</Label>
                      <Input
                        placeholder="1920"
                        value={rec.set1AccountNumber}
                        onChange={(e) => update(idx, "set1AccountNumber", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonavn</Label>
                      <Input
                        placeholder="Hovedbok"
                        value={rec.set1Name}
                        onChange={(e) => update(idx, "set1Name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={rec.set1Type}
                        onValueChange={(v) => update(idx, "set1Type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ledger">Hovedbok</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      Mengde 2
                    </span>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonummer</Label>
                      <Input
                        placeholder="1920"
                        value={rec.set2AccountNumber}
                        onChange={(e) => update(idx, "set2AccountNumber", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonavn</Label>
                      <Input
                        placeholder="Bank"
                        value={rec.set2Name}
                        onChange={(e) => update(idx, "set2Name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={rec.set2Type}
                        onValueChange={(v) => update(idx, "set2Type", v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ledger">Hovedbok</SelectItem>
                          <SelectItem value="bank">Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4" />
              Legg til klient
            </Button>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Oppretter...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Opprett {items.length > 1 ? `${items.length} klienter` : "klient"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
