"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Unlink, ChevronDown, ChevronRight, Search, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableAppearance, useFormatting } from "@/contexts/ui-preferences-context";

export interface MatchGroupTransaction {
  id: string;
  setNumber: number;
  date: string;
  amount: number;
  voucher?: string;
  text: string;
}

export interface MatchGroup {
  matchId: string;
  matchedAt: string;
  matchedBy: string | null;
  difference: number;
  transactions: MatchGroupTransaction[];
}

interface MatchedGroupsViewProps {
  groups: MatchGroup[];
  onUnmatch: (matchId: string) => void;
  onRemoveTransaction?: (transactionId: string) => void;
  unmatchingId?: string | null;
  set1Label: string;
  set2Label: string;
  dateFrom?: string;
  dateTo?: string;
}

export function MatchedGroupsView({
  groups,
  onUnmatch,
  onRemoveTransaction,
  unmatchingId,
  set1Label,
  set2Label,
  dateFrom,
  dateTo,
}: MatchedGroupsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const tableAppearance = useTableAppearance();
  const { fmtNum, fmtAbs, fmtDate: fmtD, fmtDateTime } = useFormatting();

  const toggleExpand = (matchId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const filteredGroups = useMemo(() => {
    let result = groups;

    if (dateFrom) {
      result = result.filter((g) =>
        g.transactions.some((tx) => tx.date >= dateFrom)
      );
    }
    if (dateTo) {
      result = result.filter((g) =>
        g.transactions.some((tx) => tx.date <= dateTo)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((g) =>
        g.transactions.some(
          (tx) =>
            tx.text.toLowerCase().includes(q) ||
            tx.voucher?.toLowerCase().includes(q) ||
            String(tx.amount).includes(q) ||
            tx.date.includes(q)
        )
      );
    }

    return result;
  }, [groups, dateFrom, dateTo, searchQuery]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Ingen matchede poster ennå. Match transaksjoner fra &laquo;Åpne&raquo;-visningen.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4 gap-2">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søk i lukkede poster\u2026"
            className="h-7 w-full rounded-md border bg-transparent pl-7 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted"
              onClick={() => setSearchQuery("")}
            >
              <XIcon className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filteredGroups.length} match{filteredGroups.length !== 1 ? "er" : ""} — {filteredGroups.reduce((s, g) => s + g.transactions.length, 0)} transaksjoner
        </span>
      </div>

      {filteredGroups.map((group) => {
        const expanded = expandedIds.has(group.matchId);
        const set1Txs = group.transactions.filter((t) => t.setNumber === 1);
        const set2Txs = group.transactions.filter((t) => t.setNumber === 2);
        const totalSum = group.transactions.reduce((s, t) => s + t.amount, 0);
        const roundedSum = Math.round(totalSum * 100) / 100;

        return (
          <div
            key={group.matchId}
            className="rounded-lg border bg-card shadow-sm"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpand(group.matchId)}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <div className="flex flex-1 items-center gap-4 min-w-0">
                <span className="text-sm font-medium">
                  {group.transactions.length} transaksjon{group.transactions.length !== 1 ? "er" : ""}
                </span>
                {set1Txs.length > 0 && set2Txs.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {set1Txs.length} {set1Label} + {set2Txs.length} {set2Label}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Intern match</span>
                )}
                {roundedSum !== 0 && (
                  <span className="text-xs text-amber-600 font-medium">
                    Differanse: {fmtNum(roundedSum)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {fmtD(group.matchedAt)}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnmatch(group.matchId);
                }}
                disabled={unmatchingId === group.matchId}
              >
                <Unlink className="h-3.5 w-3.5" />
                {unmatchingId === group.matchId ? "Opphever\u2026" : "Opphev"}
              </Button>
            </div>

            {expanded && (
              <div className="border-t">
                <table className={cn("w-full text-sm", tableAppearance.tableClass)}>
                  <thead className={cn("bg-muted/40", tableAppearance.theadClass)}>
                    <tr>
                      <th className="text-left p-2 pl-4 font-medium text-xs text-muted-foreground w-24">Mengde</th>
                      <th className="text-left p-2 font-medium text-xs text-muted-foreground w-28">Dato</th>
                      <th className="text-right p-2 font-medium text-xs text-muted-foreground w-32">Beløp</th>
                      <th className="text-left p-2 font-medium text-xs text-muted-foreground w-28">Bilag</th>
                      <th className="text-left p-2 font-medium text-xs text-muted-foreground">Tekst</th>
                      {onRemoveTransaction && (
                        <th className="w-10 p-2" />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.transactions.map((tx, idx) => (
                      <tr
                        key={tx.id}
                        className={cn(
                          "hover:bg-muted/20 group/row",
                          tableAppearance.rowBorderClass,
                          idx % 2 === 1 && tableAppearance.rowAlternateClass
                        )}
                      >
                        <td className="p-2 pl-4 text-xs text-muted-foreground">
                          {tx.setNumber === 1 ? set1Label : set2Label}
                        </td>
                        <td className="p-2">{fmtD(tx.date)}</td>
                        <td
                          className={cn(
                            "p-2 text-right font-mono",
                            tx.amount < 0 && "text-destructive"
                          )}
                        >
                          {tx.amount >= 0 ? "" : "\u2212"}
                          {fmtAbs(tx.amount)}
                        </td>
                        <td className="p-2 text-muted-foreground">{tx.voucher ?? "\u2014"}</td>
                        <td className="p-2 truncate max-w-[300px]" title={tx.text}>{tx.text}</td>
                        {onRemoveTransaction && (
                          <td className="p-2 pr-4">
                            <button
                              type="button"
                              className="p-1 rounded-sm opacity-0 group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                              title="Fjern fra matchgruppe"
                              onClick={() => onRemoveTransaction(tx.id)}
                            >
                              <XIcon className="h-3 w-3" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
