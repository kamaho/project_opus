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
import { Zap, CheckCircle2, PartyPopper, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PreviewClient {
  clientId: string;
  clientName: string;
  expectedMatches: number;
  totalTransactions: number;
  status: "ready" | "error";
}

interface SkippedClient {
  clientId: string;
  clientName: string;
  reason: string;
}

interface JobResult {
  clientId: string;
  clientName: string;
  matches: number;
  status: string;
  error?: string;
}

interface BulkJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  results: JobResult[];
}

type Phase = "loading" | "preview" | "committing" | "done" | "empty";

interface BulkAutoMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientIds: string[];
  onComplete?: () => void;
}

export function BulkAutoMatchDialog({
  open,
  onOpenChange,
  clientIds,
  onComplete,
}: BulkAutoMatchDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [readyClients, setReadyClients] = useState<PreviewClient[]>([]);
  const [skippedClients, setSkippedClients] = useState<SkippedClient[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobTotal, setJobTotal] = useState(0);
  const [results, setResults] = useState<JobResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open || clientIds.length === 0) return;
    setPhase("loading");
    setReadyClients([]);
    setSkippedClients([]);
    setJobId(null);
    setResults([]);
    setError(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients/bulk/auto-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientIds, mode: "preview" }),
        });
        if (!res.ok) throw new Error("Preview feilet");
        const data = await res.json();
        if (cancelled) return;

        setReadyClients(data.ready ?? []);
        setSkippedClients(data.skipped ?? []);

        const totalMatches = (data.ready ?? []).reduce(
          (sum: number, c: PreviewClient) => sum + c.expectedMatches, 0
        );
        setPhase(totalMatches === 0 && (data.ready ?? []).length === 0 ? "empty" : "preview");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ukjent feil");
        setPhase("empty");
      }
    })();
    return () => { cancelled = true; };
  }, [open, clientIds]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCommit = useCallback(async () => {
    setPhase("committing");
    try {
      const res = await fetch("/api/clients/bulk/auto-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientIds, mode: "commit" }),
      });
      if (!res.ok) throw new Error("Commit feilet");
      const data = await res.json();

      setJobId(data.jobId);
      setJobTotal(data.totalReady);
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
            setPhase("done");
            onComplete?.();
          }
        } catch {
          // Ignore poll errors, retry on next interval
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Commit feilet");
      setPhase("done");
    }
  }, [clientIds, onComplete]);

  const isLocked = phase === "committing";
  const totalExpectedMatches = readyClients.reduce((s, c) => s + c.expectedMatches, 0);
  const totalActualMatches = results.reduce((s, r) => s + r.matches, 0);

  return (
    <Dialog open={open} onOpenChange={isLocked ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={isLocked ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isLocked ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === "done" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {phase === "done" ? "Smart Match fullført" : "Smart Match (masseoperasjon)"}
          </DialogTitle>
        </DialogHeader>

        {phase === "loading" && (
          <div className="py-6 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            <p className="text-sm text-muted-foreground mt-3">
              Analyserer {clientIds.length} klienter&hellip;
            </p>
          </div>
        )}

        {phase === "empty" && (
          <div className="py-6 text-center space-y-2">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ingen klienter er klare for Smart Match.
              </p>
            )}
            {skippedClients.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Klient</th>
                      <th className="p-2 text-left font-medium">Grunn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skippedClients.map((s) => (
                      <tr key={s.clientId} className="border-b last:border-0">
                        <td className="p-2 truncate max-w-[150px]">{s.clientName}</td>
                        <td className="p-2 text-muted-foreground">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
            </div>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Klare klienter</span>
                <span className="font-medium tabular-nums">{readyClients.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Forventede matcher</span>
                <span className="font-medium tabular-nums">{totalExpectedMatches}</span>
              </div>
              {skippedClients.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hoppet over</span>
                  <span className="font-medium tabular-nums text-amber-600">{skippedClients.length}</span>
                </div>
              )}
            </div>

            {skippedClients.length > 0 && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {skippedClients.length} klient{skippedClients.length !== 1 && "er"} hoppet over
                </div>
                <ul className="text-amber-700 dark:text-amber-400 space-y-0.5 pl-5 list-disc">
                  {skippedClients.slice(0, 5).map((s) => (
                    <li key={s.clientId}>{s.clientName}: {s.reason}</li>
                  ))}
                  {skippedClients.length > 5 && (
                    <li>…og {skippedClients.length - 5} til</li>
                  )}
                </ul>
              </div>
            )}

            {readyClients.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Per klient</p>
                <div className="rounded-md border overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left font-medium">Klient</th>
                        <th className="p-2 text-right font-medium">Matcher</th>
                        <th className="p-2 text-right font-medium">Trx.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyClients.map((c) => (
                        <tr key={c.clientId} className="border-b last:border-0">
                          <td className="p-2 truncate max-w-[200px]">{c.clientName}</td>
                          <td className="p-2 text-right tabular-nums">{c.expectedMatches}</td>
                          <td className="p-2 text-right tabular-nums">{c.totalTransactions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button size="sm" onClick={handleCommit} disabled={readyClients.length === 0}>
                Bekreft matching ({readyClients.length} klienter)
              </Button>
            </div>
          </div>
        )}

        {phase === "committing" && (
          <div className="py-6 space-y-4">
            <div className="text-center">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              <p className="text-sm font-medium mt-3">
                Matcher poster&hellip;
              </p>
            </div>
            <div className="space-y-1.5">
              <Progress value={jobTotal > 0 ? (jobProgress / jobTotal) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground text-center tabular-nums">
                {jobProgress} av {jobTotal} klienter ferdig
              </p>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="py-4 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                <PartyPopper className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {totalActualMatches} grupper matchet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {results.length} klienter behandlet
                </p>
              </div>
            </div>

            {results.length > 0 && (
              <div className="rounded-md border overflow-hidden max-h-52 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Klient</th>
                      <th className="p-2 text-right font-medium">Matcher</th>
                      <th className="p-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.clientId} className="border-b last:border-0">
                        <td className="p-2 truncate max-w-[200px]">{r.clientName}</td>
                        <td className="p-2 text-right tabular-nums">{r.matches}</td>
                        <td className="p-2 text-right">
                          {r.status === "completed" ? (
                            <span className="text-emerald-600">OK</span>
                          ) : (
                            <span className="text-destructive">Feil</span>
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
