"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  ClipboardCopy,
  Download,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  parseOnboardingExcel,
  type OnboardingRow,
  type ParseResult,
} from "@/lib/onboarding/excel-parser";
import {
  byggTsv,
  byggCsv,
  lastNedFil,
  kopierTilUtklipp,
  formaterBelop,
} from "@/lib/onboarding/batch-converter";

// ───────────────────────────────────────────────
// Shared constants
// ───────────────────────────────────────────────

export interface CreateClientDialogRef {
  open: () => void;
}

type DialogMode = "choose" | "manual" | "excel";

const ACCOUNT_TYPE_OPTIONS = [
  { value: "ledger", label: "Hovedbok" },
  { value: "bank", label: "Bank" },
  { value: "accounts_receivable", label: "Kundefordringer" },
  { value: "accounts_payable", label: "Leverandørgjeld" },
  { value: "payroll", label: "Lønn" },
  { value: "tax", label: "Skatt/avgift" },
  { value: "fixed_assets", label: "Anleggsmidler" },
  { value: "intercompany", label: "Mellomværende" },
  { value: "external", label: "Eksternt system" },
  { value: "custom", label: "Annet" },
] as const;

type AccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number]["value"];

const CURRENCIES = [
  "NOK", "USD", "EUR", "GBP", "SEK", "DKK", "CHF", "CAD", "AUD", "JPY", "PLN", "ISK",
] as const;

// ───────────────────────────────────────────────
// Manual mode types
// ───────────────────────────────────────────────

interface ReconciliationItem {
  name: string;
  set1AccountNumber: string;
  set1Name: string;
  set1Type: AccountType;
  set1Currency: string;
  set2AccountNumber: string;
  set2Name: string;
  set2Type: AccountType;
  set2Currency: string;
  openingBalanceDate: string;
  openingBalanceSet1: string;
  openingBalanceSet2: string;
  openingBalanceCurrencySet1: string;
  openingBalanceCurrencySet2: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

const DEFAULT_ITEM: ReconciliationItem = {
  name: "",
  set1AccountNumber: "",
  set1Name: "Hovedbok",
  set1Type: "ledger",
  set1Currency: "NOK",
  set2AccountNumber: "",
  set2Name: "Bank",
  set2Type: "bank",
  set2Currency: "NOK",
  openingBalanceDate: "",
  openingBalanceSet1: "",
  openingBalanceSet2: "",
  openingBalanceCurrencySet1: "",
  openingBalanceCurrencySet2: "",
};

// ───────────────────────────────────────────────
// Excel mode types
// ───────────────────────────────────────────────

type ExcelStep = "upload" | "review" | "confirm";
const EXCEL_STEPS: ExcelStep[] = ["upload", "review", "confirm"];

type SortField = "selskapsnavn" | "konsernnavn" | "banknavn" | null;
type SortDir = "asc" | "desc";

function formatAmount(val: number | null): string {
  if (val == null) return "–";
  return val.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ───────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────

export const CreateClientDialog = forwardRef<CreateClientDialogRef>(
  function CreateClientDialog(_, ref) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<DialogMode>("choose");
    const router = useRouter();

    useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

    // ── Manual state ──
    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [items, setItems] = useState<ReconciliationItem[]>([{ ...DEFAULT_ITEM }]);
    const [manualSubmitting, setManualSubmitting] = useState(false);
    const [manualError, setManualError] = useState<string | null>(null);

    // ── Excel state ──
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [excelStep, setExcelStep] = useState<ExcelStep>("upload");
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [ibDate, setIbDate] = useState("");
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [dragOver, setDragOver] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [excelSubmitting, setExcelSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [createdCount, setCreatedCount] = useState(0);
    const [sortField, setSortField] = useState<SortField>(null);
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [showIBAN, setShowIBAN] = useState(true);

    const resetState = useCallback(() => {
      setMode("choose");
      setItems([{ ...DEFAULT_ITEM }]);
      setManualSubmitting(false);
      setManualError(null);
      setSelectedCompanyId("");
      setExcelStep("upload");
      setParseResult(null);
      setIbDate("");
      setSelected(new Set());
      setDragOver(false);
      setParseError(null);
      setExcelSubmitting(false);
      setSubmitError(null);
      setCreatedCount(0);
      setSortField(null);
      setSortDir("asc");
      setShowIBAN(true);
    }, []);

    const handleOpenChange = useCallback(
      (v: boolean) => {
        setOpen(v);
        if (!v) resetState();
      },
      [resetState]
    );

    // Fetch companies when opening (for manual mode)
    useEffect(() => {
      if (!open) return;
      fetch("/api/companies")
        .then((r) => r.json())
        .then((data: CompanyOption[]) => {
          const list = Array.isArray(data) ? data.filter((c) => c.id && c.name) : [];
          setCompanies(list);
          if (list.length === 1) setSelectedCompanyId(list[0].id);
        })
        .catch(() => setCompanies([]));
    }, [open]);

    // ────────────────────────────────────────────
    // Manual mode handlers
    // ────────────────────────────────────────────

    function updateItem(idx: number, field: keyof ReconciliationItem, value: string) {
      setItems((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: value };
        return next;
      });
    }

    const canSubmitManual =
      selectedCompanyId &&
      items.every(
        (r) =>
          r.name.trim().length > 0 &&
          r.set1AccountNumber.trim().length > 0 &&
          r.set2AccountNumber.trim().length > 0
      );

    const handleManualSubmit = useCallback(async () => {
      if (!selectedCompanyId) return;
      setManualSubmitting(true);
      setManualError(null);

      try {
        let firstClientId: string | null = null;
        for (const rec of items) {
          const res = await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              companyId: selectedCompanyId,
              name: rec.name.trim(),
              set1: {
                accountNumber: rec.set1AccountNumber.trim(),
                name: rec.set1Name.trim(),
                type: rec.set1Type,
                currency: rec.set1Currency,
              },
              set2: {
                accountNumber: rec.set2AccountNumber.trim(),
                name: rec.set2Name.trim(),
                type: rec.set2Type,
                currency: rec.set2Currency,
              },
              openingBalanceDate: rec.openingBalanceDate || undefined,
              openingBalanceSet1: rec.openingBalanceSet1 || undefined,
              openingBalanceSet2: rec.openingBalanceSet2 || undefined,
              openingBalanceCurrencySet1:
                rec.set1Currency !== "NOK" && rec.openingBalanceCurrencySet1
                  ? rec.openingBalanceCurrencySet1
                  : undefined,
              openingBalanceCurrencySet2:
                rec.set2Currency !== "NOK" && rec.openingBalanceCurrencySet2
                  ? rec.openingBalanceCurrencySet2
                  : undefined,
            }),
            credentials: "include",
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(
              (body as { error?: string }).error || "Kunne ikke opprette klient"
            );
          }
          if (!firstClientId) firstClientId = (body as { id: string }).id;
        }

        setOpen(false);
        if (firstClientId) {
          router.push(`/dashboard/clients/${firstClientId}/matching`);
        } else {
          router.refresh();
        }
      } catch (e) {
        setManualError(e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.");
      } finally {
        setManualSubmitting(false);
      }
    }, [selectedCompanyId, items, router]);

    // ────────────────────────────────────────────
    // Excel mode handlers
    // ────────────────────────────────────────────

    const handleFile = useCallback((file: File) => {
      setParseError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseOnboardingExcel(e.target!.result as ArrayBuffer, file.name);
          setParseResult(result);
          setIbDate(result.ibDate);
          setSelected(new Set(result.rows.filter((r) => r.valid).map((r) => r.index)));
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "Kunne ikke lese filen.");
        }
      };
      reader.readAsArrayBuffer(file);
    }, []);

    const onDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const onFileChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const rows = parseResult?.rows ?? [];
    const validRows = useMemo(() => rows.filter((r) => r.valid), [rows]);
    const invalidRows = useMemo(() => rows.filter((r) => !r.valid), [rows]);
    const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.index)), [rows, selected]);
    const selectedCompanies = useMemo(
      () => [...new Set(selectedRows.map((r) => r.selskapsnavn))],
      [selectedRows]
    );

    // Sorting
    const sortedRows = useMemo(() => {
      if (!sortField) return rows;
      const sorted = [...rows].sort((a, b) => {
        const va = (a[sortField] || "").toLowerCase();
        const vb = (b[sortField] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb, "nb") : vb.localeCompare(va, "nb");
      });
      return sorted;
    }, [rows, sortField, sortDir]);

    // Group headers for sorted view
    const groupedRows = useMemo(() => {
      if (!sortField) return sortedRows.map((r) => ({ type: "row" as const, row: r }));

      const result: ({ type: "header"; label: string; count: number } | { type: "row"; row: OnboardingRow })[] = [];
      let currentGroup = "";
      let groupCount = 0;
      let headerIdx = -1;

      for (const row of sortedRows) {
        const groupKey = (row[sortField] || "").trim() || "–";
        if (groupKey !== currentGroup) {
          currentGroup = groupKey;
          headerIdx = result.length;
          result.push({ type: "header", label: groupKey, count: 0 });
          groupCount = 0;
        }
        groupCount++;
        if (headerIdx >= 0) (result[headerIdx] as { count: number }).count = groupCount;
        result.push({ type: "row", row });
      }
      return result;
    }, [sortedRows, sortField]);

    const allValidSelected = validRows.every((r) => selected.has(r.index));
    const someValidSelected = validRows.some((r) => selected.has(r.index));

    const toggleAll = useCallback(() => {
      setSelected(allValidSelected ? new Set() : new Set(validRows.map((r) => r.index)));
    }, [allValidSelected, validRows]);

    const toggleRow = useCallback((index: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    }, []);

    const handleSort = useCallback(
      (field: SortField) => {
        if (sortField === field) {
          if (sortDir === "asc") setSortDir("desc");
          else {
            setSortField(null);
            setSortDir("asc");
          }
        } else {
          setSortField(field);
          setSortDir("asc");
        }
      },
      [sortField, sortDir]
    );

    const handleCopyTsv = useCallback(() => {
      const headers = ["Konsern", "Selskap", "Kontonr", "BBAN", "IBAN", "IB regnskap", "IB bank", "Bank", "Status"];
      const data = rows.map((r) => [
        r.konsernnavn,
        r.selskapsnavn,
        r.kontonrRegnskap,
        r.ibanResult.bbanFormatted || r.bankkontonr,
        r.ibanResult.ok ? r.ibanResult.iban : "",
        r.ibRegnskap != null ? formaterBelop(r.ibRegnskap) : "",
        r.ibBank != null ? formaterBelop(r.ibBank) : "",
        r.banknavn,
        r.valid ? "OK" : r.errors[0] || "Feil",
      ]);
      kopierTilUtklipp(byggTsv(headers, data)).then((ok) => {
        if (ok) toast.success("Tabell kopiert til utklippstavle");
      });
    }, [rows]);

    const handleDownloadCsv = useCallback(() => {
      const headers = ["Konsern", "Selskap", "Kontonr", "BBAN", "IBAN", "IB regnskap", "IB bank", "Bank", "Status"];
      const data = rows.map((r) => [
        r.konsernnavn,
        r.selskapsnavn,
        r.kontonrRegnskap,
        r.ibanResult.bbanFormatted || r.bankkontonr,
        r.ibanResult.ok ? r.ibanResult.iban : "",
        r.ibRegnskap != null ? formaterBelop(r.ibRegnskap) : "",
        r.ibBank != null ? formaterBelop(r.ibBank) : "",
        r.banknavn,
        r.valid ? "OK" : r.errors[0] || "Feil",
      ]);
      lastNedFil(byggCsv(headers, data), "kontooppsett-preview.csv");
    }, [rows]);

    const handleExcelSubmit = useCallback(async () => {
      if (selectedRows.length === 0) return;
      setExcelSubmitting(true);
      setSubmitError(null);

      try {
        const apiItems = selectedRows.map((r) => ({
          companyName: r.selskapsnavn,
          clientName: `${r.kontonrRegnskap} – ${r.selskapsnavn}`,
          set1: { accountNumber: r.kontonrRegnskap, name: "Hovedbok", type: "ledger", currency: "NOK" },
          set2: {
            accountNumber: r.ibanResult.iban || r.bankkontonr,
            name: r.banknavn || "Bank",
            type: "bank",
            currency: "NOK",
          },
          openingBalanceSet1: r.ibRegnskap != null ? String(r.ibRegnskap) : undefined,
          openingBalanceSet2: r.ibBank != null ? String(r.ibBank) : undefined,
          openingBalanceDate: ibDate || undefined,
        }));

        const res = await fetch("/api/clients/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: apiItems }),
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? "Kunne ikke opprette klienter.");
        setCreatedCount((body as { count: number }).count);
        setExcelStep("confirm");
        router.refresh();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Noe gikk galt. Prøv igjen.");
      } finally {
        setExcelSubmitting(false);
      }
    }, [selectedRows, ibDate]);

    // ────────────────────────────────────────────
    // Step indicator
    // ────────────────────────────────────────────

    function renderStepIndicator() {
      if (mode === "choose") return null;

      const steps = mode === "manual"
        ? [{ key: "method", label: "Metode" }, { key: "details", label: "Detaljer" }]
        : [
            { key: "method", label: "Metode" },
            { key: "upload", label: "Last opp" },
            { key: "review", label: "Gjennomgå" },
            { key: "confirm", label: "Bekreft" },
          ];

      const currentIdx = mode === "manual"
        ? 1
        : EXCEL_STEPS.indexOf(excelStep) + 1;

      return (
        <div className="flex items-center gap-1 shrink-0 flex-wrap">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  i < currentIdx && "bg-violet-500 text-white",
                  i === currentIdx && "bg-primary text-primary-foreground",
                  i > currentIdx && "bg-muted text-muted-foreground"
                )}
              >
                {i < currentIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  i === currentIdx && "font-medium",
                  i > currentIdx && "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground mx-0.5" />
              )}
            </div>
          ))}
        </div>
      );
    }

    // ────────────────────────────────────────────
    // Mode chooser
    // ────────────────────────────────────────────

    function renderModeChooser() {
      return (
        <div className="grid grid-cols-2 gap-4 py-4">
          <button
            type="button"
            className="rounded-lg border-2 border-transparent bg-muted/40 p-6 text-left transition-all hover:border-primary hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMode("manual")}
          >
            <Plus className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-semibold text-sm">Opprett manuelt</p>
            <p className="text-xs text-muted-foreground mt-1">
              Opprett en eller flere klienter med tilpassede kontoer og innstillinger.
            </p>
          </button>
          <button
            type="button"
            className="rounded-lg border-2 border-transparent bg-muted/40 p-6 text-left transition-all hover:border-primary hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMode("excel")}
          >
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="font-semibold text-sm">Importer fra Excel</p>
            <p className="text-xs text-muted-foreground mt-1">
              Last opp kontooppsett-fil for å opprette mange klienter samtidig.
            </p>
          </button>
        </div>
      );
    }

    // ────────────────────────────────────────────
    // Manual mode content
    // ────────────────────────────────────────────

    function renderManualContent() {
      return (
        <div className="space-y-6 pt-2">
          {companies.length > 1 && (
            <div className="space-y-1.5">
              <Label>Selskap</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg selskap" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {companies.length === 1 && (
            <p className="text-sm text-muted-foreground">
              Klienten opprettes under <span className="font-medium text-foreground">{companies[0].name}</span>.
            </p>
          )}

          {items.map((rec, idx) => {
            const set1IsForeign = rec.set1Currency !== "NOK";
            const set2IsForeign = rec.set2Currency !== "NOK";

            return (
              <div key={idx} className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Klient {items.length > 1 ? idx + 1 : ""}
                    </span>
                  </div>
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon-xs" onClick={() => {
                      if (items.length <= 1) return;
                      setItems((prev) => prev.filter((_, i) => i !== idx));
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Navn på klient / avstemming</Label>
                  <Input
                    placeholder="F.eks. 1920 - Bankavstemming"
                    value={rec.name}
                    onChange={(e) => updateItem(idx, "name", e.target.value)}
                    autoFocus={idx === 0}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Mengde 1 */}
                  <div className="space-y-3 rounded-md border border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">Mengde 1</span>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonummer</Label>
                      <Input placeholder="1920" value={rec.set1AccountNumber}
                        onChange={(e) => updateItem(idx, "set1AccountNumber", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonavn</Label>
                      <Input placeholder="Hovedbok" value={rec.set1Name}
                        onChange={(e) => updateItem(idx, "set1Name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={rec.set1Type} onValueChange={(v) => updateItem(idx, "set1Type", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valuta</Label>
                      <Select value={rec.set1Currency} onValueChange={(v) => updateItem(idx, "set1Currency", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Mengde 2 */}
                  <div className="space-y-3 rounded-md border border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Mengde 2</span>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonummer</Label>
                      <Input placeholder="1920" value={rec.set2AccountNumber}
                        onChange={(e) => updateItem(idx, "set2AccountNumber", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Kontonavn</Label>
                      <Input placeholder="Bank" value={rec.set2Name}
                        onChange={(e) => updateItem(idx, "set2Name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={rec.set2Type} onValueChange={(v) => updateItem(idx, "set2Type", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valuta</Label>
                      <Select value={rec.set2Currency} onValueChange={(v) => updateItem(idx, "set2Currency", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Opening balance */}
                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <span className="text-xs font-semibold text-muted-foreground">Oppstartssaldo (valgfritt)</span>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dato for oppstartssaldo</Label>
                    <Input type="date" value={rec.openingBalanceDate}
                      onChange={(e) => updateItem(idx, "openingBalanceDate", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Saldo mengde 1 <span className="text-muted-foreground">(NOK)</span></Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={rec.openingBalanceSet1}
                        onChange={(e) => updateItem(idx, "openingBalanceSet1", e.target.value)}
                        className="h-8 text-xs font-mono tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Saldo mengde 2 <span className="text-muted-foreground">(NOK)</span></Label>
                      <Input type="number" step="0.01" placeholder="0,00" value={rec.openingBalanceSet2}
                        onChange={(e) => updateItem(idx, "openingBalanceSet2", e.target.value)}
                        className="h-8 text-xs font-mono tabular-nums" />
                    </div>
                  </div>
                  {(set1IsForeign || set2IsForeign) && (
                    <div className="grid grid-cols-2 gap-4">
                      {set1IsForeign ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Valutasaldo mengde 1 <span className="text-muted-foreground">({rec.set1Currency})</span></Label>
                          <Input type="number" step="0.01" placeholder="0,00" value={rec.openingBalanceCurrencySet1}
                            onChange={(e) => updateItem(idx, "openingBalanceCurrencySet1", e.target.value)}
                            className="h-8 text-xs font-mono tabular-nums" />
                        </div>
                      ) : <div />}
                      {set2IsForeign ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Valutasaldo mengde 2 <span className="text-muted-foreground">({rec.set2Currency})</span></Label>
                          <Input type="number" step="0.01" placeholder="0,00" value={rec.openingBalanceCurrencySet2}
                            onChange={(e) => updateItem(idx, "openingBalanceCurrencySet2", e.target.value)}
                            className="h-8 text-xs font-mono tabular-nums" />
                        </div>
                      ) : <div />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, { ...DEFAULT_ITEM }])} className="w-full">
            <Plus className="h-4 w-4" /> Legg til klient
          </Button>

          {manualError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <div className="flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{manualError}</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ────────────────────────────────────────────
    // Excel mode content
    // ────────────────────────────────────────────

    function renderSortableHeader(label: string, field: SortField) {
      const isActive = sortField === field;
      return (
        <th
          className="p-2 text-xs font-medium text-muted-foreground text-left cursor-pointer select-none hover:text-foreground transition-colors"
          onClick={() => handleSort(field)}
        >
          <span className="inline-flex items-center gap-1">
            {label}
            <ArrowUpDown className={cn("h-3 w-3", isActive ? "text-foreground" : "opacity-40")} />
            {isActive && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
          </span>
        </th>
      );
    }

    function renderExcelUpload() {
      return (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Dra og slipp kontooppsett-fil hit</p>
            <p className="text-xs text-muted-foreground mt-1">.xlsx-fil (Account_Control_Onboarding_-_Kontooppsett)</p>
          </div>

          {parseError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{parseError}</p>
            </div>
          )}

          {parseResult && (
            <div className="rounded-md border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-3 flex items-center gap-2">
              <CircleCheck className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <p className="text-sm text-violet-800 dark:text-violet-200">
                <span className="font-semibold">{rows.length}</span> rader funnet i{" "}
                <span className="font-medium">{parseResult.fileName}</span>
                {invalidRows.length > 0 && (
                  <span className="text-destructive ml-1">({invalidRows.length} med feil)</span>
                )}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">Oppstartsdato (IB)</Label>
            <Input type="date" value={ibDate} onChange={(e) => setIbDate(e.target.value)} className="h-9 max-w-xs" />
            {ibDate && (
              <p className="text-xs text-muted-foreground">Denne datoen settes som oppstartsdato for alle klienter.</p>
            )}
          </div>
        </div>
      );
    }

    function renderExcelReview() {
      return (
        <div className="flex flex-col gap-3 min-h-0 flex-1">
          {/* Toolbar: BBAN/IBAN toggle + export */}
          <div className="flex items-center justify-between">
            <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  !showIBAN ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setShowIBAN(false)}
              >
                BBAN
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                  showIBAN ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setShowIBAN(true)}
              >
                IBAN
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopyTsv}>
                <ClipboardCopy className="h-3 w-3" /> Kopier
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleDownloadCsv}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          </div>

          <div className="rounded-md border overflow-hidden flex-1 min-h-0">
            <div className="overflow-auto max-h-[45vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
                  <tr>
                    <th className="p-2 w-10">
                      <Checkbox
                        checked={allValidSelected ? true : someValidSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Velg alle"
                      />
                    </th>
                    {renderSortableHeader("Konsern", "konsernnavn")}
                    {renderSortableHeader("Selskap", "selskapsnavn")}
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">Kontonr</th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                      {showIBAN ? "IBAN" : "BBAN"}
                    </th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-right">IB regn.</th>
                    <th className="p-2 text-xs font-medium text-muted-foreground text-right">IB bank</th>
                    {renderSortableHeader("Bank", "banknavn")}
                    <th className="p-2 text-xs font-medium text-muted-foreground text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((entry, i) => {
                    if (entry.type === "header") {
                      return (
                        <tr key={`group-${i}`} className="bg-muted/50">
                          <td colSpan={9} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {entry.label} <span className="font-normal">({entry.count})</span>
                          </td>
                        </tr>
                      );
                    }
                    const row = entry.row;
                    const isSelected = selected.has(row.index);
                    const isInvalid = !row.valid;
                    return (
                      <tr
                        key={row.index}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isInvalid && "bg-red-50/60 dark:bg-red-950/20",
                          !isInvalid && !isSelected && "opacity-50",
                          "hover:bg-sky-50 dark:hover:bg-sky-950/30"
                        )}
                      >
                        <td className="p-2">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleRow(row.index)} disabled={isInvalid} />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">{row.konsernnavn || "–"}</td>
                        <td className="p-2 text-xs">{row.selskapsnavn}</td>
                        <td className="p-2 text-xs font-mono">{row.kontonrRegnskap}</td>
                        <td className="p-2 text-xs font-mono">
                          {showIBAN
                            ? (row.ibanResult.ok ? row.ibanResult.iban : row.bankkontonr || "–")
                            : (row.ibanResult.bbanFormatted || row.bankkontonr || "–")}
                        </td>
                        <td className="p-2 text-xs font-mono tabular-nums text-right">{formatAmount(row.ibRegnskap)}</td>
                        <td className="p-2 text-xs font-mono tabular-nums text-right">{formatAmount(row.ibBank)}</td>
                        <td className="p-2 text-xs text-muted-foreground">{row.banknavn || "–"}</td>
                        <td className="p-2">
                          {row.valid ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">OK</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-medium text-destructive">{row.errors[0]}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 px-4 py-2.5 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{selectedRows.length}</span> av {rows.length} rader valgt —{" "}
              <span className="font-semibold text-foreground">{selectedCompanies.length}</span>{" "}
              {selectedCompanies.length === 1 ? "selskap" : "selskaper"}
            </span>
            {invalidRows.length > 0 && (
              <span className="text-destructive font-medium text-xs">{invalidRows.length} rader med feil (ekskludert)</span>
            )}
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          )}
        </div>
      );
    }

    function renderExcelConfirm() {
      if (createdCount > 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CircleCheck className="h-12 w-12 text-violet-600 dark:text-violet-400" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">{createdCount} klienter opprettet</p>
              <p className="text-sm text-muted-foreground">Klientene er klare for avstemming.</p>
            </div>
            <Button onClick={() => { setOpen(false); resetState(); router.refresh(); }}>Lukk</Button>
          </div>
        );
      }

      return (
        <div className="space-y-4">
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <span className="text-sm font-medium">Oppsummering</span>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground pl-6">
              <p><span className="font-semibold text-foreground">{selectedRows.length}</span> klienter vil bli opprettet</p>
              <p>
                Fordelt på <span className="font-semibold text-foreground">{selectedCompanies.length}</span>{" "}
                {selectedCompanies.length === 1 ? "selskap" : "selskaper"}
                {selectedCompanies.length <= 5 && <span>: {selectedCompanies.join(", ")}</span>}
              </p>
              {ibDate && (
                <p>
                  Oppstartsdato: <span className="font-semibold text-foreground">
                    {new Date(ibDate + "T00:00:00").toLocaleDateString("nb-NO")}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-800 dark:text-amber-200">
              Selskaper som ikke finnes fra før vil bli opprettet automatisk.
            </p>
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{submitError}</p>
            </div>
          )}
        </div>
      );
    }

    // ────────────────────────────────────────────
    // Footer
    // ────────────────────────────────────────────

    function renderFooter() {
      if (mode === "choose") return null;
      if (mode === "excel" && excelStep === "confirm" && createdCount > 0) return null;

      return (
        <div className="flex items-center justify-between border-t pt-3 shrink-0">
          <div>
            {mode === "manual" && (
              <Button variant="outline" size="sm" onClick={() => setMode("choose")}>Tilbake</Button>
            )}
            {mode === "excel" && excelStep === "upload" && (
              <Button variant="outline" size="sm" onClick={() => setMode("choose")}>Tilbake</Button>
            )}
            {mode === "excel" && excelStep === "review" && (
              <Button variant="outline" size="sm" onClick={() => setExcelStep("upload")}>Tilbake</Button>
            )}
            {mode === "excel" && excelStep === "confirm" && (
              <Button variant="outline" size="sm" onClick={() => setExcelStep("review")}>Tilbake</Button>
            )}
          </div>
          <div>
            {mode === "manual" && (
              <Button onClick={handleManualSubmit} disabled={!canSubmitManual || manualSubmitting}>
                {manualSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Oppretter...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Opprett {items.length > 1 ? `${items.length} klienter` : "klient"}</>
                )}
              </Button>
            )}
            {mode === "excel" && excelStep === "upload" && (
              <Button size="sm" disabled={!parseResult} onClick={() => setExcelStep("review")}>
                Neste <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {mode === "excel" && excelStep === "review" && (
              <Button size="sm" disabled={selectedRows.length === 0} onClick={() => setExcelStep("confirm")}>
                Neste <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
            {mode === "excel" && excelStep === "confirm" && (
              <Button size="sm" disabled={excelSubmitting || selectedRows.length === 0} onClick={handleExcelSubmit}>
                {excelSubmitting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Oppretter...</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Bekreft og opprett</>
                )}
              </Button>
            )}
          </div>
        </div>
      );
    }

    // ────────────────────────────────────────────
    // Dialog title/description
    // ────────────────────────────────────────────

    const dialogTitle = mode === "choose"
      ? "Ny klient"
      : mode === "manual"
        ? "Opprett klient"
        : "Importer klienter fra Excel";

    const dialogDesc = mode === "choose"
      ? "Velg hvordan du vil opprette nye klienter."
      : mode === "manual"
        ? "Sett opp en ny avstemming med to kontoer som skal avstemmes mot hverandre."
        : "Last opp kontooppsett-filen for å opprette flere klienter samtidig.";

    const dialogMaxWidth = mode === "excel" && excelStep !== "upload"
      ? "sm:max-w-5xl"
      : mode === "manual"
        ? "sm:max-w-2xl"
        : "sm:max-w-xl";

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className={cn(dialogMaxWidth, "max-h-[85vh] flex flex-col")}>
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>{dialogDesc}</DialogDescription>
              </div>
              {renderStepIndicator()}
            </div>
          </DialogHeader>

          <div className={cn(
            "flex-1 min-h-0 flex flex-col gap-3 pt-2",
            mode === "manual" && "overflow-y-auto"
          )}>
            {mode === "choose" && renderModeChooser()}
            {mode === "manual" && renderManualContent()}
            {mode === "excel" && excelStep === "upload" && renderExcelUpload()}
            {mode === "excel" && excelStep === "review" && renderExcelReview()}
            {mode === "excel" && excelStep === "confirm" && renderExcelConfirm()}
          </div>

          {renderFooter()}
        </DialogContent>
      </Dialog>
    );
  }
);
