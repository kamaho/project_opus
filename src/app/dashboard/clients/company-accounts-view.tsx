"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Search,
  CheckCircle2,
  PlayCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountSyncRow {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: "ledger" | "bank";
  syncLevel: "balance_only" | "transactions";
  balanceIn: string | null;
  balanceOut: string | null;
  balanceYear: number | null;
  clientId: string | null;
  txCount: number;
  lastTxSyncAt: string | null;
  companyId: string;
}

interface CompanyAccountsViewProps {
  accounts: AccountSyncRow[];
  companyId: string;
}

const RECOMMENDED_PREFIXES = ["15", "19", "24", "27", "50", "59"];

const ACCOUNT_CLASS_NAMES: Record<string, string> = {
  "10": "Immaterielle eiendeler",
  "11": "Tomter og bygninger",
  "12": "Transportmidler, inventar mv.",
  "13": "Finansielle anleggsmidler",
  "14": "Varelager",
  "15": "Kundefordringer",
  "16": "Andre fordringer",
  "17": "Forskuddsbetalinger",
  "18": "Finansielle omløpsmidler",
  "19": "Bankinnskudd, kontanter",
  "20": "Egenkapital",
  "21": "Avsetning for forpliktelser",
  "22": "Annen langsiktig gjeld",
  "23": "Kortsiktig konvertibel gjeld",
  "24": "Leverandørgjeld",
  "25": "Betalbar skatt",
  "26": "Skattetrekk og avgifter",
  "27": "Skyldige offentlige avgifter",
  "28": "Utbytte",
  "29": "Annen kortsiktig gjeld",
  "30": "Salgsinntekter, avgiftspliktig",
  "40": "Forbruk av innkjøpte varer",
  "50": "Lønn til ansatte",
  "54": "Arbeidsgiveravgift og pensjon",
  "59": "Annen personalkostnad",
  "60": "Avskrivning",
  "70": "Kostnad reise, diett, bil",
  "80": "Finansinntekter",
  "85": "Finanskostnader",
};

function formatAmount(val: string | null): string {
  if (!val) return "—";
  const num = Number(val);
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

interface AccountGroupData {
  prefix: string;
  label: string;
  accounts: AccountSyncRow[];
}

export function CompanyAccountsView({
  accounts,
  companyId,
}: CompanyAccountsViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activating, setActivating] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const activeCount = accounts.filter(
    (a) => a.syncLevel === "transactions"
  ).length;

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.accountNumber.includes(q) ||
        a.accountName.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const groups = useMemo((): AccountGroupData[] => {
    const map = new Map<string, AccountSyncRow[]>();
    for (const acct of filtered) {
      const prefix = acct.accountNumber.slice(0, 2).padStart(2, "0");
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix)!.push(acct);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, accts]) => ({
        prefix,
        label: ACCOUNT_CLASS_NAMES[prefix] ?? `${prefix}xx`,
        accounts: accts,
      }));
  }, [filtered]);

  const recommendedAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.syncLevel === "balance_only" &&
          RECOMMENDED_PREFIXES.some((p) => a.accountNumber.startsWith(p))
      ),
    [accounts]
  );

  const handleActivate = useCallback(
    async (accountNumber: string) => {
      setActivating((prev) => new Set(prev).add(accountNumber));
      try {
        const res = await fetch(
          `/api/companies/${companyId}/accounts/${accountNumber}/activate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dateFrom: `${new Date().getFullYear()}-01-01` }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Aktivering feilet"
          );
        }
        const data = await res.json();
        toast.success(
          `Konto ${accountNumber} aktivert. Transaksjoner hentes i bakgrunnen.`
        );
        if (data.clientId) {
          router.refresh();
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke aktivere kontoen"
        );
      } finally {
        setActivating((prev) => {
          const next = new Set(prev);
          next.delete(accountNumber);
          return next;
        });
      }
    },
    [companyId, router]
  );

  const handleBulkActivate = useCallback(
    async (accountNumbers: string[]) => {
      for (const n of accountNumbers) {
        setActivating((prev) => new Set(prev).add(n));
      }
      try {
        const res = await fetch(
          `/api/companies/${companyId}/accounts/bulk-activate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountNumbers,
              dateFrom: `${new Date().getFullYear()}-01-01`,
            }),
          }
        );
        if (!res.ok) throw new Error("Bulk-aktivering feilet");
        const data = await res.json();
        const activated = (
          data.results as Array<{ status: string }>
        ).filter((r) => r.status === "activated").length;
        toast.success(
          `${activated} ${activated === 1 ? "konto" : "kontoer"} aktivert. Transaksjoner hentes i bakgrunnen.`
        );
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Kunne ikke aktivere kontoer"
        );
      } finally {
        setActivating(new Set());
      }
    },
    [companyId, router]
  );

  const toggleGroupCollapse = (prefix: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  if (accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Ingen kontoer synkronisert ennå. Kontoliste og saldoer hentes automatisk
          fra Tripletex etter tilkobling.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{accounts.length}</span>{" "}
          kontoer totalt ·{" "}
          <span className="font-medium text-foreground">{activeCount}</span> under
          avstemming
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Søk kontoer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9 text-sm"
          />
        </div>
      </div>

      {/* Recommended accounts section */}
      {recommendedAccounts.length > 0 && !search && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">Anbefalte kontoer for avstemming</p>
            <p className="text-xs text-muted-foreground">
              De fleste regnskapsførere avstemmer disse kontoene. Aktiver alle med
              ett klikk.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommendedAccounts.slice(0, 10).map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono"
              >
                {a.accountNumber} {a.accountName}
              </span>
            ))}
            {recommendedAccounts.length > 10 && (
              <span className="text-xs text-muted-foreground self-center">
                +{recommendedAccounts.length - 10} til
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={activating.size > 0}
            onClick={() =>
              handleBulkActivate(
                recommendedAccounts.slice(0, 20).map((a) => a.accountNumber)
              )
            }
          >
            {activating.size > 0 ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="h-3.5 w-3.5" />
            )}
            Aktiver {Math.min(recommendedAccounts.length, 20)} anbefalte kontoer
          </Button>
        </div>
      )}

      {/* Account groups */}
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_140px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
          <span>Konto</span>
          <span className="text-right">IB</span>
          <span className="text-right">UB</span>
          <span className="text-right">Status</span>
        </div>

        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.prefix);

          return (
            <div key={group.prefix}>
              <button
                type="button"
                onClick={() => toggleGroupCollapse(group.prefix)}
                className="flex items-center gap-2 w-full px-3 py-2 bg-muted/30 border-b text-left hover:bg-muted/50 transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {group.prefix}xx
                </span>
                <span className="text-xs font-medium">{group.label}</span>
                <span className="text-xs text-muted-foreground">
                  ({group.accounts.length})
                </span>
              </button>

              {!isCollapsed &&
                group.accounts.map((acct) => {
                  const isActive = acct.syncLevel === "transactions";
                  const isActivating = activating.has(acct.accountNumber);

                  return (
                    <div
                      key={acct.id}
                      className={cn(
                        "grid grid-cols-[1fr_120px_120px_140px] gap-2 px-3 pl-9 py-2 border-b last:border-b-0 items-center text-sm",
                        isActive && "bg-emerald-50/30 dark:bg-emerald-950/10"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono tabular-nums text-xs text-muted-foreground w-12 shrink-0">
                          {acct.accountNumber}
                        </span>
                        <span className="truncate text-sm">{acct.accountName}</span>
                        {acct.accountType === "bank" && (
                          <span className="shrink-0 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5">
                            Bank
                          </span>
                        )}
                      </div>

                      <span className="text-right font-mono tabular-nums text-xs">
                        {formatAmount(acct.balanceIn)}
                      </span>

                      <span className="text-right font-mono tabular-nums text-xs">
                        {formatAmount(acct.balanceOut)}
                      </span>

                      <div className="flex justify-end">
                        {isActive ? (
                          <a
                            href={`/dashboard/clients/${acct.clientId}/matching`}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Avstemming
                            {acct.txCount > 0 && (
                              <span className="text-emerald-600/70">
                                ({acct.txCount})
                              </span>
                            )}
                          </a>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 px-2"
                            disabled={isActivating}
                            onClick={() => handleActivate(acct.accountNumber)}
                          >
                            {isActivating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PlayCircle className="h-3 w-3" />
                            )}
                            Start avstemming
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
