"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ExternalLink,
  Building2,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  CalendarDays,
} from "lucide-react";

interface TxCompany {
  id: number;
  name: string;
  orgNumber: string | null;
}

interface TxAccount {
  id: number;
  number: number;
  name: string;
  displayName: string;
  isBankAccount: boolean;
  requireReconciliation: boolean;
}

export interface ERPSetupClient {
  clientId: string;
  clientName: string;
  accountNumber: number;
  syncConfigId: string;
}

export interface ERPSetupResult {
  companyId: string;
  companyName: string;
  tripletexCompanyId: number;
  clients: ERPSetupClient[];
}

interface StepConfigureERPProps {
  erpId: string;
  onComplete: (result: ERPSetupResult) => void;
}

interface AccountGroup {
  prefix: string;
  label: string;
  accounts: TxAccount[];
}

type Phase = "credentials" | "verifying" | "select-company" | "select-accounts" | "creating";

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
  "31": "Salgsinntekter, avgiftsfri",
  "32": "Salgsinntekter, utenfor avg.omr.",
  "33": "Offentlige tilskudd/refusjoner",
  "34": "Andre driftsinntekter",
  "35": "Uopptjent inntekt",
  "36": "Leieinntekt",
  "37": "Provisjonsinntekt",
  "38": "Gevinst ved avgang",
  "39": "Andre inntekter",
  "40": "Forbruk av innkjøpte varer",
  "41": "Varekostnad",
  "42": "Fremmedtjenester og underentreprise",
  "43": "Annen fremmedtjeneste",
  "44": "Underentreprise",
  "45": "Fremmedytelse og underentreprise",
  "46": "Innkjøp, forskning og utvikling",
  "47": "Spesielle driftskostnader",
  "49": "Endring i beholdning",
  "50": "Lønn til ansatte",
  "51": "Feriepenger",
  "52": "Fordel i arbeidsforhold",
  "53": "Annen opptjent godtgjørelse",
  "54": "Arbeidsgiveravgift og pensjon",
  "55": "Andre ytelser til personalet",
  "56": "Arbeidsgiveravgift",
  "57": "Offentlige tilskudd vedr. arbeidskraft",
  "58": "Offentlige refusjoner vedr. arbeidskraft",
  "59": "Annen personalkostnad",
  "60": "Avskrivning",
  "61": "Frakt og transportkostnad",
  "62": "Energi, brensel",
  "63": "Kostnad lokaler",
  "64": "Leie maskiner, inventar o.l.",
  "65": "Verktøy, inventar driftsmateriale",
  "66": "Reparasjon og vedlikehold",
  "67": "Fremmedtjenester (kontorkostnader)",
  "68": "Kontorkostnad, telefon, porto",
  "69": "Kostnad transportmidler",
  "70": "Kostnad reise, diett, bil",
  "71": "Provisjonskostnad",
  "72": "Salgs-/reklamekostnad",
  "73": "Representasjon",
  "74": "Kontingenter og gaver",
  "75": "Forsikringspremie",
  "76": "Lisens, patenter, royalty",
  "77": "Annen kostnad",
  "78": "Tap og liknende",
  "79": "Annen driftskostnad",
  "80": "Finansinntekter",
  "81": "Renteinntekter",
  "82": "Annen finansinntekt",
  "83": "Valutagevins",
  "84": "Gevinst verdipapirer",
  "85": "Finanskostnader",
  "86": "Rentekostnad",
  "87": "Annen finanskostnad",
  "88": "Valutatap",
  "89": "Tap verdipapirer",
};

function getGroupLabel(prefix: string): string {
  return ACCOUNT_CLASS_NAMES[prefix] ?? `${prefix}xx`;
}

export function StepConfigureERP({ erpId, onComplete }: StepConfigureERPProps) {
  const [phase, setPhase] = useState<Phase>("credentials");
  const [error, setError] = useState<string | null>(null);

  // Credentials
  const [consumerToken, setConsumerToken] = useState("");
  const [employeeToken, setEmployeeToken] = useState("");
  const [showConsumer, setShowConsumer] = useState(false);
  const [showEmployee, setShowEmployee] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Companies
  const [txCompanies, setTxCompanies] = useState<TxCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Accounts
  const [txAccounts, setTxAccounts] = useState<TxAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [accountSearch, setAccountSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Date
  const [dateFrom, setDateFrom] = useState(`${new Date().getFullYear()}-01-01`);

  // Creating
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<string | null>(null);

  // Check if tenant already has a connection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tripletex/connect");
        if (!res.ok) return;
        const data = await res.json();
        if (data.connection?.verifiedAt && !cancelled) {
          setPhase("select-company");
          loadCompanies();
        }
      } catch {
        // No existing connection — stay on credentials
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = useCallback(async () => {
    if (!consumerToken.trim() || !employeeToken.trim()) {
      setError("Begge nøklene er påkrevd.");
      return;
    }

    setVerifying(true);
    setPhase("verifying");
    setError(null);

    try {
      const res = await fetch("/api/tripletex/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumerToken: consumerToken.trim(),
          employeeToken: employeeToken.trim(),
          isTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Tilkobling feilet");
      }

      setPhase("select-company");
      await loadCompanies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tilkobling feilet");
      setPhase("credentials");
    } finally {
      setVerifying(false);
    }
  }, [consumerToken, employeeToken, isTest]);

  async function loadCompanies() {
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/tripletex/companies");
      if (!res.ok) throw new Error("Kunne ikke hente selskaper fra Tripletex.");
      const data = await res.json();
      setTxCompanies(data.companies ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feil ved henting av selskaper");
    } finally {
      setLoadingCompanies(false);
    }
  }

  const handleCompanySelect = useCallback(async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setError(null);
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/tripletex/accounts");
      if (!res.ok) throw new Error("Kunne ikke hente kontoplan.");
      const data = await res.json();
      setTxAccounts(data.accounts ?? []);
      setPhase("select-accounts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feil ved henting av kontoer");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const toggleAccount = (id: number) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (accounts: TxAccount[]) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      const ids = accounts.map((a) => a.id);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleGroupCollapse = (prefix: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  };

  // Group and filter accounts
  const filteredAccounts = useMemo(() => {
    const list = accountSearch
      ? txAccounts.filter((a) =>
          a.displayName.toLowerCase().includes(accountSearch.toLowerCase()) ||
          a.number.toString().includes(accountSearch)
        )
      : txAccounts;

    return list.sort((a, b) => a.number - b.number);
  }, [txAccounts, accountSearch]);

  const accountGroups = useMemo((): AccountGroup[] => {
    const groups = new Map<string, TxAccount[]>();

    for (const account of filteredAccounts) {
      const prefix = String(account.number).slice(0, 2).padStart(2, "0");
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push(account);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, accounts]) => ({
        prefix,
        label: getGroupLabel(prefix),
        accounts,
      }));
  }, [filteredAccounts]);

  const handleCreate = useCallback(async () => {
    if (selectedAccountIds.size === 0) {
      setError("Velg minst én konto.");
      return;
    }

    setCreating(true);
    setPhase("creating");
    setError(null);
    setCreateProgress(null);

    const txCompanyId = Number(selectedCompanyId);
    const txCompany = txCompanies.find((c) => c.id === txCompanyId);

    const selectedAccounts = txAccounts.filter((a) => selectedAccountIds.has(a.id));

    try {
      setCreateProgress(`Oppretter selskap «${txCompany?.name ?? "Selskap"}»...`);
      const companyRes = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: txCompany?.name ?? "Selskap",
          orgNumber: txCompany?.orgNumber ?? undefined,
          type: "company",
        }),
        credentials: "include",
      });
      const companyBody = await companyRes.json().catch(() => ({}));
      if (!companyRes.ok) {
        const msg = (companyBody as { error?: string }).error || "Kunne ikke opprette selskap";
        throw new Error(`Selskap: ${msg}`);
      }
      const company = companyBody as { id: string; name: string };

      const createdClients: ERPSetupClient[] = [];

      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        const clientName = `${account.number} ${account.name}`;
        const accountType = account.isBankAccount ? "bank" : "ledger";

        setCreateProgress(
          `Oppretter konto ${i + 1} av ${selectedAccounts.length} (${account.number} ${account.name})...`
        );

        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            name: clientName,
            set1: {
              accountNumber: account.number.toString(),
              name: account.name,
              type: accountType,
            },
            set2: {
              accountNumber: account.number.toString(),
              name: `${account.name} (motkonto)`,
              type: accountType === "bank" ? "ledger" : "bank",
            },
          }),
          credentials: "include",
        });
        const clientBody = await clientRes.json().catch(() => ({}));
        if (!clientRes.ok) {
          const msg = (clientBody as { error?: string }).error || "Ukjent feil";
          throw new Error(`Konto ${account.number} ${account.name}: ${msg}`);
        }
        const client = clientBody as { id: string; name: string };

        setCreateProgress(`Starter synkronisering for konto ${account.number}...`);
        const syncRes = await fetch("/api/tripletex/sync-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: client.id,
            tripletexCompanyId: txCompanyId,
            set1TripletexAccountIds: [account.id],
            set2TripletexAccountIds: [],
            dateFrom,
            syncIntervalMinutes: 60,
          }),
        });

        let syncConfigId = "";
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          syncConfigId = syncData.config?.id ?? "";
        }

        createdClients.push({
          clientId: client.id,
          clientName: client.name ?? clientName,
          accountNumber: account.number,
          syncConfigId,
        });
      }

      setCreateProgress(null);
      onComplete({
        companyId: company.id,
        companyName: company.name,
        tripletexCompanyId: txCompanyId,
        clients: createdClients,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt under opprettelsen. Prøv igjen.");
      setPhase("select-accounts");
      setCreateProgress(null);
    } finally {
      setCreating(false);
    }
  }, [selectedCompanyId, txCompanies, txAccounts, selectedAccountIds, dateFrom, onComplete]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {phase === "credentials" && "Koble til Tripletex"}
          {phase === "verifying" && "Verifiserer tilkobling"}
          {phase === "select-company" && "Velg selskap"}
          {phase === "select-accounts" && "Velg kontoer"}
          {phase === "creating" && "Setter opp avstemming"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {phase === "credentials" && "Oppgi API-nøklene fra din Tripletex-konto for å koble til."}
          {phase === "verifying" && "Tester tilkoblingen mot Tripletex..."}
          {phase === "select-company" && "Velg selskapet du vil sette opp avstemming for."}
          {phase === "select-accounts" && "Velg kontoene du vil sette opp i Revizo. Du kan velge hele kontoserier."}
          {phase === "creating" && "Oppretter kontoer og starter synkronisering i bakgrunnen..."}
        </p>
      </div>

      {/* Credentials phase */}
      {phase === "credentials" && (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">API-nøkler</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="consumer-token">Consumer token</Label>
              <div className="relative">
                <Input
                  id="consumer-token"
                  type={showConsumer ? "text" : "password"}
                  placeholder="Lim inn consumer token"
                  value={consumerToken}
                  onChange={(e) => setConsumerToken(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowConsumer(!showConsumer)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConsumer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee-token">Employee token</Label>
              <div className="relative">
                <Input
                  id="employee-token"
                  type={showEmployee ? "text" : "password"}
                  placeholder="Lim inn employee token"
                  value={employeeToken}
                  onChange={(e) => setEmployeeToken(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEmployee(!showEmployee)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showEmployee ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-muted/30 px-4 py-3 space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Nøklene lagres kryptert og brukes kun for å synkronisere data
                  mellom Tripletex og Revizo. Du kan når som helst fjerne
                  tilkoblingen under Innstillinger.
                </p>
                <a
                  href="https://hjelp.tripletex.no/hc/no/articles/4411891889937"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hvor finner jeg API-nøklene?
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
            <Checkbox
              id="is-test"
              checked={isTest}
              onCheckedChange={(v) => setIsTest(v === true)}
            />
            <Label htmlFor="is-test" className="text-sm text-muted-foreground cursor-pointer">
              Bruk test-miljø (api-test.tripletex.tech)
            </Label>
          </div>

          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={!consumerToken.trim() || !employeeToken.trim()}
              className="gap-2"
            >
              Koble til Tripletex
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Verifying phase */}
      {phase === "verifying" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verifiserer API-nøkler og oppretter tilkobling...</p>
        </div>
      )}

      {/* Company selection phase */}
      {phase === "select-company" && (
        <div className="space-y-3">
          {loadingCompanies ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : txCompanies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Ingen selskaper funnet i Tripletex.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {txCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => handleCompanySelect(company.id.toString())}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all",
                    "hover:border-foreground/30 hover:bg-foreground/[0.02]",
                    selectedCompanyId === company.id.toString() && "border-foreground bg-foreground/[0.03]"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{company.name}</p>
                    {company.orgNumber && (
                      <p className="text-xs text-muted-foreground">Org.nr: {company.orgNumber}</p>
                    )}
                  </div>
                  {loadingAccounts && selectedCompanyId === company.id.toString() ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Account selection phase */}
      {phase === "select-accounts" && (
        <div className="space-y-4">
          <Input
            placeholder="Søk kontoer (navn eller nummer)..."
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            className="h-9"
          />

          <div className="rounded-lg border max-h-[400px] overflow-y-auto">
            {accountGroups.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">
                {accountSearch ? "Ingen treff" : "Ingen kontoer funnet"}
              </p>
            ) : (
              accountGroups.map((group) => {
                const isCollapsed = collapsedGroups.has(group.prefix);
                const groupIds = group.accounts.map((a) => a.id);
                const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedAccountIds.has(id));
                const someSelected = groupIds.some((id) => selectedAccountIds.has(id));

                return (
                  <div key={group.prefix}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b sticky top-0 z-10">
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.prefix)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5" />
                          : <ChevronDown className="h-3.5 w-3.5" />
                        }
                      </button>
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={() => toggleGroup(group.accounts)}
                      />
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapse(group.prefix)}
                        className="flex-1 text-left"
                      >
                        <span className="text-xs font-mono tabular-nums text-muted-foreground mr-1.5">
                          {group.prefix}xx
                        </span>
                        <span className="text-xs font-medium">
                          {group.label}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1.5">
                          ({group.accounts.length})
                        </span>
                      </button>
                    </div>
                    {!isCollapsed && group.accounts.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2.5 px-3 pl-10 py-2 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-b-0"
                      >
                        <Checkbox
                          checked={selectedAccountIds.has(a.id)}
                          onCheckedChange={() => toggleAccount(a.id)}
                        />
                        <span className="text-xs font-mono tabular-nums w-12 shrink-0 text-muted-foreground">
                          {a.number}
                        </span>
                        <span className="text-sm truncate">{a.name}</span>
                        {a.isBankAccount && (
                          <span className="ml-auto text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 shrink-0">
                            Bank
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Date picker */}
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="date-from" className="text-sm font-medium">Startdato for synkronisering</Label>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-44"
              />
              <p className="text-xs text-muted-foreground">
                Transaksjoner fra denne datoen og fremover blir hentet fra Tripletex.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{selectedAccountIds.size}</span>
              {" "}konto{selectedAccountIds.size !== 1 ? "er" : ""} valgt
            </div>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={selectedAccountIds.size === 0}
              className="gap-1.5"
            >
              Opprett og synkroniser
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Creating phase */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-4 py-12">
          {creating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Setter opp alt...</p>
                {createProgress ? (
                  <p className="text-xs text-muted-foreground">{createProgress}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Oppretter selskap, kontoer og starter synkronisering i bakgrunnen.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium">Tilkobling opprettet</p>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                Synkronisering av transaksjoner kjører i bakgrunnen. Du kan gå videre — statusen vises på dashbordet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p>{error}</p>
              {(/tilgang|permission|organisation|organization|403/i.test(error)) && (
                <p className="text-foreground/70">
                  Velg riktig organisasjon i headeren og prøv igjen.
                </p>
              )}
              {(/duplikat|allerede|kontoene|duplicate|unique/i.test(error)) && (
                <p className="text-foreground/70">
                  Denne kontoen er allerede satt opp. Velg en annen konto, eller gå til dashbordet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
