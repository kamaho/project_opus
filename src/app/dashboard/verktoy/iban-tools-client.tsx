"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  Upload,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  normalizeToIBAN,
  normalizeBBAN,
  recognizeBank,
  formatBBAN,
  formatIBAN,
  type IBANResult,
} from "@/lib/onboarding/iban";
import {
  finnBestKolonne,
  finnEkstraKolonner,
  formaterBelop,
  formaterDato,
  detekterSep,
  splittLinje,
  konverterBatch,
  byggTsv,
  byggCsv,
  lastNedFil,
  kopierTilUtklipp,
  type BatchRow,
  type EkstraKolonner,
} from "@/lib/onboarding/batch-converter";

// ───────────────────────────────────────────────
// Shared result table
// ───────────────────────────────────────────────

function ResultTable({
  rows,
  ekstra,
  showIBAN,
}: {
  rows: BatchRow[];
  ekstra: EkstraKolonner;
  showIBAN: boolean;
}) {
  const okCount = rows.filter((r) => r.ibanResult.ok).length;
  const errCount = rows.length - okCount;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{rows.length}</span> rader —{" "}
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{okCount} OK</span>
        {errCount > 0 && (
          <span className="text-destructive font-medium ml-2">{errCount} feil</span>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b">
              <tr>
                <th className="p-2 text-xs font-medium text-muted-foreground text-left w-10">#</th>
                <th className="p-2 text-xs font-medium text-muted-foreground text-left">BBAN</th>
                <th className="p-2 text-xs font-medium text-muted-foreground text-left">
                  {showIBAN ? "IBAN" : "Kontonummer"}
                </th>
                {ekstra.saldoKolIdx !== null && (
                  <th className="p-2 text-xs font-medium text-muted-foreground text-right">Saldo</th>
                )}
                {ekstra.datoKolIdx !== null && (
                  <th className="p-2 text-xs font-medium text-muted-foreground text-left">Dato</th>
                )}
                <th className="p-2 text-xs font-medium text-muted-foreground text-left">Bank</th>
                <th className="p-2 text-xs font-medium text-muted-foreground text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-border/50",
                    !row.ibanResult.ok && "bg-red-50/60 dark:bg-red-950/20"
                  )}
                >
                  <td className="p-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="p-2 text-xs font-mono">
                    {row.ibanResult.ok ? row.ibanResult.bbanFormatted : row.digits || row.original}
                  </td>
                  <td className="p-2 text-xs font-mono">
                    {showIBAN
                      ? (row.ibanResult.ok ? row.ibanResult.iban : "–")
                      : (row.ibanResult.ok ? row.ibanResult.bbanFormatted : row.digits || "–")}
                  </td>
                  {ekstra.saldoKolIdx !== null && (
                    <td className="p-2 text-xs font-mono tabular-nums text-right">
                      {row.saldo ? formaterBelop(row.saldo) : "–"}
                    </td>
                  )}
                  {ekstra.datoKolIdx !== null && (
                    <td className="p-2 text-xs">{row.dato ? formaterDato(row.dato) : "–"}</td>
                  )}
                  <td className="p-2 text-xs text-muted-foreground">
                    {row.ibanResult.ok ? (row.ibanResult.bank || "Ukjent") : "–"}
                  </td>
                  <td className="p-2">
                    {row.ibanResult.ok ? (
                      <span className="inline-flex items-center rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        {row.ibanResult.error || "Feil"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────
// Tab: Enkelt nummer
// ───────────────────────────────────────────────

function EnkeltTab() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<IBANResult | null>(null);
  const [copied, setCopied] = useState(false);

  const digits = input.replace(/\D/g, "").substring(0, 11);
  const bank = digits.length >= 4 ? recognizeBank(digits) : "";

  const formatInput = (raw: string) => {
    const d = raw.replace(/\D/g, "").substring(0, 11);
    let f = "";
    if (d.length > 0) f += d.substring(0, Math.min(4, d.length));
    if (d.length > 4) f += "." + d.substring(4, Math.min(6, d.length));
    if (d.length > 6) f += "." + d.substring(6, 11);
    setInput(f);
    setResult(null);
    setCopied(false);
  };

  const handleConvert = () => {
    const res = normalizeToIBAN(digits);
    setResult(res);
  };

  const handleCopy = async () => {
    if (!result?.ok) return;
    const ok = await kopierTilUtklipp(result.iban);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-md space-y-4">
      <div className="space-y-1.5">
        <Label>Kontonummer (BBAN)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="xxxx.xx.xxxxx"
            value={input}
            onChange={(e) => formatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleConvert(); }}
            className="font-mono"
          />
          <Button onClick={handleConvert} disabled={digits.length === 0}>
            Konverter
          </Button>
        </div>
        {bank && (
          <p className="text-xs text-muted-foreground">
            Gjenkjent bank: <span className="font-medium text-foreground">{bank}</span>
          </p>
        )}
      </div>

      {result && !result.ok && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{result.error}</p>
        </div>
      )}

      {result?.ok && (
        <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4 space-y-2">
          <p className="text-xs text-muted-foreground">IBAN</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-mono font-semibold tracking-wide">{formatIBAN(result.iban)}</p>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
              {copied ? <><Check className="h-3 w-3" /> Kopiert</> : <><ClipboardCopy className="h-3 w-3" /> Kopier</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            BBAN: {result.bbanFormatted} — {result.bank || "Ukjent bank"}
          </p>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// Tab: Excel
// ───────────────────────────────────────────────

function ExcelTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<unknown[][]>([]);
  const [bestCol, setBestCol] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [ekstra, setEkstra] = useState<EkstraKolonner>({ saldoKolIdx: null, datoKolIdx: null });
  const [showIBAN, setShowIBAN] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const processData = useCallback((allRows: unknown[][]) => {
    if (!allRows.length) { setError("Filen er tom."); return; }
    const h = (allRows[0] as unknown[]).map(String);
    const d = allRows.slice(1).filter((r) => (r as unknown[]).some((c) => String(c ?? "").trim() !== ""));
    if (!d.length) { setError("Ingen datarader funnet."); return; }

    const numCols = h.length;
    const best = finnBestKolonne(d, numCols);
    setHeaders(h);
    setData(d);
    setBestCol(best);
    setSelectedCol(best);

    const ek = finnEkstraKolonner(d, numCols, best);
    setEkstra(ek);
    setRows(konverterBatch(d, best, ek));
    setError(null);
  }, []);

  const handleFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(e.target!.result as ArrayBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        processData(allRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lese filen.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [processData]);

  const handleColChange = useCallback((val: string) => {
    const col = parseInt(val, 10);
    setSelectedCol(col);
    const ek = finnEkstraKolonner(data, headers.length, col);
    setEkstra(ek);
    setRows(konverterBatch(data, col, ek));
  }, [data, headers]);

  const handleCopy = useCallback(() => {
    const h = ["BBAN", "IBAN", ...(ekstra.saldoKolIdx !== null ? ["Saldo"] : []), ...(ekstra.datoKolIdx !== null ? ["Dato"] : []), "Bank", "Status"];
    const d = rows.map((r) => [
      r.ibanResult.ok ? r.ibanResult.bbanFormatted : r.digits || "",
      r.ibanResult.ok ? r.ibanResult.iban : "",
      ...(ekstra.saldoKolIdx !== null ? [r.saldo ? formaterBelop(r.saldo) : ""] : []),
      ...(ekstra.datoKolIdx !== null ? [r.dato ? formaterDato(r.dato) : ""] : []),
      r.ibanResult.ok ? r.ibanResult.bank : "",
      r.ibanResult.ok ? "OK" : r.ibanResult.error || "Feil",
    ]);
    kopierTilUtklipp(byggTsv(h, d)).then((ok) => { if (ok) toast.success("Tabell kopiert"); });
  }, [rows, ekstra]);

  const handleDownload = useCallback(() => {
    const h = ["BBAN", "IBAN", ...(ekstra.saldoKolIdx !== null ? ["Saldo"] : []), ...(ekstra.datoKolIdx !== null ? ["Dato"] : []), "Bank", "Status"];
    const d = rows.map((r) => [
      r.ibanResult.ok ? r.ibanResult.bbanFormatted : r.digits || "",
      r.ibanResult.ok ? r.ibanResult.iban : "",
      ...(ekstra.saldoKolIdx !== null ? [r.saldo ? formaterBelop(r.saldo) : ""] : []),
      ...(ekstra.datoKolIdx !== null ? [r.dato ? formaterDato(r.dato) : ""] : []),
      r.ibanResult.ok ? r.ibanResult.bank : "",
      r.ibanResult.ok ? "OK" : r.ibanResult.error || "Feil",
    ]);
    lastNedFil(byggCsv(h, d), "iban-konvertering.csv");
  }, [rows, ekstra]);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Dra og slipp Excel-fil hit</p>
        <p className="text-xs text-muted-foreground mt-1">.xlsx eller .xls</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {headers.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Kolonne:</Label>
                  <Select value={String(selectedCol)} onValueChange={handleColChange}>
                    <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}{i === bestCol ? " (gjenkjent)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                <button type="button" className={cn("rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", !showIBAN ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setShowIBAN(false)}>BBAN</button>
                <button type="button" className={cn("rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", showIBAN ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setShowIBAN(true)}>IBAN</button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
                <ClipboardCopy className="h-3 w-3" /> Kopier
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleDownload}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          </div>
          <ResultTable rows={rows} ekstra={ekstra} showIBAN={showIBAN} />
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// Tab: CSV / Lim inn
// ───────────────────────────────────────────────

function CsvTab() {
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<unknown[][]>([]);
  const [bestCol, setBestCol] = useState(0);
  const [selectedCol, setSelectedCol] = useState(0);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [ekstra, setEkstra] = useState<EkstraKolonner>({ saldoKolIdx: null, datoKolIdx: null });
  const [showIBAN, setShowIBAN] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleParse = useCallback(() => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) { setError("Lim inn data først."); return; }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const sep = detekterSep(lines[0]);
    const allRows = lines.map((l) => splittLinje(l, sep));
    const numCols = Math.max(...allRows.map((r) => r.length));

    const firstRow = allRows[0];
    const hasHeader =
      numCols > 1 &&
      !firstRow.some((c) => {
        const d = normalizeBBAN(c);
        return d.length === 11;
      });

    let h: string[];
    let d: unknown[][];
    if (hasHeader) {
      h = firstRow.map(String);
      d = allRows.slice(1);
    } else {
      h = allRows[0].map((_, i) => `Kolonne ${i + 1}`);
      d = allRows;
    }

    d = d.filter((r) => (r as string[]).some((c) => c.trim() !== ""));
    if (!d.length) { setError("Ingen datarader funnet."); return; }

    const best = finnBestKolonne(d, numCols);
    setHeaders(h);
    setData(d);
    setBestCol(best);
    setSelectedCol(best);

    const ek = finnEkstraKolonner(d, numCols, best);
    setEkstra(ek);
    setRows(konverterBatch(d, best, ek));
  }, [text]);

  const handleColChange = useCallback(
    (val: string) => {
      const col = parseInt(val, 10);
      setSelectedCol(col);
      const ek = finnEkstraKolonner(data, headers.length, col);
      setEkstra(ek);
      setRows(konverterBatch(data, col, ek));
    },
    [data, headers]
  );

  const handleCopy = useCallback(() => {
    const h = ["BBAN", "IBAN", ...(ekstra.saldoKolIdx !== null ? ["Saldo"] : []), ...(ekstra.datoKolIdx !== null ? ["Dato"] : []), "Bank", "Status"];
    const d = rows.map((r) => [
      r.ibanResult.ok ? r.ibanResult.bbanFormatted : r.digits || "",
      r.ibanResult.ok ? r.ibanResult.iban : "",
      ...(ekstra.saldoKolIdx !== null ? [r.saldo ? formaterBelop(r.saldo) : ""] : []),
      ...(ekstra.datoKolIdx !== null ? [r.dato ? formaterDato(r.dato) : ""] : []),
      r.ibanResult.ok ? r.ibanResult.bank : "",
      r.ibanResult.ok ? "OK" : r.ibanResult.error || "Feil",
    ]);
    kopierTilUtklipp(byggTsv(h, d)).then((ok) => { if (ok) toast.success("Tabell kopiert"); });
  }, [rows, ekstra]);

  const handleDownload = useCallback(() => {
    const h = ["BBAN", "IBAN", ...(ekstra.saldoKolIdx !== null ? ["Saldo"] : []), ...(ekstra.datoKolIdx !== null ? ["Dato"] : []), "Bank", "Status"];
    const d = rows.map((r) => [
      r.ibanResult.ok ? r.ibanResult.bbanFormatted : r.digits || "",
      r.ibanResult.ok ? r.ibanResult.iban : "",
      ...(ekstra.saldoKolIdx !== null ? [r.saldo ? formaterBelop(r.saldo) : ""] : []),
      ...(ekstra.datoKolIdx !== null ? [r.dato ? formaterDato(r.dato) : ""] : []),
      r.ibanResult.ok ? r.ibanResult.bank : "",
      r.ibanResult.ok ? "OK" : r.ibanResult.error || "Feil",
    ]);
    lastNedFil(byggCsv(h, d), "iban-csv-konvertering.csv");
  }, [rows, ekstra]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Lim inn data (CSV, TSV, eller semikolon-separert)</Label>
        <Textarea
          placeholder="Lim inn kontonumre her...&#10;1234.56.78901&#10;9876.54.32109"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="font-mono text-xs"
        />
      </div>

      <Button onClick={handleParse} disabled={!text.trim()}>Konverter</Button>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {headers.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Kolonne:</Label>
                  <Select value={String(selectedCol)} onValueChange={handleColChange}>
                    <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {h}{i === bestCol ? " (gjenkjent)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                <button type="button" className={cn("rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", !showIBAN ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setShowIBAN(false)}>BBAN</button>
                <button type="button" className={cn("rounded-sm px-2.5 py-1 text-xs font-medium transition-colors", showIBAN ? "bg-background shadow-sm" : "text-muted-foreground")} onClick={() => setShowIBAN(true)}>IBAN</button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
                <ClipboardCopy className="h-3 w-3" /> Kopier
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleDownload}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          </div>
          <ResultTable rows={rows} ekstra={ekstra} showIBAN={showIBAN} />
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────
// Main page
// ───────────────────────────────────────────────

export function IbanToolsClient() {
  return (
    <div className="space-y-6 p-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">IBAN-konvertering</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Konverter norske kontonummer (BBAN) til IBAN-format med bankgjenkjenning og validering.
        </p>
      </div>

      <Tabs defaultValue="enkelt">
        <TabsList>
          <TabsTrigger value="enkelt">Enkelt nummer</TabsTrigger>
          <TabsTrigger value="excel">Excel</TabsTrigger>
          <TabsTrigger value="csv">CSV / Lim inn</TabsTrigger>
        </TabsList>

        <TabsContent value="enkelt" className="mt-4">
          <EnkeltTab />
        </TabsContent>

        <TabsContent value="excel" className="mt-4">
          <ExcelTab />
        </TabsContent>

        <TabsContent value="csv" className="mt-4">
          <CsvTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
