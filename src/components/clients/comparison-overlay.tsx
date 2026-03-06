"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFormatting } from "@/contexts/ui-preferences-context";

interface ComparisonClient {
  id: string;
  name: string;
  companyName: string;
  set1AccountNumber: string;
  set2AccountNumber: string;
  set1AccountName: string;
  set2AccountName: string;
  openingBalanceSet1: number;
  openingBalanceSet2: number;
  balanceSet1: number;
  balanceSet2: number;
  unmatchedSumSet1: number;
  unmatchedSumSet2: number;
  unmatchedCountSet1: number;
  unmatchedCountSet2: number;
  lastTransDate: string | null;
}

interface ComparisonData {
  clients: ComparisonClient[];
  totals: {
    nettoSet1: number;
    nettoSet2: number;
    totalUnmatchedCount: number;
  };
}

interface ComparisonOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds: string[];
}

export function ComparisonOverlay({
  open,
  onOpenChange,
  clientIds,
}: ComparisonOverlayProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [invertedIds, setInvertedIds] = useState<Set<string>>(new Set());
  const { fmtNum } = useFormatting();

  const fetchData = useCallback(async () => {
    if (clientIds.length < 2) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/clients/compare?ids=${clientIds.join(",")}`
      );
      if (res.ok) {
        const json: ComparisonData = await res.json();
        setData(json);
        // Default: invert all except the first client
        if (json.clients.length >= 2) {
          setInvertedIds(new Set(json.clients.slice(1).map((c) => c.id)));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [clientIds]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const toggleInvert = useCallback((id: string) => {
    setInvertedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { nettoSet1, nettoSet2, totalOpen } = useMemo(() => {
    if (!data) return { nettoSet1: 0, nettoSet2: 0, totalOpen: 0 };
    let s1 = 0;
    let s2 = 0;
    let op = 0;
    for (const c of data.clients) {
      const sign = invertedIds.has(c.id) ? -1 : 1;
      s1 += c.balanceSet1 * sign;
      s2 += c.balanceSet2 * sign;
      op += c.unmatchedCountSet1 + c.unmatchedCountSet2;
    }
    return { nettoSet1: s1, nettoSet2: s2, totalOpen: op };
  }, [data, invertedIds]);

  const handleExport = async (format: "pdf" | "xlsx") => {
    if (!data) return;
    setExporting(true);
    try {
      const exportClients = data.clients.map((c) => {
        const sign = invertedIds.has(c.id) ? -1 : 1;
        return {
          ...c,
          balanceSet1: c.balanceSet1 * sign,
          balanceSet2: c.balanceSet2 * sign,
          openingBalanceSet1: c.openingBalanceSet1 * sign,
          openingBalanceSet2: c.openingBalanceSet2 * sign,
        };
      });
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "comparison",
          format,
          comparisonData: {
            clients: exportClients,
            totals: { nettoSet1, nettoSet2, totalUnmatchedCount: totalOpen },
          },
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        a.download = `saldosammenligning-${dateStr}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  const isNeg = (n: number) => n < 0;
  const netColor = (n: number) =>
    n === 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Krysselskaplig saldosammenligning
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {data
                ? `Sammenligner saldoer mellom ${data.clients.length} klienter — snu fortegn med ±`
                : "Laster..."}
            </p>
          </DialogHeader>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : data ? (
          <>
            {/* Netting result banners */}
            <div className="grid grid-cols-2 gap-3 px-6 mt-2">
              <NettoBanner
                label="Netto hovedbok (sett 1)"
                description="Sum av saldoer med fortegn"
                value={nettoSet1}
                fmtNum={fmtNum}
              />
              <NettoBanner
                label="Netto bank (sett 2)"
                description="Sum av saldoer med fortegn"
                value={nettoSet2}
                fmtNum={fmtNum}
              />
            </div>

            {/* Per-client detail table */}
            <div className="mt-5 px-6 overflow-x-auto">
              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="w-16 px-3 py-3 text-center font-medium">
                        Fortegn
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Klient
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Selskap
                      </th>
                      <th className="px-4 py-3 text-left font-medium font-mono text-xs">
                        Konto
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Saldo hovedbok
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Saldo bank
                      </th>
                      <th className="px-4 py-3 text-center font-medium">
                        Åpne
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.map((c, idx) => {
                      const inverted = invertedIds.has(c.id);
                      const sign = inverted ? -1 : 1;
                      const dispSet1 = c.balanceSet1 * sign;
                      const dispSet2 = c.balanceSet2 * sign;
                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            "border-b last:border-b-0 transition-colors hover:bg-muted/20",
                            idx % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={() => toggleInvert(c.id)}
                              className={cn(
                                "inline-flex items-center justify-center h-7 w-10 rounded-md text-xs font-bold border transition-colors",
                                inverted
                                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-destructive"
                                  : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                              )}
                              title={
                                inverted
                                  ? "Invertert (motpart) — klikk for å snu"
                                  : "Positiv (referanse) — klikk for å snu"
                              }
                            >
                              {inverted ? "−" : "+"}
                            </button>
                          </td>
                          <td className="px-4 py-3.5 font-medium">
                            {c.name}
                          </td>
                          <td className="px-4 py-3.5 text-muted-foreground">
                            {c.companyName}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {c.set1AccountNumber}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3.5 text-right font-mono tabular-nums font-medium",
                              isNeg(dispSet1) && "text-destructive"
                            )}
                          >
                            {fmtNum(dispSet1)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3.5 text-right font-mono tabular-nums font-medium",
                              isNeg(dispSet2) && "text-destructive"
                            )}
                          >
                            {fmtNum(dispSet2)}
                          </td>
                          <td className="px-4 py-3.5 text-center tabular-nums">
                            {c.unmatchedCountSet1 + c.unmatchedCountSet2}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/40">
                      <td
                        className="px-4 py-3.5 font-semibold"
                        colSpan={4}
                      >
                        Netto mellom klienter
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3.5 text-right font-mono tabular-nums font-bold text-base",
                          netColor(nettoSet1)
                        )}
                      >
                        {fmtNum(nettoSet1)}
                        {nettoSet1 === 0 && " ✓"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3.5 text-right font-mono tabular-nums font-bold text-base",
                          netColor(nettoSet2)
                        )}
                      >
                        {fmtNum(nettoSet2)}
                        {nettoSet2 === 0 && " ✓"}
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums font-semibold">
                        {totalOpen}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Export buttons */}
            <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("xlsx")}
                disabled={exporting}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Eksporter Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("pdf")}
                disabled={exporting}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Eksporter PDF
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-muted-foreground py-12">
            Kunne ikke laste sammenligningsdata.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NettoBanner({
  label,
  description,
  value,
  fmtNum,
}: {
  label: string;
  description: string;
  value: number;
  fmtNum: (n: number) => string;
}) {
  const isZero = value === 0;
  return (
    <div
      className={cn(
        "rounded-lg px-5 py-4 border",
        isZero
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
      )}
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      <p
        className={cn(
          "text-2xl font-bold font-mono tabular-nums mt-2",
          isZero
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-destructive"
        )}
      >
        {fmtNum(value)}
        {isZero && " ✓"}
      </p>
    </div>
  );
}
