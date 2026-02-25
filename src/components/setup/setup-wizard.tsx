"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Network,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GroupData {
  name: string;
  orgNumber: string;
}

interface CompanyData {
  name: string;
  orgNumber: string;
}

interface ReconciliationData {
  name: string;
  set1AccountNumber: string;
  set1Name: string;
  set1Type: "ledger" | "bank";
  set2AccountNumber: string;
  set2Name: string;
  set2Type: "ledger" | "bank";
}

export interface SetupResult {
  group?: { id: string; name: string };
  companies: { id: string; name: string }[];
  reconciliations: { id: string; name: string; companyId: string }[];
}

interface SetupWizardProps {
  onComplete: (result: SetupResult) => void;
  onCancel?: () => void;
  mode?: "fullscreen" | "dialog";
  hideProgress?: boolean;
}

const STEPS = [
  { id: "group", label: "Konsern" },
  { id: "company", label: "Selskap" },
  { id: "reconciliation", label: "Avstemming" },
  { id: "summary", label: "Oppsummering" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupWizard({ onComplete, onCancel, mode = "fullscreen", hideProgress }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasGroup, setHasGroup] = useState<boolean | null>(null);
  const [groupData, setGroupData] = useState<GroupData>({ name: "", orgNumber: "" });
  const [companiesList, setCompaniesList] = useState<CompanyData[]>([
    { name: "", orgNumber: "" },
  ]);
  const [reconciliationsList, setReconciliationsList] = useState<ReconciliationData[]>([
    {
      name: "",
      set1AccountNumber: "",
      set1Name: "Hovedbok",
      set1Type: "ledger",
      set2AccountNumber: "",
      set2Name: "Bank",
      set2Type: "bank",
    },
  ]);

  function goTo(nextStep: number) {
    setDirection(nextStep > step ? "forward" : "back");
    setError(null);
    setStep(nextStep);
  }

  function canAdvance(): boolean {
    if (step === 0) return hasGroup !== null && (hasGroup === false || groupData.name.trim().length > 0);
    if (step === 1) return companiesList.every((c) => c.name.trim().length > 0);
    if (step === 2) {
      return reconciliationsList.every(
        (r) =>
          r.name.trim().length > 0 &&
          r.set1AccountNumber.trim().length > 0 &&
          r.set2AccountNumber.trim().length > 0
      );
    }
    return true;
  }

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const result: SetupResult = { companies: [], reconciliations: [] };

      let parentCompanyId: string | undefined;
      if (hasGroup && groupData.name.trim()) {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupData.name.trim(),
            orgNumber: groupData.orgNumber.trim() || undefined,
            type: "group",
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Kunne ikke opprette konsern");
        const group = await res.json();
        result.group = { id: group.id, name: group.name };
        parentCompanyId = group.id;
      }

      for (const companyData of companiesList) {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: companyData.name.trim(),
            orgNumber: companyData.orgNumber.trim() || undefined,
            type: "company",
            parentCompanyId,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Kunne ikke opprette selskap");
        const company = await res.json();
        result.companies.push({ id: company.id, name: company.name });
      }

      const firstCompanyId = result.companies[0]?.id;
      if (!firstCompanyId) throw new Error("Ingen selskap opprettet");

      for (const rec of reconciliationsList) {
        const res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: firstCompanyId,
            name: rec.name.trim(),
            set1: {
              accountNumber: rec.set1AccountNumber.trim(),
              name: rec.set1Name.trim(),
              type: rec.set1Type,
            },
            set2: {
              accountNumber: rec.set2AccountNumber.trim(),
              name: rec.set2Name.trim(),
              type: rec.set2Type,
            },
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Kunne ikke opprette avstemming");
        const client = await res.json();
        result.reconciliations.push({ id: client.id, name: client.name, companyId: firstCompanyId });
      }

      onComplete(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt");
    } finally {
      setSubmitting(false);
    }
  }, [hasGroup, groupData, companiesList, reconciliationsList, onComplete]);

  const isDialog = mode === "dialog";

  return (
    <div className={cn("w-full", isDialog ? "max-w-full" : "max-w-xl mx-auto")}>
      {/* Step indicator */}
      {!hideProgress && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => i < step && goTo(i)}
              disabled={i >= step}
              className={cn(
                "rounded-full transition-all duration-300",
                i === step
                  ? "h-2 w-8 bg-foreground"
                  : i < step
                    ? "h-2 w-2 bg-foreground/30 cursor-pointer hover:bg-foreground/50"
                    : "h-2 w-2 bg-border"
              )}
            />
          ))}
        </div>
      )}

      {/* Step labels */}
      {!hideProgress && (
        <div className="flex items-center justify-center gap-1 mb-6 text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <span key={s.id} className={cn(i === step ? "text-foreground font-medium" : "", i > 0 && "ml-2")}>
              {i > 0 && <span className="mr-2 text-border">/</span>}
              {s.label}
            </span>
          ))}
        </div>
      )}

      {/* Step content */}
      <div
        key={step}
        className={cn(
          "animate-in fade-in duration-300",
          direction === "forward" ? "slide-in-from-right-4" : "slide-in-from-left-4"
        )}
      >
        {step === 0 && (
          <StepGroup
            hasGroup={hasGroup}
            setHasGroup={setHasGroup}
            data={groupData}
            setData={setGroupData}
          />
        )}
        {step === 1 && (
          <StepCompany
            companies={companiesList}
            setCompanies={setCompaniesList}
            hasGroup={!!hasGroup}
            groupName={groupData.name}
          />
        )}
        {step === 2 && (
          <StepReconciliation
            items={reconciliationsList}
            setItems={setReconciliationsList}
          />
        )}
        {step === 3 && (
          <StepSummary
            hasGroup={!!hasGroup}
            groupData={groupData}
            companies={companiesList}
            reconciliations={reconciliationsList}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t">
        <div>
          {step > 0 ? (
            <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={submitting}>
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Button>
          ) : onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Avbryt
            </Button>
          ) : (
            <div />
          )}
        </div>
        <div>
          {step < 3 ? (
            <Button onClick={() => goTo(step + 1)} disabled={!canAdvance()}>
              Neste
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Oppretter...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Opprett alt
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Group (Konsern)
// ---------------------------------------------------------------------------

function StepGroup({
  hasGroup,
  setHasGroup,
  data,
  setData,
}: {
  hasGroup: boolean | null;
  setHasGroup: (v: boolean) => void;
  data: GroupData;
  setData: (d: GroupData) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Network className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Konsernstruktur</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Tilhører selskapene dine et konsern? Et konsern grupperer flere selskap under én enhet.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setHasGroup(true)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-all hover:border-foreground/30",
            hasGroup === true
              ? "border-foreground bg-foreground/[0.03]"
              : "border-border"
          )}
        >
          <Network className="h-5 w-5" />
          <span className="font-medium">Ja, vi har et konsern</span>
        </button>
        <button
          type="button"
          onClick={() => setHasGroup(false)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-all hover:border-foreground/30",
            hasGroup === false
              ? "border-foreground bg-foreground/[0.03]"
              : "border-border"
          )}
        >
          <Building2 className="h-5 w-5" />
          <span className="font-medium">Nei, enkeltstående selskap</span>
        </button>
      </div>

      {hasGroup && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Konsernets navn</Label>
            <Input
              id="group-name"
              placeholder="F.eks. Holm Gruppen AS"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-org">Organisasjonsnummer (valgfritt)</Label>
            <Input
              id="group-org"
              placeholder="123 456 789"
              value={data.orgNumber}
              onChange={(e) => setData({ ...data, orgNumber: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Company (Selskap)
// ---------------------------------------------------------------------------

function StepCompany({
  companies,
  setCompanies,
  hasGroup,
  groupName,
}: {
  companies: CompanyData[];
  setCompanies: (c: CompanyData[]) => void;
  hasGroup: boolean;
  groupName: string;
}) {
  function update(idx: number, field: keyof CompanyData, value: string) {
    const next = [...companies];
    next[idx] = { ...next[idx], [field]: value };
    setCompanies(next);
  }

  function add() {
    setCompanies([...companies, { name: "", orgNumber: "" }]);
  }

  function remove(idx: number) {
    if (companies.length <= 1) return;
    setCompanies(companies.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {hasGroup ? "Selskap i konsernet" : "Legg til selskap"}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {hasGroup
            ? `Legg til selskapene som tilhører ${groupName || "konsernet"}.`
            : "Opprett selskapet du vil jobbe med. Du kan legge til flere senere."}
        </p>
      </div>

      <div className="space-y-3">
        {companies.map((c, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Selskap {companies.length > 1 ? idx + 1 : ""}
              </span>
              {companies.length > 1 && (
                <Button variant="ghost" size="icon-xs" onClick={() => remove(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Selskapsnavn</Label>
              <Input
                placeholder="F.eks. Holm Regnskap AS"
                value={c.name}
                onChange={(e) => update(idx, "name", e.target.value)}
                autoFocus={idx === 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organisasjonsnummer (valgfritt)</Label>
              <Input
                placeholder="123 456 789"
                value={c.orgNumber}
                onChange={(e) => update(idx, "orgNumber", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-4 w-4" />
        Legg til selskap
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Reconciliation (Avstemming)
// ---------------------------------------------------------------------------

function StepReconciliation({
  items,
  setItems,
}: {
  items: ReconciliationData[];
  setItems: (r: ReconciliationData[]) => void;
}) {
  function update(idx: number, field: keyof ReconciliationData, value: string) {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    setItems(next);
  }

  function add() {
    setItems([
      ...items,
      {
        name: "",
        set1AccountNumber: "",
        set1Name: "Hovedbok",
        set1Type: "ledger",
        set2AccountNumber: "",
        set2Name: "Bank",
        set2Type: "bank",
      },
    ]);
  }

  function remove(idx: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Sett opp avstemming</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          En avstemming kobler to kontoer (f.eks. hovedbok og bank) som skal avstemmes mot hverandre.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((rec, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Avstemming {items.length > 1 ? idx + 1 : ""}
              </span>
              {items.length > 1 && (
                <Button variant="ghost" size="icon-xs" onClick={() => remove(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Navn på avstemming</Label>
              <Input
                placeholder="F.eks. 1920 - Bankavstemming"
                value={rec.name}
                onChange={(e) => update(idx, "name", e.target.value)}
                autoFocus={idx === 0}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Set 1 */}
              <div className="space-y-3 rounded-md border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
                  Mengde 1{rec.set1Name && rec.set1Name !== "Hovedbok" ? ` — ${rec.set1Name}` : ""}
                </span>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kontonummer</Label>
                  <Input
                    placeholder="1920"
                    value={rec.set1AccountNumber}
                    onChange={(e) => update(idx, "set1AccountNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kontonavn</Label>
                  <Input
                    placeholder="Hovedbok"
                    value={rec.set1Name}
                    onChange={(e) => update(idx, "set1Name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={rec.set1Type}
                    onValueChange={(v) => update(idx, "set1Type", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ledger">Hovedbok</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Set 2 */}
              <div className="space-y-3 rounded-md border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Mengde 2{rec.set2Name && rec.set2Name !== "Bank" ? ` — ${rec.set2Name}` : ""}
                </span>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kontonummer</Label>
                  <Input
                    placeholder="1920"
                    value={rec.set2AccountNumber}
                    onChange={(e) => update(idx, "set2AccountNumber", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kontonavn</Label>
                  <Input
                    placeholder="Bank"
                    value={rec.set2Name}
                    onChange={(e) => update(idx, "set2Name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={rec.set2Type}
                    onValueChange={(v) => update(idx, "set2Type", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ledger">Hovedbok</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-4 w-4" />
        Legg til avstemming
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Summary
// ---------------------------------------------------------------------------

function StepSummary({
  hasGroup,
  groupData,
  companies,
  reconciliations,
}: {
  hasGroup: boolean;
  groupData: GroupData;
  companies: CompanyData[];
  reconciliations: ReconciliationData[];
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Oppsummering</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Bekreft at alt ser riktig ut, og klikk &quot;Opprett alt&quot; for å komme i gang.
        </p>
      </div>

      <div className="space-y-3">
        {hasGroup && groupData.name && (
          <div className="rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Konsern</span>
            </div>
            <p className="mt-1 text-sm">{groupData.name}</p>
            {groupData.orgNumber && (
              <p className="text-xs text-muted-foreground">Org.nr: {groupData.orgNumber}</p>
            )}
          </div>
        )}

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {companies.length === 1 ? "Selskap" : `${companies.length} selskap`}
            </span>
          </div>
          {companies.map((c, i) => (
            <div key={i} className="text-sm py-1">
              <span>{c.name}</span>
              {c.orgNumber && (
                <span className="text-muted-foreground ml-2 text-xs">({c.orgNumber})</span>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm mb-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {reconciliations.length === 1
                ? "Avstemming"
                : `${reconciliations.length} avstemminger`}
            </span>
          </div>
          {reconciliations.map((r, i) => (
            <div key={i} className="text-sm py-1.5 border-t first:border-t-0">
              <span className="font-medium">{r.name}</span>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>
                  M1: {r.set1AccountNumber} ({r.set1Name})
                </span>
                <span>
                  M2: {r.set2AccountNumber} ({r.set2Name})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
