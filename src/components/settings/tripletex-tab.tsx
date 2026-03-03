"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, Search, Unplug } from "lucide-react";
import { DEFAULT_ENABLED_FIELDS, FIELD_LABELS } from "@/lib/tripletex/mappers";

interface TripletexCompany {
  id: number;
  name: string;
  orgNumber: string | null;
}

interface TripletexAccount {
  id: number;
  number: number;
  name: string;
  displayName: string;
  isBankAccount: boolean;
  requireReconciliation: boolean;
}

interface SyncConfig {
  id: string;
  clientId: string;
  tripletexCompanyId: number;
  set1TripletexAccountIds: number[];
  set2TripletexAccountIds: number[];
  enabledFields: Record<string, boolean>;
  dateFrom: string;
  lastSyncAt: string | null;
  syncIntervalMinutes: number;
  isActive: boolean;
}

interface ClientOption {
  id: string;
  name: string;
  companyId: string;
}

export function TripletexTab() {
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [consumerToken, setConsumerToken] = useState("");
  const [employeeToken, setEmployeeToken] = useState("");
  const [isTestEnv, setIsTestEnv] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [txCompanies, setTxCompanies] = useState<TripletexCompany[]>([]);
  const [txAccounts, setTxAccounts] = useState<TripletexAccount[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [existingConfig, setExistingConfig] = useState<SyncConfig | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedSet1Ids, setSelectedSet1Ids] = useState<Set<number>>(new Set());
  const [selectedSet2Ids, setSelectedSet2Ids] = useState<Set<number>>(new Set());
  const [enabledFields, setEnabledFields] = useState<Record<string, boolean>>({
    ...DEFAULT_ENABLED_FIELDS,
  });
  const [dateFrom, setDateFrom] = useState(
    `${new Date().getFullYear()}-01-01`
  );
  const [syncInterval, setSyncInterval] = useState(60);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [accountSearch, setAccountSearch] = useState("");

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/tripletex/connect");
      if (res.ok) {
        const data = await res.json();
        setConnectionOk(!!data.connection?.isActive);
      } else {
        setConnectionOk(false);
      }
    } catch {
      setConnectionOk(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleConnect = useCallback(async () => {
    if (!consumerToken.trim() || !employeeToken.trim()) {
      setConnectError("Begge nøklene er påkrevd.");
      return;
    }
    setConnecting(true);
    setConnectError(null);
    try {
      const res = await fetch("/api/tripletex/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consumerToken: consumerToken.trim(),
          employeeToken: employeeToken.trim(),
          isTest: isTestEnv,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error ?? "Tilkobling feilet. Sjekk nøklene og prøv igjen.");
        return;
      }
      toast.success(`Koblet til Tripletex${data.company?.name ? ` (${data.company.name})` : ""}`);
      setConsumerToken("");
      setEmployeeToken("");
      setConnectionOk(true);
    } catch {
      setConnectError("Nettverksfeil — sjekk tilkoblingen og prøv igjen.");
    } finally {
      setConnecting(false);
    }
  }, [consumerToken, employeeToken, isTestEnv]);

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/tripletex/companies");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTxCompanies(data.companies ?? []);
    } catch {
      toast.error("Kunne ikke hente selskaper fra Tripletex");
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/tripletex/accounts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTxAccounts(data.accounts ?? []);
    } catch {
      toast.error("Kunne ikke hente kontoplan fra Tripletex");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (connectionOk) {
      loadCompanies();
      loadAccounts();
      fetch("/api/clients")
        .then((r) => r.json())
        .then((d) => setClients(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [connectionOk, loadCompanies, loadAccounts]);

  const loadExistingConfig = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/tripletex/sync-config?clientId=${clientId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.config) {
        const c = data.config as SyncConfig;
        setExistingConfig(c);
        setSelectedCompanyId(c.tripletexCompanyId.toString());
        setSelectedSet1Ids(new Set(c.set1TripletexAccountIds ?? []));
        setSelectedSet2Ids(new Set(c.set2TripletexAccountIds ?? []));
        setEnabledFields(c.enabledFields ?? { ...DEFAULT_ENABLED_FIELDS });
        setDateFrom(c.dateFrom);
        setSyncInterval(c.syncIntervalMinutes);
      } else {
        setExistingConfig(null);
      }
    } catch {
      setExistingConfig(null);
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadExistingConfig(selectedClientId);
    } else {
      setExistingConfig(null);
    }
  }, [selectedClientId, loadExistingConfig]);

  const ledgerAccounts = useMemo(
    () => txAccounts.filter((a) => !a.isBankAccount),
    [txAccounts]
  );
  const bankAccounts = useMemo(
    () => txAccounts.filter((a) => a.isBankAccount),
    [txAccounts]
  );

  const filteredLedger = useMemo(() => {
    if (!accountSearch.trim()) return ledgerAccounts;
    const q = accountSearch.toLowerCase();
    return ledgerAccounts.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.number.toString().includes(q)
    );
  }, [ledgerAccounts, accountSearch]);

  const filteredBank = useMemo(() => {
    if (!accountSearch.trim()) return bankAccounts;
    const q = accountSearch.toLowerCase();
    return bankAccounts.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.number.toString().includes(q)
    );
  }, [bankAccounts, accountSearch]);

  const toggleSet1 = (id: number) => {
    setSelectedSet1Ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSet2 = (id: number) => {
    setSelectedSet2Ids((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleField = (field: string) => {
    setEnabledFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSave = async () => {
    if (!selectedClientId || !selectedCompanyId || !dateFrom) {
      toast.error("Fyll inn alle obligatoriske felt");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tripletex/sync-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClientId,
          tripletexCompanyId: Number(selectedCompanyId),
          set1TripletexAccountIds: Array.from(selectedSet1Ids),
          set2TripletexAccountIds: Array.from(selectedSet2Ids),
          enabledFields,
          dateFrom,
          syncIntervalMinutes: syncInterval,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Feil");
      }

      const data = await res.json();
      setExistingConfig(data.config);

      const r = data.syncResult;
      toast.success(
        `Synkronisering fullført: ${r.postings.inserted} posteringer, ${r.bankTransactions.inserted} banktransaksjoner`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async () => {
    if (!selectedClientId) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/tripletex/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selectedClientId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Synkronisering feilet");
      }
      const data = await res.json();
      const r = data.result;
      toast.success(
        `Synkronisert: ${r.postings.inserted} posteringer, ${r.bankTransactions.inserted} banktransaksjoner`
      );
      loadExistingConfig(selectedClientId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synkronisering feilet");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <Card>
        <CardHeader>
          <CardTitle>Tilkobling</CardTitle>
          <CardDescription>
            Status for Tripletex API-tilkoblingen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : connectionOk ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Unplug className="h-4 w-4 text-destructive" />
            )}
            <span className="text-sm flex-1">
              {checking
                ? "Sjekker..."
                : connectionOk
                  ? "Koblet til Tripletex"
                  : "Ikke tilkoblet"}
            </span>
            <Button variant="ghost" size="sm" onClick={checkConnection} disabled={checking}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {!connectionOk && !checking && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Koble til Tripletex ved å lime inn dine API-nøkler. Du finner dem
                under Innstillinger &rarr; Integrasjon &rarr; API-tilgang i Tripletex.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tab-tx-consumer">Consumer token</Label>
                  <Input
                    id="tab-tx-consumer"
                    type="password"
                    value={consumerToken}
                    onChange={(e) => setConsumerToken(e.target.value)}
                    placeholder="Lim inn consumer token..."
                    autoComplete="off"
                    className="max-w-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tab-tx-employee">Employee token</Label>
                  <Input
                    id="tab-tx-employee"
                    type="password"
                    value={employeeToken}
                    onChange={(e) => setEmployeeToken(e.target.value)}
                    placeholder="Lim inn employee token..."
                    autoComplete="off"
                    className="max-w-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isTestEnv}
                    onCheckedChange={(checked) => setIsTestEnv(checked === true)}
                  />
                  <span className="text-muted-foreground">Bruk testmiljø (api-test.tripletex.tech)</span>
                </label>
                {connectError && (
                  <p className="text-sm text-destructive">{connectError}</p>
                )}
                <Button
                  onClick={handleConnect}
                  disabled={connecting || !consumerToken.trim() || !employeeToken.trim()}
                >
                  {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {connecting ? "Kobler til..." : "Koble til Tripletex"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {connectionOk && (
        <Card>
          <CardHeader>
            <CardTitle>Synkronisering</CardTitle>
            <CardDescription>
              Koble en klient til et Tripletex-selskap og sett opp automatisk synkronisering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Client */}
            <div className="space-y-2">
              <Label>Klient</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Velg klient" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClientId && (
              <>
                {/* Tripletex company */}
                <div className="space-y-2">
                  <Label>Tripletex-selskap</Label>
                  <Select
                    value={selectedCompanyId}
                    onValueChange={setSelectedCompanyId}
                    disabled={loadingCompanies}
                  >
                    <SelectTrigger className="w-full max-w-sm">
                      <SelectValue
                        placeholder={loadingCompanies ? "Laster..." : "Velg selskap"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {txCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                          {c.orgNumber ? ` (${c.orgNumber})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Account search */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Søk i kontoer..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pl-9 h-9"
                    disabled={loadingAccounts}
                  />
                </div>

                {/* Set 1: Ledger accounts */}
                <div className="space-y-2">
                  <Label>Hovedbok-kontoer (Sett 1)</Label>
                  <p className="text-xs text-muted-foreground">
                    Velg én eller flere kontoer for posteringer fra hovedboken.
                  </p>
                  <div className="rounded-md border max-h-40 overflow-y-auto">
                    {loadingAccounts ? (
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Laster kontoer...
                      </div>
                    ) : filteredLedger.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Ingen hovedbok-kontoer funnet.
                      </p>
                    ) : (
                      filteredLedger.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedSet1Ids.has(a.id)}
                            onCheckedChange={() => toggleSet1(a.id)}
                          />
                          <span className="font-mono text-xs tabular-nums text-muted-foreground w-12">
                            {a.number}
                          </span>
                          <span className="truncate">{a.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedSet1Ids.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedSet1Ids.size} konto{selectedSet1Ids.size !== 1 ? "er" : ""} valgt
                    </p>
                  )}
                </div>

                {/* Set 2: Bank accounts */}
                <div className="space-y-2">
                  <Label>Bankkontoer (Sett 2)</Label>
                  <p className="text-xs text-muted-foreground">
                    Velg én eller flere bankkontoer for banktransaksjoner.
                  </p>
                  <div className="rounded-md border max-h-40 overflow-y-auto">
                    {loadingAccounts ? (
                      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Laster kontoer...
                      </div>
                    ) : filteredBank.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        Ingen bankkontoer funnet.
                      </p>
                    ) : (
                      filteredBank.map((a) => (
                        <label
                          key={a.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={selectedSet2Ids.has(a.id)}
                            onCheckedChange={() => toggleSet2(a.id)}
                          />
                          <span className="font-mono text-xs tabular-nums text-muted-foreground w-12">
                            {a.number}
                          </span>
                          <span className="truncate">{a.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedSet2Ids.size > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedSet2Ids.size} konto{selectedSet2Ids.size !== 1 ? "er" : ""} valgt
                    </p>
                  )}
                </div>

                {/* Field picker */}
                <div className="space-y-2">
                  <Label>Transaksjonsfelt</Label>
                  <p className="text-xs text-muted-foreground">
                    Velg hvilke felt som skal hentes inn fra Tripletex. Beløp og dato
                    hentes alltid.
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    {(Object.entries(FIELD_LABELS) as [string, string][]).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 rounded-md border px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm"
                      >
                        <Checkbox
                          checked={enabledFields[key] !== false}
                          onCheckedChange={() => toggleField(key)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date from + interval */}
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div className="space-y-2">
                    <Label>Synkroniser fra dato</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervall (minutter)</Label>
                    <Input
                      type="number"
                      min={15}
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <Button onClick={handleSave} disabled={saving || !selectedCompanyId}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {existingConfig ? "Oppdater og synkroniser" : "Koble til og synkroniser"}
                  </Button>

                  {existingConfig && (
                    <Button
                      variant="outline"
                      onClick={handleManualSync}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Synkroniser nå
                    </Button>
                  )}
                </div>

                {/* Existing config info */}
                {existingConfig && (
                  <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium text-foreground">Status:</span>{" "}
                      {existingConfig.isActive ? "Aktiv" : "Pauset"}
                    </p>
                    {existingConfig.lastSyncAt && (
                      <p>
                        <span className="font-medium text-foreground">Siste synk:</span>{" "}
                        {new Date(existingConfig.lastSyncAt).toLocaleString("nb-NO")}
                      </p>
                    )}
                    <p>
                      <span className="font-medium text-foreground">Sett 1:</span>{" "}
                      {existingConfig.set1TripletexAccountIds?.length ?? 0} kontoer
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Sett 2:</span>{" "}
                      {existingConfig.set2TripletexAccountIds?.length ?? 0} kontoer
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
