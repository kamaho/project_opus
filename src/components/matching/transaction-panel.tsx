"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Trash2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_COLUMN_WIDTHS = { date: 100, amount: 110, voucher: 120, text: 240 };
const MIN_COLUMN_WIDTH = 60;
const ROW_HEIGHT = 36;
const OVERSCAN = 20;

export interface TransactionRow {
  id: string;
  date: string;
  amount: number;
  voucher?: string;
  text: string;
}

export type CellField = "date" | "amount" | "voucher" | "text";

export interface CellContextAction {
  txId: string;
  field: CellField;
  value: string;
  numericValue?: number;
}

type SortKey = "date" | "amount" | "voucher" | "text";
type SortDir = "asc" | "desc";

interface TransactionPanelProps {
  title?: string;
  transactions: TransactionRow[];
  onSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  onEject?: () => void;
  setLabel?: string;
  ejecting?: boolean;
  onImportFile?: (file: File) => void;
  onCellContextMenu?: (action: CellContextAction, position: { x: number; y: number }) => void;
  contextFilterIds?: Set<string> | null;
}

type ColumnKey = keyof typeof DEFAULT_COLUMN_WIDTHS;

function formatNO(n: number): string {
  return Math.abs(n).toLocaleString("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeAmountQuery(input: string): string {
  return input.replace(/[\s\u00a0]/g, "").replace(",", ".");
}

function matchesAmount(amount: number, query: string): boolean {
  const norm = normalizeAmountQuery(query);
  const raw = String(amount);
  const rawAbs = String(Math.abs(amount));
  const formatted = formatNO(amount);
  const formattedNorm = normalizeAmountQuery(formatted);
  return raw.includes(norm) || rawAbs.includes(norm) || formattedNorm.includes(norm)
    || formatted.includes(query);
}

export function TransactionPanel({
  title,
  transactions,
  onSelect,
  selectedIds = new Set(),
  onEject,
  setLabel,
  ejecting = false,
  onImportFile,
  onCellContextMenu,
  contextFilterIds,
}: TransactionPanelProps) {
  const [colWidths, setColWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<ColumnKey | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Search & sort state
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey, sortDir]);

  const setColumnFilter = useCallback((key: SortKey, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const filteredAndSorted = useMemo(() => {
    let rows = transactions;

    if (contextFilterIds) {
      rows = rows.filter((tx) => contextFilterIds.has(tx.id));
    }

    const q = globalSearch.toLowerCase().trim();
    if (q) {
      rows = rows.filter((tx) =>
        tx.date.toLowerCase().includes(q) ||
        matchesAmount(tx.amount, q) ||
        (tx.voucher ?? "").toLowerCase().includes(q) ||
        tx.text.toLowerCase().includes(q)
      );
    }

    for (const [key, val] of Object.entries(columnFilters)) {
      if (!val?.trim()) continue;
      const v = val.toLowerCase().trim();
      rows = rows.filter((tx) => {
        const field = key as SortKey;
        if (field === "amount") return matchesAmount(tx.amount, v);
        const cellVal = field === "voucher" ? (tx.voucher ?? "") : (tx[field] ?? "");
        return cellVal.toLowerCase().includes(v);
      });
    }

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        if (sortKey === "amount") return (a.amount - b.amount) * dir;
        const av = sortKey === "voucher" ? (a.voucher ?? "") : a[sortKey];
        const bv = sortKey === "voucher" ? (b.voucher ?? "") : b[sortKey];
        return av.localeCompare(bv, "nb-NO") * dir;
      });
    }

    return rows;
  }, [transactions, globalSearch, columnFilters, sortKey, sortDir, contextFilterIds]);

  const virtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const handleResizeStart = useCallback((col: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(col);
    startX.current = e.clientX;
    startWidth.current = colWidths[col];
  }, [colWidths]);

  useEffect(() => {
    if (resizing === null) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX.current;
      setColWidths((prev) => ({
        ...prev,
        [resizing]: Math.max(MIN_COLUMN_WIDTH, startWidth.current + dx),
      }));
    };
    const onEnd = () => setResizing(null);
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
  }, [resizing]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onImportFile) setDragOver(true);
  }, [onImportFile]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!onImportFile) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onImportFile(file);
  }, [onImportFile]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) onImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onImportFile]);

  const hasActiveFilters = globalSearch || Object.values(columnFilters).some((v) => v?.trim());

  const clearAllFilters = useCallback(() => {
    setGlobalSearch("");
    setColumnFilters({});
  }, []);

  const tableMinWidth = 32 + colWidths.date + colWidths.amount + colWidths.voucher + colWidths.text;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  return (
    <div
      className={cn(
        "flex flex-1 flex-col min-w-0 min-h-0 bg-background relative overflow-hidden",
        dragOver && "ring-2 ring-primary ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-primary/5 pointer-events-none">
          <div className="rounded-lg border-2 border-dashed border-primary bg-background/90 px-6 py-4 text-center shadow-lg">
            <Upload className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium text-primary">Slipp fil for å importere</p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".csv,.txt,.xlsx,.xls,.xml"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={searchOpen ? "default" : "outline"}
            className="gap-1"
            onClick={() => setSearchOpen(!searchOpen)}
            data-smart-info="Åpne søk og filter. Søk på tvers av alle kolonner, eller filtrer per kolonne (dato, beløp, bilag, tekst)."
          >
            <Search className="h-3.5 w-3.5" />
            Søk
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={clearAllFilters} data-smart-info="Nullstill alle aktive søk og filtre.">
              <X className="h-3.5 w-3.5" />
              Nullstill
            </Button>
          )}
        </div>
        <div className="flex gap-1.5">
          {onImportFile && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleFileSelect}
              data-smart-info="Last opp en ny fil til denne mengden. Støtter CSV, Excel, CAMT.053 og Klink-format."
            >
              <Upload className="h-3.5 w-3.5" />
              Last opp
            </Button>
          )}
          {onEject && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={onEject}
              disabled={ejecting}
              data-smart-info={`Fjern den importerte filen og alle transaksjoner${setLabel ? ` fra ${setLabel}` : ""}. Eksisterende matchinger som involverer disse postene blir også opphevet.`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {ejecting ? "Fjerner…" : "Fjern fil"}
            </Button>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="border-b px-3 py-2 space-y-2 shrink-0 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Søk i alle kolonner…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <Input
              placeholder="Dato"
              value={columnFilters.date ?? ""}
              onChange={(e) => setColumnFilter("date", e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Beløp"
              value={columnFilters.amount ?? ""}
              onChange={(e) => setColumnFilter("amount", e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Bilag"
              value={columnFilters.voucher ?? ""}
              onChange={(e) => setColumnFilter("voucher", e.target.value)}
              className="h-7 text-xs"
            />
            <Input
              placeholder="Tekst"
              value={columnFilters.text ?? ""}
              onChange={(e) => setColumnFilter("text", e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <table className="w-full text-sm table-fixed" style={{ minWidth: tableMinWidth }}>
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: colWidths.date }} />
            <col style={{ width: colWidths.amount }} />
            <col style={{ width: colWidths.voucher }} />
            <col style={{ width: colWidths.text }} />
          </colgroup>
          <thead className="sticky top-0 bg-muted/95 z-10">
            <tr>
              <th className="w-8 p-2 text-left shrink-0">
                <input type="checkbox" className="rounded" aria-label="Velg alle" />
              </th>
              <th
                className="p-2 text-left font-medium relative select-none cursor-pointer"
                onClick={() => toggleSort("date")}
              >
                <span className="flex items-center gap-1">
                  Dato
                  <SortIcon col="date" />
                </span>
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "date" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("date", e)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th
                className="p-2 text-right font-medium relative select-none cursor-pointer"
                onClick={() => toggleSort("amount")}
              >
                <span className="flex items-center justify-end gap-1">
                  Beløp
                  <SortIcon col="amount" />
                </span>
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "amount" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("amount", e)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th
                className="p-2 text-left font-medium relative select-none cursor-pointer"
                onClick={() => toggleSort("voucher")}
              >
                <span className="flex items-center gap-1">
                  Bilag
                  <SortIcon col="voucher" />
                </span>
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "voucher" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("voucher", e)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <th
                className="p-2 text-left font-medium relative select-none cursor-pointer"
                onClick={() => toggleSort("text")}
              >
                <span className="flex items-center gap-1">
                  Tekst
                  <SortIcon col="text" />
                </span>
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "text" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("text", e)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  {transactions.length === 0
                    ? "Ingen transaksjoner. Importer fil for Mengde 1 og Mengde 2."
                    : "Ingen treff. Prøv et annet søkeord."}
                </td>
              </tr>
            ) : (
              <>
                {virtualizer.getVirtualItems().length > 0 && virtualizer.getVirtualItems()[0].start > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={5} style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0, border: "none" }} />
                  </tr>
                )}
                {virtualizer.getVirtualItems().map((vRow) => {
                  const tx = filteredAndSorted[vRow.index];
                  const makeAction = (field: CellField): CellContextAction => ({
                    txId: tx.id,
                    field,
                    value: field === "amount" ? formatNO(tx.amount) : field === "voucher" ? (tx.voucher ?? "") : tx[field],
                    numericValue: field === "amount" ? tx.amount : undefined,
                  });
                  return (
                    <tr
                      key={tx.id}
                      data-index={vRow.index}
                      className={cn(
                        "border-t hover:bg-muted/50 cursor-pointer",
                        selectedIds.has(tx.id)
                          ? "bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60"
                          : vRow.index % 2 === 1 && "bg-muted/30"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onSelect?.(tx.id)}
                    >
                      <td className="p-2" style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(tx.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            onSelect?.(tx.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      {([
                        { field: "date" as CellField, content: tx.date, className: "p-2 truncate", style: { width: colWidths.date }, title: undefined as string | undefined },
                        { field: "amount" as CellField, content: <>{tx.amount >= 0 ? "" : "−"}{formatNO(tx.amount)}</>, className: cn("p-2 text-right font-mono truncate", tx.amount < 0 && "text-destructive"), style: { width: colWidths.amount }, title: undefined as string | undefined },
                        { field: "voucher" as CellField, content: tx.voucher ?? "—", className: "p-2 text-muted-foreground truncate", style: { width: colWidths.voucher }, title: tx.voucher },
                        { field: "text" as CellField, content: tx.text, className: "p-2 truncate", style: { width: colWidths.text }, title: tx.text },
                      ] as const).map((cell) => (
                        <td
                          key={cell.field}
                          className={cell.className}
                          style={cell.style}
                          title={cell.title}
                          onContextMenu={(e) => {
                            if (!onCellContextMenu) return;
                            e.preventDefault();
                            e.stopPropagation();
                            onCellContextMenu(makeAction(cell.field), { x: e.clientX, y: e.clientY });
                          }}
                        >
                          {cell.content}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={5}
                      style={{
                        height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0),
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
      </div>
      <div className="border-t px-3 py-1.5 text-muted-foreground text-xs shrink-0 flex items-center gap-3" data-smart-info="Viser totalt antall transaksjoner og sum. Når filter er aktive vises filtrert antall av totalt.">
        <span>
          {hasActiveFilters
            ? `${filteredAndSorted.length} av ${transactions.length} transaksjoner`
            : `${transactions.length} transaksjoner totalt`}
        </span>
        {filteredAndSorted.length > 0 && (
          <span className="font-mono">
            Sum: {filteredAndSorted.reduce((s, t) => s + t.amount, 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
