"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IntegrationBadge } from "@/components/ui/integration-badge";

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
  integrationSources?: string[];
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

const ACCOUNT_CLASS_RANGE: Record<string, string> = {
  "1": "Eiendeler",
  "2": "Egenkapital og gjeld",
  "3": "Inntekter",
  "4": "Varekostnad",
  "5": "Lønnskostnad",
  "6": "Avskrivninger",
  "7": "Andre driftskostnader",
  "8": "Finansposter",
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
  activeCount: number;
}

export function CompanyAccountsView({
  accounts,
  companyId,
  integrationSources = [],
}: CompanyAccountsViewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [activating, setActivating] = useState<Set<string>>(new Set());

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Selection dialog for recommended bulk import
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [selectedForImport, setSelectedForImport] = useState<Set<string>>(new Set());

  // Import confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    accountNumbers: string[];
    accountNames: string[];
    isBulk: boolean;
  }>({ open: false, accountNumbers: [], accountNames: [], isBulk: false });

  function requestImport(accountNumber: string, accountName: string) {
    setConfirmDialog({
      open: true,
      accountNumbers: [accountNumber],
      accountNames: [accountName],
      isBulk: false,
    });
  }

  function openRecommendedSelection() {
    setSelectedForImport(new Set(recommendedAccounts.map((a) => a.accountNumber)));
    setSelectionOpen(true);
  }

  function confirmSelection() {
    const selected = recommendedAccounts.filter((a) =>
      selectedForImport.has(a.accountNumber)
    );
    if (selected.length === 0) return;
    setSelectionOpen(false);
    setConfirmDialog({
      open: true,
      accountNumbers: selected.map((a) => a.accountNumber),
      accountNames: selected.map((a) => a.accountName),
      isBulk: true,
    });
  }

  function requestBulkImport(accts: { accountNumber: string; accountName: string }[]) {
    setConfirmDialog({
      open: true,
      accountNumbers: accts.map((a) => a.accountNumber),
      accountNames: accts.map((a) => a.accountName),
      isBulk: true,
    });
  }

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.accountNumber.includes(q) ||
        a.accountName.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const { groups, classRanges } = useMemo(() => {
    const map = new Map<string, AccountSyncRow[]>();
    for (const acct of filtered) {
      const prefix = acct.accountNumber.slice(0, 2).padStart(2, "0");
      if (!map.has(prefix)) map.set(prefix, []);
      map.get(prefix)!.push(acct);
    }
    const grps: AccountGroupData[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, accts]) => ({
        prefix,
        label: ACCOUNT_CLASS_NAMES[prefix] ?? `${prefix}xx`,
        accounts: accts,
        activeCount: accts.filter((a) => !!a.clientId).length,
      }));

    // Group by first digit for section headers
    const ranges = new Map<string, AccountGroupData[]>();
    for (const g of grps) {
      const digit = g.prefix[0];
      if (!ranges.has(digit)) ranges.set(digit, []);
      ranges.get(digit)!.push(g);
    }

    return { groups: grps, classRanges: ranges };
  }, [filtered]);

  const recommendedAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.clientId &&
          RECOMMENDED_PREFIXES.some((p) => a.accountNumber.startsWith(p))
      ),
    [accounts]
  );

  const recommendedGrouped = useMemo(() => {
    const groups: { prefix: string; label: string; accounts: AccountSyncRow[] }[] = [];
    for (const prefix of RECOMMENDED_PREFIXES) {
      const accts = recommendedAccounts.filter((a) => a.accountNumber.startsWith(prefix));
      if (accts.length > 0) {
        groups.push({ prefix, label: ACCOUNT_CLASS_NAMES[prefix] ?? prefix, accounts: accts });
      }
    }
    return groups;
  }, [recommendedAccounts]);

  const handleActivate = useCallback(
    async (accountNumber: string) => {
      setActivating((prev) => new Set(prev).add(accountNumber));
      try {
        const res = await fetch(
          `/api/companies/${companyId}/accounts/${accountNumber}/activate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dateFrom: `${new Date().getFullYear()}-01-01`,
              syncLevel: "transactions",
            }),
          }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || "Aktivering feilet"
          );
        }
        toast.success(
          `Import startet for konto ${accountNumber}. Du får beskjed når dataen er klar.`
        );
        router.refresh();
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

      const BATCH_SIZE = 20;
      let totalActivated = 0;
      let totalErrors = 0;

      try {
        for (let i = 0; i < accountNumbers.length; i += BATCH_SIZE) {
          const batch = accountNumbers.slice(i, i + BATCH_SIZE);
          const res = await fetch(
            `/api/companies/${companyId}/accounts/bulk-activate`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accountNumbers: batch,
                dateFrom: `${new Date().getFullYear()}-01-01`,
                syncLevel: "transactions",
              }),
            }
          );
          if (!res.ok) {
            totalErrors += batch.length;
            continue;
          }
          const data = await res.json();
          const results = data.results as Array<{ status: string }>;
          totalActivated += results.filter((r) => r.status === "activated").length;
          totalErrors += results.filter((r) => r.status === "error").length;
        }

        if (totalActivated > 0) {
          toast.success(
            `Import startet for ${totalActivated} ${totalActivated === 1 ? "konto" : "kontoer"}. Du får beskjed når dataen er klar.`
          );
        }
        if (totalErrors > 0) {
          toast.error(`${totalErrors} ${totalErrors === 1 ? "konto" : "kontoer"} kunne ikke aktiveres.`);
        }
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

  async function handleConfirmImport() {
    const { accountNumbers, isBulk } = confirmDialog;
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    if (isBulk) {
      await handleBulkActivate(accountNumbers);
    } else if (accountNumbers[0]) {
      await handleActivate(accountNumbers[0]);
    }
  }

  const toggleGroupExpand = (prefix: string) => {
    setExpandedGroups((prev) => {
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
          Ingen kontoer synkronisert ennå.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Søk etter kontonummer eller navn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Recommended accounts banner */}
      {recommendedAccounts.length > 0 && !search && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-900/40">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {recommendedAccounts.length} anbefalte kontoer klare for import
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saldo synkroniseres alltid for alle kontoer. Importer data for å
                også hente transaksjoner og regnskapsdetaljer for
                kundefordringer, bank, leverandørgjeld, avgifter og lønn.
              </p>
            </div>
          </div>
          <div className="pl-8">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={activating.size > 0}
              onClick={openRecommendedSelection}
            >
              {activating.size > 0 ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Velg og importer kontoer
            </Button>
          </div>
        </div>
      )}

      {/* Account groups by class range */}
      <div className="space-y-1">
        {Array.from(classRanges.entries()).map(([digit, rangeGroups]) => (
          <div key={digit}>
            {/* Class range header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-1 pt-3 pb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {digit}xxx · {ACCOUNT_CLASS_RANGE[digit] ?? "Andre"}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Groups within this range */}
            <div className="rounded-lg border overflow-hidden mb-3">
              {rangeGroups.map((group, gi) => {
                const isExpanded = expandedGroups.has(group.prefix);
                const groupPct =
                  group.accounts.length > 0
                    ? Math.round(
                        (group.activeCount / group.accounts.length) * 100
                      )
                    : 0;

                return (
                  <div key={group.prefix}>
                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(group.prefix)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors",
                        "hover:bg-muted/50",
                        gi > 0 && "border-t",
                        isExpanded && "bg-muted/30"
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}

                      <span className="font-mono tabular-nums text-xs text-muted-foreground w-8 shrink-0">
                        {group.prefix}xx
                      </span>

                      <span className="text-sm font-medium flex-1 truncate">
                        {group.label}
                      </span>

                      {/* Mini progress */}
                      {group.activeCount > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${groupPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400 font-medium w-6 text-right">
                            {group.activeCount}
                          </span>
                        </div>
                      )}

                      <span className="text-xs tabular-nums text-muted-foreground shrink-0 w-6 text-right">
                        {group.accounts.length}
                      </span>
                    </button>

                    {/* Expanded rows */}
                    {isExpanded && (
                      <div>
                        {/* Column header */}
                        <div className="grid grid-cols-[24px_1fr_90px_90px_150px] gap-3 px-3 pl-[52px] py-1.5 bg-muted/40 border-t border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          <span />
                          <span>Konto</span>
                          <span className="text-center">IB</span>
                          <span className="text-center">UB</span>
                          <span />
                        </div>

                        {group.accounts.map((acct) => {
                          const hasClient = !!acct.clientId;
                          const isTransactions =
                            acct.syncLevel === "transactions" && hasClient;
                          const needsImport = !isTransactions;
                          const isActivating = activating.has(
                            acct.accountNumber
                          );
                          const isRecommended =
                            !hasClient &&
                            RECOMMENDED_PREFIXES.some((p) =>
                              acct.accountNumber.startsWith(p)
                            );

                          return (
                            <div
                              key={acct.id}
                              className={cn(
                                "grid grid-cols-[24px_1fr_90px_90px_150px] gap-3 px-3 pl-[52px] py-2 border-t items-center group/row transition-colors",
                                isTransactions
                                  ? "bg-emerald-50/40 dark:bg-emerald-950/10"
                                  : "hover:bg-muted/20"
                              )}
                            >
                              {/* Integration source badge */}
                              <IntegrationBadge
                                sources={integrationSources.length > 0 ? integrationSources : ["tripletex"]}
                                size="md"
                              />

                              {/* Account name + number */}
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono tabular-nums text-xs text-muted-foreground w-10 shrink-0">
                                  {acct.accountNumber}
                                </span>
                                <span className="truncate text-sm">
                                  {acct.accountName}
                                </span>
                                {acct.accountType === "bank" && (
                                  <span className="shrink-0 text-[10px] rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-1.5 py-px font-medium">
                                    Bank
                                  </span>
                                )}
                                {isRecommended && (
                                  <span className="shrink-0 text-[10px] rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-px font-medium">
                                    Anbefalt
                                  </span>
                                )}
                              </div>

                              {/* IB — centered */}
                              <span className="text-center font-mono tabular-nums text-xs text-muted-foreground">
                                {formatAmount(acct.balanceIn)}
                              </span>

                              {/* UB — centered */}
                              <span className="text-center font-mono tabular-nums text-xs text-muted-foreground">
                                {formatAmount(acct.balanceOut)}
                              </span>

                              {/* Action */}
                              <div className="flex justify-end">
                                {isTransactions ? (
                                  <a
                                    href={`/dashboard/clients/${acct.clientId}/matching`}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-colors"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Importert
                                    {acct.txCount > 0 && (
                                      <span className="text-emerald-500/70">
                                        · {acct.txCount} tx
                                      </span>
                                    )}
                                    <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-50" />
                                  </a>
                                ) : needsImport ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 px-3"
                                    disabled={isActivating}
                                    onClick={() =>
                                      requestImport(
                                        acct.accountNumber,
                                        acct.accountName
                                      )
                                    }
                                  >
                                    {isActivating ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Download className="h-3 w-3" />
                                        Importer data
                                      </>
                                    )}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selection dialog for recommended accounts */}
      <Dialog open={selectionOpen} onOpenChange={setSelectionOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Velg kontoer for import</DialogTitle>
            <DialogDescription>
              {selectedForImport.size} av {recommendedAccounts.length} kontoer valgt.
              Fjern haken fra kontoer du ikke vil importere.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 -mx-6 border-y">
            <div className="h-full max-h-[50vh] overflow-y-auto">
              {recommendedGrouped.map((group) => {
                const allInGroupSelected = group.accounts.every((a) =>
                  selectedForImport.has(a.accountNumber)
                );
                const someInGroupSelected = group.accounts.some((a) =>
                  selectedForImport.has(a.accountNumber)
                );

                return (
                  <div key={group.prefix}>
                    <div
                      role="checkbox"
                      aria-checked={allInGroupSelected ? true : someInGroupSelected ? "mixed" : false}
                      tabIndex={0}
                      className="flex items-center gap-2.5 w-full px-4 py-2 bg-muted/40 border-b text-left hover:bg-muted/60 transition-colors cursor-pointer select-none"
                      onClick={() => {
                        setSelectedForImport((prev) => {
                          const next = new Set(prev);
                          const nums = group.accounts.map((a) => a.accountNumber);
                          if (allInGroupSelected) {
                            nums.forEach((n) => next.delete(n));
                          } else {
                            nums.forEach((n) => next.add(n));
                          }
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                    >
                      <Checkbox
                        checked={allInGroupSelected ? true : someInGroupSelected ? "indeterminate" : false}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <span className="font-mono tabular-nums text-xs text-muted-foreground w-8 shrink-0">
                        {group.prefix}xx
                      </span>
                      <span className="text-sm font-medium flex-1 truncate">
                        {group.label}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                        {group.accounts.filter((a) => selectedForImport.has(a.accountNumber)).length}/{group.accounts.length}
                      </span>
                    </div>

                    {group.accounts.map((acct) => {
                      const checked = selectedForImport.has(acct.accountNumber);
                      return (
                        <div
                          key={acct.id}
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={0}
                          className={cn(
                            "flex items-center gap-2.5 w-full px-4 pl-6 py-1.5 border-b border-border/50 text-left transition-colors cursor-pointer select-none",
                            checked ? "bg-emerald-50/30 dark:bg-emerald-950/10" : "hover:bg-muted/20"
                          )}
                          onClick={() => {
                            setSelectedForImport((prev) => {
                              const next = new Set(prev);
                              if (checked) next.delete(acct.accountNumber);
                              else next.add(acct.accountNumber);
                              return next;
                            });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}
                        >
                          <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                          <span className="font-mono tabular-nums text-xs text-muted-foreground w-10 shrink-0">
                            {acct.accountNumber}
                          </span>
                          <span className="text-sm truncate flex-1">{acct.accountName}</span>
                          {acct.balanceOut && (
                            <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0">
                              {formatAmount(acct.balanceOut)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                const allSelected = selectedForImport.size === recommendedAccounts.length;
                setSelectedForImport(
                  allSelected ? new Set() : new Set(recommendedAccounts.map((a) => a.accountNumber))
                );
              }}
            >
              {selectedForImport.size === recommendedAccounts.length ? "Fjern alle" : "Velg alle"}
            </button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectionOpen(false)}>
                Avbryt
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={selectedForImport.size === 0}
                onClick={confirmSelection}
              >
                <Download className="h-3.5 w-3.5" />
                Importer {selectedForImport.size} {selectedForImport.size === 1 ? "konto" : "kontoer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.isBulk
                ? `Importer data for ${confirmDialog.accountNumbers.length} kontoer`
                : `Importer data for konto ${confirmDialog.accountNumbers[0]}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Bekreft import av regnskapsdata
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {!confirmDialog.isBulk && confirmDialog.accountNames[0] && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {confirmDialog.accountNumbers[0]} {confirmDialog.accountNames[0]}
                </span>
              </p>
            )}

            <p className="text-sm text-muted-foreground">
              Vi henter transaksjoner og detaljert regnskapsdata fra
              regnskapssystemet for{" "}
              {confirmDialog.isBulk
                ? `${confirmDialog.accountNumbers.length} valgte kontoer`
                : "denne kontoen"}
              . Saldo er allerede hentet for alle kontoer.
            </p>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="relative flex flex-col gap-0">
                {/* Step 1 */}
                <div className="relative flex gap-3 pb-5">
                  <div className="flex flex-col items-center">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 bg-background text-[10px] font-semibold text-muted-foreground">
                      1
                    </div>
                    <div className="mt-1 w-px flex-1 bg-border" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Henter data
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Vi importerer transaksjoner og regnskapsdata. Dette kan ta
                      litt tid avhengig av datamengden.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative flex gap-3 pb-5">
                  <div className="flex flex-col items-center">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 bg-background text-[10px] font-semibold text-muted-foreground">
                      2
                    </div>
                    <div className="mt-1 w-px flex-1 bg-border" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Varsel ved fullføring
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Du får beskjed når importen er ferdig — du trenger ikke
                      vente.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-foreground/20 bg-background text-[10px] font-semibold text-muted-foreground">
                      3
                    </div>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-foreground">
                      Klar i Klienter
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {confirmDialog.isBulk ? "Kontoene" : "Kontoen"} legges
                      automatisk til på Klienter-siden når dataen er klar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {confirmDialog.isBulk && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Kontoer som importeres ({confirmDialog.accountNumbers.length}):
                </p>
                <div className="max-h-48 overflow-y-auto rounded border bg-muted/20 p-2 space-y-0.5">
                  {confirmDialog.accountNumbers.map((num, i) => (
                    <p
                      key={num}
                      className="text-xs text-muted-foreground font-mono tabular-nums"
                    >
                      {num}{" "}
                      <span className="font-sans text-foreground/70">
                        {confirmDialog.accountNames[i]}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Avbryt
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleConfirmImport}
            >
              <Download className="h-3.5 w-3.5" />
              {confirmDialog.isBulk
                ? `Importer ${confirmDialog.accountNumbers.length} kontoer`
                : "Start import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
