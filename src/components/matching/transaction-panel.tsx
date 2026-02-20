"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Filter, LayoutList, Trash2, Upload } from "lucide-react";
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

interface TransactionPanelProps {
  title?: string;
  transactions: TransactionRow[];
  onSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  onEject?: () => void;
  setLabel?: string;
  ejecting?: boolean;
  onImportFile?: (file: File) => void;
}

type ColumnKey = keyof typeof DEFAULT_COLUMN_WIDTHS;

export function TransactionPanel({
  title,
  transactions,
  onSelect,
  selectedIds = new Set(),
  onEject,
  setLabel,
  ejecting = false,
  onImportFile,
}: TransactionPanelProps) {
  const [colWidths, setColWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<ColumnKey | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: transactions.length,
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

  const tableMinWidth = 32 + colWidths.date + colWidths.amount + colWidths.voucher + colWidths.text;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col min-w-0 border-r last:border-r-0 bg-background relative",
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

      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
          <Button size="sm" variant="outline" className="gap-1">
            <LayoutList className="h-3.5 w-3.5" />
            Visning
          </Button>
        </div>
        <div className="flex gap-1.5">
          {onImportFile && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleFileSelect}
              title="Importer ny fil"
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
              title={setLabel ? `Fjern ${setLabel}-fil og alle transaksjoner` : "Fjern fil"}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {ejecting ? "Fjerner…" : "Fjern fil"}
            </Button>
          )}
        </div>
      </div>

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
              <th className="p-2 text-left font-medium relative select-none">
                Dato
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "date" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("date", e)}
                />
              </th>
              <th className="p-2 text-right font-medium relative select-none">
                Beløp
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "amount" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("amount", e)}
                />
              </th>
              <th className="p-2 text-left font-medium relative select-none">
                Bilag
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "voucher" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("voucher", e)}
                />
              </th>
              <th className="p-2 text-left font-medium relative select-none">
                Tekst
                <span
                  role="separator"
                  aria-label="Juster kolonnebredde"
                  className={cn(
                    "absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50",
                    resizing === "text" && "bg-primary/50"
                  )}
                  onMouseDown={(e) => handleResizeStart("text", e)}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Ingen transaksjoner. Importer fil for Mengde 1 og Mengde 2.
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
                  const tx = transactions[vRow.index];
                  return (
                    <tr
                      key={tx.id}
                      data-index={vRow.index}
                      className={cn(
                        "border-t hover:bg-muted/50",
                        vRow.index % 2 === 1 && "bg-muted/30"
                      )}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => onSelect?.(tx.id)}
                    >
                      <td className="p-2" style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => onSelect?.(tx.id)}
                          readOnly
                        />
                      </td>
                      <td className="p-2 truncate" style={{ width: colWidths.date }}>{tx.date}</td>
                      <td
                        className={cn("p-2 text-right font-mono truncate", tx.amount < 0 && "text-destructive")}
                        style={{ width: colWidths.amount }}
                      >
                        {tx.amount >= 0 ? "" : "−"}
                        {Math.abs(tx.amount).toLocaleString("nb-NO", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-2 text-muted-foreground truncate" style={{ width: colWidths.voucher }} title={tx.voucher}>{tx.voucher ?? "—"}</td>
                      <td className="p-2 truncate" style={{ width: colWidths.text }} title={tx.text}>{tx.text}</td>
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
      <div className="border-t px-3 py-1.5 text-muted-foreground text-xs">
        {transactions.length} transaksjoner totalt
      </div>
    </div>
  );
}
