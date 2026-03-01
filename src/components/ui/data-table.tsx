"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Search,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTableAppearance } from "@/contexts/ui-preferences-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortDir = "asc" | "desc";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorFn: (row: T) => string | number | boolean | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  hideable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  width?: string;
  mono?: boolean;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;

  onRowClick?: (row: T) => void;

  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;

  searchPlaceholder?: string;

  toolbarRight?: ReactNode;
  toolbarLeft?: ReactNode;

  emptyMessage?: string;

  rowClassName?: (row: T) => string | undefined;

  striped?: boolean;
  stickyHeader?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
  searchPlaceholder = "Søk…",
  toolbarRight,
  toolbarLeft,
  emptyMessage = "Ingen data",
  rowClassName,
  stickyHeader = true,
}: DataTableProps<T>) {
  const tableAppearance = useTableAppearance();

  // Search
  const [searchInput, setSearchInput] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const updateSearch = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setGlobalSearch(value), 150);
  }, []);

  // Column filters
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>(
    {}
  );
  const [inlineSearchCol, setInlineSearchCol] = useState<string | null>(null);
  const inlineSearchRef = useRef<HTMLInputElement>(null);

  const setColumnFilter = useCallback((colId: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [colId]: value }));
  }, []);

  // Hidden columns
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

  const toggleHideColumn = useCallback((colId: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols]
  );

  // Sort
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const setSortExplicit = useCallback(
    (colId: string, dir: SortDir) => {
      if (sortKey === colId && sortDir === dir) {
        setSortKey(null);
        setSortDir("asc");
      } else {
        setSortKey(colId);
        setSortDir(dir);
      }
    },
    [sortKey, sortDir]
  );

  // Derived: filter + sort
  const colMap = useMemo(() => {
    const m = new Map<string, ColumnDef<T>>();
    for (const c of columns) m.set(c.id, c);
    return m;
  }, [columns]);

  const filteredAndSorted = useMemo(() => {
    let rows = data;

    const q = globalSearch.toLowerCase().trim();
    if (q) {
      rows = rows.filter((row) =>
        columns.some((col) => {
          const val = col.accessorFn(row);
          if (val == null) return false;
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    for (const [colId, filterVal] of Object.entries(columnFilters)) {
      if (!filterVal?.trim()) continue;
      const col = colMap.get(colId);
      if (!col) continue;
      const v = filterVal.toLowerCase().trim();
      rows = rows.filter((row) => {
        const val = col.accessorFn(row);
        if (val == null) return false;
        return String(val).toLowerCase().includes(v);
      });
    }

    if (sortKey) {
      const col = colMap.get(sortKey);
      if (col) {
        const dir = sortDir === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) => {
          const av = col.accessorFn(a);
          const bv = col.accessorFn(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number")
            return (av - bv) * dir;
          return String(av).localeCompare(String(bv), "nb-NO") * dir;
        });
      }
    }

    return rows;
  }, [data, globalSearch, columnFilters, sortKey, sortDir, columns, colMap]);

  // Selection helpers
  const allSelected =
    selectable &&
    filteredAndSorted.length > 0 &&
    selectedIds?.size === filteredAndSorted.length;

  const toggleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filteredAndSorted.map(getRowId)));
    }
  }, [allSelected, filteredAndSorted, getRowId, onSelectionChange]);

  const toggleSelect = useCallback(
    (id: string) => {
      if (!onSelectionChange || !selectedIds) return;
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange(next);
    },
    [selectedIds, onSelectionChange]
  );

  // Active filters
  const hasActiveFilters =
    globalSearch.trim() !== "" ||
    Object.values(columnFilters).some((v) => v?.trim());

  const clearAllFilters = useCallback(() => {
    setSearchInput("");
    setGlobalSearch("");
    setColumnFilters({});
    setInlineSearchCol(null);
  }, []);

  const handleInlineSearchClose = useCallback(
    (colId: string) => {
      setColumnFilter(colId, "");
      setInlineSearchCol(null);
    },
    [setColumnFilter]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {toolbarLeft}

        <div
          className={cn(
            "flex items-center h-8 rounded-md border bg-background transition-[width] duration-200 ease-out overflow-hidden",
            searchExpanded ? "w-72" : "w-44"
          )}
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2.5" />
          <input
            placeholder={searchExpanded ? searchPlaceholder : "Søk…"}
            value={searchInput}
            onChange={(e) => updateSearch(e.target.value)}
            onFocus={() => setSearchExpanded(true)}
            onBlur={() => {
              if (!searchInput.trim()) setSearchExpanded(false);
            }}
            className="flex-1 min-w-0 bg-transparent text-xs outline-none px-2 h-full"
          />
          {searchInput && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground shrink-0 mr-2 transition-colors"
              onClick={() => updateSearch("")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={clearAllFilters}
          >
            <X className="h-3 w-3" />
            Nullstill filtre
          </Button>
        )}

        {hiddenCols.size > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-muted-foreground"
              >
                <EyeOff className="h-3 w-3" />
                {hiddenCols.size} skjult
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {columns
                .filter((c) => hiddenCols.has(c.id))
                .map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    className="gap-2 text-xs"
                    onClick={() => toggleHideColumn(col.id)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Vis «{col.header}»
                  </DropdownMenuItem>
                ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs"
                onClick={() => setHiddenCols(new Set())}
              >
                <Eye className="h-3.5 w-3.5" />
                Vis alle kolonner
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="flex-1" />

        <div className="text-xs text-muted-foreground tabular-nums">
          {filteredAndSorted.length !== data.length
            ? `${filteredAndSorted.length} av ${data.length}`
            : `${data.length}`}{" "}
          rad{data.length !== 1 ? "er" : ""}
        </div>

        {toolbarRight}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className={cn("w-full text-sm", tableAppearance.tableClass)}>
          <thead
            className={cn(
              tableAppearance.theadClass,
              stickyHeader && "sticky top-0 z-10 bg-background"
            )}
          >
            <tr className="border-b bg-muted/50">
              {selectable && (
                <th className="w-10 p-2 text-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
              )}
              {visibleColumns.map((col) => {
                const isSortedAsc = sortKey === col.id && sortDir === "asc";
                const isSortedDesc = sortKey === col.id && sortDir === "desc";
                const isSearching = inlineSearchCol === col.id;
                const canSort = col.sortable !== false;
                const canFilter = col.filterable !== false;
                const canHide = col.hideable !== false;
                const hasActions = canSort || canFilter || canHide;
                const hasFilter = !!columnFilters[col.id]?.trim();

                return (
                  <th
                    key={col.id}
                    className={cn(
                      "font-medium select-none",
                      isSearching ? "p-0" : "p-2",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.align !== "right" &&
                        col.align !== "center" &&
                        "text-left",
                      col.headerClassName
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {isSearching ? (
                      <div className="flex items-center h-full">
                        <div className="relative flex-1">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <input
                            ref={inlineSearchRef}
                            type="text"
                            value={columnFilters[col.id] ?? ""}
                            onChange={(e) =>
                              setColumnFilter(col.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Escape")
                                handleInlineSearchClose(col.id);
                            }}
                            onBlur={(e) => {
                              const th = (
                                e.target as HTMLElement
                              ).closest("th");
                              if (th?.contains(e.relatedTarget as Node))
                                return;
                              setInlineSearchCol(null);
                            }}
                            placeholder={`Søk ${col.header.toLowerCase()}…`}
                            className="w-full h-10 pl-7 pr-7 text-xs bg-background border-0 outline-none ring-1 ring-inset ring-primary/40 focus:ring-primary/70 rounded-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted text-muted-foreground"
                            onClick={() => handleInlineSearchClose(col.id)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : hasActions ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "group/hdr flex items-center gap-1 min-w-0 w-full cursor-pointer rounded -m-1 p-1 hover:bg-muted transition-colors",
                              col.align === "right" && "justify-end"
                            )}
                          >
                            {col.header}
                            {isSortedAsc && (
                              <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                            )}
                            {isSortedDesc && (
                              <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                            )}
                            {hasFilter && (
                              <Search className="h-3 w-3 text-primary shrink-0" />
                            )}
                            <ChevronDown className="h-3 w-3 text-muted-foreground/0 group-hover/hdr:text-muted-foreground transition-colors shrink-0 ml-auto" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align={col.align === "right" ? "end" : "start"}
                          className="w-48"
                        >
                          {canFilter && (
                            <DropdownMenuItem
                              className="gap-2 text-xs"
                              onClick={() => {
                                setInlineSearchCol(col.id);
                                requestAnimationFrame(() =>
                                  inlineSearchRef.current?.focus()
                                );
                              }}
                            >
                              <Search className="h-3.5 w-3.5" />
                              Søk
                            </DropdownMenuItem>
                          )}
                          {canFilter && canSort && <DropdownMenuSeparator />}
                          {canSort && (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-xs"
                                onClick={() =>
                                  setSortExplicit(col.id, "asc")
                                }
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                                Sorter stigende
                                {isSortedAsc && (
                                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-xs"
                                onClick={() =>
                                  setSortExplicit(col.id, "desc")
                                }
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                                Sorter synkende
                                {isSortedDesc && (
                                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                              </DropdownMenuItem>
                            </>
                          )}
                          {canHide && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 text-xs"
                                onClick={() => toggleHideColumn(col.id)}
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                                Skjul kolonne
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span
                        className={cn(
                          "flex items-center gap-1 min-w-0",
                          col.align === "right" && "justify-end"
                        )}
                      >
                        {col.header}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="py-12 text-center text-muted-foreground"
                >
                  {hasActiveFilters
                    ? "Ingen treff på filteret"
                    : emptyMessage}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row, idx) => {
                const id = getRowId(row);
                const isSelected = selectedIds?.has(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "border-b hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors",
                      tableAppearance.rowBorderClass,
                      idx % 2 === 1 && tableAppearance.rowAlternateClass,
                      selectable && isSelected && "bg-accent/40",
                      onRowClick && "cursor-pointer",
                      rowClassName?.(row)
                    )}
                    onClick={
                      selectable
                        ? () => toggleSelect(id)
                        : onRowClick
                          ? () => onRowClick(row)
                          : undefined
                    }
                  >
                    {selectable && (
                      <td
                        className="p-2 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(id)}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "p-2",
                          col.align === "right" && "text-right",
                          col.align === "center" && "text-center",
                          col.mono && "font-mono tabular-nums",
                          col.className
                        )}
                      >
                        {col.cell
                          ? col.cell(row)
                          : String(col.accessorFn(row) ?? "—")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
