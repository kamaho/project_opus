"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { parseFile, detectFileTypeFromFile, readExcelRows, readCsvRawRows } from "@/lib/parsers";
import type { ParsedTransaction, CsvParserConfig, ExcelParserConfig } from "@/lib/parsers";
import { MatchingToolbar, type ViewMode } from "@/components/matching/matching-toolbar";
import { TransactionPanel, type TransactionRow, type CellContextAction } from "@/components/matching/transaction-panel";
import { SetDropzone } from "@/components/matching/set-dropzone";
import type { WizardResult } from "@/components/import/column-import-wizard";
import type { MatchGroup } from "@/components/matching/matched-groups-view";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Copy, Link2, Search, Sparkles, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartPanel } from "@/components/smart-panel/smart-panel";

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

const MatchedGroupsView = dynamic(
  () => import("@/components/matching/matched-groups-view").then((m) => ({ default: m.MatchedGroupsView })),
  { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Laster matchede poster…</div> }
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

function formatAmountDisplay(raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return num.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FormattedAmountInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : formatAmountDisplay(value);

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      className="font-mono text-right"
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,-]/g, "").replace(",", ".");
        onChange(v);
      }}
    />
  );
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
  matchedGroups: MatchGroup[];
  openingBalanceSet1: string;
  openingBalanceSet2: string;
  openingBalanceDate: string | null;
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
  matchedGroups,
  openingBalanceSet1,
  openingBalanceSet2,
  openingBalanceDate,
}: MatchingViewClientProps) {
  const router = useRouter();

  // --- View mode ---
  const [viewMode, setViewMode] = useState<ViewMode>("open");

  // --- Selection state for matching ---
  const [selectedSet1, setSelectedSet1] = useState<Set<string>>(new Set());
  const [selectedSet2, setSelectedSet2] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((setNumber: 1 | 2, id: string) => {
    const setter = setNumber === 1 ? setSelectedSet1 : setSelectedSet2;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Context filter state — shows only matching rows
  const [contextFilter1, setContextFilter1] = useState<Set<string> | null>(null);
  const [contextFilter2, setContextFilter2] = useState<Set<string> | null>(null);

  // Smart panel state
  const [smartPanelOpen, setSmartPanelOpen] = useState(false);
  const [smartPanelPos, setSmartPanelPos] = useState({ x: 0, y: 0 });
  const [smartPanelActiveOption, setSmartPanelActiveOption] = useState<string | null>(null);
  const [pendingCellAction, setPendingCellAction] = useState<{ action: CellContextAction; sourceSet: 1 | 2 } | null>(null);
  const [smartPanelResult, setSmartPanelResult] = useState<{ matchCount1: number; matchCount2: number } | null>(null);

  const closeSmartPanel = useCallback(() => {
    setSmartPanelOpen(false);
    setSmartPanelActiveOption(null);
    setPendingCellAction(null);
    setSmartPanelResult(null);
    setContextFilter1(null);
    setContextFilter2(null);
    setSelectedSet1(new Set());
    setSelectedSet2(new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSet1(new Set());
    setSelectedSet2(new Set());
    closeSmartPanel();
  }, [closeSmartPanel]);

  const findMatchingIds = useCallback(
    (source: TransactionRow[], action: CellContextAction): Set<string> => {
      const ids = new Set<string>();
      ids.add(action.txId);
      for (const tx of source) {
        const match = action.field === "amount"
          ? tx.amount === action.numericValue
          : action.field === "voucher"
            ? (tx.voucher ?? "") === action.value
            : tx[action.field] === action.value;
        if (match) ids.add(tx.id);
      }
      return ids;
    },
    []
  );

  const findCounterpartIds = useCallback(
    (source: TransactionRow[], amount: number): Set<string> => {
      const absTarget = Math.round(Math.abs(amount) * 100) / 100;
      const ids = new Set<string>();
      for (const tx of source) {
        if (Math.round(Math.abs(tx.amount) * 100) / 100 === absTarget) ids.add(tx.id);
      }
      return ids;
    },
    []
  );

  const formatAmount = (n: number): string => {
    const abs = Math.abs(n).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `−${abs}` : abs;
  };

  const handleCellContextMenu = useCallback(
    (setNumber: 1 | 2, action: CellContextAction, position: { x: number; y: number }) => {
      setPendingCellAction({ action, sourceSet: setNumber });
      setSmartPanelPos(position);
      setSmartPanelActiveOption(null);
      setSmartPanelResult(null);
      setContextFilter1(null);
      setContextFilter2(null);
      setSelectedSet1(new Set());
      setSelectedSet2(new Set());
      setSmartPanelOpen(true);
    },
    []
  );

  const selectedSum = useMemo(() => {
    let sum = 0;
    for (const tx of rows1) if (selectedSet1.has(tx.id)) sum += tx.amount;
    for (const tx of rows2) if (selectedSet2.has(tx.id)) sum += tx.amount;
    return Math.round(sum * 100) / 100;
  }, [selectedSet1, selectedSet2, rows1, rows2]);

  const selectedCount = selectedSet1.size + selectedSet2.size;
  const canMatch = selectedCount >= 2 && selectedSum === 0;

  // --- Matching action ---
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const handleMatch = useCallback(async () => {
    const allIds = [
      ...Array.from(selectedSet1),
      ...Array.from(selectedSet2),
    ];
    if (allIds.length < 2) return;

    setMatching(true);
    setMatchError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: allIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMatchError(data.details ?? data.error ?? "Matching feilet");
        return;
      }
      clearSelection();
      router.refresh();
    } catch {
      setMatchError("Nettverksfeil — prøv igjen.");
    } finally {
      setMatching(false);
    }
  }, [selectedSet1, selectedSet2, clientId, clearSelection, router]);

  const handleSmartPanelOptionSelect = useCallback(
    (optionId: string) => {
      if (!optionId) {
        setSmartPanelActiveOption(null);
        setSmartPanelResult(null);
        setContextFilter1(null);
        setContextFilter2(null);
        setSelectedSet1(new Set());
        setSelectedSet2(new Set());
        return;
      }

      if (optionId === "match") {
        closeSmartPanel();
        handleMatch();
        return;
      }

      if (optionId === "smartMatch") {
        setSmartPanelActiveOption(optionId);
        return;
      }

      if (!pendingCellAction) return;
      const { action, sourceSet } = pendingCellAction;
      const isAmount = action.field === "amount";
      const otherRows = sourceSet === 1 ? rows2 : rows1;
      const sameRows = sourceSet === 1 ? rows1 : rows2;

      if (optionId === "counterpartOther") {
        const amount = action.numericValue ?? 0;
        const originIds = new Set<string>([action.txId]);
        const counterIds = findCounterpartIds(otherRows, amount);
        if (sourceSet === 1) {
          setSelectedSet1(originIds); setSelectedSet2(counterIds);
          setContextFilter1(originIds); setContextFilter2(counterIds.size > 0 ? counterIds : null);
        } else {
          setSelectedSet1(counterIds); setSelectedSet2(originIds);
          setContextFilter1(counterIds.size > 0 ? counterIds : null); setContextFilter2(originIds);
        }
        setSmartPanelResult({
          matchCount1: sourceSet === 1 ? 1 : counterIds.size,
          matchCount2: sourceSet === 2 ? 1 : counterIds.size,
        });
      } else if (optionId === "counterpartSame") {
        const amount = action.numericValue ?? 0;
        const ids = findCounterpartIds(sameRows, amount);
        ids.add(action.txId);
        if (sourceSet === 1) {
          setSelectedSet1(ids); setSelectedSet2(new Set());
          setContextFilter1(ids); setContextFilter2(null);
        } else {
          setSelectedSet1(new Set()); setSelectedSet2(ids);
          setContextFilter1(null); setContextFilter2(ids);
        }
        setSmartPanelResult({
          matchCount1: sourceSet === 1 ? ids.size : 0,
          matchCount2: sourceSet === 2 ? ids.size : 0,
        });
      } else if (optionId === "filterSame") {
        const ids = findMatchingIds(sameRows, action);
        if (sourceSet === 1) {
          setSelectedSet1(ids); setSelectedSet2(new Set());
          setContextFilter1(ids); setContextFilter2(null);
        } else {
          setSelectedSet1(new Set()); setSelectedSet2(ids);
          setContextFilter1(null); setContextFilter2(ids);
        }
        setSmartPanelResult({
          matchCount1: sourceSet === 1 ? ids.size : 0,
          matchCount2: sourceSet === 2 ? ids.size : 0,
        });
      } else if (optionId === "filterOther") {
        const ids = findMatchingIds(otherRows, action);
        const originIds = new Set<string>([action.txId]);
        if (sourceSet === 1) {
          setSelectedSet1(originIds); setSelectedSet2(ids);
          setContextFilter1(originIds); setContextFilter2(ids.size > 0 ? ids : null);
        } else {
          setSelectedSet1(ids); setSelectedSet2(originIds);
          setContextFilter1(ids.size > 0 ? ids : null); setContextFilter2(originIds);
        }
        setSmartPanelResult({
          matchCount1: sourceSet === 1 ? 1 : ids.size,
          matchCount2: sourceSet === 2 ? 1 : ids.size,
        });
      }
      setSmartPanelActiveOption(optionId);
    },
    [pendingCellAction, rows1, rows2, findMatchingIds, findCounterpartIds, closeSmartPanel, handleMatch]
  );

  // --- Unmatch action ---
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);

  const handleUnmatch = useCallback(async (matchId: string) => {
    setUnmatchingId(matchId);
    try {
      const res = await fetch(
        `/api/clients/${clientId}/matches?matchId=${matchId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMatchError(data.error ?? "Kunne ikke oppheve match");
        return;
      }
      router.refresh();
    } catch {
      setMatchError("Nettverksfeil — prøv igjen.");
    } finally {
      setUnmatchingId(null);
    }
  }, [clientId, router]);

  // --- Opening balance ---
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [editBalS1, setEditBalS1] = useState(openingBalanceSet1);
  const [editBalS2, setEditBalS2] = useState(openingBalanceSet2);
  const [editBalDate, setEditBalDate] = useState(openingBalanceDate ?? "");
  const [savingBalance, setSavingBalance] = useState(false);

  const handleSaveBalance = useCallback(async () => {
    setSavingBalance(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/balance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openingBalanceSet1: editBalS1,
          openingBalanceSet2: editBalS2,
          openingBalanceDate: editBalDate || null,
        }),
      });
      if (res.ok) {
        setBalanceDialogOpen(false);
        router.refresh();
      }
    } finally {
      setSavingBalance(false);
    }
  }, [clientId, editBalS1, editBalS2, editBalDate, router]);

  // Live saldo = opening balance + sum of all unmatched transactions
  const liveBalance1 = useMemo(() => {
    return parseFloat(openingBalanceSet1 || "0") + balance1;
  }, [openingBalanceSet1, balance1]);

  const liveBalance2 = useMemo(() => {
    return parseFloat(openingBalanceSet2 || "0") + balance2;
  }, [openingBalanceSet2, balance2]);

  // --- Import dialog state ---
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

  const [fileManagerOpen, setFileManagerOpen] = useState(false);

  const [dupReport, setDupReport] = useState<DuplicateReport | null>(null);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

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

  const handleWizardComplete = useCallback(
    async (result: WizardResult) => {
      if (!pendingFile) return;
      setLoading(true);
      setImportError(null);
      try {
        const formData = buildFormData(result);

        const dryRunFd = new FormData();
        for (const [k, v] of formData.entries()) dryRunFd.set(k, v);
        dryRunFd.set("dryRun", "true");

        const dryRes = await doImport(dryRunFd);
        if (!dryRes) return;

        const dryData = await dryRes.json().catch(() => ({}));

        if (dryRes.status === 409) {
          setImportError(dryData.details ?? "Denne filen er allerede importert.");
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
          setDupReport(dryData as DuplicateReport);
          setPendingFormData(formData);
          setDupDialogOpen(true);
          return;
        }

        if (dryData.duplicateCount > 0 && dryData.newCount === 0) {
          setImportError(
            `Alle ${dryData.duplicateCount} transaksjoner finnes allerede. Ingen nye rader å importere.`
          );
          return;
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

  const handleImport = async (importSelected = false) => {
    if (!pendingFile || !preview) return;
    setLoading(true);
    setImportError(null);
    try {
      const formData = buildLegacyFormData();
      if (!formData) return;

      if (!importSelected) {
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

  // --- Keyboard shortcut for matching (M key) ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "m" && !e.metaKey && !e.ctrlKey && canMatch && !matching) {
        e.preventDefault();
        handleMatch();
      }
      if (e.key === "Escape" && selectedCount > 0) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canMatch, matching, handleMatch, selectedCount, clearSelection]);

  return (
    <>
      <div className="flex h-[calc(100vh-10rem)] flex-col -m-4 p-4">
       <div className="flex flex-1 flex-col min-h-0 rounded-md border overflow-hidden">
        <MatchingToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onMatch={handleMatch}
          matchDisabled={!canMatch || matching}
          onFileManager={() => setFileManagerOpen(true)}
        />

        {matchError && (
          <div className="border-b bg-destructive/10 px-4 py-2 text-sm text-destructive flex items-center gap-2 shrink-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {matchError}
            <button className="ml-auto hover:underline text-xs" onClick={() => setMatchError(null)}>Lukk</button>
          </div>
        )}

        {viewMode === "open" ? (
          <>
          <div className="flex flex-1 min-h-0 gap-[3px] bg-border">
            <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-background overflow-hidden">
              <div className="flex items-center gap-3 border-b px-3 py-1.5 text-xs shrink-0" data-smart-info={`Overskrift for mengde 1 (${set1Label}). Viser antall åpne poster og løpende saldo inkludert inngående saldo.`}>
                <span className="font-medium text-muted-foreground">{set1Label}</span>
                <span>
                  <span className="text-muted-foreground">Poster:</span>{" "}
                  <span className="font-medium">{rows1.length}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Saldo:</span>{" "}
                  <span className="font-medium font-mono">
                    {liveBalance1.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                <button
                  className="text-muted-foreground hover:text-foreground ml-1"
                  onClick={() => {
                    setEditBalS1(openingBalanceSet1);
                    setEditBalS2(openingBalanceSet2);
                    setEditBalDate(openingBalanceDate ?? "");
                    setBalanceDialogOpen(true);
                  }}
                  data-smart-info="Rediger inngående saldo for begge mengder. Saldo brukes til å beregne løpende balanse."
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              {rows1.length > 0 ? (
                <TransactionPanel
                  transactions={rows1}
                  setLabel={set1Label}
                  onEject={() => ejectSet(1)}
                  ejecting={ejectingSet === 1}
                  onImportFile={(file) => openImportDialog(file, 1)}
                  onSelect={(id) => toggleSelect(1, id)}
                  selectedIds={selectedSet1}
                  onCellContextMenu={(a, pos) => handleCellContextMenu(1, a, pos)}
                  contextFilterIds={contextFilter1}
                />
              ) : (
                <SetDropzone
                  label="Dra hovedboksfil hit"
                  onFile={(file) => openImportDialog(file, 1)}
                />
              )}
            </div>
            <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-background overflow-hidden">
              <div className="flex items-center justify-between border-b px-3 py-1.5 shrink-0" data-smart-info={`Overskrift for mengde 2 (${set2Label}). Viser antall åpne poster og løpende saldo inkludert inngående saldo.`}>
                <span className="text-xs font-medium text-muted-foreground">{set2Label}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span>
                    <span className="text-muted-foreground">Poster:</span>{" "}
                    <span className="font-medium">{rows2.length}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Saldo:</span>{" "}
                    <span className="font-medium font-mono">
                      {liveBalance2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditBalS1(openingBalanceSet1);
                      setEditBalS2(openingBalanceSet2);
                      setEditBalDate(openingBalanceDate ?? "");
                      setBalanceDialogOpen(true);
                    }}
                    data-smart-info="Rediger inngående saldo for begge mengder. Saldo brukes til å beregne løpende balanse."
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {rows2.length > 0 ? (
                <TransactionPanel
                  transactions={rows2}
                  setLabel={set2Label}
                  onEject={() => ejectSet(2)}
                  ejecting={ejectingSet === 2}
                  onImportFile={(file) => openImportDialog(file, 2)}
                  onSelect={(id) => toggleSelect(2, id)}
                  selectedIds={selectedSet2}
                  onCellContextMenu={(a, pos) => handleCellContextMenu(2, a, pos)}
                  contextFilterIds={contextFilter2}
                />
              ) : (
                <SetDropzone
                  label="Dra bankfil hit"
                  onFile={(file) => openImportDialog(file, 2)}
                />
              )}
            </div>
          </div>

          {/* Status bar — always visible, changes based on selection state */}
          <div
            className={cn(
              "flex items-center gap-3 border-t px-4 text-sm shrink-0 h-10 transition-colors",
              selectedCount > 0
                ? "bg-blue-50 dark:bg-blue-950/30"
                : "bg-muted/30"
            )}
            data-smart-info="Statuslinjen viser valgte poster og matchinformasjon. Når poster er markert vises sum og match-knapp. Summen av markerte poster må være 0 for at matching er mulig."
          >
            {selectedCount > 0 ? (
              <>
                <span className="font-medium">
                  {selectedSet1.size > 0 && (
                    <span>{selectedSet1.size} fra {set1Label}</span>
                  )}
                  {selectedSet1.size > 0 && selectedSet2.size > 0 && <span> + </span>}
                  {selectedSet2.size > 0 && (
                    <span>{selectedSet2.size} fra {set2Label}</span>
                  )}
                </span>
                <span className="text-muted-foreground">|</span>
                <span className={cn(
                  "font-mono font-medium",
                  selectedSum === 0 ? "text-green-600" : "text-amber-600"
                )}>
                  Sum: {selectedSum.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {selectedSum !== 0 && (
                  <span className="text-xs text-muted-foreground">
                    (må være 0 for å matche)
                  </span>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={clearSelection}
                  >
                    <X className="h-3.5 w-3.5" />
                    Avbryt
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!canMatch || matching}
                    onClick={handleMatch}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {matching ? "Matcher…" : "Match"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {rows1.length === 0 && rows2.length === 0
                    ? "Importer filer i begge mengder for å starte matching"
                    : rows1.length === 0 || rows2.length === 0
                      ? "Importer fil i begge mengder for å starte matching"
                      : "Marker poster i begge mengder og trykk Match (M)"}
                </span>
                {(rows1.length > 0 || rows2.length > 0) && (
                  <div className="flex items-center gap-4 ml-auto text-xs text-muted-foreground">
                    {matchedGroups.length > 0 && (
                      <span>
                        <span className="font-medium text-foreground">{matchedGroups.length}</span> matchgrupper
                      </span>
                    )}
                    <span>
                      <span className="font-medium text-foreground">{rows1.length + rows2.length}</span> åpne poster
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          </>
        ) : (
          <MatchedGroupsView
            groups={matchedGroups}
            onUnmatch={handleUnmatch}
            unmatchingId={unmatchingId}
            set1Label={set1Label}
            set2Label={set2Label}
          />
        )}
       </div>
      </div>

      {/* Opening balance dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inngående saldo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bal-s1">{set1Label} — inngående saldo</Label>
              <FormattedAmountInput
                id="bal-s1"
                value={editBalS1}
                onChange={setEditBalS1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bal-s2">{set2Label} — inngående saldo</Label>
              <FormattedAmountInput
                id="bal-s2"
                value={editBalS2}
                onChange={setEditBalS2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bal-date">Saldodato</Label>
              <Input
                id="bal-date"
                type="date"
                value={editBalDate}
                onChange={(e) => setEditBalDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleSaveBalance} disabled={savingBalance}>
                {savingBalance ? "Lagrer…" : "Lagre"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => !open && handleCloseImport()}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[min(90vw,2800px)] max-w-none flex-col sm:max-w-[min(90vw,2800px)] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              Importer til {pendingSet === 1 ? set1Label : set2Label}
            </DialogTitle>
          </DialogHeader>

          {/* Balance summary */}
          {pendingFile && (() => {
            const currentBal = pendingSet === 1 ? liveBalance1 : liveBalance2;
            const fileSum = preview
              ? preview.transactions.reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0)
              : null;
            const newBal = fileSum !== null ? currentBal + fileSum : null;
            const fmt = (n: number) => n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const setName = pendingSet === 1 ? set1Label : set2Label;
            return (
              <div className="rounded-md border bg-muted/30 px-4 py-2 text-sm shrink-0">
                <div className="text-xs text-muted-foreground mb-1.5">
                  Saldoeffekt for <span className="font-medium text-foreground">{setName}</span> ved import av denne filen
                </div>
                <div className="flex items-center gap-4 font-mono">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wide">Saldo nå</div>
                  <div className="font-medium">{fmt(currentBal)}</div>
                </div>
                {fileSum !== null && (
                  <>
                    <div className="text-muted-foreground">+</div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wide">Bevegelse</div>
                      <div className={cn("font-medium", fileSum < 0 ? "text-destructive" : fileSum > 0 ? "text-green-600" : "")}>
                        {fileSum >= 0 ? "+" : ""}{fmt(fileSum)}
                      </div>
                    </div>
                    <div className="text-muted-foreground">=</div>
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wide">Saldo etter</div>
                      <div className="font-semibold">{fmt(newBal!)}</div>
                    </div>
                  </>
                )}
                {fileSum === null && (
                  <div className="text-xs text-muted-foreground font-sans">
                    Bevegelse vises etter forhåndsvisning
                  </div>
                )}
                </div>
              </div>
            );
          })()}

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

      {/* Smart panel overlay */}
      {(() => {
        const pa = pendingCellAction;
        const isAmount = pa?.action.field === "amount";
        const otherLabel = pa ? (pa.sourceSet === 1 ? set2Label : set1Label) : "";
        const sameLabel = pa ? (pa.sourceSet === 1 ? set1Label : set2Label) : "";
        const amountAbs = pa && isAmount
          ? Math.abs(pa.action.numericValue ?? 0).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "";
        const displayValue = pa
          ? isAmount
            ? formatAmount(pa.action.numericValue ?? 0)
            : `«${pa.action.value}»`
          : "";

        const options = isAmount
          ? [
              { id: "counterpartOther", label: `Finn motpost: ${amountAbs} i ${otherLabel}`, icon: <Search className="h-3.5 w-3.5" /> },
              { id: "counterpartSame", label: `Finn intern motpost: ${amountAbs}`, icon: <Search className="h-3.5 w-3.5" /> },
            ]
          : [
              { id: "filterSame", label: `Filtrer: ${displayValue} i denne mengden`, icon: <Search className="h-3.5 w-3.5" /> },
              { id: "filterOther", label: `Filtrer: ${displayValue} i ${otherLabel}`, icon: <Search className="h-3.5 w-3.5" /> },
            ];

        const allOptions = [
          ...options,
          { id: "match", label: "Match markerte poster", icon: <Link2 className="h-3.5 w-3.5" />, separator: true, disabled: !canMatch, hint: "M" },
          { id: "smartMatch", label: "Smart match", icon: <Sparkles className="h-3.5 w-3.5" />, disabled: true, hint: "Kommer" },
        ];

        const resultLabel = smartPanelActiveOption === "counterpartOther" || smartPanelActiveOption === "filterOther"
          ? otherLabel
          : sameLabel;

        return (
          <SmartPanel
            open={smartPanelOpen}
            onClose={closeSmartPanel}
            position={smartPanelPos}
            options={allOptions}
            onOptionSelect={handleSmartPanelOptionSelect}
            activeOptionId={smartPanelActiveOption}
            resultContent={
              smartPanelResult && pa ? (
                <div className="p-3 space-y-3">
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      {isAmount ? "Søker etter motpost" : "Filtrerer på verdi"}
                    </div>
                    <div className="text-sm font-medium font-mono mt-0.5 truncate">
                      {isAmount ? amountAbs : pa.action.value || "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {smartPanelResult.matchCount1 > 0 && (
                      <div className="rounded-md border px-3 py-2 text-center">
                        <div className="text-lg font-bold">{smartPanelResult.matchCount1}</div>
                        <div className="text-xs text-muted-foreground truncate">{set1Label}</div>
                      </div>
                    )}
                    {smartPanelResult.matchCount2 > 0 && (
                      <div className="rounded-md border px-3 py-2 text-center">
                        <div className="text-lg font-bold">{smartPanelResult.matchCount2}</div>
                        <div className="text-xs text-muted-foreground truncate">{set2Label}</div>
                      </div>
                    )}
                  </div>
                  {smartPanelResult.matchCount1 + smartPanelResult.matchCount2 > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {smartPanelResult.matchCount1 + smartPanelResult.matchCount2} poster markert og filtrert.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ingen treff i {resultLabel}.
                    </p>
                  )}
                </div>
              ) : undefined
            }
          />
        );
      })()}
    </>
  );
}
