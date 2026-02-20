"use client";

import { useCallback, useMemo, useState } from "react";
import type { InternalFieldKey } from "@/lib/import-scripts";
import { INTERNAL_FIELDS } from "@/lib/import-scripts";
import type { RowIssue } from "@/lib/parsers/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, ChevronRight, CircleCheck, X } from "lucide-react";

const DISPLAY_LABELS: Record<string, string> = {
  date1: "Dato 1",
  date2: "Dato 2",
  amount: "Beløp",
  credit: "Kredit",
  debit: "Debit",
  reference: "Ref",
  description: "Tekst",
  accountNumber: "Kontonr",
  currency: "Valuta",
  foreignAmount: "Valutabeløp",
  textCode: "Tekstkode",
  dim1: "Dim 1",
  dim2: "Dim 2",
  dim3: "Dim 3",
  dim4: "Dim 4",
  dim5: "Dim 5",
  dim6: "Dim 6",
  dim7: "Dim 7",
  dim8: "Dim 8",
  dim9: "Dim 9",
  dim10: "Dim 10",
  buntref: "Buntref",
  notat: "Notat",
  bilag: "Bilag",
  faktura: "Faktura",
  forfall: "Forfall",
  periode: "Periode",
  importNumber: "Importnummer",
  avgift: "Avgift",
  tilleggstekst: "Tilleggstekst",
  ref2: "Ref 2",
  ref3: "Ref 3",
  ref4: "Ref 4",
  ref5: "Ref 5",
  ref6: "Ref 6",
  anleggsnr: "Anleggsnr.",
  anleggsbeskrivelse: "Anleggsbeskrivelse",
  bilagsart: "Bilagsart",
  avsnr: "Avsnr.",
  tid: "Tid",
  avvikendeDato: "Avvikende dato",
  rate: "Rate",
  kundenavn: "Kundenavn",
  kontonummerBokføring: "Kontonr. bokføring",
  sign: "Fortegn",
};

function isValidDateString(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  let y: number, m: number, d: number;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    [y, m, d] = [+t.slice(0, 4), +t.slice(5, 7), +t.slice(8, 10)];
  } else if (/^\d{8}$/.test(t)) {
    [y, m, d] = [+t.slice(0, 4), +t.slice(4, 6), +t.slice(6, 8)];
  } else {
    const parts = t.split(/[./-]/);
    if (parts.length !== 3) return false;
    const [a, b, c] = parts;
    if (c.length === 4) { y = +c; m = +b; d = +a; }
    else if (a.length === 4) { y = +a; m = +b; d = +c; }
    else return false;
  }
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function isValidAmount(s: string): boolean {
  const cleaned = s.trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return false;
  const n = parseFloat(cleaned);
  return !isNaN(n) && n !== 0;
}

function validateDataRows(
  dataRows: string[][],
  mappings: Map<number, InternalFieldKey>,
  headerRowIndex: number,
): RowIssue[] {
  const issues: RowIssue[] = [];
  const dateCol = [...mappings.entries()].find(([, f]) => f === "date1")?.[0];
  const amountCol = [...mappings.entries()].find(([, f]) => f === "amount")?.[0];
  const creditCol = [...mappings.entries()].find(([, f]) => f === "credit")?.[0];
  const debitCol = [...mappings.entries()].find(([, f]) => f === "debit")?.[0];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNum = headerRowIndex + 2 + i;

    const hasAmount = amountCol !== undefined
      ? isValidAmount(row[amountCol] ?? "")
      : false;
    const hasCreditDebit = creditCol !== undefined && debitCol !== undefined;
    let hasNetAmount = false;
    if (hasCreditDebit) {
      const c = parseFloat((row[creditCol!] ?? "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
      const d = parseFloat((row[debitCol!] ?? "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
      hasNetAmount = Math.abs(c - d) > 0;
    }

    const rowHasValue = hasAmount || hasNetAmount;
    if (!rowHasValue) continue;

    if (dateCol !== undefined) {
      const val = (row[dateCol] ?? "").trim();
      if (!isValidDateString(val)) {
        issues.push({
          rowIndex: i,
          rowNumber: rowNum,
          field: "date1",
          value: val || "(tom)",
          reason: !val
            ? "Datofeltet er tomt"
            : `«${val}» er ikke et gjenkjennbart datoformat (forventet ÅÅÅÅMMDD, DD.MM.ÅÅÅÅ, eller ÅÅÅÅ-MM-DD)`,
        });
      }
    }

    if (amountCol !== undefined && !hasCreditDebit) {
      const val = (row[amountCol] ?? "").trim();
      if (val && !isValidAmount(val)) {
        issues.push({
          rowIndex: i,
          rowNumber: rowNum,
          field: "amount",
          value: val,
          reason: `«${val}» er ikke et gyldig beløp`,
        });
      }
    }
  }

  return issues;
}

type WizardStep =
  | "pick-header"
  | "select-date"
  | "select-amount"
  | "select-extras"
  | "confirm";

const STEPS: WizardStep[] = [
  "pick-header",
  "select-date",
  "select-amount",
  "select-extras",
  "confirm",
];

const STEP_LABELS: Record<WizardStep, string> = {
  "pick-header": "Overskrift",
  "select-date": "Dato",
  "select-amount": "Beløp",
  "select-extras": "Ekstra",
  confirm: "Bekreft",
};

const COL_W = 150;
const PRIMARY_FIELDS: InternalFieldKey[] = ["date1", "date2", "amount", "credit", "debit"];

export interface WizardResult {
  headerRowIndex: number;
  columnMappings: Array<{
    colIndex: number;
    field: InternalFieldKey;
    header: string;
  }>;
}

interface ColumnImportWizardProps {
  rawRows: string[][];
  onComplete: (result: WizardResult) => void;
  onCancel: () => void;
}

export function ColumnImportWizard({
  rawRows,
  onComplete,
  onCancel,
}: ColumnImportWizardProps) {
  const [step, setStep] = useState<WizardStep>("pick-header");
  const [headerRowIndex, setHeaderRowIndex] = useState<number | null>(null);
  const [mappings, setMappings] = useState<Map<number, InternalFieldKey>>(
    new Map()
  );
  const [creditDebitMode, setCreditDebitMode] = useState(false);
  const [activeExtraCol, setActiveExtraCol] = useState<number | null>(null);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const colCount = useMemo(
    () => Math.max(...rawRows.map((r) => r.length), 0),
    [rawRows]
  );
  const headerValues = useMemo(
    () => (headerRowIndex !== null ? (rawRows[headerRowIndex] ?? []) : []),
    [rawRows, headerRowIndex]
  );
  const dataRows = useMemo(
    () =>
      headerRowIndex !== null ? rawRows.slice(headerRowIndex + 1) : [],
    [rawRows, headerRowIndex]
  );

  const selectedColSet = useMemo(() => new Set(mappings.keys()), [mappings]);

  const displayOrder = useMemo(() => {
    const priority: Record<string, number> = {
      date1: 0,
      date2: 1,
      amount: 2,
      credit: 2,
      debit: 3,
    };
    const entries = [...mappings.entries()];
    const sorted = [...entries].sort(
      (a, b) => (priority[a[1]] ?? 10) - (priority[b[1]] ?? 10)
    );
    const selected = sorted.map(([ci]) => ci);
    const all = Array.from({ length: colCount }, (_, i) => i);
    const unselected = all.filter((c) => !mappings.has(c));
    return [...selected, ...unselected];
  }, [mappings, colCount]);

  const selectedCount = mappings.size;
  const unselectedCols = useMemo(
    () =>
      Array.from({ length: colCount }, (_, i) => i).filter(
        (i) => !selectedColSet.has(i)
      ),
    [colCount, selectedColSet]
  );

  const validationIssues = useMemo(
    () =>
      step === "confirm" && headerRowIndex !== null
        ? validateDataRows(dataRows, mappings, headerRowIndex)
        : [],
    [step, dataRows, mappings, headerRowIndex],
  );

  const validRowCount = useMemo(() => {
    if (step !== "confirm") return dataRows.length;
    const issueRowSet = new Set(validationIssues.map((i) => i.rowIndex));
    const amountCol = [...mappings.entries()].find(([, f]) => f === "amount")?.[0];
    const creditCol = [...mappings.entries()].find(([, f]) => f === "credit")?.[0];
    const debitCol = [...mappings.entries()].find(([, f]) => f === "debit")?.[0];
    let count = 0;
    for (let i = 0; i < dataRows.length; i++) {
      if (issueRowSet.has(i)) continue;
      const row = dataRows[i];
      if (amountCol !== undefined && isValidAmount(row[amountCol] ?? "")) count++;
      else if (creditCol !== undefined && debitCol !== undefined) {
        const c = parseFloat((row[creditCol] ?? "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
        const d = parseFloat((row[debitCol] ?? "").trim().replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
        if (Math.abs(c - d) > 0) count++;
      }
    }
    return count;
  }, [step, dataRows, validationIssues, mappings]);

  const usedFields = useMemo(() => new Set(mappings.values()), [mappings]);
  const availableFields = useMemo(
    () => INTERNAL_FIELDS.filter((f) => !usedFields.has(f)),
    [usedFields]
  );

  const extraCount = useMemo(
    () =>
      [...mappings.values()].filter((f) => !PRIMARY_FIELDS.includes(f))
        .length,
    [mappings]
  );
  const progressPct = Math.min(100, (extraCount / 5) * 100);

  const hasCreditMapped = useMemo(
    () => [...mappings.values()].includes("credit"),
    [mappings]
  );
  const hasDebitMapped = useMemo(
    () => [...mappings.values()].includes("debit"),
    [mappings]
  );
  const hasAmountMapped = useMemo(
    () => [...mappings.values()].includes("amount"),
    [mappings]
  );

  /* ─── handlers ──────────────────────────── */

  const replaceMapping = useCallback(
    (field: InternalFieldKey, colIndex: number) => {
      setMappings((prev) => {
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v === field) next.delete(k);
        }
        next.set(colIndex, field);
        return next;
      });
    },
    []
  );

  const handleHeaderRowClick = useCallback(
    (index: number) => {
      setHeaderRowIndex(index);
      setMappings(new Map());
      setCreditDebitMode(false);
      setStep("select-date");
    },
    []
  );

  const handleColumnClick = useCallback(
    (colIndex: number) => {
      if (selectedColSet.has(colIndex)) return;

      if (step === "select-date") {
        replaceMapping("date1", colIndex);
        setStep("select-amount");
      } else if (step === "select-amount") {
        if (!creditDebitMode) {
          replaceMapping("amount", colIndex);
          setStep("select-extras");
        } else {
          if (!hasCreditMapped) {
            replaceMapping("credit", colIndex);
          } else if (!hasDebitMapped) {
            replaceMapping("debit", colIndex);
            setStep("select-extras");
          }
        }
      }
    },
    [
      step,
      selectedColSet,
      creditDebitMode,
      hasCreditMapped,
      hasDebitMapped,
      replaceMapping,
    ]
  );

  const handleExtraSelect = useCallback(
    (colIndex: number, field: InternalFieldKey) => {
      setMappings((prev) => {
        const next = new Map(prev);
        next.set(colIndex, field);
        return next;
      });
      setActiveExtraCol(null);
    },
    []
  );

  const handleRemoveExtra = useCallback((colIndex: number) => {
    setMappings((prev) => {
      const next = new Map(prev);
      next.delete(colIndex);
      return next;
    });
  }, []);

  const handleSwitchToCreditDebit = useCallback(() => {
    setMappings((prev) => {
      const next = new Map(prev);
      for (const [k, v] of next) {
        if (v === "amount") next.delete(k);
      }
      return next;
    });
    setCreditDebitMode(true);
  }, []);

  const handleSwitchToSingleAmount = useCallback(() => {
    setMappings((prev) => {
      const next = new Map(prev);
      for (const [k, v] of next) {
        if (v === "credit" || v === "debit") next.delete(k);
      }
      return next;
    });
    setCreditDebitMode(false);
  }, []);

  const handleBack = useCallback(() => {
    if (step === "select-date") {
      setHeaderRowIndex(null);
      setMappings(new Map());
      setCreditDebitMode(false);
      setStep("pick-header");
    } else if (step === "select-amount") {
      setStep("select-date");
    } else if (step === "select-extras") {
      setStep("select-amount");
    } else if (step === "confirm") {
      setStep("select-extras");
    }
  }, [step]);

  const handleConfirm = useCallback(() => {
    if (headerRowIndex === null) return;
    onComplete({
      headerRowIndex,
      columnMappings: [...mappings.entries()].map(([ci, field]) => ({
        colIndex: ci,
        field,
        header: headerValues[ci] ?? `Kolonne ${ci + 1}`,
      })),
    });
  }, [headerRowIndex, mappings, headerValues, onComplete]);

  /* ─── edge cases ────────────────────────── */

  if (rawRows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Ingen data funnet i filen.
        </p>
      </div>
    );
  }

  /* ─── render helpers ────────────────────── */

  const canAdvanceFromAmount = creditDebitMode
    ? hasCreditMapped && hasDebitMapped
    : hasAmountMapped;

  const isColumnClickStep =
    step === "select-date" || step === "select-amount";

  function renderStepIndicator() {
    return (
      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i < stepIndex && "bg-green-500 text-white",
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

  function renderInstruction() {
    switch (step) {
      case "pick-header":
        return (
          <p className="text-sm text-muted-foreground shrink-0">
            Klikk på raden som inneholder overskriftene (kolonne-navn).
            Alle rader over den valgte raden fjernes. Data under blir
            importert.
          </p>
        );
      case "select-date":
        return (
          <p className="text-sm text-muted-foreground shrink-0">
            Klikk på kolonnen som inneholder{" "}
            <strong>dato</strong>-verdier.
          </p>
        );
      case "select-amount":
        if (creditDebitMode) {
          return (
            <div className="shrink-0 space-y-1">
              <p className="text-sm text-muted-foreground">
                {!hasCreditMapped
                  ? <>Klikk på kolonnen som inneholder <strong>kredit</strong>-verdier.</>
                  : <>Klikk på kolonnen som inneholder <strong>debit</strong>-verdier.</>}
              </p>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={handleSwitchToSingleAmount}
              >
                Bruk én beløpskolonne istedenfor
              </button>
            </div>
          );
        }
        return (
          <div className="shrink-0 space-y-1">
            <p className="text-sm text-muted-foreground">
              Klikk på kolonnen som inneholder{" "}
              <strong>beløp</strong>-verdier.
            </p>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={handleSwitchToCreditDebit}
            >
              Har du separate Kredit og Debit-kolonner?
            </button>
          </div>
        );
      case "select-extras":
        return (
          <div className="shrink-0 space-y-2">
            <p className="text-sm text-muted-foreground">
              Velg flere kolonner for bedre matching. Klikk på en
              kolonneoverskrift og velg felt.
            </p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    extraCount >= 5
                      ? "bg-green-500"
                      : extraCount >= 3
                        ? "bg-green-400"
                        : "bg-amber-400"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {extraCount === 0
                  ? "Ingen ekstra felt"
                  : extraCount <= 2
                    ? `${extraCount} felt — flere gir bedre matching`
                    : extraCount <= 4
                      ? `${extraCount} felt — bra!`
                      : `${extraCount} felt — utmerket!`}
              </span>
            </div>
          </div>
        );
      case "confirm": {
        const hasIssues = validationIssues.length > 0;
        const shownIssues = showAllIssues
          ? validationIssues
          : validationIssues.slice(0, 5);
        return (
          <div className="shrink-0 space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3">
              <CircleCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>{validRowCount}</strong> rader er klare for import.
              </p>
            </div>

            {hasIssues && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {validationIssues.length} {validationIssues.length === 1 ? "rad" : "rader"} har
                      problemer og vil bli hoppet over:
                    </p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
                      {shownIssues.map((issue) => (
                        <li key={`${issue.rowIndex}-${issue.field}`}>
                          <strong>Rad {issue.rowNumber}:</strong> {issue.reason}
                        </li>
                      ))}
                    </ul>
                    {validationIssues.length > 5 && !showAllIssues && (
                      <button
                        type="button"
                        className="text-xs text-amber-600 underline"
                        onClick={() => setShowAllIssues(true)}
                      >
                        Vis alle {validationIssues.length} problemer
                      </button>
                    )}
                    <p className="text-xs text-amber-600 dark:text-amber-400 pt-1">
                      Disse radene ser ut til å inneholde verdier som ikke kan
                      tolkes som gyldige transaksjoner (f.eks. saldo-rader,
                      overskrifter eller tomme felter). Du kan importere de
                      gyldige radene, eller avbryte og rette filen først.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
    }
  }

  /* ─── pick-header table ─────────────────── */

  function renderPickHeaderTable() {
    return (
      <div className="min-h-0 flex-1 border rounded-md overflow-auto">
        <table className="text-sm table-fixed border-collapse w-full">
          <colgroup>
            <col style={{ width: 48 }} />
            {Array.from({ length: colCount }, (_, c) => (
              <col key={c} style={{ width: COL_W }} />
            ))}
          </colgroup>
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground border-b">
                Rad
              </th>
              {Array.from({ length: colCount }, (_, c) => (
                <th
                  key={c}
                  className="p-2 font-medium text-left border-b text-muted-foreground"
                  style={{
                    width: COL_W,
                    minWidth: COL_W,
                    maxWidth: COL_W,
                  }}
                >
                  K{c + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rawRows.map((row, i) => (
              <tr
                key={i}
                className="border-t cursor-pointer transition-colors hover:bg-primary/10"
                onClick={() => handleHeaderRowClick(i)}
              >
                <td className="px-2 py-1.5 font-medium text-muted-foreground align-top text-xs">
                  {i + 1}
                </td>
                {Array.from({ length: colCount }, (_, c) => (
                  <td
                    key={c}
                    className="px-2 py-1.5 truncate align-top text-xs"
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      maxWidth: COL_W,
                    }}
                    title={String(row[c] ?? "")}
                  >
                    {String(row[c] ?? "") || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ─── column-selection table (date / amount / extras) ── */

  function renderDataTable() {
    const selOrder = displayOrder.filter((c) => selectedColSet.has(c));
    const lastSelectedIdx =
      selOrder.length > 0 ? displayOrder.indexOf(selOrder[selOrder.length - 1]) : -1;

    return (
      <div className="min-h-0 flex-1 border rounded-md overflow-auto">
        <table className="text-sm table-fixed border-collapse w-full">
          <colgroup>
            <col style={{ width: 48 }} />
            {displayOrder.map((c) => (
              <col key={c} style={{ width: COL_W }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="text-left p-2 font-medium text-muted-foreground border-b bg-muted">
                #
              </th>
              {displayOrder.map((c, di) => {
                const isSelected = selectedColSet.has(c);
                const field = mappings.get(c);
                const isSeparator = di === lastSelectedIdx && lastSelectedIdx >= 0;
                const isExtraActive =
                  step === "select-extras" &&
                  activeExtraCol === c &&
                  !isSelected;

                if (isSelected) {
                  return (
                    <th
                      key={c}
                      className={cn(
                        "p-2 font-medium text-left border-b truncate",
                        "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200",
                        isSeparator &&
                          "border-r-2 border-r-green-400 dark:border-r-green-600"
                      )}
                      style={{
                        width: COL_W,
                        minWidth: COL_W,
                        maxWidth: COL_W,
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <span className="truncate">
                          {DISPLAY_LABELS[field!] ?? field}
                        </span>
                        {step === "select-extras" &&
                          !PRIMARY_FIELDS.includes(field!) && (
                            <button
                              type="button"
                              className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveExtra(c);
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                      </div>
                      <div className="text-xs font-normal text-muted-foreground truncate">
                        {headerValues[c] ?? `K${c + 1}`}
                      </div>
                    </th>
                  );
                }

                if (step === "select-extras") {
                  return (
                    <th
                      key={c}
                      className={cn(
                        "p-0 font-medium text-left border-b align-bottom bg-muted",
                        isExtraActive && "ring-2 ring-primary"
                      )}
                      style={{
                        width: COL_W,
                        minWidth: COL_W,
                        maxWidth: COL_W,
                      }}
                    >
                      {isExtraActive ? (
                        <div className="p-1.5 space-y-0.5">
                          <Select
                            value=""
                            onValueChange={(v) =>
                              handleExtraSelect(
                                c,
                                v as InternalFieldKey
                              )
                            }
                            open
                            onOpenChange={(open) => {
                              if (!open) setActiveExtraCol(null);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue placeholder="Velg felt…" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFields.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {DISPLAY_LABELS[f] ?? f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground truncate">
                            {headerValues[c] ?? `K${c + 1}`}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left p-2 hover:bg-primary/10 transition-colors cursor-pointer"
                          onClick={() => setActiveExtraCol(c)}
                        >
                          <span className="truncate block text-sm">
                            {headerValues[c] ?? `Kolonne ${c + 1}`}
                          </span>
                        </button>
                      )}
                    </th>
                  );
                }

                return (
                  <th
                    key={c}
                    className={cn(
                      "p-2 font-medium text-left border-b truncate transition-colors bg-muted",
                      isColumnClickStep &&
                        "cursor-pointer hover:bg-primary/10 hover:text-primary"
                    )}
                    style={{
                      width: COL_W,
                      minWidth: COL_W,
                      maxWidth: COL_W,
                    }}
                    onClick={() =>
                      isColumnClickStep && handleColumnClick(c)
                    }
                    title={headerValues[c] ?? `Kolonne ${c + 1}`}
                  >
                    {headerValues[c] ?? `Kolonne ${c + 1}`}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {dataRows.slice(0, 50).map((row, idx) => (
              <tr key={idx} className="border-t">
                <td className="px-2 py-1.5 font-medium text-muted-foreground align-top text-xs">
                  {headerRowIndex! + 2 + idx}
                </td>
                {displayOrder.map((c, di) => {
                  const isSelected = selectedColSet.has(c);
                  const isSeparator = di === lastSelectedIdx && lastSelectedIdx >= 0;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "px-2 py-1.5 truncate align-top text-xs",
                        isSelected &&
                          "bg-green-50/50 dark:bg-green-950/10",
                        isSeparator &&
                          "border-r-2 border-r-green-400 dark:border-r-green-600",
                        isColumnClickStep &&
                          !isSelected &&
                          "cursor-pointer hover:bg-primary/5"
                      )}
                      style={{
                        width: COL_W,
                        minWidth: COL_W,
                        maxWidth: COL_W,
                      }}
                      title={String(row[c] ?? "")}
                      onClick={() =>
                        isColumnClickStep &&
                        !isSelected &&
                        handleColumnClick(c)
                      }
                    >
                      {String(row[c] ?? "") || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {dataRows.length > 50 && (
          <p className="text-muted-foreground text-xs p-2 border-t">
            Viser 50 av {dataRows.length} datarader
          </p>
        )}
      </div>
    );
  }

  /* ─── confirm view ──────────────────────── */

  function renderConfirmView() {
    const selected = [...mappings.entries()].map(([ci, field]) => ({
      colIndex: ci,
      field,
      header: headerValues[ci] ?? `Kolonne ${ci + 1}`,
    }));

    const issueRowSet = new Set(validationIssues.map((i) => i.rowIndex));
    const issueFieldMap = new Map<number, Set<string>>();
    for (const issue of validationIssues) {
      if (!issueFieldMap.has(issue.rowIndex)) issueFieldMap.set(issue.rowIndex, new Set());
      issueFieldMap.get(issue.rowIndex)!.add(issue.field);
    }

    return (
      <div className="min-h-0 flex-1 border rounded-md overflow-auto">
        <table className="text-sm table-fixed border-collapse w-full">
          <colgroup>
            <col style={{ width: 48 }} />
            {selected.map((m) => (
              <col key={m.colIndex} style={{ width: 180 }} />
            ))}
          </colgroup>
          <thead className="bg-green-50 dark:bg-green-950/30 sticky top-0 z-10">
            <tr>
              <th
                className="p-2 font-medium text-left border-b text-muted-foreground"
                style={{ width: 48, minWidth: 48, maxWidth: 48 }}
              >
                #
              </th>
              {selected.map((m) => (
                <th
                  key={m.colIndex}
                  className="p-2 font-medium text-left border-b text-green-800 dark:text-green-200"
                  style={{ width: 180, minWidth: 180, maxWidth: 180 }}
                >
                  <div>{DISPLAY_LABELS[m.field] ?? m.field}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {m.header}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.slice(0, 30).map((row, idx) => {
              const hasIssue = issueRowSet.has(idx);
              const rowFields = issueFieldMap.get(idx);
              return (
                <tr
                  key={idx}
                  className={cn(
                    "border-t",
                    hasIssue && "bg-amber-50/60 dark:bg-amber-950/20 line-through opacity-60",
                  )}
                >
                  <td
                    className="px-2 py-1.5 font-medium text-muted-foreground align-top text-xs"
                    style={{ width: 48, minWidth: 48, maxWidth: 48 }}
                  >
                    {headerRowIndex! + 2 + idx}
                  </td>
                  {selected.map((m) => {
                    const cellHasIssue = hasIssue && rowFields?.has(m.field);
                    return (
                      <td
                        key={m.colIndex}
                        className={cn(
                          "px-2 py-1.5 truncate align-top text-xs",
                          cellHasIssue &&
                            "text-amber-700 dark:text-amber-400 font-medium",
                        )}
                        style={{ width: 180, minWidth: 180, maxWidth: 180 }}
                        title={String(row[m.colIndex] ?? "")}
                      >
                        {String(row[m.colIndex] ?? "") || "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {dataRows.length > 30 && (
          <p className="text-muted-foreground text-xs p-2 border-t">
            Viser 30 av {dataRows.length} datarader
          </p>
        )}
      </div>
    );
  }

  /* ─── footer ────────────────────────────── */

  function renderFooter() {
    return (
      <div className="flex items-center justify-between border-t pt-3 shrink-0">
        <div>
          {step !== "pick-header" && (
            <Button variant="outline" size="sm" onClick={handleBack}>
              Tilbake
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Avbryt
          </Button>
          {step === "select-amount" && canAdvanceFromAmount && (
            <Button
              size="sm"
              onClick={() => setStep("select-extras")}
            >
              Neste
            </Button>
          )}
          {step === "select-extras" && (
            <Button size="sm" onClick={() => setStep("confirm")}>
              {extraCount === 0 ? "Hopp over" : "Neste"}
            </Button>
          )}
          {step === "confirm" && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={validRowCount === 0}
            >
              {validationIssues.length > 0
                ? `Importer ${validRowCount} rader`
                : "Bekreft og importer"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ─── main layout ───────────────────────── */

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3">
      {renderStepIndicator()}
      {renderInstruction()}
      {step === "pick-header" && renderPickHeaderTable()}
      {(step === "select-date" ||
        step === "select-amount" ||
        step === "select-extras") &&
        renderDataTable()}
      {step === "confirm" && renderConfirmView()}
      {renderFooter()}
    </div>
  );
}
