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
  Check,
} from "lucide-react";

interface TxCompany {
  id: number;
  name: string;
  orgNumber: string | null;
}

export interface ERPSetupResult {
  companies: Array<{
    companyId: string;
    companyName: string;
    tripletexCompanyId: number;
  }>;
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);
  const [completedCompanies, setCompletedCompanies] = useState<
    ERPSetupResult["companies"]
  >([]);

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
      const companies: TxCompany[] = data.companies ?? [];
      setTxCompanies(companies);
      if (companies.length === 1) {
        setSelectedIds(new Set([companies[0].id]));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feil ved henting av selskaper");
    } finally {
      setLoadingCompanies(false);
    }
  }

  function toggleCompany(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === txCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(txCompanies.map((c) => c.id)));
    }
  }

  const handleImportSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setError(null);
    setCreating(true);
    setPhase("creating");

    const toImport = txCompanies.filter((c) => selectedIds.has(c.id));
    const results: ERPSetupResult["companies"] = [];

    for (let i = 0; i < toImport.length; i++) {
      const txCompany = toImport[i];
      setCreateProgress({
        current: i + 1,
        total: toImport.length,
        name: txCompany.name,
      });

      try {
        const companyRes = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: txCompany.name,
            orgNumber: txCompany.orgNumber ?? undefined,
            type: "company",
            tripletexCompanyId: txCompany.id,
          }),
          credentials: "include",
        });
        const companyBody = await companyRes.json().catch(() => ({}));
        if (!companyRes.ok) {
          const msg =
            (companyBody as { error?: string }).error ||
            "Kunne ikke opprette selskap";
          console.warn(
            `[onboarding] Failed to create company ${txCompany.name}: ${msg}`
          );
          continue;
        }
        const company = companyBody as { id: string; name: string };

        // Trigger sync in background — don't block the flow
        fetch("/api/tripletex/sync-balances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: company.id,
            tripletexCompanyId: txCompany.id,
          }),
        }).catch(() => {});

        results.push({
          companyId: company.id,
          companyName: company.name,
          tripletexCompanyId: txCompany.id,
        });
      } catch (e) {
        console.warn(
          `[onboarding] Error importing ${txCompany.name}:`,
          e instanceof Error ? e.message : e
        );
      }
    }

    setCompletedCompanies(results);
    setCreateProgress(null);
    setCreating(false);

    if (results.length === 0) {
      setError("Ingen selskaper ble opprettet. Prøv igjen.");
      setPhase("select-company");
      return;
    }
  }, [selectedIds, txCompanies]);

  function handleFinishSetup() {
    onComplete({ companies: completedCompanies });
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {phase === "credentials" && "Koble til Tripletex"}
          {phase === "verifying" && "Verifiserer tilkobling"}
          {phase === "select-company" && "Velg selskaper"}
          {phase === "creating" && "Importerer selskaper"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {phase === "credentials" &&
            "Oppgi API-nøklene fra din Tripletex-konto for å koble til."}
          {phase === "verifying" &&
            "Tester tilkoblingen mot Tripletex..."}
          {phase === "select-company" &&
            "Velg selskapene du vil importere til Revizo. Du kan legge til flere senere."}
          {phase === "creating" &&
            "Oppretter selskaper og synkroniserer data fra Tripletex..."}
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
                  {showConsumer ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
                  {showEmployee ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
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
            <Label
              htmlFor="is-test"
              className="text-sm text-muted-foreground cursor-pointer"
            >
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
          <p className="text-sm text-muted-foreground">
            Verifiserer API-nøkler og oppretter tilkobling...
          </p>
        </div>
      )}

      {/* Company selection phase — multi-select */}
      {phase === "select-company" && (
        <div className="space-y-4">
          {loadingCompanies ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : txCompanies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Ingen selskaper funnet i Tripletex.
              </p>
            </div>
          ) : (
            <>
              {txCompanies.length > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} av {txCompanies.length} valgt
                  </span>
                  <button
                    onClick={selectAll}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {selectedIds.size === txCompanies.length
                      ? "Fjern alle"
                      : "Velg alle"}
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {txCompanies.map((company) => {
                  const selected = selectedIds.has(company.id);
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => toggleCompany(company.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-all",
                        selected
                          ? "border-foreground bg-foreground/[0.03]"
                          : "border-border hover:border-foreground/20"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
                          selected
                            ? "border-foreground bg-foreground"
                            : "border-border"
                        )}
                      >
                        {selected && (
                          <Check className="h-3 w-3 text-background" />
                        )}
                      </div>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {company.name}
                        </p>
                        {company.orgNumber && (
                          <p className="text-xs text-muted-foreground">
                            Org.nr: {company.orgNumber}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-center pt-2">
                <Button
                  size="lg"
                  onClick={handleImportSelected}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  Importer{" "}
                  {selectedIds.size > 0
                    ? `${selectedIds.size} selskap${selectedIds.size > 1 ? "er" : ""}`
                    : "valgte selskaper"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Creating phase — progress */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-4 py-12">
          {creating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <div className="space-y-2 text-center">
                <p className="text-sm font-medium">
                  Importerer selskaper...
                </p>
                {createProgress && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {createProgress.current} av {createProgress.total} —{" "}
                      {createProgress.name}
                    </p>
                    <div className="w-48 mx-auto h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground rounded-full transition-all duration-500"
                        style={{
                          width: `${(createProgress.current / createProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="space-y-1 text-center">
                <p className="text-sm font-medium">
                  {completedCompanies.length} selskap
                  {completedCompanies.length > 1 ? "er" : ""} importert
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Kontolister og saldoer synkroniseres i bakgrunnen. Du kan
                  begynne å jobbe med en gang.
                </p>
              </div>

              {completedCompanies.length > 0 && (
                <div className="w-full max-w-sm space-y-1.5">
                  {completedCompanies.map((c) => (
                    <div
                      key={c.companyId}
                      className="flex items-center gap-2 rounded-md border px-3 py-2"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-sm truncate">{c.companyName}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                size="lg"
                onClick={handleFinishSetup}
                className="gap-2 mt-2"
              >
                Fortsett
                <ArrowRight className="h-4 w-4" />
              </Button>
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
              {/tilgang|permission|organisation|organization|403/i.test(
                error
              ) && (
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
