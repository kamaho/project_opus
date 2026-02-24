"use client";

import Link from "next/link";
import { ChevronRight, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTableAppearance, useFormatting } from "@/contexts/ui-preferences-context";

export interface AccountRow {
  id: string;
  matchGroup: string;
  company: string;
  ledgerAccountGroup: string;
  openItems: number;
  leftBalance: number;
  rightBalance: number;
  hasDoc: boolean;
  lastTrans: string | null;
  lastRecon: string | null;
}

export function AccountsTable({ rows }: { rows: AccountRow[] }) {
  const tableAppearance = useTableAppearance();
  const { fmtNum, fmtDate: fmtD } = useFormatting();
  const formatBalance = fmtNum;
  const isNegative = (n: number) => n < 0;

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className={cn("w-full text-sm", tableAppearance.tableClass)}>
        <thead className={tableAppearance.theadClass}>
          <tr className="border-b bg-muted/50">
            <th className="w-8 p-2 text-left"></th>
            <th className="p-2 text-left font-medium">Matchgruppe</th>
            <th className="p-2 text-left font-medium">Selskap</th>
            <th className="p-2 text-left font-medium">Hovedbokskontogruppe</th>
            <th className="p-2 text-right font-medium">Åpne poster</th>
            <th className="p-2 text-right font-medium">Venstre saldo</th>
            <th className="p-2 text-right font-medium">Høyre saldo</th>
            <th className="p-2 text-center font-medium w-20">Har dok.</th>
            <th className="p-2 text-left font-medium">Siste trans.</th>
            <th className="p-2 text-left font-medium">Siste avst.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr
              key={r.id}
              className={cn(
                "border-b hover:bg-muted/30",
                tableAppearance.rowBorderClass,
                idx % 2 === 1 && tableAppearance.rowAlternateClass
              )}
            >
              <td className="p-2">
                <Link
                  href={`/dashboard/clients/${r.id}/matching`}
                  className="inline-flex text-muted-foreground hover:text-foreground"
                  aria-label="Åpne"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </td>
              <td className="p-2 font-medium">
                <Link href={`/dashboard/clients/${r.id}/matching`} className="hover:underline">
                  {r.matchGroup}
                </Link>
              </td>
              <td className="p-2 text-muted-foreground">{r.company}</td>
              <td className="p-2 font-mono text-muted-foreground">{r.ledgerAccountGroup}</td>
              <td className="p-2 text-right">{r.openItems}</td>
              <td
                className={`p-2 text-right font-mono ${
                  isNegative(r.leftBalance) ? "text-destructive" : ""
                }`}
              >
                {formatBalance(r.leftBalance)}
              </td>
              <td
                className={`p-2 text-right font-mono ${
                  isNegative(r.rightBalance) ? "text-destructive" : ""
                }`}
              >
                {formatBalance(r.rightBalance)}
              </td>
              <td className="p-2 text-center">
                {r.hasDoc ? <Upload className="h-4 w-4 inline text-muted-foreground" /> : "—"}
              </td>
              <td className="p-2 text-muted-foreground">{r.lastTrans ? fmtD(r.lastTrans) : "—"}</td>
              <td className="p-2 text-muted-foreground">{r.lastRecon ? fmtD(r.lastRecon) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
