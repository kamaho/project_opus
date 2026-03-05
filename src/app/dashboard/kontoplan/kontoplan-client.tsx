"use client";

import { useState, useMemo } from "react";
import { Building2, TrendingUp, TrendingDown, CheckCircle2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CompanyAccountsView,
  type AccountSyncRow,
} from "../clients/company-accounts-view";
import { IntegrationBadge } from "@/components/ui/integration-badge";

interface Company {
  id: string;
  name: string;
  orgNumber: string | null;
  integrationSources?: string[];
}

interface KontoplanClientProps {
  companies: Company[];
  accounts: AccountSyncRow[];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

export function KontoplanClient({ companies, accounts }: KontoplanClientProps) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    companies[0]?.id ?? ""
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
  const companyAccounts = useMemo(
    () => accounts.filter((a) => a.companyId === selectedCompanyId),
    [accounts, selectedCompanyId]
  );

  const stats = useMemo(() => {
    const accts = companyAccounts;
    const total = accts.length;
    const active = accts.filter((a) => !!a.clientId).length;
    let sumIB = 0;
    let sumUB = 0;
    for (const a of accts) {
      if (a.balanceIn) sumIB += Number(a.balanceIn);
      if (a.balanceOut) sumUB += Number(a.balanceOut);
    }
    return { total, active, sumIB, sumUB };
  }, [companyAccounts]);

  const accountCountByCompany = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    for (const a of accounts) {
      const entry = map.get(a.companyId) ?? { total: 0, active: 0 };
      entry.total++;
      if (a.clientId) entry.active++;
      map.set(a.companyId, entry);
    }
    return map;
  }, [accounts]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Kontoplan</h1>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Ingen kontoer synkronisert ennå. Kontoliste og saldoer hentes
            automatisk fra regnskapssystemet etter tilkobling.
          </p>
        </div>
      </div>
    );
  }

  const showCompanySelector = companies.length > 1;
  const pct = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Kontoplan</h1>
        {selectedCompany && !showCompanySelector && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedCompany.name}
            {selectedCompany.orgNumber && (
              <span className="ml-1.5 text-muted-foreground/60">
                · {selectedCompany.orgNumber}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Company selector */}
      {showCompanySelector && (
        <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
          {companies.map((company) => {
            const counts = accountCountByCompany.get(company.id);
            const isSelected = company.id === selectedCompanyId;
            return (
              <button
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all",
                  isSelected
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate max-w-[160px]">{company.name}</span>
                {company.integrationSources && company.integrationSources.length > 0 && (
                  <IntegrationBadge sources={company.integrationSources} />
                )}
                {counts && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isSelected ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}
                  >
                    {counts.active}/{counts.total}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Layers className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Kontoer</span>
          </div>
          <p className="text-xl font-semibold tabular-nums">{stats.total}</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Importert</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-semibold tabular-nums">{stats.active}</p>
            <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Sum IB</span>
          </div>
          <p className="text-lg font-semibold tabular-nums font-mono">
            {formatCurrency(stats.sumIB)}
          </p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Sum UB</span>
          </div>
          <p className="text-lg font-semibold tabular-nums font-mono">
            {formatCurrency(stats.sumUB)}
          </p>
        </div>
      </div>

      {/* Account list */}
      {selectedCompany && (
        <CompanyAccountsView
          key={selectedCompanyId}
          accounts={companyAccounts}
          companyId={selectedCompanyId}
          integrationSources={selectedCompany.integrationSources}
        />
      )}
    </div>
  );
}
