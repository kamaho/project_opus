"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { parseFile, detectFileTypeFromFile, readExcelRows, readCsvRawRows, readFileAsText } from "@/lib/parsers";
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
import { AlertTriangle, CheckCircle2, Copy, FileDown, Link2, Search, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartPanel } from "@/components/smart-panel/smart-panel";
import { NotePopover } from "@/components/matching/note-popover";
import { NoteDialog } from "@/components/matching/note-dialog";
import { AttachmentPopover } from "@/components/matching/attachment-popover";
import { AttachmentDialog } from "@/components/matching/attachment-dialog";
import { ExportModal } from "@/components/export/export-modal";
import { ExportIntroOverlay } from "@/components/export/export-intro-overlay";

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
  set1AccountId: string;
  set2AccountId: string;
  rows1: TransactionRow[];
  rows2: TransactionRow[];
  balance1: number;
  balance2: number;
  matchedGroups: MatchGroup[];
  openingBalanceSet1: string;
  openingBalanceSet2: string;
  openingBalanceDate: string | null;
}

function EditableAccountBadge({
  label,
  accountId,
  clientId,
  variant,
  onRenamed,
}: {
  label: string;
  accountId: string;
  clientId: string;
  variant: "violet" | "brand";
  onRenamed: (newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(label);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, label]);

  const save = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === label) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, name: trimmed }),
      });
      if (res.ok) {
        onRenamed(trimmed);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [value, label, accountId, clientId, onRenamed]);

  const badgeClasses =
    variant === "violet"
      ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800"
      : "bg-brand-subtle text-brand-emphasis ring-brand-muted";

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          e.stopPropagation();
        }}
        onBlur={save}
        disabled={saving}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset outline-none",
          badgeClasses,
          "min-w-[60px] max-w-[200px] bg-background/80"
        )}
        style={{ width: `${Math.max(60, value.length * 7 + 24)}px` }}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset cursor-pointer transition-colors hover:opacity-80",
        badgeClasses
      )}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Klikk for å endre navn"
    >
      {label}
      <Pencil className="h-2.5 w-2.5 opacity-50" />
    </button>
  );
}

export function MatchingViewClient({
  clientId,
  clientName,
  set1Label: initialSet1Label,
  set2Label: initialSet2Label,
  set1AccountId,
  set2AccountId,
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
  const searchParams = useSearchParams();

  const [set1Label, setSet1Label] = useState(initialSet1Label);
  const [set2Label, setSet2Label] = useState(initialSet2Label);

  useEffect(() => { setSet1Label(initialSet1Label); }, [initialSet1Label]);
  useEffect(() => { setSet2Label(initialSet2Label); }, [initialSet2Label]);

  // --- Notification highlight ---
  const [highlightTxId, setHighlightTxId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("highlight");
    if (!id) return;

    setHighlightTxId(id);

    const inSet1 = rows1.some((r) => r.id === id);
    const inSet2 = rows2.some((r) => r.id === id);
    if (inSet1) setSelectedSet1(new Set([id]));
    else if (inSet2) setSelectedSet2(new Set([id]));

    const url = new URL(window.location.href);
    url.searchParams.delete("highlight");
    router.replace(url.pathname + url.search, { scroll: false });

    const timer = setTimeout(() => setHighlightTxId(null), 4000);
    return () => clearTimeout(timer);
  }, [searchParams, rows1, rows2, router]);

  // --- View mode ---
  const [viewMode, setViewMode] = useState<ViewMode>("open");

  // --- Export ---
  const [exportOpen, setExportOpen] = useState(false);
  const [exportGenerating, setExportGenerating] = useState(false);

  // --- Global date filter (shared across both panels) ---
  const [globalDateFrom, setGlobalDateFrom] = useState("");
  const [globalDateTo, setGlobalDateTo] = useState("");

  // --- Keyboard navigation ---
  const [kbPanel, setKbPanel] = useState<1 | 2 | null>(null);
  const [kbRowIndex, setKbRowIndex] = useState<number>(0);
  const rowCount1Ref = useRef(0);
  const rowCount2Ref = useRef(0);
  const visibleIds1Ref = useRef<string[]>([]);
  const visibleIds2Ref = useRef<string[]>([]);
  const handleRowCount1 = useCallback((n: number) => { rowCount1Ref.current = n; }, []);
  const handleRowCount2 = useCallback((n: number) => { rowCount2Ref.current = n; }, []);

  // --- Selection state for matching ---
  const [selectedSet1, setSelectedSet1] = useState<Set<string>>(new Set());
  const [selectedSet2, setSelectedSet2] = useState<Set<string>>(new Set());
  const [focusMode, setFocusMode] = useState(false);
  const focusPrimarySetRef = useRef<1 | 2 | null>(null);

  // Optimistic: hide matched rows instantly before server refresh completes.
  // The filter is cheap (Set.has is O(1)) and harmless on new server data that
  // already excludes matched rows — it simply returns the same array.
  const [locallyMatchedIds, setLocallyMatchedIds] = useState<Set<string>>(new Set());
  const visibleRows1 = useMemo(() =>
    locallyMatchedIds.size === 0 ? rows1 : rows1.filter((r) => !locallyMatchedIds.has(r.id)),
    [rows1, locallyMatchedIds]
  );
  const visibleRows2 = useMemo(() =>
    locallyMatchedIds.size === 0 ? rows2 : rows2.filter((r) => !locallyMatchedIds.has(r.id)),
    [rows2, locallyMatchedIds]
  );

  const toggleSelect = useCallback((setNumber: 1 | 2, id: string) => {
    const setter = setNumber === 1 ? setSelectedSet1 : setSelectedSet2;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (focusPrimarySetRef.current === null || focusPrimarySetRef.current === setNumber) {
      focusPrimarySetRef.current = setNumber;
    }
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
    focusPrimarySetRef.current = null;
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
    for (const tx of visibleRows1) if (selectedSet1.has(tx.id)) sum += tx.amount;
    for (const tx of visibleRows2) if (selectedSet2.has(tx.id)) sum += tx.amount;
    return Math.round(sum * 100) / 100;
  }, [selectedSet1, selectedSet2, visibleRows1, visibleRows2]);

  const selectedCount = selectedSet1.size + selectedSet2.size;
  const canMatch = selectedCount >= 2 && selectedSum === 0;

  // --- Counterpart hints ---
  // Green (1:1): for each selected tx, highlight its exact negated amount in the opposite set.
  // Orange (many-to-1): highlight a single tx whose amount equals the negated total of all selected.
  const counterpartHints1 = useMemo(() => {
    if (selectedSet2.size === 0) return undefined;
    const needed = new Set<number>();
    for (const tx of visibleRows2) {
      if (selectedSet2.has(tx.id)) needed.add(Math.round(-tx.amount * 100));
    }
    const hints = new Set<string>();
    for (const tx of visibleRows1) {
      if (selectedSet1.has(tx.id)) continue;
      if (needed.has(Math.round(tx.amount * 100))) hints.add(tx.id);
    }
    return hints.size > 0 ? hints : undefined;
  }, [visibleRows1, visibleRows2, selectedSet1, selectedSet2]);

  const counterpartHints2 = useMemo(() => {
    if (selectedSet1.size === 0) return undefined;
    const needed = new Set<number>();
    for (const tx of visibleRows1) {
      if (selectedSet1.has(tx.id)) needed.add(Math.round(-tx.amount * 100));
    }
    const hints = new Set<string>();
    for (const tx of visibleRows2) {
      if (selectedSet2.has(tx.id)) continue;
      if (needed.has(Math.round(tx.amount * 100))) hints.add(tx.id);
    }
    return hints.size > 0 ? hints : undefined;
  }, [visibleRows1, visibleRows2, selectedSet1, selectedSet2]);

  // Orange hints: sum-based matching in both directions
  // many-to-1: 2+ selected → find 1 tx matching combined sum (uses selectedSum)
  // 1-to-many: for EACH selected tx → find N txs of same amount that equal negated amount

  const counterpartSumHints1 = useMemo(() => {
    if (selectedSet2.size === 0) return undefined;
    const hints = new Set<string>();

    const groups = new Map<number, string[]>();
    for (const tx of visibleRows1) {
      if (selectedSet1.has(tx.id) || counterpartHints1?.has(tx.id)) continue;
      const key = Math.round(tx.amount * 100);
      const arr = groups.get(key) ?? [];
      arr.push(tx.id);
      groups.set(key, arr);
    }

    if (selectedSet2.size >= 2 && selectedSum !== 0) {
      const target = Math.round(selectedSum * 100);
      for (const [amountKey, ids] of groups) {
        if (ids.length >= 1 && amountKey === target) {
          hints.add(ids[0]);
        }
      }
    }

    const targets = new Set<number>();
    for (const tx of visibleRows2) {
      if (selectedSet2.has(tx.id)) targets.add(Math.round(-tx.amount * 100));
    }
    for (const [amountKey, ids] of groups) {
      if (ids.length < 2) continue;
      for (const t of targets) {
        for (let n = 2; n <= ids.length; n++) {
          if (amountKey * n === t) {
            for (let i = 0; i < n; i++) hints.add(ids[i]);
            break;
          }
        }
      }
    }

    return hints.size > 0 ? hints : undefined;
  }, [visibleRows1, visibleRows2, selectedSet1, selectedSet2, selectedSum, counterpartHints1]);

  const counterpartSumHints2 = useMemo(() => {
    if (selectedSet1.size === 0) return undefined;
    const hints = new Set<string>();

    const groups = new Map<number, string[]>();
    for (const tx of visibleRows2) {
      if (selectedSet2.has(tx.id) || counterpartHints2?.has(tx.id)) continue;
      const key = Math.round(tx.amount * 100);
      const arr = groups.get(key) ?? [];
      arr.push(tx.id);
      groups.set(key, arr);
    }

    if (selectedSet1.size >= 2 && selectedSum !== 0) {
      const target = Math.round(-selectedSum * 100);
      for (const [amountKey, ids] of groups) {
        if (ids.length >= 1 && amountKey === target) {
          hints.add(ids[0]);
        }
      }
    }

    const targets = new Set<number>();
    for (const tx of visibleRows1) {
      if (selectedSet1.has(tx.id)) targets.add(Math.round(-tx.amount * 100));
    }
    for (const [amountKey, ids] of groups) {
      if (ids.length < 2) continue;
      for (const t of targets) {
        for (let n = 2; n <= ids.length; n++) {
          if (amountKey * n === t) {
            for (let i = 0; i < n; i++) hints.add(ids[i]);
            break;
          }
        }
      }
    }

    return hints.size > 0 ? hints : undefined;
  }, [visibleRows1, visibleRows2, selectedSet1, selectedSet2, selectedSum, counterpartHints2]);

  const selectCounterparts1 = useCallback(() => {
    if (!counterpartHints1 && !counterpartSumHints1) return;
    setSelectedSet1((prev) => {
      const next = new Set(prev);
      counterpartHints1?.forEach((id) => next.add(id));
      counterpartSumHints1?.forEach((id) => next.add(id));
      return next;
    });
  }, [counterpartHints1, counterpartSumHints1]);

  const deselectCounterparts1 = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const selectCounterparts2 = useCallback(() => {
    if (!counterpartHints2 && !counterpartSumHints2) return;
    setSelectedSet2((prev) => {
      const next = new Set(prev);
      counterpartHints2?.forEach((id) => next.add(id));
      counterpartSumHints2?.forEach((id) => next.add(id));
      return next;
    });
  }, [counterpartHints2, counterpartSumHints2]);

  const deselectCounterparts2 = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const lastHintIds1 = useRef<Set<string>>(new Set());
  const lastHintIds2 = useRef<Set<string>>(new Set());

  if ((counterpartHints1 && counterpartHints1.size > 0) || (counterpartSumHints1 && counterpartSumHints1.size > 0)) {
    const ids = new Set<string>();
    counterpartHints1?.forEach((id) => ids.add(id));
    counterpartSumHints1?.forEach((id) => ids.add(id));
    lastHintIds1.current = ids;
  }
  if ((counterpartHints2 && counterpartHints2.size > 0) || (counterpartSumHints2 && counterpartSumHints2.size > 0)) {
    const ids = new Set<string>();
    counterpartHints2?.forEach((id) => ids.add(id));
    counterpartSumHints2?.forEach((id) => ids.add(id));
    lastHintIds2.current = ids;
  }

  const counterpartsSelected1 = useMemo(() => {
    if (lastHintIds1.current.size === 0) return false;
    for (const id of lastHintIds1.current) {
      if (!selectedSet1.has(id)) return false;
    }
    return true;
  }, [selectedSet1, counterpartHints1, counterpartSumHints1]);

  const counterpartsSelected2 = useMemo(() => {
    if (lastHintIds2.current.size === 0) return false;
    for (const id of lastHintIds2.current) {
      if (!selectedSet2.has(id)) return false;
    }
    return true;
  }, [selectedSet2, counterpartHints2, counterpartSumHints2]);

  // Focus mode: filter only the OPPOSITE panel from where the user started selecting.
  // primarySet=1 → user selects in Set 1 → filter Set 2 only.
  // primarySet=2 → user selects in Set 2 → filter Set 1 only.
  const focusFilter1 = useMemo(() => {
    if (!focusMode) return contextFilter1;
    if (focusPrimarySetRef.current !== 2) return contextFilter1;
    const hints = lastHintIds1.current;
    const hasHints = hints.size > 0 || (counterpartHints1 && counterpartHints1.size > 0) || (counterpartSumHints1 && counterpartSumHints1.size > 0);
    if (!hasHints) return contextFilter1;
    const ids = new Set<string>();
    hints.forEach((id) => ids.add(id));
    counterpartHints1?.forEach((id) => ids.add(id));
    counterpartSumHints1?.forEach((id) => ids.add(id));
    selectedSet1.forEach((id) => ids.add(id));
    return ids;
  }, [focusMode, counterpartHints1, counterpartSumHints1, selectedSet1, contextFilter1]);

  const focusFilter2 = useMemo(() => {
    if (!focusMode) return contextFilter2;
    if (focusPrimarySetRef.current !== 1) return contextFilter2;
    const hints = lastHintIds2.current;
    const hasHints = hints.size > 0 || (counterpartHints2 && counterpartHints2.size > 0) || (counterpartSumHints2 && counterpartSumHints2.size > 0);
    if (!hasHints) return contextFilter2;
    const ids = new Set<string>();
    hints.forEach((id) => ids.add(id));
    counterpartHints2?.forEach((id) => ids.add(id));
    counterpartSumHints2?.forEach((id) => ids.add(id));
    selectedSet2.forEach((id) => ids.add(id));
    return ids;
  }, [focusMode, counterpartHints2, counterpartSumHints2, selectedSet2, contextFilter2]);

  const totalHintCount = (counterpartHints1?.size ?? 0) + (counterpartSumHints1?.size ?? 0)
    + (counterpartHints2?.size ?? 0) + (counterpartSumHints2?.size ?? 0);

  useEffect(() => {
    if (focusMode && totalHintCount === 0) setFocusMode(false);
  }, [focusMode, totalHintCount]);

  // --- Row quick actions (hover toolbar) ---
  const [noteTarget, setNoteTarget] = useState<{
    txId: string;
    note: string | null;
    mentionedUserId: string | null;
  } | null>(null);
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [bulkNoteOpen, setBulkNoteOpen] = useState(false);
  const [bulkAttachOpen, setBulkAttachOpen] = useState(false);

  // Optimistic note/attachment updates
  const [localNotes, setLocalNotes] = useState<Map<string, string | null>>(new Map());
  const [localAttachments, setLocalAttachments] = useState<Set<string>>(new Set());

  const patchedRows1 = useMemo(() => {
    if (localNotes.size === 0 && localAttachments.size === 0) return visibleRows1;
    return visibleRows1.map((r) => ({
      ...r,
      notat: localNotes.has(r.id) ? localNotes.get(r.id) ?? null : r.notat,
      hasAttachment: localAttachments.has(r.id) || r.hasAttachment,
    }));
  }, [visibleRows1, localNotes, localAttachments]);

  const patchedRows2 = useMemo(() => {
    if (localNotes.size === 0 && localAttachments.size === 0) return visibleRows2;
    return visibleRows2.map((r) => ({
      ...r,
      notat: localNotes.has(r.id) ? localNotes.get(r.id) ?? null : r.notat,
      hasAttachment: localAttachments.has(r.id) || r.hasAttachment,
    }));
  }, [visibleRows2, localNotes, localAttachments]);

  const handleRowAction = useCallback((txId: string, action: string) => {
    if (action === "note") {
      if (selectedCount > 1) {
        setBulkNoteOpen(true);
      } else {
        const allRows = [...rows1, ...rows2];
        const tx = allRows.find((r) => r.id === txId);
        const currentNote = localNotes.has(txId) ? localNotes.get(txId) : tx?.notat;
        setNoteTarget({
          txId,
          note: currentNote ?? null,
          mentionedUserId: tx?.mentionedUserId ?? null,
        });
      }
    } else if (action === "attachment") {
      if (selectedCount > 1) {
        setBulkAttachOpen(true);
      } else {
        setAttachTarget(txId);
      }
    }
  }, [selectedCount, rows1, rows2, localNotes]);

  // --- Matching action ---
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchAnimatingIds, setMatchAnimatingIds] = useState<Set<string> | undefined>(undefined);
  const [matchAnimationPhase, setMatchAnimationPhase] = useState<"glow" | "exit" | "collapse">("glow");
  const [matchSuccessVisible, setMatchSuccessVisible] = useState(false);
  const [matchSuccessExiting, setMatchSuccessExiting] = useState(false);
  const matchCountRef = useRef(0);
  const closedBtnRef = useRef<HTMLButtonElement>(null);
  const [closedBtnPulse, setClosedBtnPulse] = useState(false);

  const handleMatch = useCallback(async () => {
    const ids1 = new Set(selectedSet1);
    const ids2 = new Set(selectedSet2);
    const allIds = [...Array.from(ids1), ...Array.from(ids2)];
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
        setMatching(false);
        return;
      }

      matchCountRef.current = allIds.length;
      const allAnimIds = new Set(allIds);
      setMatchAnimatingIds(allAnimIds);
      setMatchAnimationPhase("glow");
      setSmartPanelOpen(false);
      router.refresh();

      // Phase 1: glow (450ms CSS)
      await new Promise((r) => setTimeout(r, 480));

      // Phase 2: rows fly upward (550ms CSS)
      setMatchAnimationPhase("exit");
      await new Promise((r) => setTimeout(r, 550));

      // Phase 3: immediately settle — remove rows and reset state so user can keep working
      setLocallyMatchedIds(new Set());
      setMatchAnimatingIds(undefined);
      setMatchAnimationPhase("glow");
      setSelectedSet1(new Set());
      setSelectedSet2(new Set());
      focusPrimarySetRef.current = null;
      setContextFilter1(null);
      setContextFilter2(null);
      setSmartPanelActiveOption(null);
      setPendingCellAction(null);
      setSmartPanelResult(null);

      // Phase 4: non-blocking toast — runs on top of the live table
      setClosedBtnPulse(true);
      setMatchSuccessVisible(true);
      await new Promise((r) => setTimeout(r, 1200));
      setClosedBtnPulse(false);
      setMatchSuccessExiting(true);
      await new Promise((r) => setTimeout(r, 320));
      setMatchSuccessVisible(false);
      setMatchSuccessExiting(false);
    } catch {
      setMatchError("Nettverksfeil — prøv igjen.");
    } finally {
      setMatching(false);
    }
  }, [selectedSet1, selectedSet2, clientId, router]);

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

      if (!pendingCellAction) return;
      const { action, sourceSet } = pendingCellAction;
      const isAmount = action.field === "amount";
      const otherRows = sourceSet === 1 ? visibleRows2 : visibleRows1;
      const sameRows = sourceSet === 1 ? visibleRows1 : visibleRows2;

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
    [pendingCellAction, visibleRows1, visibleRows2, findMatchingIds, findCounterpartIds, handleMatch]
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
  const [balanceDialogSet, setBalanceDialogSet] = useState<1 | 2 | null>(null);
  const [editBalValue, setEditBalValue] = useState("");
  const [editBalDate, setEditBalDate] = useState(openingBalanceDate ?? "");
  const [savingBalance, setSavingBalance] = useState(false);

  const openBalanceDialog = useCallback((setNumber: 1 | 2) => {
    setEditBalValue(setNumber === 1 ? openingBalanceSet1 : openingBalanceSet2);
    setEditBalDate(openingBalanceDate ?? "");
    setBalanceDialogSet(setNumber);
  }, [openingBalanceSet1, openingBalanceSet2, openingBalanceDate]);

  const handleSaveBalance = useCallback(async () => {
    if (!balanceDialogSet) return;
    setSavingBalance(true);
    try {
      const body: Record<string, unknown> = {
        openingBalanceDate: editBalDate || null,
      };
      if (balanceDialogSet === 1) body.openingBalanceSet1 = editBalValue;
      else body.openingBalanceSet2 = editBalValue;

      const res = await fetch(`/api/clients/${clientId}/balance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setBalanceDialogSet(null);
        router.refresh();
      }
    } finally {
      setSavingBalance(false);
    }
  }, [clientId, balanceDialogSet, editBalValue, editBalDate, router]);

  // Live saldo = opening balance + sum of all unmatched transactions
  const liveBalance1 = useMemo(() => {
    return parseFloat(openingBalanceSet1 || "0") + balance1;
  }, [openingBalanceSet1, balance1]);

  const liveBalance2 = useMemo(() => {
    return parseFloat(openingBalanceSet2 || "0") + balance2;
  }, [openingBalanceSet2, balance2]);

  // --- Manual transaction dialog state ---
  const [manualTxOpen, setManualTxOpen] = useState(false);
  const [manualTxSet, setManualTxSet] = useState<1 | 2>(1);
  const [manualTxDate, setManualTxDate] = useState("");
  const [manualTxAmount, setManualTxAmount] = useState("");
  const [manualTxText, setManualTxText] = useState("");
  const [manualTxVoucher, setManualTxVoucher] = useState("");
  const [manualTxAffectBalance, setManualTxAffectBalance] = useState(false);
  const [manualTxSaving, setManualTxSaving] = useState(false);
  const [manualTxError, setManualTxError] = useState<string | null>(null);

  const openManualTxDialog = useCallback((setNumber: 1 | 2) => {
    setManualTxDate(new Date().toISOString().slice(0, 10));
    setManualTxAmount("");
    setManualTxText("");
    setManualTxVoucher("");
    setManualTxAffectBalance(false);
    setManualTxError(null);
    setManualTxSet(setNumber);
    setManualTxOpen(true);
  }, []);

  const handleCreateManualTx = useCallback(async () => {
    const amount = parseFloat(manualTxAmount.replace(",", "."));
    if (!manualTxDate || isNaN(amount) || amount === 0 || !manualTxText.trim()) {
      setManualTxError("Fyll ut dato, beløp (≠ 0) og tekst.");
      return;
    }
    setManualTxSaving(true);
    setManualTxError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setNumber: manualTxSet,
          date: manualTxDate,
          amount,
          text: manualTxText.trim(),
          voucher: manualTxVoucher.trim() || undefined,
          affectBalance: manualTxAffectBalance,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setManualTxError(data.error ?? "En feil oppstod.");
        return;
      }
      setManualTxOpen(false);
      router.refresh();
    } catch {
      setManualTxError("Nettverksfeil — prøv igjen.");
    } finally {
      setManualTxSaving(false);
    }
  }, [clientId, manualTxSet, manualTxDate, manualTxAmount, manualTxText, manualTxVoucher, manualTxAffectBalance, router]);

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

  const [fileManagerSet, setFileManagerSet] = useState<1 | 2 | null>(null);

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

      const content = await readFileAsText(file);

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


  // --- Keyboard shortcuts and arrow navigation ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "m" && !e.metaKey && !e.ctrlKey && canMatch && !matching) {
        e.preventDefault();
        handleMatch();
        return;
      }
      if (e.key === "Escape") {
        if (kbPanel !== null) { setKbPanel(null); return; }
        if (selectedCount > 0) { clearSelection(); return; }
        return;
      }

      // Arrow navigation
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const panel = kbPanel ?? 1;
        const maxRows = panel === 1 ? rowCount1Ref.current : rowCount2Ref.current;
        if (maxRows === 0) return;

        if (kbPanel === null) {
          setKbPanel(panel);
          setKbRowIndex(0);
          return;
        }

        setKbRowIndex((prev) => {
          if (e.key === "ArrowDown") return Math.min(prev + 1, maxRows - 1);
          return Math.max(prev - 1, 0);
        });
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const target = e.key === "ArrowLeft" ? 1 : 2;
        const maxRows = target === 1 ? rowCount1Ref.current : rowCount2Ref.current;
        if (maxRows === 0) return;
        setKbPanel(target);
        setKbRowIndex((prev) => Math.min(prev, maxRows - 1));
        return;
      }

      // Space = toggle selection on focused row
      if (e.key === " " && kbPanel !== null) {
        e.preventDefault();
        const ids = kbPanel === 1 ? visibleIds1Ref.current : visibleIds2Ref.current;
        const txId = ids[kbRowIndex];
        if (txId) toggleSelect(kbPanel, txId);
        return;
      }

      if (e.key === "Enter" && kbPanel !== null && canMatch && !matching) {
        e.preventDefault();
        handleMatch();
        return;
      }

      // F = toggle focus mode
      if (e.key === "f" && !e.metaKey && !e.ctrlKey && kbPanel !== null && totalHintCount > 0) {
        e.preventDefault();
        setFocusMode((f) => !f);
        return;
      }

      // C = select counterparts
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && kbPanel !== null && totalHintCount > 0) {
        e.preventDefault();
        selectCounterparts1();
        selectCounterparts2();
        return;
      }

      // X = clear all selection
      if (e.key === "x" && !e.metaKey && !e.ctrlKey && kbPanel !== null && selectedCount > 0) {
        e.preventDefault();
        clearSelection();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canMatch, matching, handleMatch, selectedCount, clearSelection, kbPanel, kbRowIndex, toggleSelect, totalHintCount, selectCounterparts1, selectCounterparts2, focusMode]);

  return (
    <>
      <div className="flex h-[calc(100dvh-4rem)] flex-col -m-2 md:-m-4 p-0">
       <div className="flex flex-1 flex-col min-h-0 rounded-md border overflow-hidden">
        <div className="flex items-center shrink-0">
          <div className="flex-1 min-w-0">
            <MatchingToolbar
              ref={closedBtnRef}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              closedBtnPulse={closedBtnPulse}
              dateFrom={globalDateFrom}
              dateTo={globalDateTo}
              onDateFromChange={setGlobalDateFrom}
              onDateToChange={setGlobalDateTo}
            />
          </div>
        </div>

        <ExportModal
          open={exportOpen && !exportGenerating}
          onOpenChange={setExportOpen}
          module="matching"
          title={viewMode === "open" ? "Eksporter åpne poster" : "Eksporter lukkede poster"}
          getPayload={() => ({
            matchingParams: {
              clientId,
              reportType: viewMode,
              dateFrom: globalDateFrom || undefined,
              dateTo: globalDateTo || undefined,
            },
          })}
          onGeneratingStart={() => setExportGenerating(true)}
          onGeneratingEnd={() => setExportGenerating(false)}
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
          <div className="relative flex flex-1 min-h-0 gap-px bg-border">
            <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-background overflow-hidden">
              <div className="flex items-center gap-2 border-b px-2 py-1 text-xs shrink-0" data-smart-info={`Overskrift for mengde 1 (${set1Label}). Viser antall åpne poster og løpende saldo inkludert inngående saldo.`}>
                <EditableAccountBadge
                  label={set1Label}
                  accountId={set1AccountId}
                  clientId={clientId}
                  variant="violet"
                  onRenamed={(name) => { setSet1Label(name); router.refresh(); }}
                />
                <span>
                  <span className="text-muted-foreground">Poster:</span>{" "}
                  <span className="font-medium">{visibleRows1.length}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Saldo:</span>{" "}
                  <span className="font-medium font-mono">
                    {liveBalance1.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </span>
                <button
                  className="text-muted-foreground hover:text-foreground ml-1"
                  onClick={() => openBalanceDialog(1)}
                  data-smart-info={`Rediger inngående saldo for ${set1Label}. Saldo brukes til å beregne løpende balanse.`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
              {patchedRows1.length > 0 ? (
                <TransactionPanel
                  transactions={patchedRows1}
                  setLabel={set1Label}
                  onImportFile={(file) => openImportDialog(file, 1)}
                  onSelect={(id) => toggleSelect(1, id)}
                  onSelectAll={(ids) => setSelectedSet1(new Set(ids))}
                  selectedIds={selectedSet1}
                  counterpartHintIds={counterpartHints1}
                  counterpartSumHintIds={counterpartSumHints1}
                  matchAnimatingIds={matchAnimatingIds}
                  matchAnimationPhase={matchAnimationPhase}
                  onCellContextMenu={(a, pos) => handleCellContextMenu(1, a, pos)}
                  contextFilterIds={focusFilter1}
                  onRowAction={handleRowAction}
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode((f) => !f)}
                  hintCount={totalHintCount}
                  onMatch={handleMatch}
                  canMatch={canMatch}
                  onSelectCounterparts={selectCounterparts2}
                  onDeselectCounterparts={deselectCounterparts2}
                  counterpartsSelected={counterpartsSelected2}
                  onClearSelection={clearSelection}
                  hasSelection={selectedCount > 0}
                  globalDateFrom={globalDateFrom}
                  globalDateTo={globalDateTo}
                  focusedRowIndex={kbPanel === 1 ? kbRowIndex : null}
                  panelActive={kbPanel === 1}
                  onRequestRowCount={handleRowCount1}
                  visibleIdsRef={visibleIds1Ref}
                  onDeactivateKeyboard={() => setKbPanel(null)}
                  highlightTxId={highlightTxId}
                  onFileManager={() => setFileManagerSet(1)}
                  onCreateTransaction={() => openManualTxDialog(1)}
                />
              ) : (
                <SetDropzone
                  label="Dra hovedboksfil hit"
                  onFile={(file) => openImportDialog(file, 1)}
                />
              )}
            </div>
            <div className="flex flex-1 flex-col min-w-0 min-h-0 bg-background overflow-hidden">
              <div className="flex items-center justify-between border-b px-2 py-1 shrink-0" data-smart-info={`Overskrift for mengde 2 (${set2Label}). Viser antall åpne poster og løpende saldo inkludert inngående saldo.`}>
                <EditableAccountBadge
                  label={set2Label}
                  accountId={set2AccountId}
                  clientId={clientId}
                  variant="brand"
                  onRenamed={(name) => { setSet2Label(name); router.refresh(); }}
                />
                <div className="flex items-center gap-2 text-xs">
                  <span>
                    <span className="text-muted-foreground">Poster:</span>{" "}
                    <span className="font-medium">{visibleRows2.length}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Saldo:</span>{" "}
                    <span className="font-medium font-mono">
                      {liveBalance2.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => openBalanceDialog(2)}
                    data-smart-info={`Rediger inngående saldo for ${set2Label}. Saldo brukes til å beregne løpende balanse.`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {patchedRows2.length > 0 ? (
                <TransactionPanel
                  transactions={patchedRows2}
                  setLabel={set2Label}
                  onImportFile={(file) => openImportDialog(file, 2)}
                  onSelect={(id) => toggleSelect(2, id)}
                  onSelectAll={(ids) => setSelectedSet2(new Set(ids))}
                  selectedIds={selectedSet2}
                  counterpartHintIds={counterpartHints2}
                  counterpartSumHintIds={counterpartSumHints2}
                  matchAnimatingIds={matchAnimatingIds}
                  matchAnimationPhase={matchAnimationPhase}
                  onCellContextMenu={(a, pos) => handleCellContextMenu(2, a, pos)}
                  contextFilterIds={focusFilter2}
                  onRowAction={handleRowAction}
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode((f) => !f)}
                  hintCount={totalHintCount}
                  onMatch={handleMatch}
                  canMatch={canMatch}
                  onSelectCounterparts={selectCounterparts1}
                  onDeselectCounterparts={deselectCounterparts1}
                  counterpartsSelected={counterpartsSelected1}
                  onClearSelection={clearSelection}
                  hasSelection={selectedCount > 0}
                  globalDateFrom={globalDateFrom}
                  globalDateTo={globalDateTo}
                  focusedRowIndex={kbPanel === 2 ? kbRowIndex : null}
                  panelActive={kbPanel === 2}
                  onRequestRowCount={handleRowCount2}
                  visibleIdsRef={visibleIds2Ref}
                  onDeactivateKeyboard={() => setKbPanel(null)}
                  highlightTxId={highlightTxId}
                  onFileManager={() => setFileManagerSet(2)}
                  onCreateTransaction={() => openManualTxDialog(2)}
                />
              ) : (
                <SetDropzone
                  label="Dra bankfil hit"
                  onFile={(file) => openImportDialog(file, 2)}
                />
              )}
            </div>

            {matchSuccessVisible && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className={cn(
                  "match-success-overlay flex flex-col items-center gap-2 rounded-xl bg-background/95 border shadow-lg px-6 py-4 backdrop-blur-sm",
                  matchSuccessExiting && "exiting"
                )}>
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-sm font-medium">
                    {matchCountRef.current} poster matchet
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status bar — always visible, changes based on selection state */}
          <div
            className={cn(
              "flex items-center gap-2 border-t px-2 text-sm shrink-0 h-9 transition-colors",
              selectedCount > 0
                ? "bg-blue-50 dark:bg-blue-950/30"
                : "bg-muted/30"
            )}
            data-smart-info="Statuslinjen viser valgte poster og matchinformasjon. Når poster er markert vises sum og match-knapp. Summen av markerte poster må være 0 for at matching er mulig."
          >
            {selectedCount > 0 ? (
              <>
                <span className="flex items-center gap-1.5 font-medium">
                  {selectedSet1.size > 0 && (
                    <span className="flex items-center gap-1">{selectedSet1.size} fra <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-px text-[11px] font-semibold text-violet-700 dark:text-violet-300">{set1Label}</span></span>
                  )}
                  {selectedSet1.size > 0 && selectedSet2.size > 0 && <span>+</span>}
                  {selectedSet2.size > 0 && (
                    <span className="flex items-center gap-1">{selectedSet2.size} fra <span className="inline-flex items-center rounded-full bg-brand-subtle px-2 py-px text-[11px] font-semibold text-brand-emphasis">{set2Label}</span></span>
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
                <div className="flex items-center gap-2 ml-auto shrink-0">
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
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
                    onClick={() => {
                      setExportOpen(true);
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Eksporter
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className="text-muted-foreground min-w-0 truncate">
                  {visibleRows1.length === 0 && visibleRows2.length === 0
                    ? "Importer filer i begge mengder for å starte matching"
                    : visibleRows1.length === 0 || visibleRows2.length === 0
                      ? "Importer fil i begge mengder for å starte matching"
                      : "Marker poster ved å klikke på en rad · Match med M eller Enter"}
                </span>
                <div className="flex items-center gap-2 ml-auto shrink-0">
                  {(visibleRows1.length > 0 || visibleRows2.length > 0) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {matchedGroups.length > 0 && (
                        <span>
                          <span className="font-medium text-foreground">{matchedGroups.length}</span> matchgrupper
                        </span>
                      )}
                      <span>
                        <span className="font-medium text-foreground">{visibleRows1.length + visibleRows2.length}</span> åpne poster
                      </span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
                    onClick={() => setExportOpen(true)}
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Eksporter
                  </Button>
                </div>
              </>
            )}
          </div>
          </>
        ) : (
          <>
            <MatchedGroupsView
              groups={matchedGroups}
              onUnmatch={handleUnmatch}
              unmatchingId={unmatchingId}
              set1Label={set1Label}
              set2Label={set2Label}
            />
            <div className="flex items-center gap-2 border-t px-2 text-sm shrink-0 h-9 bg-muted/30">
              <div className="flex-1 min-w-0" aria-hidden />
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 shrink-0 active:scale-[0.97] transition-transform"
                onClick={() => setExportOpen(true)}
              >
                <FileDown className="h-3.5 w-3.5" />
                Eksporter
              </Button>
            </div>
          </>
        )}
       </div>
      </div>

      {/* Export generating: animation while file is being created (after "Last ned" in modal) */}
      {exportGenerating && (
        <ExportIntroOverlay
          viewMode={viewMode}
          openCount={visibleRows1.length + visibleRows2.length}
          matchedCount={matchedGroups.length}
          mode="generating"
          onComplete={() => setExportGenerating(false)}
          onSkip={() => setExportGenerating(false)}
        />
      )}

      {/* Opening balance dialog — per set */}
      <Dialog open={balanceDialogSet !== null} onOpenChange={(open) => { if (!open) setBalanceDialogSet(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {balanceDialogSet === 1 ? set1Label : set2Label} — inngående saldo
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bal-value">Inngående saldo</Label>
              <FormattedAmountInput
                id="bal-value"
                value={editBalValue}
                onChange={setEditBalValue}
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
              <Button variant="outline" onClick={() => setBalanceDialogSet(null)}>
                Avbryt
              </Button>
              <Button onClick={handleSaveBalance} disabled={savingBalance}>
                {savingBalance ? "Lagrer…" : "Lagre"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual transaction dialog */}
      <Dialog open={manualTxOpen} onOpenChange={setManualTxOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Opprett korreksjonspost — {manualTxSet === 1 ? set1Label : set2Label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mtx-date">Dato *</Label>
              <Input
                id="mtx-date"
                type="date"
                value={manualTxDate}
                onChange={(e) => setManualTxDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtx-amount">Beløp *</Label>
              <FormattedAmountInput
                id="mtx-amount"
                value={manualTxAmount}
                onChange={setManualTxAmount}
              />
              <p className="text-xs text-muted-foreground">Bruk negativt fortegn for utgifter</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtx-text">Tekst *</Label>
              <Textarea
                id="mtx-text"
                value={manualTxText}
                onChange={(e) => setManualTxText(e.target.value)}
                placeholder="Korreksjonspost..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mtx-voucher">Bilag</Label>
              <Input
                id="mtx-voucher"
                value={manualTxVoucher}
                onChange={(e) => setManualTxVoucher(e.target.value)}
                placeholder="Valgfritt"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="mtx-balance"
                type="checkbox"
                className="rounded"
                checked={manualTxAffectBalance}
                onChange={(e) => setManualTxAffectBalance(e.target.checked)}
              />
              <Label htmlFor="mtx-balance" className="cursor-pointer text-sm font-normal">
                Juster inngående saldo med beløpet
              </Label>
            </div>
            {manualTxError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {manualTxError}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setManualTxOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={handleCreateManualTx} disabled={manualTxSaving}>
                {manualTxSaving ? "Oppretter…" : "Opprett"}
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
        open={fileManagerSet !== null}
        onOpenChange={(open) => { if (!open) setFileManagerSet(null); }}
        clientId={clientId}
        set1Label={set1Label}
        set2Label={set2Label}
        setNumber={fileManagerSet ?? undefined}
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
                    <>
                      <p className="text-xs text-muted-foreground">
                        {smartPanelResult.matchCount1 + smartPanelResult.matchCount2} poster markert og filtrert.
                      </p>
                      {canMatch && (
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                          disabled={matching}
                          onClick={() => handleMatch()}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {matching ? "Matcher…" : "Match"}
                        </button>
                      )}
                      {!canMatch && selectedCount >= 2 && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                          Differanse: {selectedSum.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} — må gå i 0 for å matche.
                        </div>
                      )}
                    </>
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

      {/* Note dialog for single transaction */}
      {noteTarget && (
        <NotePopover
          open={!!noteTarget}
          onOpenChange={(open) => { if (!open) setNoteTarget(null); }}
          clientId={clientId}
          transactionId={noteTarget.txId}
          existingNote={noteTarget.note}
          existingMentionedUserId={noteTarget.mentionedUserId}
          onSaved={(text) => {
            setLocalNotes((prev) => new Map(prev).set(noteTarget.txId, text));
          }}
        />
      )}

      {/* Note dialog for multi-select */}
      <NoteDialog
        open={bulkNoteOpen}
        onOpenChange={setBulkNoteOpen}
        clientId={clientId}
        transactionIds={[...Array.from(selectedSet1), ...Array.from(selectedSet2)]}
        onSaved={(text) => {
          const allIds = [...Array.from(selectedSet1), ...Array.from(selectedSet2)];
          setLocalNotes((prev) => {
            const next = new Map(prev);
            for (const id of allIds) next.set(id, text);
            return next;
          });
        }}
      />

      {/* Attachment dialog for single transaction */}
      {attachTarget && (
        <AttachmentPopover
          open={!!attachTarget}
          onOpenChange={(open) => { if (!open) setAttachTarget(null); }}
          clientId={clientId}
          transactionId={attachTarget}
          onAttachmentsChanged={(has) => {
            if (has) {
              setLocalAttachments((prev) => new Set(prev).add(attachTarget));
            }
          }}
        />
      )}

      {/* Attachment dialog for multi-select */}
      <AttachmentDialog
        open={bulkAttachOpen}
        onOpenChange={setBulkAttachOpen}
        clientId={clientId}
        transactionIds={[...Array.from(selectedSet1), ...Array.from(selectedSet2)]}
        onUploaded={() => {
          const allIds = [...Array.from(selectedSet1), ...Array.from(selectedSet2)];
          setLocalAttachments((prev) => {
            const next = new Set(prev);
            for (const id of allIds) next.add(id);
            return next;
          });
        }}
      />
    </>
  );
}
