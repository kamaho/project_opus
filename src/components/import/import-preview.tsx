"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ParsedTransaction } from "@/lib/parsers";
import type { InternalFieldKey } from "@/lib/import-scripts";
import { INTERNAL_FIELDS, SCRIPT_FIELD_LABELS } from "@/lib/import-scripts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableAppearance } from "@/contexts/ui-preferences-context";

const TX_ROW_HEIGHT = 36;

const DEFAULT_COL_WIDTH = 140;
const MIN_COL_WIDTH = 60;

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

type CsvColumnMeta = { colIndex: number; suggestedField: InternalFieldKey | "" | "none" };

interface ImportPreviewProps {
  transactions: ParsedTransaction[];
  errors: string[];
  className?: string;
  /** CSV-modus: kolonner fra fil (header blir dropdown med verdier + mapping) */
  csvColumns?: CsvColumnMeta[];
  csvPreviewRows?: string[][];
  onColumnMappingChange?: (colIndex: number, field: InternalFieldKey | "" | "none") => void;
  /** Excel: rå rader slik at bruker kan klikke på raden som er overskrift direkte i tabellen */
  excelRawRows?: string[][];
  excelHeaderRowIndex?: number;
  onExcelHeaderRowClick?: (index: number) => void;
  /** Enable row selection in standard transaction view */
  selectable?: boolean;
  selectedIndices?: Set<number>;
  onSelectionChange?: (indices: Set<number>) => void;
}

export function ImportPreview({
  transactions,
  errors,
  className,
  csvColumns,
  csvPreviewRows,
  onColumnMappingChange,
  excelRawRows,
  excelHeaderRowIndex,
  onExcelHeaderRowClick,
  selectable,
  selectedIndices,
  onSelectionChange,
}: ImportPreviewProps) {
  const [openHeaderCol, setOpenHeaderCol] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const tableAppearance = useTableAppearance();
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const txScrollRef = useRef<HTMLDivElement>(null);

  const isStandardMode = !Array.isArray(csvColumns) || csvColumns.length === 0;
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredTxWithIndex = useMemo(() => {
    if (!isStandardMode || !deferredSearch.trim()) {
      return transactions.map((t, i) => ({ tx: t, origIndex: i }));
    }
    const q = deferredSearch.toLowerCase().trim();
    return transactions
      .map((t, i) => ({ tx: t, origIndex: i }))
      .filter(({ tx }) =>
        (tx.date1 ?? "").toLowerCase().includes(q) ||
        (tx.amount ?? "").toLowerCase().includes(q) ||
        (tx.reference ?? "").toLowerCase().includes(q) ||
        (tx.description ?? "").toLowerCase().includes(q) ||
        (tx.bilag ?? "").toLowerCase().includes(q) ||
        (tx.accountNumber ?? "").toLowerCase().includes(q)
      );
  }, [transactions, deferredSearch, isStandardMode]);

  const txVirtualizer = useVirtualizer({
    count: isStandardMode ? filteredTxWithIndex.length : 0,
    getScrollElement: () => txScrollRef.current,
    estimateSize: () => TX_ROW_HEIGHT,
    overscan: 20,
  });

  const isExcelRowPickerMode =
    Array.isArray(excelRawRows) &&
    excelHeaderRowIndex !== undefined &&
    typeof onExcelHeaderRowClick === "function" &&
    Array.isArray(csvColumns) &&
    csvColumns.length > 0;
  const isCsvMappingMode =
    !isExcelRowPickerMode &&
    Array.isArray(csvColumns) &&
    csvColumns.length > 0 &&
    Array.isArray(csvPreviewRows);

  const getColWidth = useCallback(
    (colIndex: number) => colWidths[colIndex] ?? DEFAULT_COL_WIDTH,
    [colWidths]
  );

  const handleResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingCol(colIndex);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = getColWidth(colIndex);
    },
    [getColWidth]
  );

  useEffect(() => {
    if (resizingCol === null) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStartX.current;
      setColWidths((prev) => ({
        ...prev,
        [resizingCol]: Math.max(MIN_COL_WIDTH, resizeStartWidth.current + dx),
      }));
    };
    const onEnd = () => setResizingCol(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizingCol]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {errors.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-amber-800 dark:text-amber-200 text-sm mb-4">
          <p className="font-medium">
            Advarsler ved lesing ({errors.length} melding{errors.length !== 1 ? "er" : ""})
          </p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            {errors.slice(0, 8).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 8 && (
              <li className="text-muted-foreground">… og {errors.length - 8} til</li>
            )}
          </ul>
        </div>
      )}
      <p className="text-muted-foreground text-sm mb-2">
        {isExcelRowPickerMode
          ? "Klikk på raden som inneholder overskrifter. Deretter velg felt per kolonne i overskriftsraden."
          : isCsvMappingMode
            ? `${csvPreviewRows!.length} rader · Klikk på kolonneoverskrift for å velge hva kolonnen skal mappes til`
            : `${transactions.length} transaksjoner`}
      </p>
      {(isExcelRowPickerMode || isCsvMappingMode) && (
        <p className="text-amber-700 dark:text-amber-300 text-xs mb-2">
          Kolonner uten feltvalg er merket med gul ramme. Velg et felt som finnes i appen, eller «— Ingen» for å ignorere kolonnen. Først når alle kolonner er tilordnet kan du importere.
        </p>
      )}
      <div ref={txScrollRef} className="min-h-0 flex-1 border rounded-md overflow-auto min-w-0">
        {isExcelRowPickerMode ? (
          (() => {
            const raw = excelRawRows!;
            const hIdx = excelHeaderRowIndex!;
            const colCount = Math.max(
              raw.length ? Math.max(...raw.map((r) => r.length)) : 0,
              csvColumns!.length
            );
            const headerRow = raw[hIdx] ?? [];
            return (
              <table className={cn("text-sm table-fixed border-collapse w-full", tableAppearance.tableClass)}>
                <colgroup>
                  <col style={{ width: 48 }} />
                  {Array.from({ length: colCount }, (_, c) => (
                    <col key={c} style={{ width: getColWidth(c) }} />
                  ))}
                </colgroup>
                <thead className={cn("bg-primary/10 sticky top-0 z-10", tableAppearance.theadClass)}>
                  <tr>
                    <th key="rad" className="text-left p-2 font-medium text-muted-foreground border-b">
                      Rad {hIdx + 1}
                    </th>
                    {Array.from({ length: colCount }, (_v, c) => {
                      const col = csvColumns!.find((x) => x.colIndex === c);
                      const label =
                        col?.suggestedField &&
                        col.suggestedField !== "none" &&
                        DISPLAY_LABELS[col.suggestedField]
                          ? DISPLAY_LABELS[col.suggestedField]
                          : null;
                      const isUnmapped = col?.suggestedField === "";
                      const columnValues = raw.map((row) => String(row[c] ?? ""));
                      if (!col) {
                        return (
                          <th
                            key={`col-${c}`}
                            className="p-2 font-medium text-left border-b truncate"
                            style={{ width: getColWidth(c), minWidth: getColWidth(c), maxWidth: getColWidth(c) }}
                            title={String(headerRow[c] ?? "")}
                          >
                            {String(headerRow[c] ?? "") || `K${c + 1}`}
                          </th>
                        );
                      }
                      return (
                        <th
                          key={`col-${c}`}
                          className="p-0 align-bottom relative group border-b"
                          style={{ width: getColWidth(c), minWidth: getColWidth(c), maxWidth: getColWidth(c) }}
                        >
                          <DropdownMenu
                            open={openHeaderCol === c}
                            onOpenChange={(open) => setOpenHeaderCol(open ? c : null)}
                          >
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className={cn(
                                  "w-full h-full min-h-[2.25rem] justify-between rounded-none border-b-2 font-medium text-left px-2 py-2 pr-6",
                                  isUnmapped && "ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-500",
                                  !isUnmapped && "border-transparent hover:bg-muted/80",
                                  openHeaderCol === c && "bg-muted/80 border-primary"
                                )}
                              >
                                <span className="truncate" title={String(headerRow[c] ?? "")}>
                                  {label ? `${label} (K${c + 1})` : String(headerRow[c] ?? "") || `Kolonne ${c + 1}`}
                                </span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-[min(380px,90vw)] max-h-[70vh] overflow-hidden flex flex-col"
                            >
                              <div className="p-2 border-b">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Verdier i kolonne {c + 1}
                                </p>
                                <div className="max-h-[200px] overflow-y-auto rounded border bg-muted/30 p-2 text-xs font-mono space-y-0.5">
                                  {columnValues.length === 0 ? (
                                    <span className="text-muted-foreground">Ingen verdier</span>
                                  ) : (
                                    columnValues.slice(0, 50).map((val, i) => (
                                      <div key={i} className="truncate" title={val}>
                                        {val || "\u00A0"}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div className="p-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                  Denne kolonnen er:
                                </p>
                                <Select
                                  value={col?.suggestedField === "none" || col?.suggestedField === "" ? "none" : col?.suggestedField ?? "none"}
                                  onValueChange={(v) => {
                                    onColumnMappingChange?.(c, v === "none" ? "none" : (v as InternalFieldKey));
                                    setOpenHeaderCol(null);
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs w-full">
                                    <SelectValue placeholder="— Ingen" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">— Ingen</SelectItem>
                                    <SelectItem value="date1">{DISPLAY_LABELS.date1 ?? "Dato 1"}</SelectItem>
                                    <SelectItem value="date2">{DISPLAY_LABELS.date2 ?? "Dato 2"}</SelectItem>
                                    <SelectItem value="amount">{DISPLAY_LABELS.amount ?? "Beløp"}</SelectItem>
                                    <SelectItem value="credit">{DISPLAY_LABELS.credit ?? "Kredit"}</SelectItem>
                                    <SelectItem value="debit">{DISPLAY_LABELS.debit ?? "Debit"}</SelectItem>
                                    <SelectItem value="reference">{DISPLAY_LABELS.reference ?? "Ref"}</SelectItem>
                                    <SelectItem value="description">{DISPLAY_LABELS.description ?? "Tekst"}</SelectItem>
                                    <SelectItem value="accountNumber">{DISPLAY_LABELS.accountNumber ?? "Kontonr"}</SelectItem>
                                    <SelectItem value="currency">{DISPLAY_LABELS.currency ?? "Valuta"}</SelectItem>
                                    {INTERNAL_FIELDS.filter(
                                      (f) =>
                                        !["date1", "date2", "amount", "credit", "debit", "reference", "description", "accountNumber", "currency"].includes(f)
                                    ).map((f) => (
                                      <SelectItem key={f} value={f}>
                                        {DISPLAY_LABELS[f] ?? SCRIPT_FIELD_LABELS[f] ?? f}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <div
                            role="separator"
                            aria-label={`Juster bredde kolonne ${c + 1}`}
                            className={cn(
                              "absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize touch-none z-20",
                              "hover:bg-primary/30 active:bg-primary/50",
                              resizingCol === c && "bg-primary/50"
                            )}
                            onMouseDown={(e) => handleResizeStart(c, e)}
                          />
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {raw
                    .filter((_row, i) => i > hIdx)
                    .map((row, idx) => {
                      const i = hIdx + 1 + idx;
                      return (
                        <tr
                          key={i}
                          className={cn(
                            tableAppearance.rowBorderClass,
                            idx % 2 === 1 && tableAppearance.rowAlternateClass
                          )}
                        >
                          <td key={`${i}-rad`} className="px-2 py-1.5 font-medium text-muted-foreground align-top w-12">
                            {i + 1}
                          </td>
                          {Array.from({ length: colCount }, (_v, c) => (
                            <td key={`col-${c}`} className="p-2 truncate align-top" title={String(row[c] ?? "")}>
                              {String(row[c] ?? "") || "—"}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            );
          })()
        ) : isCsvMappingMode ? (
          <table
            className={cn("text-sm table-fixed border-collapse", tableAppearance.tableClass)}
            style={{
              minWidth: csvColumns!.reduce((sum, col) => sum + getColWidth(col.colIndex), 0),
            }}
          >
            <colgroup>
              {csvColumns!.map((col) => (
                <col key={col.colIndex} style={{ width: getColWidth(col.colIndex) }} />
              ))}
            </colgroup>
            <thead className={cn("bg-muted sticky top-0 z-10", tableAppearance.theadClass)}>
              <tr>
                {csvColumns!.map((col) => {
                  const label =
                    col.suggestedField &&
                    col.suggestedField !== "none" &&
                    DISPLAY_LABELS[col.suggestedField]
                      ? DISPLAY_LABELS[col.suggestedField]
                      : null;
                  const isUnmapped = col.suggestedField === "";
                  const columnValues =
                    csvPreviewRows!.map((row) => String(row[col.colIndex] ?? "")) ?? [];
                  const w = getColWidth(col.colIndex);
                  return (
                    <th
                      key={col.colIndex}
                      className={cn(
                        "p-0 align-bottom relative group",
                        isUnmapped && "ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-500"
                      )}
                      style={{ width: w, minWidth: w, maxWidth: w }}
                    >
                      <DropdownMenu
                        open={openHeaderCol === col.colIndex}
                        onOpenChange={(open) => setOpenHeaderCol(open ? col.colIndex : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full h-full min-h-[2.25rem] justify-between rounded-none border-b-2 font-medium text-left px-2 py-2 pr-6",
                              isUnmapped && "ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:ring-amber-500",
                              !isUnmapped && "border-transparent hover:bg-muted/80",
                              openHeaderCol === col.colIndex && "bg-muted/80 border-primary"
                            )}
                          >
                            <span className="truncate">
                              {label ? `${label} (K${col.colIndex + 1})` : `Kolonne ${col.colIndex + 1}`}
                            </span>
                            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[min(380px,90vw)] max-h-[70vh] overflow-hidden flex flex-col"
                        >
                          <div className="p-2 border-b">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Verdier i kolonne {col.colIndex + 1}
                            </p>
                            <div className="max-h-[200px] overflow-y-auto rounded border bg-muted/30 p-2 text-xs font-mono space-y-0.5">
                              {columnValues.length === 0 ? (
                                <span className="text-muted-foreground">Ingen verdier</span>
                              ) : (
                                columnValues.map((val, i) => (
                                  <div key={i} className="truncate" title={val}>
                                    {val || "\u00A0"}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">
                              Denne kolonnen er:
                            </p>
                            <Select
                              value={col.suggestedField === "none" || col.suggestedField === "" ? "none" : col.suggestedField}
                              onValueChange={(v) => {
                                onColumnMappingChange?.(
                                  col.colIndex,
                                  v === "none" ? "none" : (v as InternalFieldKey)
                                );
                                setOpenHeaderCol(null);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-full">
                                <SelectValue placeholder="— Ingen" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Ingen</SelectItem>
                                <SelectItem value="date1">{DISPLAY_LABELS.date1 ?? "Dato 1"}</SelectItem>
                                <SelectItem value="date2">{DISPLAY_LABELS.date2 ?? "Dato 2"}</SelectItem>
                                <SelectItem value="amount">{DISPLAY_LABELS.amount ?? "Beløp"}</SelectItem>
                                <SelectItem value="credit">{DISPLAY_LABELS.credit ?? "Kredit"}</SelectItem>
                                <SelectItem value="debit">{DISPLAY_LABELS.debit ?? "Debit"}</SelectItem>
                                <SelectItem value="reference">{DISPLAY_LABELS.reference ?? "Ref"}</SelectItem>
                                <SelectItem value="description">{DISPLAY_LABELS.description ?? "Tekst"}</SelectItem>
                                <SelectItem value="accountNumber">{DISPLAY_LABELS.accountNumber ?? "Kontonr"}</SelectItem>
                                <SelectItem value="currency">{DISPLAY_LABELS.currency ?? "Valuta"}</SelectItem>
                                {INTERNAL_FIELDS.filter(
                                  (f) =>
                                    !["date1", "date2", "amount", "credit", "debit", "reference", "description", "accountNumber", "currency"].includes(
                                      f
                                    )
                                ).map((f) => (
                                  <SelectItem key={f} value={f}>
                                    {DISPLAY_LABELS[f] ?? SCRIPT_FIELD_LABELS[f] ?? f}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div
                        role="separator"
                        aria-label={`Juster bredde kolonne ${col.colIndex + 1}`}
                        className={cn(
                          "absolute top-0 right-0 bottom-0 w-1.5 cursor-col-resize touch-none z-20",
                          "hover:bg-primary/30 active:bg-primary/50",
                          resizingCol === col.colIndex && "bg-primary/50"
                        )}
                        onMouseDown={(e) => handleResizeStart(col.colIndex, e)}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {csvPreviewRows!.slice(0, 100).map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    tableAppearance.rowBorderClass,
                    i % 2 === 1 && tableAppearance.rowAlternateClass
                  )}
                >
                  {csvColumns!.map((col) => (
                    <td key={col.colIndex} className="p-2 truncate" title={String(row[col.colIndex] ?? "")}>
                      {String(row[col.colIndex] ?? "") || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            {selectable && (
              <div className="sticky top-0 z-10 bg-muted border-b px-2 py-1.5 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Søk på dato, beløp, referanse, tekst..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {searchQuery && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredTxWithIndex.length} av {transactions.length}
                  </span>
                )}
              </div>
            )}
            <table className={cn("w-full text-sm", tableAppearance.tableClass)}>
              <thead className={cn("bg-muted sticky", selectable ? "top-[37px]" : "top-0", tableAppearance.theadClass)}>
                <tr>
                  {selectable && (
                    <th className="w-8 p-2">
                      <input
                        type="checkbox"
                        className="rounded"
                        aria-label="Velg alle synlige"
                        checked={
                          selectedIndices != null &&
                          filteredTxWithIndex.length > 0 &&
                          filteredTxWithIndex.every(({ origIndex }) => selectedIndices.has(origIndex))
                        }
                        onChange={() => {
                          if (!onSelectionChange || !selectedIndices) return;
                          const visibleIndices = filteredTxWithIndex.map(({ origIndex }) => origIndex);
                          const allVisibleSelected = visibleIndices.every((i) => selectedIndices.has(i));
                          const next = new Set(selectedIndices);
                          if (allVisibleSelected) {
                            visibleIndices.forEach((i) => next.delete(i));
                          } else {
                            visibleIndices.forEach((i) => next.add(i));
                          }
                          onSelectionChange(next);
                        }}
                      />
                    </th>
                  )}
                  <th className="text-left p-2 font-medium">Dato</th>
                  <th className="text-right p-2 font-medium">Beløp</th>
                  <th className="text-left p-2 font-medium">Referanse</th>
                  <th className="text-left p-2 font-medium">Tekst</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxWithIndex.length === 0 ? (
                  <tr>
                    <td colSpan={selectable ? 5 : 4} className="p-4 text-center text-muted-foreground text-sm">
                      {searchQuery ? "Ingen treff" : "Ingen transaksjoner"}
                    </td>
                  </tr>
                ) : (
                  <>
                    {txVirtualizer.getVirtualItems().length > 0 && txVirtualizer.getVirtualItems()[0].start > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={selectable ? 5 : 4} style={{ height: txVirtualizer.getVirtualItems()[0].start, padding: 0, border: "none" }} />
                      </tr>
                    )}
                    {txVirtualizer.getVirtualItems().map((vRow) => {
                      const { tx: t, origIndex } = filteredTxWithIndex[vRow.index];
                      const isSelected = selectedIndices?.has(origIndex) ?? false;
                      return (
                        <tr
                          key={origIndex}
                          className={cn(
                            tableAppearance.rowBorderClass,
                            vRow.index % 2 === 1 && tableAppearance.rowAlternateClass,
                            selectable && "cursor-pointer hover:bg-muted/50",
                            selectable && isSelected && "bg-primary/5"
                          )}
                          style={{ height: TX_ROW_HEIGHT }}
                          onClick={
                            selectable
                              ? () => {
                                  if (!onSelectionChange || !selectedIndices) return;
                                  const next = new Set(selectedIndices);
                                  if (next.has(origIndex)) next.delete(origIndex);
                                  else next.add(origIndex);
                                  onSelectionChange(next);
                                }
                              : undefined
                          }
                        >
                          {selectable && (
                            <td className="p-2">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={isSelected}
                                readOnly
                              />
                            </td>
                          )}
                          <td className="p-2">{t.date1}</td>
                          <td className="p-2 text-right font-mono">
                            {t.sign === "-" ? "−" : ""}{t.amount}
                          </td>
                          <td className="p-2 truncate max-w-[120px]">{t.reference ?? "—"}</td>
                          <td className="p-2 truncate max-w-[200px]">{t.description ?? "—"}</td>
                        </tr>
                      );
                    })}
                    {txVirtualizer.getVirtualItems().length > 0 && (
                      <tr aria-hidden="true">
                        <td
                          colSpan={selectable ? 5 : 4}
                          style={{
                            height: txVirtualizer.getTotalSize() - (txVirtualizer.getVirtualItems().at(-1)?.end ?? 0),
                            padding: 0,
                            border: "none",
                          }}
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </>
        )}
        {isCsvMappingMode && csvPreviewRows!.length > 100 && (
          <p className="text-muted-foreground text-xs p-2 border-t">
            Viser 100 av {csvPreviewRows!.length}
          </p>
        )}
      </div>
    </div>
  );
}
