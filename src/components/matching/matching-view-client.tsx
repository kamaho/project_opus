"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { parseFile, detectFileTypeFromFile, readExcelRows, readCsvRawRows } from "@/lib/parsers";
import type { ParsedTransaction, CsvParserConfig, ExcelParserConfig } from "@/lib/parsers";
import { MatchingToolbar } from "@/components/matching/matching-toolbar";
import { TransactionPanel, type TransactionRow } from "@/components/matching/transaction-panel";
import { SetDropzone } from "@/components/matching/set-dropzone";
import type { WizardResult } from "@/components/import/column-import-wizard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";

const ImportPreview = dynamic(
  () => import("@/components/import/import-preview").then((m) => ({ default: m.ImportPreview })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Laster forhåndsvisning…</div> }
);

const ColumnImportWizard = dynamic(
  () => import("@/components/import/column-import-wizard").then((m) => ({ default: m.ColumnImportWizard })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Laster importveiviser…</div> }
);

const FileManagerPanel = dynamic(
  () => import("@/components/matching/file-manager-panel").then((m) => ({ default: m.FileManagerPanel })),
  { ssr: false, loading: () => null }
);

function cellToString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function detectDateFormat(samples: string[]): string {
  const s = samples.find((x) => x.trim() !== "");
  if (!s) return "DD.MM.YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "YYYY-MM-DD";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return "DD/MM/YYYY";
  if (/^\d{8}$/.test(s)) return "YYYYMMDD";
  return "DD.MM.YYYY";
}

function detectDelimiterFromContent(content: string): ";" | "," | "\t" {
  const firstLine = content.split("\n")[0] ?? "";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of firstLine) {
    if (ch in counts) counts[ch]++;
  }
  if (counts["\t"] > counts[";"] && counts["\t"] > counts[","]) return "\t";
  if (counts[";"] >= counts[","]) return ";";
  return ",";
}

interface DuplicateReport {
  totalCount: number;
  duplicateCount: number;
  newCount: number;
  duplicates: Array<{ rowNumber: number; date1: string; amount: string; description?: string | null }>;
}

export interface MatchingViewClientProps {
  clientId: string;
  clientName: string;
  set1Label: string;
  set2Label: string;
  rows1: TransactionRow[];
  rows2: TransactionRow[];
  balance1: number;
  balance2: number;
}

export function MatchingViewClient({
  clientId,
  clientName,
  set1Label,
  set2Label,
  rows1,
  rows2,
  balance1,
  balance2,
}: MatchingViewClientProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingSet, setPendingSet] = useState<1 | 2>(1);
  const [parserType, setParserType] = useState<"csv" | "camt" | "klink" | "excel">("csv");
  const [csvDelimiter, setCsvDelimiter] = useState<";" | "," | "\t">(";");
  const [klinkSpec, setKlinkSpec] = useState("");
  const [preview, setPreview] = useState<{
    transactions: ParsedTransaction[];
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [wizardRawRows, setWizardRawRows] = useState<string[][] | null>(null);
  const [excelBuffer, setExcelBuffer] = useState<ArrayBuffer | null>(null);

  // File manager state
  const [fileManagerOpen, setFileManagerOpen] = useState(false);

  // Duplicate dialog state
  const [dupReport, setDupReport] = useState<DuplicateReport | null>(null);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  // Exact duplicate state (for legacy camt/klink flow)
  const [exactDuplicate, setExactDuplicate] = useState(false);
  const [selectedTxIndices, setSelectedTxIndices] = useState<Set<number>>(new Set());

  const openImportDialog = useCallback(
    async (file: File, setNumber: 1 | 2) => {
      setPendingFile(file);
      setPendingSet(setNumber);
      setPreview(null);
      setImportError(null);
      setWizardRawRows(null);
      setExcelBuffer(null);

      const detected = await detectFileTypeFromFile(file);
      setParserType(detected);

      if (detected === "excel") {
        const buffer = await file.arrayBuffer();
        setExcelBuffer(buffer);
        const rawRows = readExcelRows(buffer);
        const maxCol = Math.max(...rawRows.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
        setWizardRawRows(
          rawRows.map((r) => {
            const out: string[] = [];
            for (let c = 0; c < maxCol; c++)
              out.push(cellToString(Array.isArray(r) ? r[c] : undefined));
            return out;
          })
        );
        setFileContent(null);
        setImportOpen(true);
        return;
      }

      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Kunne ikke lese filen"));
        reader.readAsText(file, "utf-8");
      });

      if (detected === "csv") {
        setFileContent(content);
        const rawRows = readCsvRawRows(content);
        setWizardRawRows(rawRows);
        setCsvDelimiter(detectDelimiterFromContent(content));
        setImportOpen(true);
      } else if (detected === "klink") {
        setFileContent(content);
        setWizardRawRows(null);
        setKlinkSpec("");
        const out = parseFile(content, "klink", { spec: "" });
        setPreview({ transactions: out.transactions, errors: out.errors });
        setImportOpen(true);
      } else {
        setFileContent(null);
        setWizardRawRows(null);
        const out = parseFile(content, "camt");
        setPreview({ transactions: out.transactions, errors: out.errors });
        setImportOpen(true);
      }
    },
    []
  );

  useEffect(() => {
    if (parserType !== "klink" || !fileContent || !importOpen) return;
    const out = parseFile(fileContent, "klink", { spec: klinkSpec });
    setPreview({ transactions: out.transactions, errors: out.errors });
  }, [parserType, fileContent, klinkSpec, importOpen]);

  const buildFormData = useCallback(
    (result: WizardResult): FormData => {
      const colMap = Object.fromEntries(
        result.columnMappings.map((m) => [m.field, m.colIndex])
      ) as Record<string, number>;

      const formData = new FormData();
      formData.set("file", pendingFile!);
      formData.set("clientId", clientId);
      formData.set("setNumber", String(pendingSet));
      formData.set("parserType", parserType);

      const dataRows = wizardRawRows
        ? wizardRawRows.slice(result.headerRowIndex + 1)
        : [];

      const dateFormats: Record<string, string> = {};
      for (const m of result.columnMappings) {
        if (["date1", "date2"].includes(m.field)) {
          const samples = dataRows
            .slice(0, 10)
            .map((r) => String(r[m.colIndex] ?? ""))
            .filter(Boolean);
          dateFormats[m.field] = detectDateFormat(samples);
        }
      }

      if (parserType === "excel") {
        const excelCfg: ExcelParserConfig = {
          dataStartRow: result.headerRowIndex + 1,
          columns: colMap,
          dateFormats,
        };
        formData.set("excelConfig", JSON.stringify(excelCfg));
      } else if (parserType === "csv") {
        const config: CsvParserConfig = {
          delimiter: csvDelimiter,
          decimalSeparator: ",",
          hasHeader: true,
          columns: colMap,
          dataStartRow: result.headerRowIndex,
        };
        formData.set("csvConfig", JSON.stringify(config));
      }

      return formData;
    },
    [pendingFile, clientId, pendingSet, parserType, csvDelimiter, wizardRawRows]
  );

  const doImport = useCallback(
    async (formData: FormData, extraParams?: Record<string, string>) => {
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          formData.set(k, v);
        }
      }

      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetch("/api/import", {
            method: "POST",
            body: formData,
          });
          break;
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
        }
      }

      if (!res) {
        setImportError("Nettverksfeil — kunne ikke nå serveren. Prøv igjen om noen sekunder.");
        return null;
      }

      return res;
    },
    []
  );

  /** Wizard complete: build config, dry-run for duplicates, then import */
  const handleWizardComplete = useCallback(
    async (result: WizardResult) => {
      if (!pendingFile) return;
      setLoading(true);
      setImportError(null);
      try {
        const formData = buildFormData(result);

        // Step 1: dry-run to check duplicates
        const dryRunFd = new FormData();
        for (const [k, v] of formData.entries()) dryRunFd.set(k, v);
        dryRunFd.set("dryRun", "true");

        const dryRes = await doImport(dryRunFd);
        if (!dryRes) return;

        const dryData = await dryRes.json().catch(() => ({}));

        // 409 = exact file duplicate
        if (dryRes.status === 409) {
          setImportError(
            dryData.details ?? "Denne filen er allerede importert."
          );
          return;
        }

        if (!dryRes.ok && !dryData.dryRun) {
          const msg = [dryData.error ?? "Import feilet"]
            .concat(dryData.details ? [dryData.details] : [])
            .filter(Boolean)
            .join(" — ");
          setImportError(msg);
          return;
        }

        // If duplicates found, show dialog
        if (dryData.duplicateCount > 0 && dryData.newCount > 0) {
          setDupReport(dryData as DuplicateReport);
          setPendingFormData(formData);
          setDupDialogOpen(true);
          return;
        }

        // All duplicates, no new rows
        if (dryData.duplicateCount > 0 && dryData.newCount === 0) {
          setImportError(
            `Alle ${dryData.duplicateCount} transaksjoner finnes allerede. Ingen nye rader å importere.`
          );
          return;
        }

        // No duplicates — proceed with import
        const res = await doImport(formData);
        if (!res) return;

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = [data.error ?? "Import feilet"]
            .concat(data.details ? [data.details] : [])
            .filter(Boolean)
            .join(" — ");
          setImportError(msg);
          return;
        }

        setImportError(null);
        setImportOpen(false);
        setPendingFile(null);
        setPreview(null);
        setWizardRawRows(null);
        setExcelBuffer(null);
        router.refresh();
      } catch {
        setImportError("En uventet feil oppstod under importen. Prøv igjen.");
      } finally {
        setLoading(false);
      }
    },
    [pendingFile, buildFormData, doImport, router]
  );

  /** Handle duplicate dialog choice */
  const handleDuplicateChoice = useCallback(
    async (action: "skip" | "force" | "cancel") => {
      setDupDialogOpen(false);
      if (action === "cancel" || !pendingFormData) {
        setDupReport(null);
        setPendingFormData(null);
        return;
      }

      setLoading(true);
      try {
        const params: Record<string, string> = action === "skip"
          ? { skipDuplicates: "true" }
          : { forceAll: "true" };

        const res = await doImport(pendingFormData, params);
        if (!res) return;

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = [data.error ?? "Import feilet"]
            .concat(data.details ? [data.details] : [])
            .filter(Boolean)
            .join(" — ");
          setImportError(msg);
          return;
        }

        setImportError(null);
        setImportOpen(false);
        setPendingFile(null);
        setPreview(null);
        setWizardRawRows(null);
        setExcelBuffer(null);
        setDupReport(null);
        setPendingFormData(null);
        router.refresh();
      } catch {
        setImportError("En uventet feil oppstod under importen. Prøv igjen.");
      } finally {
        setLoading(false);
      }
    },
    [pendingFormData, doImport, router]
  );

  /** Build FormData for legacy camt/klink import */
  const buildLegacyFormData = useCallback(() => {
    if (!pendingFile) return null;
    const formData = new FormData();
    formData.set("file", pendingFile);
    formData.set("clientId", clientId);
    formData.set("setNumber", String(pendingSet));
    formData.set("parserType", parserType);
    if (parserType === "klink") {
      formData.set("klinkSpec", klinkSpec);
    }
    return formData;
  }, [pendingFile, clientId, pendingSet, parserType, klinkSpec]);

  /** Legacy import for camt/klink — now with dry-run + duplicate handling */
  const handleImport = async (importSelected = false) => {
    if (!pendingFile || !preview) return;
    setLoading(true);
    setImportError(null);
    try {
      const formData = buildLegacyFormData();
      if (!formData) return;

      if (!importSelected) {
        // Step 1: dry-run
        const dryFd = new FormData();
        for (const [k, v] of formData.entries()) dryFd.set(k, v);
        dryFd.set("dryRun", "true");

        const dryRes = await doImport(dryFd);
        if (!dryRes) return;

        const dryData = await dryRes.json().catch(() => ({}));

        if (dryRes.status === 409 && dryData.isExactDuplicate) {
          setExactDuplicate(true);
          setSelectedTxIndices(new Set());
          return;
        }

        if (dryRes.status === 409) {
          setImportError(dryData.details ?? "Alle transaksjoner finnes allerede.");
          return;
        }

        if (!dryRes.ok && !dryData.dryRun) {
          const msg = [dryData.error ?? "Import feilet"]
            .concat(dryData.details ? [dryData.details] : [])
            .filter(Boolean)
            .join(" — ");
          setImportError(msg);
          return;
        }

        if (dryData.duplicateCount > 0 && dryData.newCount > 0) {
          setPendingFormData(formData);
          setDupReport(dryData as DuplicateReport);
          setDupDialogOpen(true);
          return;
        }

        if (dryData.duplicateCount > 0 && dryData.newCount === 0) {
          setExactDuplicate(true);
          setSelectedTxIndices(new Set());
          return;
        }
      }

      // Step 2: actual import — send only selected indices if applicable
      if (importSelected && selectedTxIndices.size > 0) {
        formData.set(
          "selectedIndices",
          JSON.stringify(Array.from(selectedTxIndices))
        );
      }

      const res = await doImport(formData);
      if (!res) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = [data.error ?? "Import feilet"]
          .concat(data.details ? [data.details] : [])
          .filter(Boolean)
          .join(" — ");
        setImportError(msg);
        return;
      }
      setImportError(null);
      setExactDuplicate(false);
      setSelectedTxIndices(new Set());
      setImportOpen(false);
      setPendingFile(null);
      setPreview(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCloseImport = () => {
    setImportOpen(false);
    setPendingFile(null);
    setPreview(null);
    setImportError(null);
    setFileContent(null);
    setWizardRawRows(null);
    setExcelBuffer(null);
    setExactDuplicate(false);
    setSelectedTxIndices(new Set());
  };

  const [ejectingSet, setEjectingSet] = useState<1 | 2 | null>(null);
  const ejectSet = useCallback(
    async (setNumber: 1 | 2) => {
      setEjectingSet(setNumber);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/matching?setNumber=${setNumber}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImportError(data.error ?? "Kunne ikke fjerne fil");
          return;
        }
        setImportError(null);
        router.refresh();
      } finally {
        setEjectingSet(null);
      }
    },
    [clientId, router]
  );

  return (
    <>
      <div className="flex h-[calc(100vh-10rem)] flex-col -m-4 p-4">
        <MatchingToolbar
          onFileManager={() => setFileManagerOpen(true)}
        />
        <div className="flex flex-1 min-h-0">
          <div className="flex flex-1 flex-col min-w-0">
            <div className="flex items-center gap-3 border-b px-3 py-1.5 text-xs">
              <span className="font-medium text-muted-foreground">{set1Label}</span>
              <span>
                <span className="text-muted-foreground">Poster:</span>{" "}
                <span className="font-medium">{rows1.length}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Saldo:</span>{" "}
                <span className="font-medium">
                  {balance1.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </div>
            {rows1.length > 0 ? (
              <TransactionPanel
                transactions={rows1}
                setLabel={set1Label}
                onEject={() => ejectSet(1)}
                ejecting={ejectingSet === 1}
                onImportFile={(file) => openImportDialog(file, 1)}
              />
            ) : (
              <SetDropzone
                label="Dra hovedboksfil hit"
                onFile={(file) => openImportDialog(file, 1)}
              />
            )}
          </div>
          <div className="flex flex-1 flex-col min-w-0">
            <div className="flex items-center justify-between border-b px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">{set2Label}</span>
              <div className="flex items-center gap-3 text-xs">
                <span>
                  <span className="text-muted-foreground">Poster:</span>{" "}
                  <span className="font-medium">{rows2.length}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Saldo:</span>{" "}
                  <span className="font-medium">
                    {balance2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
              </div>
            </div>
            {rows2.length > 0 ? (
              <TransactionPanel
                transactions={rows2}
                setLabel={set2Label}
                onEject={() => ejectSet(2)}
                ejecting={ejectingSet === 2}
                onImportFile={(file) => openImportDialog(file, 2)}
              />
            ) : (
              <SetDropzone
                label="Dra bankfil hit"
                onFile={(file) => openImportDialog(file, 2)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => !open && handleCloseImport()}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[min(90vw,2800px)] max-w-none flex-col sm:max-w-[min(90vw,2800px)] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Importer til {pendingSet === 1 ? set1Label : set2Label}
            </DialogTitle>
          </DialogHeader>

          {(parserType === "excel" || parserType === "csv") && wizardRawRows ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {importError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm mb-3 shrink-0">
                  <p className="font-medium">Import feilet</p>
                  <p className="mt-0.5">{importError}</p>
                </div>
              )}
              {loading ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-muted-foreground text-sm">Importerer…</p>
                </div>
              ) : (
                <ColumnImportWizard
                  rawRows={wizardRawRows}
                  onComplete={handleWizardComplete}
                  onCancel={handleCloseImport}
                />
              )}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                {importError && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    <p className="font-medium">Import feilet</p>
                    <p className="mt-0.5">{importError}</p>
                  </div>
                )}
                {exactDuplicate && (
                  <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <Copy className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          Denne filen er allerede importert
                        </p>
                        <p className="text-amber-700 dark:text-amber-400 mt-1">
                          Transaksjonene fra denne filen ligger allerede i tabellen.
                          Dersom du likevel ønsker å importere, marker transaksjonene
                          du vil ha med og klikk &laquo;Importer valgte&raquo;.
                          Bruk søkefeltet for å raskt finne spesifikke poster.
                        </p>
                      </div>
                    </div>
                    {preview && selectedTxIndices.size > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                        {selectedTxIndices.size} av {preview.transactions.length} transaksjoner valgt
                      </p>
                    )}
                  </div>
                )}
                {parserType === "camt" && preview?.errors && preview.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                    <p className="font-medium">Filen kan ikke brukes</p>
                    <p className="mt-0.5">{preview.errors[0]}</p>
                  </div>
                )}
                <div>
                  <Label>Filtype</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parserType === "camt"
                      ? "Gjenkjent: CAMT.053 (bank-XML)"
                      : "Gjenkjent: Klink / fastlengde (Nordea m.m.)"}
                  </p>
                </div>
                {parserType === "klink" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="klink-spec">Spec (FILTYPE, BEHANDL1, [Transer]…)</Label>
                    <Textarea
                      id="klink-spec"
                      placeholder="Lim inn spec her. F.eks. FILTYPE;FASTLENGDEMULTILINE&#10;BEHANDL1;0=0;1=1;…&#10;[Transer]&#10;ID;151;1;3&#10;Kontonr;9,11,1&#10;…"
                      value={klinkSpec}
                      onChange={(e) => setKlinkSpec(e.target.value)}
                      className="min-h-[120px] font-mono text-xs"
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Forhåndsvisningen oppdateres når du limer inn eller endrer spec.
                    </p>
                  </div>
                )}
                {pendingFile && !preview && (
                  <p className="text-muted-foreground text-sm">Laster forhåndsvisning…</p>
                )}
                {preview && (
                  <ImportPreview
                    transactions={preview.transactions}
                    errors={preview.errors}
                    className="min-h-0 flex-1"
                    selectable={exactDuplicate}
                    selectedIndices={exactDuplicate ? selectedTxIndices : undefined}
                    onSelectionChange={exactDuplicate ? setSelectedTxIndices : undefined}
                  />
                )}
              </div>
              {preview && (
                <div className="flex shrink-0 items-center justify-end gap-2 border-t pt-4">
                  <Button variant="outline" onClick={handleCloseImport}>
                    Avbryt
                  </Button>
                  {exactDuplicate ? (
                    <Button
                      onClick={() => handleImport(true)}
                      disabled={loading || selectedTxIndices.size === 0}
                    >
                      {loading
                        ? "Importerer…"
                        : `Importer valgte (${selectedTxIndices.size})`}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleImport()}
                      disabled={
                        loading ||
                        preview.transactions.length === 0 ||
                        (parserType === "klink" && !klinkSpec.trim())
                      }
                      title={
                        parserType === "klink" && !klinkSpec.trim()
                          ? "Lim inn spec for å importere"
                          : undefined
                      }
                    >
                      {loading ? "Importerer…" : "Importer"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate report dialog */}
      <Dialog open={dupDialogOpen} onOpenChange={(open) => !open && handleDuplicateChoice("cancel")}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-amber-600" />
              Duplikater funnet
            </DialogTitle>
          </DialogHeader>
          {dupReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {dupReport.newCount}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-500 font-medium mt-0.5">
                    Nye transaksjoner
                  </div>
                </div>
                <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {dupReport.duplicateCount}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-0.5">
                    Duplikater
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Filen inneholder {dupReport.totalCount} transaksjoner.{" "}
                <strong>{dupReport.duplicateCount}</strong> av disse finnes allerede
                i datasettet. Du kan velge å importere kun de nye, eller importere alt.
              </p>

              {dupReport.duplicates.length > 0 && (
                <div className="rounded-md border max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Rad</th>
                        <th className="text-left p-2 font-medium">Dato</th>
                        <th className="text-right p-2 font-medium">Beløp</th>
                        <th className="text-left p-2 font-medium">Tekst</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dupReport.duplicates.map((d, i) => (
                        <tr key={i} className="text-muted-foreground">
                          <td className="p-2">{d.rowNumber}</td>
                          <td className="p-2">{d.date1}</td>
                          <td className="p-2 text-right">{d.amount}</td>
                          <td className="p-2 truncate max-w-[150px]">{d.description ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleDuplicateChoice("cancel")}
                  disabled={loading}
                >
                  Avbryt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDuplicateChoice("force")}
                  disabled={loading}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Importer alle ({dupReport.totalCount})
                </Button>
                <Button
                  onClick={() => handleDuplicateChoice("skip")}
                  disabled={loading}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Importer kun nye ({dupReport.newCount})
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File manager panel */}
      <FileManagerPanel
        open={fileManagerOpen}
        onOpenChange={setFileManagerOpen}
        clientId={clientId}
        set1Label={set1Label}
        set2Label={set2Label}
        onRefresh={() => router.refresh()}
      />
    </>
  );
}
