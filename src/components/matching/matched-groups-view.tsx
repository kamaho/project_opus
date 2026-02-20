"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Unlink, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  unmatchingId?: string | null;
  set1Label: string;
  set2Label: string;
}

export function MatchedGroupsView({
  groups,
  onUnmatch,
  unmatchingId,
  set1Label,
  set2Label,
}: MatchedGroupsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (matchId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
        Ingen matchede poster ennå. Match transaksjoner fra &laquo;Åpne&raquo;-visningen.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4 gap-2">
      <div className="text-xs text-muted-foreground mb-2">
        {groups.length} match{groups.length !== 1 ? "er" : ""} — {groups.reduce((s, g) => s + g.transactions.length, 0)} transaksjoner
      </div>
      {groups.map((group) => {
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
                    Differanse: {roundedSum.toFixed(2)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(group.matchedAt).toLocaleDateString("nb-NO")}
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
                {unmatchingId === group.matchId ? "Opphever…" : "Opphev"}
              </Button>
            </div>

            {expanded && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left p-2 pl-4 font-medium text-xs text-muted-foreground w-24">Mengde</th>
                      <th className="text-left p-2 font-medium text-xs text-muted-foreground w-28">Dato</th>
                      <th className="text-right p-2 font-medium text-xs text-muted-foreground w-32">Beløp</th>
                      <th className="text-left p-2 font-medium text-xs text-muted-foreground w-28">Bilag</th>
                      <th className="text-left p-2 pr-4 font-medium text-xs text-muted-foreground">Tekst</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {group.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-muted/20">
                        <td className="p-2 pl-4 text-xs text-muted-foreground">
                          {tx.setNumber === 1 ? set1Label : set2Label}
                        </td>
                        <td className="p-2">{tx.date}</td>
                        <td
                          className={cn(
                            "p-2 text-right font-mono",
                            tx.amount < 0 && "text-destructive"
                          )}
                        >
                          {tx.amount >= 0 ? "" : "−"}
                          {Math.abs(tx.amount).toLocaleString("nb-NO", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="p-2 text-muted-foreground">{tx.voucher ?? "—"}</td>
                        <td className="p-2 pr-4 truncate max-w-[300px]" title={tx.text}>{tx.text}</td>
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
