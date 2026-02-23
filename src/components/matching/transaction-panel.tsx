"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, CircleOff, Columns3, Focus, FolderOpen, Link2, MessageSquarePlus, MoreHorizontal, Paperclip, PenLine, Pencil, Search, SortAsc, SortDesc, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SmartPanel, type SmartPanelOption } from "@/components/smart-panel/smart-panel";

const ATTACH_COL_WIDTH = 28;
const DEFAULT_COLUMN_WIDTHS = { date: 86, amount: 105, voucher: 80, notat: 100, text: 180 };
const MIN_COLUMN_WIDTH = 50;
const MAX_COLUMN_WIDTH = 600;
const CELL_PADDING_X = 16;
const ROW_HEIGHT = 32;
const OVERSCAN = 20;
const DEFAULT_COLUMN_ORDER: ColumnKey[] = ["date", "amount", "voucher", "notat", "text"];

export interface TransactionRow {
  id: string;
  date: string;
  amount: number;
  voucher?: string;
  text: string;
  notat?: string | null;
  notatAuthor?: string | null;
  hasAttachment?: boolean;
}

export type CellField = "date" | "amount" | "voucher" | "notat" | "text";

export interface CellContextAction {
  txId: string;
  field: CellField;
  value: string;
  numericValue?: number;
}

type SortKey = "date" | "amount" | "voucher" | "notat" | "text";
type SortDir = "asc" | "desc";

interface TransactionPanelProps {
  title?: string;
  transactions: TransactionRow[];
  onSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
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
  highlightTxId?: string | null;
  onFileManager?: () => void;
  onCreateTransaction?: () => void;
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
  onSelectAll,
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
  highlightTxId,
  onFileManager,
  onCreateTransaction,
}: TransactionPanelProps) {
  const [colWidths, setColWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [colOrder, setColOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [resizing, setResizing] = useState<ColumnKey | null>(null);
  const [dragCol, setDragCol] = useState<ColumnKey | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnKey | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [headerSmartPanel, setHeaderSmartPanel] = useState<{ col: ColumnKey; pos: { x: number; y: number } } | null>(null);
  const [headerSmartPanelActiveOption, setHeaderSmartPanelActiveOption] = useState<string | null>(null);
  const [colAliases, setColAliases] = useState<Partial<Record<ColumnKey, string>>>({});
  const [showAllInSettings, setShowAllInSettings] = useState(true);
  const [inlineSearchCol, setInlineSearchCol] = useState<ColumnKey | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const inlineSearchRef = useRef<HTMLInputElement>(null);
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
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleRowMouseDown = useCallback((txId: string, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    if (e.button !== 0) return;

    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    dragVisited.current = new Set([txId]);
    skipNextClick.current = true;
    dragInitialSelected.current = new Set(selectedIds);

    const isSelected = selectedIds.has(txId);
    dragMode.current = isSelected ? "deselect" : "select";
    onSelect?.(txId);
  }, [selectedIds, onSelect]);

  const applyDragToRow = useCallback(
    (txId: string) => {
      if (dragVisited.current.has(txId)) return;
      dragVisited.current.add(txId);
      const wasSelected = dragInitialSelected.current.has(txId);
      const shouldBeSelected = dragMode.current === "select";
      if (wasSelected !== shouldBeSelected) {
        onSelect?.(txId);
      }
    },
    [onSelect]
  );

  const handleRowMouseEnter = useCallback(
    (txId: string) => {
      if (!isDragging.current) return;
      applyDragToRow(txId);
    },
    [applyDragToRow]
  );

  const handleRowClick = useCallback((txId: string) => {
    if (skipNextClick.current) {
      skipNextClick.current = false;
      return;
    }
    onSelect?.(txId);
  }, [onSelect]);

  useEffect(() => {
    const STEP = Math.max(8, Math.floor(ROW_HEIGHT / 2));

    const onMouseMove = (e: MouseEvent) => {
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      if (!isDragging.current || !scrollRef.current) return;
      const { x: x0, y: y0 } = lastMouse.current;
      const x1 = e.clientX;
      const y1 = e.clientY;
      lastMouse.current = { x: x1, y: y1 };

      const dx = x1 - x0;
      const dy = y1 - y0;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return;

      const steps = Math.max(1, Math.ceil(dist / STEP));
      const seen = new Set<string>();
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = x0 + dx * t;
        const y = y0 + dy * t;
        const el = document.elementFromPoint(x, y);
        const row = el?.closest?.("tr[data-tx-id]") as HTMLElement | null;
        if (!row?.getAttribute || !scrollRef.current.contains(row)) continue;
        const txId = row.getAttribute("data-tx-id");
        if (txId && !seen.has(txId)) {
          seen.add(txId);
          applyDragToRow(txId);
        }
      }
    };

    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        dragVisited.current.clear();
      }
    };

    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [applyDragToRow]);

  // Search & sort state
  const [globalSearch, setGlobalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<SortKey, string>>>({});
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [onlyWithAttachment, setOnlyWithAttachment] = useState(false);

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

    if (onlyWithAttachment) {
      rows = rows.filter((tx) => tx.hasAttachment);
    }

    const q = globalSearch.toLowerCase().trim();
    if (q) {
      rows = rows.filter((tx) =>
        tx.date.toLowerCase().includes(q) ||
        matchesAmount(tx.amount, q) ||
        (tx.voucher ?? "").toLowerCase().includes(q) ||
        (tx.notat ?? "").toLowerCase().includes(q) ||
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
        const cellVal = field === "voucher" ? (tx.voucher ?? "") : field === "notat" ? (tx.notat ?? "") : (tx[field] ?? "");
        return cellVal.toLowerCase().includes(v);
      });
    }

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        if (sortKey === "amount") return (a.amount - b.amount) * dir;
        const av = sortKey === "voucher" ? (a.voucher ?? "") : sortKey === "notat" ? (a.notat ?? "") : a[sortKey];
        const bv = sortKey === "voucher" ? (b.voucher ?? "") : sortKey === "notat" ? (b.notat ?? "") : b[sortKey];
        return av.localeCompare(bv, "nb-NO") * dir;
      });
    }

    return rows;
  }, [transactions, globalSearch, columnFilters, sortKey, sortDir, contextFilterIds, globalDateFrom, globalDateTo, onlyWithAttachment]);

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

  useEffect(() => {
    if (!highlightTxId) return;
    const idx = filteredAndSorted.findIndex((t) => t.id === highlightTxId);
    if (idx === -1) return;
    virtualizer.scrollToIndex(idx, { align: "center" });
  }, [highlightTxId, filteredAndSorted, virtualizer]);

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

  const isExternalFileDrag = useCallback((e: React.DragEvent) => {
    return e.dataTransfer.types.includes("Files");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (onImportFile) setDragOver(true);
  }, [onImportFile, isExternalFileDrag]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, [isExternalFileDrag]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!onImportFile) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onImportFile(file);
  }, [onImportFile, isExternalFileDrag]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) onImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onImportFile]);

  const handleColDragStart = useCallback((col: ColumnKey, e: React.DragEvent) => {
    setDragCol(col);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", col);
    const th = (e.target as HTMLElement).closest("th");
    if (th) e.dataTransfer.setDragImage(th, 20, 16);
  }, []);

  const handleColDragOver = useCallback((col: ColumnKey, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (col !== dragCol) setDragOverCol(col);
  }, [dragCol]);

  const handleColDrop = useCallback((targetCol: ColumnKey, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragCol || dragCol === targetCol) {
      setDragCol(null);
      setDragOverCol(null);
      return;
    }
    setColOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragCol);
      const toIdx = next.indexOf(targetCol);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragCol);
      return next;
    });
    setDragCol(null);
    setDragOverCol(null);
  }, [dragCol]);

  const handleColDragEnd = useCallback(() => {
    setDragCol(null);
    setDragOverCol(null);
  }, []);

  const defaultLabels: Record<ColumnKey, string> = useMemo(() => ({ date: "Dato", amount: "Beløp", voucher: "Bilag", notat: "Notat", text: "Tekst" }), []);
  const columnLabels: Record<ColumnKey, string> = useMemo(() => {
    const labels = { ...defaultLabels };
    for (const [key, alias] of Object.entries(colAliases)) {
      if (alias?.trim()) labels[key as ColumnKey] = alias;
    }
    return labels;
  }, [defaultLabels, colAliases]);

  const measureText = useCallback((text: string, mono: boolean): number => {
    const el = document.createElement("span");
    el.style.cssText = "position:fixed;left:-9999px;visibility:hidden;white-space:nowrap;font-size:14px;";
    if (mono) el.style.fontFamily = "ui-monospace, monospace";
    el.textContent = text || "—";
    document.body.appendChild(el);
    const w = el.getBoundingClientRect().width;
    document.body.removeChild(el);
    return w;
  }, []);

  const handleResizeDoubleClick = useCallback(
    (col: ColumnKey) => {
      const headerLabel = columnLabels[col];
      let maxW = measureText(headerLabel, col === "amount");
      for (const tx of filteredAndSorted) {
        const s =
          col === "date"
            ? tx.date
            : col === "amount"
              ? (tx.amount >= 0 ? "" : "−") + formatNO(tx.amount)
              : col === "voucher"
                ? tx.voucher ?? "—"
                : col === "notat"
                  ? tx.notat ?? "—"
                  : tx.text;
        maxW = Math.max(maxW, measureText(s, col === "amount"));
      }
      const width = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.ceil(maxW) + CELL_PADDING_X));
      setColWidths((prev) => ({ ...prev, [col]: width }));
    },
    [columnLabels, filteredAndSorted, measureText]
  );

  const handleHeaderContextMenu = useCallback((col: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHeaderSmartPanel({ col, pos: { x: e.clientX, y: e.clientY } });
    setHeaderSmartPanelActiveOption(null);
  }, []);

  const headerSmartPanelOptions = useMemo((): SmartPanelOption[] => {
    if (!headerSmartPanel) return [];
    const col = headerSmartPanel.col;
    return [
      { id: "search", label: `Søk i ${columnLabels[col]}`, icon: <Search className="h-3.5 w-3.5" />, hint: "Filtrer" },
      { id: "sort-asc", label: "Sorter stigende", icon: <SortAsc className="h-3.5 w-3.5" />, hint: "A→Å" },
      { id: "sort-desc", label: "Sorter synkende", icon: <SortDesc className="h-3.5 w-3.5" />, hint: "Å→A" },
      { id: "col-settings", label: "Kolonneinnstillinger", icon: <Columns3 className="h-3.5 w-3.5" />, separator: true },
    ];
  }, [headerSmartPanel, columnLabels]);

  const toggleColumnVisibility = useCallback((target: ColumnKey) => {
    setColOrder((prev) => {
      if (prev.includes(target)) {
        if (prev.length <= 2) return prev;
        return prev.filter((c) => c !== target);
      }
      const idx = DEFAULT_COLUMN_ORDER.indexOf(target);
      const next = [...prev];
      let insertAt = next.length;
      for (let i = 0; i < next.length; i++) {
        if (DEFAULT_COLUMN_ORDER.indexOf(next[i]) > idx) {
          insertAt = i;
          break;
        }
      }
      next.splice(insertAt, 0, target);
      return next;
    });
  }, []);

  const handleHeaderSmartPanelOption = useCallback((optionId: string) => {
    if (!headerSmartPanel) return;
    const col = headerSmartPanel.col;

    if (optionId === "search") {
      setInlineSearchCol(col);
      setHeaderSmartPanel(null);
      setTimeout(() => inlineSearchRef.current?.focus(), 0);
      return;
    }
    if (optionId === "sort-asc") {
      setSortKey(col);
      setSortDir("asc");
      setHeaderSmartPanel(null);
      return;
    }
    if (optionId === "sort-desc") {
      setSortKey(col);
      setSortDir("desc");
      setHeaderSmartPanel(null);
      return;
    }
    if (optionId === "col-settings") {
      setHeaderSmartPanelActiveOption("col-settings");
      setShowAllInSettings(true);
      return;
    }
    if (optionId === "") {
      setHeaderSmartPanelActiveOption(null);
      return;
    }
    setHeaderSmartPanelActiveOption(optionId);
  }, [headerSmartPanel]);

  const handleInlineSearchClose = useCallback((col: ColumnKey) => {
    setInlineSearchCol(null);
    setColumnFilter(col, "");
  }, [setColumnFilter]);

  useEffect(() => {
    if (inlineSearchCol) {
      setTimeout(() => inlineSearchRef.current?.focus(), 0);
    }
  }, [inlineSearchCol]);

  const hasActiveFilters = globalSearch || Object.values(columnFilters).some((v) => v?.trim()) || onlyWithAttachment;

  const clearAllFilters = useCallback(() => {
    setGlobalSearch("");
    setColumnFilters({});
    setInlineSearchCol(null);
    setOnlyWithAttachment(false);
  }, []);

  const tableMinWidth = 32 + ATTACH_COL_WIDTH + colOrder.reduce((sum, col) => sum + colWidths[col], 0);

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

      <div className="flex items-center gap-2 border-b px-2 py-1 shrink-0">
        <div
          className={cn(
            "relative transition-[width] duration-200 ease-out overflow-hidden",
            searchExpanded ? "w-80" : "w-28"
          )}
        >
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchExpanded ? "Søk i alle kolonner…" : "Søk…"}
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onFocus={() => setSearchExpanded(true)}
            onBlur={() => { if (!globalSearch.trim()) setSearchExpanded(false); }}
            className="h-7 pl-8 pr-2 text-xs w-full min-w-0"
            data-smart-info="Søk på tvers av alle kolonner. Høyreklikk på en kolonne-header for å søke i en spesifikk kolonne."
          />
        </div>
        <div className="flex-1 min-w-0" aria-hidden />
        <div className="flex items-center gap-1.5 ml-auto">
          {hasActiveFilters && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground"
                  onClick={clearAllFilters}
                  data-smart-info="Nullstill alle aktive søk og filtre."
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Nullstill alle filtre</TooltipContent>
            </Tooltip>
          )}
          {onCreateTransaction && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCreateTransaction}>
                  <PenLine className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Opprett korreksjonspost</TooltipContent>
            </Tooltip>
          )}
          {onFileManager && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onFileManager}>
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Filbehandler</TooltipContent>
            </Tooltip>
          )}
          {onImportFile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={handleFileSelect}
                  data-smart-info="Last opp en ny fil til denne mengden. Støtter CSV, Excel, CAMT.053 og Klink-format."
                >
                  <Upload className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Last opp</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div ref={scrollRef} className={cn("flex-1 overflow-auto isolate", matchAnimatingIds && "overflow-x-hidden")}>
        <table className="text-sm table-fixed" style={{ width: "100%", minWidth: tableMinWidth }}>
          <colgroup>
            <col style={{ width: 32 }} />
            <col style={{ width: ATTACH_COL_WIDTH }} />
            {colOrder.map((col) => (
              <col key={col} style={{ width: colWidths[col] }} />
            ))}
            <col />
          </colgroup>
          <thead className="sticky top-0 bg-muted/95 z-10">
            <tr>
              <th className="w-8 p-2 text-left shrink-0">
                <input
                  type="checkbox"
                  className="rounded"
                  aria-label="Velg alle"
                  checked={filteredAndSorted.length > 0 && filteredAndSorted.every((t) => selectedIds.has(t.id))}
                  ref={(el) => {
                    if (!el) return;
                    const some = filteredAndSorted.some((t) => selectedIds.has(t.id));
                    const all = filteredAndSorted.length > 0 && filteredAndSorted.every((t) => selectedIds.has(t.id));
                    el.indeterminate = some && !all;
                  }}
                  onChange={() => {
                    if (!onSelectAll) return;
                    const ids = filteredAndSorted.map((t) => t.id);
                    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
                    onSelectAll(allSelected ? [] : ids);
                  }}
                />
              </th>
              <th
                className={cn(
                  "p-0 cursor-pointer hover:bg-muted/50 transition-colors",
                  onlyWithAttachment && "bg-primary/10"
                )}
                style={{ width: ATTACH_COL_WIDTH }}
                title={onlyWithAttachment ? "Kun med vedlegg – klikk for å fjerne filter" : "Klikk for kun å vise poster med vedlegg"}
                onClick={() => setOnlyWithAttachment((prev) => !prev)}
              >
                <Paperclip className={cn("h-3 w-3 mx-auto", onlyWithAttachment ? "text-green-600" : "text-muted-foreground/50")} />
              </th>
              {colOrder.map((col) => {
                const isSearching = inlineSearchCol === col;
                return (
                  <th
                    key={col}
                    className={cn(
                      "group/th font-medium relative select-none overflow-hidden",
                      isSearching ? "p-0" : "cursor-pointer",
                      col === "amount" ? "text-right" : "text-left",
                      dragOverCol === col && dragCol !== col && "bg-primary/5"
                    )}
                    draggable={!isSearching}
                    onClick={isSearching ? undefined : () => toggleSort(col)}
                    onContextMenu={(e) => handleHeaderContextMenu(col, e)}
                    onDragStart={isSearching ? undefined : (e) => handleColDragStart(col, e)}
                    onDragOver={isSearching ? undefined : (e) => handleColDragOver(col, e)}
                    onDrop={isSearching ? undefined : (e) => handleColDrop(col, e)}
                    onDragEnd={isSearching ? undefined : handleColDragEnd}
                    onDragLeave={isSearching ? undefined : () => { if (dragOverCol === col) setDragOverCol(null); }}
                  >
                    {isSearching ? (
                      <div className="flex items-center h-full">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <input
                            ref={inlineSearchRef}
                            type="text"
                            value={columnFilters[col] ?? ""}
                            onChange={(e) => setColumnFilter(col, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") handleInlineSearchClose(col); }}
                            onBlur={(e) => {
                              const th = (e.target as HTMLElement).closest("th");
                              if (th?.contains(e.relatedTarget as Node)) return;
                              setInlineSearchCol(null);
                            }}
                            placeholder={`Søk ${columnLabels[col].toLowerCase()}…`}
                            className="w-full h-8 pl-7 pr-7 text-xs bg-background border-0 outline-none ring-1 ring-inset ring-primary/40 focus:ring-primary/70 rounded-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted text-muted-foreground"
                            onClick={() => handleInlineSearchClose(col)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center h-full px-2 py-1.5 pr-3">
                        <span className={cn("flex items-center gap-1 flex-1 min-w-0 truncate", col === "amount" && "justify-end")}>
                          {columnLabels[col]}
                          <SortIcon col={col} />
                          {columnFilters[col]?.trim() && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </span>
                      </div>
                    )}
                    {!isSearching && (
                      <span
                        role="separator"
                        aria-label="Juster kolonnebredde. Dobbelklikk for å tilpasse bredde til innhold."
                        className="absolute top-0 bottom-0 right-0 w-3 cursor-col-resize flex items-center justify-center"
                        onMouseDown={(e) => handleResizeStart(col, e)}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleResizeDoubleClick(col);
                        }}
                      >
                        <span className={cn(
                          "w-[3px] h-3/5 rounded-full bg-border/70 transition-colors group-hover/th:bg-border hover:!bg-primary/50 active:!bg-primary/60",
                          resizing === col && "!bg-primary/60"
                        )} />
                      </span>
                    )}
                  </th>
                );
              })}
              <th />
            </tr>
          </thead>
          <tbody onMouseMove={panelActive ? onDeactivateKeyboard : undefined}>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={3 + colOrder.length} className="p-8 text-center text-muted-foreground">
                  {transactions.length === 0
                    ? "Ingen transaksjoner. Importer fil for Mengde 1 og Mengde 2."
                    : "Ingen treff. Prøv et annet søkeord."}
                </td>
              </tr>
            ) : (
              <>
                {virtualizer.getVirtualItems().length > 0 && virtualizer.getVirtualItems()[0].start > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={3 + colOrder.length} style={{ height: virtualizer.getVirtualItems()[0].start, padding: 0, border: "none" }} />
                  </tr>
                )}
                {virtualizer.getVirtualItems().map((vRow) => {
                  const tx = filteredAndSorted[vRow.index];
                  const isKbFocused = panelActive && focusedRowIndex === vRow.index;
                  const isHighlighted = highlightTxId === tx.id;
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
                      data-tx-id={tx.id}
                      className={cn(
                        "group/row border-t hover:bg-sky-50 dark:hover:bg-sky-950/30 cursor-pointer select-none",
                        isKbFocused && "outline outline-2 -outline-offset-2 outline-primary z-[1] kb-focused",
                        isHighlighted && "notification-highlight",
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
                      onMouseEnter={() => {
                        setHoveredRowId(tx.id);
                        handleRowMouseEnter(tx.id);
                      }}
                      onMouseLeave={() => {
                        const rowId = tx.id;
                        requestAnimationFrame(() => {
                          setHoveredRowId((current) => {
                            if (current !== rowId) return current;
                            const { x, y } = lastMousePos.current;
                            const el = document.elementFromPoint(x, y);
                            if (el?.closest(`tr[data-tx-id="${rowId}"]`) || el?.closest(`[data-row-toolbar="${rowId}"]`)) return current;
                            return null;
                          });
                        });
                      }}
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
                      <td className="p-0 text-center" style={{ width: ATTACH_COL_WIDTH }}>
                        {tx.hasAttachment && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-full h-full"
                            onClick={(e) => { e.stopPropagation(); onRowAction?.(tx.id, "attachment"); }}
                          >
                            <Paperclip className="h-3 w-3 text-green-600" />
                          </button>
                        )}
                      </td>
                      {(() => {
                        const rowToolbarVisible = hoveredRowId === tx.id || isKbFocused;
                        const hoverToolbar = rowToolbarVisible ? (
                          <TooltipProvider>
                            <div
                              className="row-action-bar absolute right-1.5 top-0 -translate-y-3/4 flex items-center gap-px rounded-md border bg-background shadow-md z-20"
                              data-row-toolbar={tx.id}
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
                                    className={cn(
                                      "p-1.5 rounded-sm hover:bg-muted transition-colors",
                                      tx.notat ? "text-green-600" : ""
                                    )}
                                    onClick={() => onRowAction?.(tx.id, "note")}
                                  >
                                    <MessageSquarePlus className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Notat</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className={cn(
                                      "p-1.5 rounded-sm hover:bg-muted transition-colors",
                                      tx.hasAttachment ? "text-green-600" : ""
                                    )}
                                    onClick={() => onRowAction?.(tx.id, "attachment")}
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
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
                        ) : null;
                        return (
                          <>
                            {colOrder.map((col) => {
                              const isLastCol = col === colOrder[colOrder.length - 1];
                              if (col === "text") {
                                return (
                                  <td
                                    key={col}
                                    className="relative"
                                    style={{ width: colWidths.text }}
                                    onContextMenu={(e) => {
                                      if (!onCellContextMenu) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      onCellContextMenu(makeAction("text"), { x: e.clientX, y: e.clientY });
                                    }}
                                  >
                                    <span className={cn("block p-2 truncate", isLastCol && "pr-8")}>
                                      {tx.text}
                                    </span>
                                  </td>
                                );
                              }
                              const cellDef = col === "date"
                                ? { content: tx.date as React.ReactNode, className: "p-2 truncate overflow-hidden" }
                                : col === "amount"
                                  ? { content: <>{tx.amount >= 0 ? "" : "−"}{formatNO(tx.amount)}</> as React.ReactNode, className: cn("p-2 text-right font-mono truncate overflow-hidden", tx.amount < 0 && "text-destructive") }
                                  : col === "voucher"
                                    ? { content: (tx.voucher ?? "—") as React.ReactNode, className: "p-2 text-muted-foreground truncate" }
                                    : { content: tx.notat ? (
                                        <button
                                          type="button"
                                          className="text-left truncate w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                                          onClick={(e) => { e.stopPropagation(); onRowAction?.(tx.id, "note"); }}
                                          title={tx.notat}
                                        >
                                          {tx.notat.split(/\s+/).slice(0, 5).join(" ")}{tx.notat.split(/\s+/).length > 5 ? "…" : ""}
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground/30 text-xs">—</span>
                                      ) as React.ReactNode, className: "p-2 truncate overflow-hidden" };
                              return (
                                <td
                                  key={col}
                                  className={cn(cellDef.className, isLastCol && "relative")}
                                  style={{ width: colWidths[col] }}
                                  onContextMenu={(e) => {
                                    if (!onCellContextMenu) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onCellContextMenu(makeAction(col as CellField), { x: e.clientX, y: e.clientY });
                                  }}
                                >
                                  {isLastCol ? <span className="block p-2 truncate pr-8">{cellDef.content}</span> : cellDef.content}
                                </td>
                              );
                            })}
                            <td className="relative p-0 align-top">
                              {hoverToolbar}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={3 + colOrder.length}
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

      <SmartPanel
        open={!!headerSmartPanel}
        onClose={() => setHeaderSmartPanel(null)}
        position={headerSmartPanel?.pos ?? { x: 0, y: 0 }}
        title={headerSmartPanel ? (headerSmartPanelActiveOption === "col-settings" ? "Kolonneinnstillinger" : `Kolonne: ${columnLabels[headerSmartPanel.col]}`) : "Kolonne"}
        options={headerSmartPanelOptions}
        onOptionSelect={handleHeaderSmartPanelOption}
        activeOptionId={headerSmartPanelActiveOption}
        resultContent={
          headerSmartPanelActiveOption === "col-settings" ? (
            <div className="p-3 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Synlige kolonner</p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setShowAllInSettings((p) => !p)}
                  >
                    {showAllInSettings ? "Vis kun synlige" : "Vis alle"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(showAllInSettings ? DEFAULT_COLUMN_ORDER : colOrder).map((col) => {
                    const isActive = colOrder.includes(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                        onClick={() => toggleColumnVisibility(col)}
                      >
                        {columnLabels[col]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">Endre navn</p>
                </div>
                <div className="space-y-1.5">
                  {DEFAULT_COLUMN_ORDER.map((col) => (
                    <div key={col} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12 shrink-0 truncate">{defaultLabels[col]}</span>
                      <input
                        type="text"
                        value={colAliases[col] ?? ""}
                        onChange={(e) => setColAliases((prev) => ({ ...prev, [col]: e.target.value }))}
                        placeholder={defaultLabels[col]}
                        className="flex-1 h-7 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : undefined
        }
        footerContent={
          headerSmartPanelActiveOption !== "col-settings" ? (
            <div className="p-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Klikk</span> for å sortere</p>
              <p><span className="font-medium text-foreground">Dra header</span> for å endre rekkefølge</p>
              <p><span className="font-medium text-foreground">Dra kanten</span> for å endre bredde</p>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
