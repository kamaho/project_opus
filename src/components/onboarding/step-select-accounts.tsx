"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const RECOMMENDED_PREFIXES = ["15", "19", "24", "27", "50", "59"];

const ACCOUNT_CLASS_NAMES: Record<string, string> = {
  "15": "Kundefordringer",
  "19": "Bankinnskudd, kontanter",
  "24": "Leverandørgjeld",
  "27": "Skyldige offentlige avgifter",
  "50": "Lønn til ansatte",
  "59": "Annen personalkostnad",
};

interface AccountRow {
  id: string;
  companyId: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  balanceIn: string | null;
  balanceOut: string | null;
}

interface CompanyGroup {
  companyId: string;
  companyName: string;
  integration: "tripletex" | "visma_nxt" | null;
  tripletexCompanyId: number | null;
  accounts: AccountRow[];
}

interface StepSelectAccountsProps {
  onComplete: () => void;
}

type ImportPhase = "idle" | "activating" | "completing" | "done";

export function StepSelectAccounts({ onComplete }: StepSelectAccountsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/onboarding/accounts");
        if (!res.ok) throw new Error("Failed to load accounts");
        const data = await res.json();
        const groups = data.companies as CompanyGroup[];
        setCompanyGroups(groups);

        const recommendedIds = new Set<string>();
        for (const g of groups) {
          for (const a of g.accounts) {
            if (RECOMMENDED_PREFIXES.some((p) => a.accountNumber.startsWith(p))) {
              recommendedIds.add(a.id);
            }
          }
        }
        setSelected(recommendedIds);
        setExpandedCompanies(new Set(groups.map((g) => g.companyId)));
      } catch {
        toast.error("Kunne ikke laste kontoer. Prøv igjen.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { recommendedCount, otherCount, totalSelected } = useMemo(() => {
    let rec = 0;
    let oth = 0;
    for (const g of companyGroups) {
      for (const a of g.accounts) {
        const isRec = RECOMMENDED_PREFIXES.some((p) => a.accountNumber.startsWith(p));
        if (selected.has(a.id)) {
          if (isRec) rec++;
          else oth++;
        }
      }
    }
    return { recommendedCount: rec, otherCount: oth, totalSelected: rec + oth };
  }, [companyGroups, selected]);

  const toggleAccount = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCompany = useCallback(
    (companyId: string) => {
      const group = companyGroups.find((g) => g.companyId === companyId);
      if (!group) return;
      const groupIds = group.accounts.map((a) => a.id);
      const allSelected = groupIds.every((id) => selected.has(id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of groupIds) {
          if (allSelected) next.delete(id);
          else next.add(id);
        }
        return next;
      });
    },
    [companyGroups, selected],
  );

  const toggleExpandCompany = useCallback((companyId: string) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (totalSelected === 0) {
      handleSkip();
      return;
    }

    setImportPhase("activating");

    try {
      for (const group of companyGroups) {
        const groupAccountIds = new Set(group.accounts.map((a) => a.id));
        const selectedAccounts = group.accounts.filter((a) => groupAccountIds.has(a.id) && selected.has(a.id));
        if (selectedAccounts.length === 0) continue;

        const accountNumbers = selectedAccounts.map((a) => a.accountNumber);

        const res = await fetch(
          `/api/companies/${group.companyId}/accounts/bulk-activate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountNumbers,
              dateFrom: `${new Date().getFullYear()}-01-01`,
              syncLevel: "transactions",
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          console.error("[onboarding] bulk-activate failed:", data);
        }
      }

      setImportPhase("completing");

      const completeRes = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erpConnected: true }),
      });

      if (!completeRes.ok) {
        toast.error("Kunne ikke fullføre onboarding. Prøv igjen.");
        setImportPhase("idle");
        return;
      }

      setImportPhase("done");
      toast.success(`${totalSelected} kontoer importert. Velkommen til Revizo!`);
      onComplete();
      router.push("/dashboard");
    } catch {
      toast.error("Noe gikk galt under importen. Prøv igjen.");
      setImportPhase("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyGroups, selected, totalSelected, router]);

  const handleSkip = useCallback(async () => {
    setImportPhase("completing");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erpConnected: true }),
      });
      if (!res.ok) {
        toast.error("Kunne ikke fullføre onboarding.");
        setImportPhase("idle");
        return;
      }
      onComplete();
      router.push("/dashboard");
    } catch {
      toast.error("Nettverksfeil. Prøv igjen.");
      setImportPhase("idle");
    }
  }, [onComplete, router]);

  if (loading) {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Laster kontoer...
        </h2>
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (companyGroups.length === 0 || companyGroups.every((g) => g.accounts.length === 0)) {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ingen kontoer funnet
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Kontolisten fra regnskapssystemet er ikke klar ennå. Du kan importere
          kontoer fra Kontoplan-siden etter onboarding.
        </p>
        <Button size="lg" onClick={handleSkip} className="gap-2">
          {importPhase === "completing" ? "Fullfører..." : "Fortsett til Revizo"}
          {importPhase !== "completing" && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  const isImporting = importPhase !== "idle";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Velg kontoer for import
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Velg hvilke kontoer som skal importeres til Revizo. Anbefalte kontoer
          er forhåndsvalgt.
        </p>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          {totalSelected} av{" "}
          {companyGroups.reduce((sum, g) => sum + g.accounts.length, 0)} kontoer
          valgt
          {recommendedCount > 0 && (
            <span className="ml-1 text-foreground/70">
              ({recommendedCount} anbefalte{otherCount > 0 ? `, ${otherCount} andre` : ""})
            </span>
          )}
        </span>
      </div>

      {/* Company groups */}
      <div className="space-y-3">
        {companyGroups.map((group) => {
          const isExpanded = expandedCompanies.has(group.companyId);
          const groupIds = group.accounts.map((a) => a.id);
          const selectedInGroup = groupIds.filter((id) => selected.has(id)).length;
          const allSelected = selectedInGroup === groupIds.length;
          const someSelected = selectedInGroup > 0 && !allSelected;

          return (
            <div
              key={group.companyId}
              className="rounded-lg border overflow-hidden"
            >
              {/* Company header */}
              <div className="flex items-center gap-3 bg-muted/30 px-4 py-3">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleCompany(group.companyId)}
                  disabled={isImporting}
                />
                <button
                  onClick={() => toggleExpandCompany(group.companyId)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">{group.companyName}</span>
                  <span className="text-xs text-muted-foreground">
                    {selectedInGroup}/{group.accounts.length}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Account rows */}
              {isExpanded && (
                <div className="divide-y">
                  {group.accounts.map((account) => {
                    const isRecommended = RECOMMENDED_PREFIXES.some((p) =>
                      account.accountNumber.startsWith(p),
                    );
                    const isChecked = selected.has(account.id);
                    const prefix = account.accountNumber.slice(0, 2);
                    const className = ACCOUNT_CLASS_NAMES[prefix];

                    return (
                      <label
                        key={account.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/20",
                          isChecked && "bg-muted/10",
                          isImporting && "pointer-events-none opacity-60",
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleAccount(account.id)}
                          disabled={isImporting}
                        />
                        <span className="font-mono text-sm tabular-nums w-16 shrink-0">
                          {account.accountNumber}
                        </span>
                        <span className="text-sm truncate flex-1">
                          {account.accountName}
                        </span>
                        {isRecommended && className && (
                          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Sparkles className="h-3 w-3" />
                            {className}
                          </span>
                        )}
                        {isRecommended && !className && (
                          <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Sparkles className="h-3 w-3" />
                            Anbefalt
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Import progress */}
      {isImporting && (
        <div className="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {importPhase === "activating" && "Importerer kontoer..."}
              {importPhase === "completing" && "Fullfører oppsett..."}
              {importPhase === "done" && "Ferdig!"}
            </span>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground pl-7">
            <span className="flex items-center gap-1">
              {importPhase === "activating" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Oppretter klienter
            </span>
            <span className="flex items-center gap-1">
              {importPhase === "completing" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : importPhase === "done" ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="h-3 w-3" />
              )}
              Fullfører
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleImport}
          disabled={isImporting}
          className="gap-2 min-w-[280px]"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importerer...
            </>
          ) : totalSelected > 0 ? (
            <>
              Importer {totalSelected} kontoer og start Revizo
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Start Revizo uten import
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {!isImporting && (
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Hopp over — jeg importerer kontoer senere
          </button>
        )}
      </div>
    </div>
  );
}
