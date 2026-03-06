"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  X,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { validateImportFile } from "@/lib/upload-validation";

interface FileRouting {
  fileRef: string;
  fileName: string;
  detectedAccount: string | null;
  detectedSource: string | null;
  clientId: string | null;
  clientName: string | null;
  companyName: string | null;
  setNumber: 1 | 2 | null;
  status: "matched" | "no_account" | "no_client" | "ambiguous" | "duplicate";
  duplicateInfo?: { importedAt: string; clientName: string };
}

interface SignatureGroup {
  signature: string;
  headers: string[];
  fileRefs: string[];
  fileCount: number;
}

interface JobResult {
  fileName: string;
  clientId: string;
  status: string;
  imported?: number;
  error?: string;
}

interface BulkJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  results: JobResult[];
}

type Step = "upload" | "routing" | "committing" | "done";

interface AvailableClient {
  id: string;
  name: string;
  companyName: string;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableClients: AvailableClient[];
  onComplete?: () => void;
}

export function BulkImportDialog({
  open,
  onOpenChange,
  availableClients,
  onComplete,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [routing, setRouting] = useState<FileRouting[]>([]);
  const [routingOverrides, setRoutingOverrides] = useState<Map<string, { clientId: string; setNumber: 1 | 2 }>>(new Map());
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [results, setResults] = useState<JobResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setFiles([]);
      setRouting([]);
      setRoutingOverrides(new Map());
      setJobId(null);
      setResults([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      const result = validateImportFile(f);
      if (!result.valid) {
        toast.error(`${f.name}: ${result.error}`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const dropped = Array.from(e.dataTransfer.files);
      addFiles(dropped);
    },
    [addFiles]
  );

  const handleUploadAndRoute = useCallback(async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const f of files) formData.append("files", f);

      const res = await fetch("/api/import/bulk", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Opplasting feilet");
        return;
      }

      const data = await res.json();
      setRouting(data.files ?? []);
      setStep("routing");
    } catch {
      setError("En uventet feil oppstod. Prøv igjen.");
    } finally {
      setUploading(false);
    }
  }, [files]);

  const getEffectiveRouting = useCallback(
    (fr: FileRouting) => {
      const override = routingOverrides.get(fr.fileRef);
      if (override) {
        const client = availableClients.find((c) => c.id === override.clientId);
        return {
          ...fr,
          clientId: override.clientId,
          clientName: client?.name ?? fr.clientName,
          setNumber: override.setNumber,
          status: "matched" as const,
        };
      }
      return fr;
    },
    [routingOverrides, availableClients]
  );

  const importableFiles = routing
    .map(getEffectiveRouting)
    .filter((fr) => fr.status === "matched" && fr.clientId && fr.setNumber);

  const handleCommit = useCallback(async () => {
    if (importableFiles.length === 0) return;
    setStep("committing");
    setError(null);

    try {
      const fileImports = importableFiles.map((fr) => ({
        fileRef: fr.fileRef,
        fileName: fr.fileName,
        clientId: fr.clientId!,
        setNumber: fr.setNumber!,
        parserType: detectParserType(fr.fileName),
      }));

      const res = await fetch("/api/import/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileImports }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Commit feilet");
        setStep("routing");
        return;
      }

      const data = await res.json();
      setJobId(data.jobId);
      setJobTotal(data.total);
      setJobProgress(0);

      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/bulk-jobs?jobId=${data.jobId}`);
          if (!pollRes.ok) return;
          const job: BulkJob = await pollRes.json();
          setJobProgress(job.completed);
          setResults(job.results ?? []);

          if (job.status === "completed" || job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setStep("done");
            onComplete?.();
          }
        } catch {
          // retry on next poll
        }
      }, 1500);
    } catch {
      setError("En uventet feil oppstod. Prøv igjen.");
      setStep("routing");
    }
  }, [importableFiles, onComplete]);

  const isLocked = step === "committing";
  const matchedCount = routing.filter((fr) => getEffectiveRouting(fr).status === "matched").length;
  const duplicateCount = routing.filter((fr) => fr.status === "duplicate").length;
  const unmatchedCount = routing.length - matchedCount - duplicateCount;
  const totalImported = results.reduce((s, r) => s + (r.imported ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={isLocked ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={isLocked ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isLocked ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Masseimport av filer
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 flex-1 min-h-0">
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
                drag
                  ? "border-foreground/50 bg-muted/50"
                  : "border-muted-foreground/25 hover:border-muted-foreground/40"
              )}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Dra filer hit eller klikk for å velge</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CSV, Excel, CAMT/XML — maks 50 filer
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".csv,.txt,.xlsx,.xls,.xml,.camt"
                className="hidden"
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  addFiles(selected);
                  e.target.value = "";
                }}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {files.length} fil{files.length !== 1 && "er"} valgt
                </p>
                <div className="rounded-md border max-h-40 overflow-y-auto divide-y">
                  {files.map((f, i) => (
                    <div
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleUploadAndRoute}
                disabled={files.length === 0 || uploading}
              >
                {uploading ? "Laster opp…" : `Last opp ${files.length} fil${files.length !== 1 ? "er" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {step === "routing" && (
          <div className="space-y-4 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-1.5 shrink-0">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Totalt filer</span>
                <span className="font-medium tabular-nums">{routing.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Matchet</span>
                <span className="font-medium tabular-nums text-emerald-600">{matchedCount}</span>
              </div>
              {duplicateCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duplikater</span>
                  <span className="font-medium tabular-nums text-amber-600">{duplicateCount}</span>
                </div>
              )}
              {unmatchedCount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ikke matchet</span>
                  <span className="font-medium tabular-nums text-destructive">{unmatchedCount}</span>
                </div>
              )}
            </div>

            <div className="rounded-md border overflow-hidden flex-1 min-h-0 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Fil</th>
                    <th className="p-2 text-left font-medium">Konto</th>
                    <th className="p-2 text-left font-medium">Klient</th>
                    <th className="p-2 text-center font-medium">Set</th>
                    <th className="p-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {routing.map((fr) => {
                    const effective = getEffectiveRouting(fr);
                    const override = routingOverrides.get(fr.fileRef);
                    return (
                      <tr key={fr.fileRef} className={cn(
                        "border-b last:border-0",
                        fr.status === "duplicate" && "bg-amber-50/50 dark:bg-amber-950/20",
                        (fr.status === "no_account" || fr.status === "no_client" || fr.status === "ambiguous") && !override && "bg-red-50/50 dark:bg-red-950/20"
                      )}>
                        <td className="p-2 truncate max-w-[150px]" title={fr.fileName}>
                          {fr.fileName}
                        </td>
                        <td className="p-2 font-mono text-muted-foreground">
                          {fr.detectedAccount ?? "—"}
                        </td>
                        <td className="p-2">
                          {effective.status === "matched" ? (
                            <span className="truncate">{effective.clientName}</span>
                          ) : fr.status === "duplicate" ? (
                            <span className="text-amber-600 text-[11px]">Duplikat</span>
                          ) : (
                            <Select
                              value={override?.clientId ?? ""}
                              onValueChange={(val) => {
                                const newMap = new Map(routingOverrides);
                                newMap.set(fr.fileRef, { clientId: val, setNumber: override?.setNumber ?? 1 });
                                setRoutingOverrides(newMap);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Velg klient…" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableClients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {effective.status === "matched" ? (
                            <span className="font-mono">M{effective.setNumber}</span>
                          ) : override ? (
                            <Select
                              value={String(override.setNumber)}
                              onValueChange={(val) => {
                                const newMap = new Map(routingOverrides);
                                newMap.set(fr.fileRef, { ...override, setNumber: Number(val) as 1 | 2 });
                                setRoutingOverrides(newMap);
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-[60px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">M1</SelectItem>
                                <SelectItem value="2">M2</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {effective.status === "matched" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                          ) : fr.status === "duplicate" ? (
                            <Copy className="h-3.5 w-3.5 text-amber-600 mx-auto" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm shrink-0">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setRouting([]); }}>
                Tilbake
              </Button>
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={importableFiles.length === 0}
              >
                Importer {importableFiles.length} fil{importableFiles.length !== 1 ? "er" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "committing" && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              <p className="text-sm font-medium mt-3">Importerer filer&hellip;</p>
            </div>
            <div className="space-y-1.5">
              <Progress value={jobTotal > 0 ? (jobProgress / jobTotal) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground text-center tabular-nums">
                {jobProgress} av {jobTotal} filer behandlet
              </p>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="py-4 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-semibold">Import fullført</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalImported} transaksjoner importert fra {results.filter((r) => r.status === "completed").length} filer
                </p>
              </div>
            </div>

            {results.length > 0 && (
              <div className="rounded-md border overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Fil</th>
                      <th className="p-2 text-right font-medium">Importert</th>
                      <th className="p-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2 truncate max-w-[200px]">{r.fileName}</td>
                        <td className="p-2 text-right tabular-nums">{r.imported ?? 0}</td>
                        <td className="p-2 text-center">
                          {r.status === "completed" ? (
                            <span className="text-emerald-600">OK</span>
                          ) : (
                            <span className="text-destructive" title={r.error}>Feil</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <div className="flex justify-center gap-2 pt-1">
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function detectParserType(fileName: string): "csv" | "camt" | "klink" | "excel" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".xml") || lower.endsWith(".camt")) return "camt";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  return "csv";
}
