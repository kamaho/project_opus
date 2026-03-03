"use client";

import { useState, useCallback, useEffect } from "react";
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
} from "lucide-react";

interface TxCompany {
  id: number;
  name: string;
  orgNumber: string | null;
}

export interface ERPSetupResult {
  companyId: string;
  companyName: string;
  tripletexCompanyId: number;
}

interface StepConfigureERPProps {
  erpId: string;
  onComplete: (result: ERPSetupResult) => void;
}

type Phase = "credentials" | "verifying" | "select-company" | "creating";

export function StepConfigureERP({ erpId, onComplete }: StepConfigureERPProps) {
  const [phase, setPhase] = useState<Phase>("credentials");
  const [error, setError] = useState<string | null>(null);

  const [consumerToken, setConsumerToken] = useState("");
  const [employeeToken, setEmployeeToken] = useState("");
  const [showConsumer, setShowConsumer] = useState(false);
  const [showEmployee, setShowEmployee] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [txCompanies, setTxCompanies] = useState<TxCompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<string | null>(null);

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
        // No existing connection
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

  const handleCompanySelect = useCallback(async (companyIdStr: string) => {
    setSelectedCompanyId(companyIdStr);
    setError(null);
    setCreating(true);
    setPhase("creating");
    setCreateProgress("Oppretter selskap...");

    const txCompanyId = Number(companyIdStr);
    const txCompany = txCompanies.find((c) => c.id === txCompanyId);

    try {
      const companyRes = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: txCompany?.name ?? "Selskap",
          orgNumber: txCompany?.orgNumber ?? undefined,
          type: "company",
          tripletexCompanyId: txCompanyId,
        }),
        credentials: "include",
      });
      const companyBody = await companyRes.json().catch(() => ({}));
      if (!companyRes.ok) {
        const msg = (companyBody as { error?: string }).error || "Kunne ikke opprette selskap";
        throw new Error(msg);
      }
      const company = companyBody as { id: string; name: string };

      setCreateProgress("Synkroniserer kontoliste og saldoer...");

      // Trigger Level 1 sync (accounts + balances)
      const syncRes = await fetch("/api/tripletex/sync-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          tripletexCompanyId: txCompanyId,
        }),
      });

      if (!syncRes.ok) {
        console.warn("[onboarding] sync-balances returned non-ok, continuing anyway");
      }

      setCreateProgress(null);
      setCreating(false);

      onComplete({
        companyId: company.id,
        companyName: company.name,
        tripletexCompanyId: txCompanyId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt under opprettelsen. Prøv igjen.");
      setPhase("select-company");
      setCreateProgress(null);
      setCreating(false);
    }
  }, [txCompanies, onComplete]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {phase === "credentials" && "Koble til Tripletex"}
          {phase === "verifying" && "Verifiserer tilkobling"}
          {phase === "select-company" && "Velg selskap"}
          {phase === "creating" && "Setter opp tilkobling"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {phase === "credentials" && "Oppgi API-nøklene fra din Tripletex-konto for å koble til."}
          {phase === "verifying" && "Tester tilkoblingen mot Tripletex..."}
          {phase === "select-company" && "Velg selskapet du vil koble til Revizo."}
          {phase === "creating" && "Henter kontoliste og saldoer fra Tripletex..."}
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
                  disabled={creating}
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
                  {creating && selectedCompanyId === company.id.toString() ? (
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

      {/* Creating phase */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-4 py-12">
          {creating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">Kobler til Tripletex...</p>
                {createProgress && (
                  <p className="text-xs text-muted-foreground">{createProgress}</p>
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
                Kontoliste og saldoer synkroniseres i bakgrunnen.
                Du kan begynne å jobbe med en gang — aktiver kontoer
                for avstemming fra dashbordet.
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
