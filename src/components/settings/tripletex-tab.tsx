"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle2, Loader2, RefreshCw, Unplug } from "lucide-react";

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
  set1TripletexAccountId: number | null;
  set2TripletexAccountId: number | null;
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

export function TripletexTab({ isEn }: { isEn: boolean }) {
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const [txCompanies, setTxCompanies] = useState<TripletexCompany[]>([]);
  const [txAccounts, setTxAccounts] = useState<TripletexAccount[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [existingConfig, setExistingConfig] = useState<SyncConfig | null>(null);

  // Form state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedSet1AccountId, setSelectedSet1AccountId] = useState<string>("none");
  const [selectedSet2AccountId, setSelectedSet2AccountId] = useState<string>("none");
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [syncInterval, setSyncInterval] = useState(60);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const checkConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/tripletex/whoami");
      setConnectionOk(res.ok);
    } catch {
      setConnectionOk(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch("/api/tripletex/companies");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTxCompanies(data.companies ?? []);
    } catch {
      toast.error(isEn ? "Failed to load companies" : "Kunne ikke hente selskaper fra Tripletex");
    } finally {
      setLoadingCompanies(false);
    }
  }, [isEn]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/tripletex/accounts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTxAccounts(data.accounts ?? []);
    } catch {
      toast.error(isEn ? "Failed to load accounts" : "Kunne ikke hente kontoplan fra Tripletex");
    } finally {
      setLoadingAccounts(false);
    }
  }, [isEn]);

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
        setSelectedSet1AccountId(c.set1TripletexAccountId?.toString() ?? "none");
        setSelectedSet2AccountId(c.set2TripletexAccountId?.toString() ?? "none");
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

  const handleSave = async () => {
    if (!selectedClientId || !selectedCompanyId || !dateFrom) {
      toast.error(isEn ? "Fill in all required fields" : "Fyll inn alle obligatoriske felt");
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
          set1TripletexAccountId: selectedSet1AccountId !== "none" ? Number(selectedSet1AccountId) : undefined,
          set2TripletexAccountId: selectedSet2AccountId !== "none" ? Number(selectedSet2AccountId) : undefined,
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
        isEn
          ? `Sync complete: ${r.postings.inserted} postings, ${r.bankTransactions.inserted} bank transactions`
          : `Synkronisering fullfort: ${r.postings.inserted} posteringer, ${r.bankTransactions.inserted} banktransaksjoner`
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
      if (!res.ok) throw new Error();
      const data = await res.json();
      const r = data.result;
      toast.success(
        isEn
          ? `Synced: ${r.postings.inserted} postings, ${r.bankTransactions.inserted} bank transactions`
          : `Synkronisert: ${r.postings.inserted} posteringer, ${r.bankTransactions.inserted} banktransaksjoner`
      );
      loadExistingConfig(selectedClientId);
    } catch {
      toast.error(isEn ? "Sync failed" : "Synkronisering feilet");
    } finally {
      setSyncing(false);
    }
  };

  const ledgerAccounts = txAccounts.filter((a) => !a.isBankAccount);
  const bankAccounts = txAccounts.filter((a) => a.isBankAccount);

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <Card>
        <CardHeader>
          <CardTitle>{isEn ? "Connection" : "Tilkobling"}</CardTitle>
          <CardDescription>
            {isEn
              ? "Status of the Tripletex API connection."
              : "Status for Tripletex API-tilkoblingen."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : connectionOk ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Unplug className="h-4 w-4 text-destructive" />
          )}
          <span className="text-sm">
            {checking
              ? (isEn ? "Checking..." : "Sjekker...")
              : connectionOk
                ? (isEn ? "Connected to Tripletex" : "Koblet til Tripletex")
                : (isEn ? "Not connected — check env vars" : "Ikke tilkoblet — sjekk miljøvariabler")}
          </span>
          <Button variant="ghost" size="sm" onClick={checkConnection} disabled={checking}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      {!connectionOk && !checking && (
        <p className="text-sm text-muted-foreground">
          {isEn
            ? "Set TRIPLETEX_API_BASE_URL, TRIPLETEX_CONSUMER_TOKEN, and TRIPLETEX_EMPLOYEE_TOKEN in .env.local to connect."
            : "Sett TRIPLETEX_API_BASE_URL, TRIPLETEX_CONSUMER_TOKEN og TRIPLETEX_EMPLOYEE_TOKEN i .env.local for å koble til."}
        </p>
      )}

      {connectionOk && (
        <>
          {/* Client selector */}
          <Card>
            <CardHeader>
              <CardTitle>{isEn ? "Sync configuration" : "Synkronisering"}</CardTitle>
              <CardDescription>
                {isEn
                  ? "Connect a client to a Tripletex company and set up automatic sync."
                  : "Koble en klient til et Tripletex-selskap og sett opp automatisk synkronisering."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Client */}
              <div className="space-y-2">
                <Label>{isEn ? "Client" : "Klient"}</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder={isEn ? "Select a client" : "Velg klient"} />
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
                    <Label>{isEn ? "Tripletex company" : "Tripletex-selskap"}</Label>
                    <Select
                      value={selectedCompanyId}
                      onValueChange={setSelectedCompanyId}
                      disabled={loadingCompanies}
                    >
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue
                          placeholder={
                            loadingCompanies
                              ? (isEn ? "Loading..." : "Laster...")
                              : (isEn ? "Select company" : "Velg selskap")
                          }
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

                  {/* Set 1 account (hovedbok) */}
                  <div className="space-y-2">
                    <Label>
                      {isEn ? "Ledger account (Set 1)" : "Hovedbok-konto (Sett 1)"}
                    </Label>
                    <Select
                      value={selectedSet1AccountId}
                      onValueChange={setSelectedSet1AccountId}
                      disabled={loadingAccounts}
                    >
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue
                          placeholder={
                            loadingAccounts
                              ? (isEn ? "Loading..." : "Laster...")
                              : (isEn ? "Select ledger account" : "Velg hovedbok-konto")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {isEn ? "— None —" : "— Ingen —"}
                        </SelectItem>
                        {ledgerAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {a.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Set 2 account (bank) */}
                  <div className="space-y-2">
                    <Label>
                      {isEn ? "Bank account (Set 2)" : "Bankkonto (Sett 2)"}
                    </Label>
                    <Select
                      value={selectedSet2AccountId}
                      onValueChange={setSelectedSet2AccountId}
                      disabled={loadingAccounts}
                    >
                      <SelectTrigger className="w-full max-w-sm">
                        <SelectValue
                          placeholder={
                            loadingAccounts
                              ? (isEn ? "Loading..." : "Laster...")
                              : (isEn ? "Select bank account" : "Velg bankkonto")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {isEn ? "— None —" : "— Ingen —"}
                        </SelectItem>
                        {bankAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id.toString()}>
                            {a.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date from */}
                  <div className="space-y-2">
                    <Label>{isEn ? "Sync from date" : "Synkroniser fra dato"}</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full max-w-sm"
                    />
                  </div>

                  {/* Sync interval */}
                  <div className="space-y-2">
                    <Label>
                      {isEn ? "Sync interval (minutes)" : "Synkroniseringsintervall (minutter)"}
                    </Label>
                    <Input
                      type="number"
                      min={15}
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      className="w-full max-w-sm"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button onClick={handleSave} disabled={saving || !selectedCompanyId}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {existingConfig
                        ? (isEn ? "Update & sync" : "Oppdater og synkroniser")
                        : (isEn ? "Connect & sync" : "Koble til og synkroniser")}
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
                        {isEn ? "Sync now" : "Synkroniser nå"}
                      </Button>
                    )}
                  </div>

                  {/* Existing config info */}
                  {existingConfig && (
                    <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium text-foreground">
                          {isEn ? "Status:" : "Status:"}
                        </span>{" "}
                        {existingConfig.isActive
                          ? (isEn ? "Active" : "Aktiv")
                          : (isEn ? "Paused" : "Pauset")}
                      </p>
                      {existingConfig.lastSyncAt && (
                        <p>
                          <span className="font-medium text-foreground">
                            {isEn ? "Last sync:" : "Siste synk:"}
                          </span>{" "}
                          {new Date(existingConfig.lastSyncAt).toLocaleString("nb-NO")}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
