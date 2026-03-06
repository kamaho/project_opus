"use client";

import {
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  Loader2,
  Upload,
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  parseOnboardingExcel,
  type OnboardingRow,
  type ParseResult,
} from "@/lib/onboarding/excel-parser";

export interface BulkImportDialogRef {
  open: () => void;
}

type WizardStep = "upload" | "review" | "confirm";
const STEPS: WizardStep[] = ["upload", "review", "confirm"];
const STEP_LABELS: Record<WizardStep, string> = {
  upload: "Last opp",
  review: "Gjennomgå",
  confirm: "Bekreft",
};

function formatAmount(val: number | null): string {
  if (val == null) return "–";
  return val.toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const BulkImportDialog = forwardRef<BulkImportDialogRef>(
  function BulkImportDialog(_, ref) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<WizardStep>("upload");
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [ibDate, setIbDate] = useState("");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [dragOver, setDragOver] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [createdCount, setCreatedCount] = useState(0);

    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

    const resetState = useCallback(() => {
      setStep("upload");
      setParseResult(null);
      setIbDate("");
      setSelected(new Set());
      setDragOver(false);
      setParseError(null);
      setSubmitting(false);
      setSubmitError(null);
      setCreatedCount(0);
    }, []);

    const handleOpenChange = useCallback(
      (v: boolean) => {
        setOpen(v);
        if (!v) resetState();
      },
      [resetState]
    );

    const handleFile = useCallback((file: File) => {
      setParseError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseOnboardingExcel(
            e.target!.result as ArrayBuffer,
            file.name
          );
          setParseResult(result);
          setIbDate(result.ibDate);
          const validIndices = new Set(
            result.rows.filter((r) => r.valid).map((r) => r.index)
          );
          setSelected(validIndices);
        } catch (err) {
          setParseError(
            err instanceof Error ? err.message : "Kunne ikke lese filen."
          );
        }
      };
      reader.readAsArrayBuffer(file);
    }, []);

    const onDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const onFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const rows = parseResult?.rows ?? [];
    const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
    const invalidRows = useMemo(() => rows.filter((r) => !r.valid), [rows]);
    const selectedRows = useMemo(
      () => rows.filter((r) => selected.has(r.index)),
      [rows, selected]
    );
    const selectedCompanies = useMemo(
      () => [...new Set(selectedRows.map((r) => r.selskapsnavn))],
      [selectedRows]
    );

    const allValidSelected = validRows.every((r) => selected.has(r.index));
    const someValidSelected = validRows.some((r) => selected.has(r.index));

    const toggleAll = useCallback(() => {
      if (allValidSelected) {
        setSelected(new Set());
      } else {
        setSelected(new Set(validRows.map((r) => r.index)));
      }
    }, [allValidSelected, validRows]);

    const toggleRow = useCallback((index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    }, []);

    const handleSubmit = useCallback(async () => {
      if (selectedRows.length === 0) return;
      setSubmitting(true);
      setSubmitError(null);

      try {
        const items = selectedRows.map((r) => ({
          companyName: r.selskapsnavn,
          clientName: `${r.kontonrRegnskap} – ${r.selskapsnavn}`,
          set1: {
            accountNumber: r.kontonrRegnskap,
            name: "Hovedbok",
            type: "ledger" as const,
            currency: "NOK",
          },
          set2: {
            accountNumber: r.ibanResult.iban || r.bankkontonr,
            name: r.banknavn || "Bank",
            type: "bank" as const,
            currency: "NOK",
          },
          openingBalanceSet1:
            r.ibRegnskap != null ? String(r.ibRegnskap) : undefined,
          openingBalanceSet2:
            r.ibBank != null ? String(r.ibBank) : undefined,
          openingBalanceDate: ibDate || undefined,
        }));

        const res = await fetch("/api/clients/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          credentials: "include",
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (body as { error?: string }).error ??
              "Kunne ikke opprette klienter."
          );
        }

        setCreatedCount((body as { count: number }).count);
        setStep("confirm");
      } catch (e) {
        setSubmitError(
          e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen."
        );
      } finally {
        setSubmitting(false);
      }
    }, [selectedRows, ibDate]);

    const stepIndex = STEPS.indexOf(step);

    function renderStepIndicator() {
      return (
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  i < stepIndex && "bg-violet-500 text-white",
                  i === stepIndex && "bg-primary text-primary-foreground",
                  i > stepIndex && "bg-muted text-muted-foreground"
                )}
              >
                {i < stepIndex ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  i === stepIndex && "font-medium",
                  i > stepIndex && "text-muted-foreground"
                )}
              >
                {STEP_LABELS[s]}
              </span>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
              )}
            </div>
          ))}
        </div>
      );
    }

    function renderUploadStep() {
      return (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onFileChange}
            />
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">
              Dra og slipp kontooppsett-fil hit
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              .xlsx-fil (Account_Control_Onboarding_-_Kontooppsett)
            </p>
          </div>

          {parseError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}

          {parseResult && (
            <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <p className="text-sm text-violet-800 dark:text-violet-200">
                <span className="font-semibold">{rows.length}</span> rader
                funnet i{" "}
                <span className="font-medium">{parseResult.fileName}</span>
                {invalidRows.length > 0 && (
                  <span className="text-destructive ml-1">
                    ({invalidRows.length} med feil)
                  </span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">Oppstartsdato (IB)</Label>
            <Input
              type="date"
              value={ibDate}
              onChange={(e) => setIbDate(e.target.value)}
              className="h-9 max-w-xs"
            />
            {ibDate && (
              <p className="text-xs text-muted-foreground">
                Denne datoen settes som oppstartsdato for alle klienter.
              </p>
            )}
          </div>
        </div>
      );
    }

    function renderReviewStep() {
      return (
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          <div className="rounded-md border overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                  <tr>
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={
                          allValidSelected
                            ? true
                            : someValidSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={toggleAll}
                        aria-label="Velg alle"
                      />
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      Selskap
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      Kontonr regnskap
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      Bankkontonr
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-right">
                      IB regnskap
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-right">
                      IB bank
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      Bank
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isSelected = selected.has(row.index);
                    const isInvalid = !row.valid;
                    return (
                      <tr
                        key={row.index}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isInvalid &&
                            "bg-red-50/60 dark:bg-red-950/20",
                          !isInvalid &&
                            !isSelected &&
                            "opacity-50",
                          !isInvalid &&
                            isSelected &&
                            i % 2 === 1 &&
                            "bg-muted/30",
                          "hover:bg-sky-50 dark:hover:bg-sky-950/30"
                        )}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRow(row.index)}
                            disabled={isInvalid}
                          />
                        </td>
                        <td className="p-2 text-xs">
                          {row.selskapsnavn}
                        </td>
                        <td className="p-2 text-xs font-mono">
                          {row.kontonrRegnskap}
                        </td>
                        <td className="p-2 text-xs font-mono">
                          {row.ibanResult.ok
                            ? row.ibanResult.iban
                            : row.bankkontonr || "–"}
                        </td>
                        <td className="p-2 text-xs font-mono tabular-nums text-right">
                          {formatAmount(row.ibRegnskap)}
                        </td>
                        <td className="p-2 text-xs font-mono tabular-nums text-right">
                          {formatAmount(row.ibBank)}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {row.banknavn || "–"}
                        </td>
                        <td className="p-2">
                          {row.valid ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                              {row.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-4 py-2.5 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {selectedRows.length}
              </span>{" "}
              av {rows.length} rader valgt —{" "}
              <span className="font-semibold text-foreground">
                {selectedCompanies.length}
              </span>{" "}
              {selectedCompanies.length === 1 ? "selskap" : "selskaper"}
            </span>
            {invalidRows.length > 0 && (
              <span className="text-destructive font-medium text-xs">
                {invalidRows.length} rader med feil (ekskludert)
              </span>
            )}
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          )}
        </div>
      );
    }

    function renderConfirmStep() {
      if (createdCount > 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CircleCheck className="h-12 w-12 text-violet-600 dark:text-violet-400" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">
                {createdCount} klienter opprettet
              </p>
              <p className="text-sm text-muted-foreground">
                Klientene er klare for avstemming.
              </p>
            </div>
            <Button
              onClick={() => {
                setOpen(false);
                resetState();
                router.refresh();
              }}
            >
              Lukk
            </Button>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-medium">Oppsummering</span>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground pl-6">
              <p>
                <span className="font-semibold text-foreground">
                  {selectedRows.length}
                </span>{" "}
                klienter vil bli opprettet
              </p>
              <p>
                Fordelt på{" "}
                <span className="font-semibold text-foreground">
                  {selectedCompanies.length}
                </span>{" "}
                {selectedCompanies.length === 1 ? "selskap" : "selskaper"}
                {selectedCompanies.length <= 5 && (
                  <span>: {selectedCompanies.join(", ")}</span>
                )}
              </p>
              {ibDate && (
                <p>
                  Oppstartsdato:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(ibDate + "T00:00:00").toLocaleDateString("nb-NO")}
                  </span>
                </p>
              )}
            </div>
          </div>

          {selectedCompanies.length > 0 && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                Selskaper som ikke finnes fra før vil bli opprettet automatisk.
              </p>
            </div>
          )}

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          )}
        </div>
      );
    }

    function renderFooter() {
      if (step === "confirm" && createdCount > 0) return null;

      return (
        <div className="flex items-center justify-between border-t pt-3 shrink-0">
          <div>
            {step === "upload" && (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Avbryt
              </Button>
            )}
            {step === "review" && (
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                Tilbake
              </Button>
            )}
            {step === "confirm" && (
              <Button variant="outline" size="sm" onClick={() => setStep("review")}>
                Tilbake
              </Button>
            )}
          </div>
          <div>
            {step === "upload" && (
              <Button
                size="sm"
                disabled={!parseResult}
                onClick={() => setStep("review")}
              >
                Neste
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === "review" && (
              <Button
                size="sm"
                disabled={selectedRows.length === 0}
                onClick={() => setStep("confirm")}
              >
                Neste
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {step === "confirm" && (
              <Button
                size="sm"
                disabled={submitting || selectedRows.length === 0}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Oppretter...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Bekreft og opprett
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>Importer klienter fra Excel</DialogTitle>
                <DialogDescription>
                  Last opp kontooppsett-filen for å opprette flere klienter
                  samtidig.
                </DialogDescription>
              </div>
              {renderStepIndicator()}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-3 pt-2">
            {step === "upload" && renderUploadStep()}
            {step === "review" && renderReviewStep()}
            {step === "confirm" && renderConfirmStep()}
          </div>

          {renderFooter()}
        </DialogContent>
      </Dialog>
    );
  }
);
