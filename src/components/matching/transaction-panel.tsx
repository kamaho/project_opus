"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, CircleOff, Focus, Link2, MessageSquarePlus, MoreHorizontal, Paperclip, Search, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const DEFAULT_COLUMN_WIDTHS = { date: 86, amount: 105, voucher: 80, text: 180 };
const MIN_COLUMN_WIDTH = 50;
const ROW_HEIGHT = 32;
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
  counterpartHintIds?: Set<string>;
  counterpartSumHintIds?: Set<string>;
  matchAnimatingIds?: Set<string>;
  matchAnimationPhase?: "glow" | "exit" | "collapse";
  setLabel?: string;
  onImportFile?: (file: File) => void;
  onCellContextMenu?: (action: CellContextAction, position: { x: number; y: number }) => void;
  contextFilterIds?: Set<string> | null;
  onRowAction?: (txId: string, action: string) => void;
  focusMode?: boolean;
  onToggleFocus?: () => void;
  hintCount?: number;
  onMatch?: () => void;
  canMatch?: boolean;
  onSelectCounterparts?: () => void;
  onDeselectCounterparts?: () => void;
  counterpartsSelected?: boolean;
  onClearSelection?: () => void;
  hasSelection?: boolean;
  globalDateFrom?: string;
  globalDateTo?: string;
  focusedRowIndex?: number | null;
  panelActive?: boolean;
  onRequestRowCount?: (count: number) => void;
  visibleIdsRef?: React.MutableRefObject<string[]>;
  onDeactivateKeyboard?: () => void;
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
  counterpartHintIds,
  counterpartSumHintIds,
  matchAnimatingIds,
  matchAnimationPhase,
  setLabel,
  onImportFile,
  onCellContextMenu,
  contextFilterIds,
  onRowAction,
  focusMode = false,
  onToggleFocus,
  hintCount = 0,
  onMatch,
  canMatch = false,
  onSelectCounterparts,
  onDeselectCounterparts,
  counterpartsSelected = false,
  onClearSelection,
  hasSelection = false,
  globalDateFrom = "",
  globalDateTo = "",
  focusedRowIndex = null,
  panelActive = false,
  onRequestRowCount,
  visibleIdsRef,
  onDeactivateKeyboard,
}: TransactionPanelProps) {
  const [colWidths, setColWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<ColumnKey | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag-select state
  const isDragging = useRef(false);
  const dragMode = useRef<"select" | "deselect">("select");
  const dragVisited = useRef<Set<string>>(new Set());
  const dragInitialSelected = useRef<Set<string>>(new Set());
  const skipNextClick = useRef(false);

  const handleRowMouseDown = useCallback((txId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    if (e.button !== 0) return;

    isDragging.current = true;
    dragVisited.current = new Set([txId]);
    skipNextClick.current = true;
    dragInitialSelected.current = new Set(selectedIds);

    const isSelected = selectedIds.has(txId);
    dragMode.current = isSelected ? "deselect" : "select";
    onSelect?.(txId);
  }, [selectedIds, onSelect]);

  const handleRowMouseEnter = useCallback((txId: string) => {
    if (!isDragging.current) return;
    if (dragVisited.current.has(txId)) return;
    dragVisited.current.add(txId);

    const wasSelected = dragInitialSelected.current.has(txId);
    const shouldBeSelected = dragMode.current === "select";
    if (wasSelected !== shouldBeSelected) {
      onSelect?.(txId);
    }
  }, [onSelect]);

  const handleRowClick = useCallback((txId: string) => {
    if (skipNextClick.current) {
      skipNextClick.current = false;
      return;
    }
    onSelect?.(txId);
  }, [onSelect]);

  useEffect(() => {
    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        dragVisited.current.clear();
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

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

    if (globalDateFrom) {
      rows = rows.filter((tx) => tx.date >= globalDateFrom);
    }
    if (globalDateTo) {
      rows = rows.filter((tx) => tx.date <= globalDateTo);
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
        if (field === "date") return;
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
  }, [transactions, globalSearch, columnFilters, sortKey, sortDir, contextFilterIds, globalDateFrom, globalDateTo]);

  useEffect(() => {
    onRequestRowCount?.(filteredAndSorted.length);
  }, [filteredAndSorted.length, onRequestRowCount]);

  useEffect(() => {
    if (visibleIdsRef) {
      visibleIdsRef.current = filteredAndSorted.map((tx) => tx.id);
    }
  }, [filteredAndSorted, visibleIdsRef]);

  const virtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  useEffect(() => {
    if (!panelActive || focusedRowIndex == null || focusedRowIndex < 0 || focusedRowIndex >= filteredAndSorted.length) return;
    const el = scrollRef.current;
    if (!el) return;

    virtualizer.scrollToIndex(focusedRowIndex, { align: "auto" });

    requestAnimationFrame(() => {
      const row = el.querySelector(`tr[data-index="${focusedRowIndex}"]`) as HTMLElement | null;
      if (!row) return;
      const thead = el.querySelector("thead") as HTMLElement | null;
      const headerH = thead?.offsetHeight ?? 0;

      const rowRect = row.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const visibleTop = elRect.top + headerH;
      const visibleBottom = elRect.bottom;

      if (rowRect.bottom > visibleBottom) {
        el.scrollTop += rowRect.bottom - visibleBottom;
      } else if (rowRect.top < visibleTop) {
        el.scrollTop -= visibleTop - rowRect.top;
      }
    });
  }, [panelActive, focusedRowIndex, filteredAndSorted.length, virtualizer]);

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

      <div className="flex items-center justify-between border-b px-2 py-1 shrink-0">
        <div className="flex gap-2 items-center">
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
        </div>
      </div>

      {searchOpen && (
        <div className="border-b px-2 py-1.5 space-y-1.5 shrink-0 bg-muted/20">
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
          <div className="grid grid-cols-3 gap-1.5">
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

      <div ref={scrollRef} className={cn("flex-1 overflow-auto isolate", matchAnimatingIds && "overflow-x-hidden")}>
        <table className="text-sm table-fixed" style={{ minWidth: "100%", width: tableMinWidth }}>
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
                className="p-2 text-left font-medium relative select-none cursor-pointer overflow-hidden"
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
                className="p-2 text-right font-medium relative select-none cursor-pointer overflow-hidden"
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
                className="p-2 text-left font-medium relative select-none cursor-pointer overflow-hidden"
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
                className="p-2 text-left font-medium relative select-none cursor-pointer overflow-hidden"
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
          <tbody onMouseMove={panelActive ? onDeactivateKeyboard : undefined}>
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
                  const isKbFocused = panelActive && focusedRowIndex === vRow.index;
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
                        "group/row border-t hover:bg-sky-50 dark:hover:bg-sky-950/30 cursor-pointer select-none",
                        isKbFocused && "outline outline-2 -outline-offset-2 outline-primary z-[1] kb-focused",
                        selectedIds.has(tx.id)
                          ? "bg-blue-100 dark:bg-blue-950/40 hover:bg-blue-200/70 dark:hover:bg-blue-950/60"
                          : counterpartHintIds?.has(tx.id)
                            ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 ring-1 ring-inset ring-emerald-300 dark:ring-emerald-700"
                            : counterpartSumHintIds?.has(tx.id)
                              ? "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 ring-1 ring-inset ring-amber-300 dark:ring-amber-700"
                              : vRow.index % 2 === 1 && "bg-muted/30",
                        matchAnimatingIds?.has(tx.id) && "match-animating",
                        matchAnimatingIds?.has(tx.id) && matchAnimationPhase === "exit" && "match-exit"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onMouseDown={(e) => handleRowMouseDown(tx.id, e)}
                      onMouseEnter={() => handleRowMouseEnter(tx.id)}
                      onClick={() => handleRowClick(tx.id)}
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
                        { field: "date" as CellField, content: tx.date, className: "p-2 truncate overflow-hidden", style: { width: colWidths.date } },
                        { field: "amount" as CellField, content: <>{tx.amount >= 0 ? "" : "−"}{formatNO(tx.amount)}</>, className: cn("p-2 text-right font-mono truncate overflow-hidden", tx.amount < 0 && "text-destructive"), style: { width: colWidths.amount } },
                        { field: "voucher" as CellField, content: tx.voucher ?? "—", className: "p-2 text-muted-foreground truncate", style: { width: colWidths.voucher } },
                      ] as const).map((cell) => (
                        <td
                          key={cell.field}
                          className={cell.className}
                          style={cell.style}
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
                      <td
                        className="relative"
                        style={{ width: colWidths.text }}
                        onContextMenu={(e) => {
                          if (!onCellContextMenu) return;
                          e.preventDefault();
                          e.stopPropagation();
                          onCellContextMenu(makeAction("text"), { x: e.clientX, y: e.clientY });
                        }}
                      >
                        <span className="block p-2 truncate pr-8">{tx.text}</span>
                        <TooltipProvider>
                          <div
                            className={cn(
                              "row-action-bar absolute right-1 top-0 -translate-y-3/4 flex items-center gap-px rounded-md border bg-background shadow-md transition-opacity duration-150 z-10",
                              isKbFocused
                                ? "opacity-100 pointer-events-auto"
                                : "opacity-0 pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto group-hover/row:delay-150"
                            )}
                            title=""
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {onMatch && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "p-1.5 rounded-sm transition-colors",
                                      canMatch
                                        ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                                        : "text-muted-foreground/40 cursor-default"
                                    )}
                                    onClick={canMatch ? onMatch : undefined}
                                  >
                                    <Link2 className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {canMatch ? "Match (M)" : "Match"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {hintCount > 0 && !counterpartsSelected && onSelectCounterparts && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-sm transition-colors text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                    onClick={onSelectCounterparts}
                                  >
                                    <CheckCheck className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Motposter (C)</TooltipContent>
                              </Tooltip>
                            )}
                            {hasSelection && onClearSelection && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-sm transition-colors text-destructive hover:bg-destructive/10"
                                    onClick={onClearSelection}
                                  >
                                    <CircleOff className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Fjern (X)</TooltipContent>
                              </Tooltip>
                            )}
                            {onToggleFocus && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "p-1.5 rounded-sm transition-colors",
                                      hintCount === 0
                                        ? "text-muted-foreground/40 cursor-default"
                                        : focusMode
                                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                          : "hover:bg-muted"
                                    )}
                                    onClick={hintCount > 0 ? onToggleFocus : undefined}
                                  >
                                    <Focus className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Fokus (F)</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                                  onClick={() => onRowAction?.(tx.id, "note")}
                                >
                                  <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Notat</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                                  onClick={() => onRowAction?.(tx.id, "attachment")}
                                >
                                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Vedlegg</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-sm hover:bg-muted transition-colors"
                                  onClick={() => onRowAction?.(tx.id, "more")}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Mer</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </td>
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
      {hasActiveFilters && (
        <div className="border-t px-2 py-1 text-muted-foreground text-xs shrink-0 flex items-center gap-3">
          <span>{filteredAndSorted.length} av {transactions.length} treff</span>
          {filteredAndSorted.length > 0 && (
            <span className="font-mono">
              Sum: {filteredAndSorted.reduce((s, t) => s + t.amount, 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

    </div>
  );
}
