"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, FileText, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ClientGroup } from "@/app/dashboard/clients/accounts-table";

interface GroupAutoMatchClientResult {
  clientId: string;
  clientName: string;
  matches: number;
  transactions: number;
  remainingOpen: number;
}

interface GroupAutoMatchResult {
  totalMatches: number;
  totalTransactions: number;
  clients: GroupAutoMatchClientResult[];
  durationMs: number;
}

type Phase = "loading" | "preview" | "committing" | "done" | "empty";

interface GroupAutoMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ClientGroup;
}

export function GroupAutoMatchDialog({
  open,
  onOpenChange,
  group,
}: GroupAutoMatchDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<GroupAutoMatchResult | null>(null);
  const [result, setResult] = useState<GroupAutoMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setPreview(null);
    setResult(null);
    setError(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/client-groups/${group.id}/auto-match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "preview" }),
        });
        if (!res.ok) throw new Error("Preview feilet");
        const data: GroupAutoMatchResult = await res.json();
        if (cancelled) return;
        setPreview(data);
        setPhase(data.totalMatches === 0 ? "empty" : "preview");
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
        setPhase("empty");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, group.id]);

  const handleCommit = useCallback(async () => {
    setPhase("committing");
    try {
      const res = await fetch(`/api/client-groups/${group.id}/auto-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit" }),
      });
      if (!res.ok) throw new Error("Commit feilet");
      const data: GroupAutoMatchResult = await res.json();
      setResult(data);
      setPhase("done");
    } catch (err) {
      setError(String(err));
      setPhase("done");
    }
  }, [group.id]);

  const handleExport = useCallback(async () => {
    const clientIds = group.members.map((m) => m.clientId);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: "group-matching",
          format: "pdf",
          groupMatchingData: {
            groupId: group.id,
            groupName: group.name,
            clientIds,
            reportType: "open",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? "Kunne ikke generere rapport");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gruppe-rapport-${group.name.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Rapport lastet ned");
    } catch {
      toast.error("Kunne ikke generere rapport");
    }
  }, [group]);

  const isLocked = phase === "committing";
  const data = result ?? preview;

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
              <CheckCircle2 className="h-4 w-4 sm-text" />
            ) : (
              <Zap className="h-4 w-4 sm-text" />
            )}
            {phase === "done"
              ? "Smart Match fullført"
              : `Smart Match — ${group.name}`}
          </DialogTitle>
        </DialogHeader>

        {phase === "loading" && (
          <div className="py-6 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 sm-border border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-3">
              Analyserer {group.members.length} klienter&hellip;
            </p>
          </div>
        )}

        {phase === "empty" && (
          <div className="py-6 text-center space-y-2">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Ingen matchkandidater funnet for noen klienter i gruppen.
                </p>
                <p className="text-xs text-muted-foreground">
                  Prøv å justere reglene eller legg til flere transaksjoner.
                </p>
              </>
            )}
            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Lukk
              </Button>
            </div>
          </div>
        )}

        {phase === "preview" && data && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Totalt matcher</span>
                <span className="font-medium tabular-nums">
                  {data.totalMatches}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaksjoner</span>
                <span className="font-medium tabular-nums">
                  {data.totalTransactions}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Analysetid</span>
                <span className="font-mono text-xs tabular-nums">
                  {data.durationMs}ms
                </span>
              </div>
            </div>

            {data.clients.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Per klient
                </p>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left font-medium">Klient</th>
                        <th className="p-2 text-right font-medium">Matcher</th>
                        <th className="p-2 text-right font-medium">Trx.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.clients.map((c) => (
                        <tr key={c.clientId} className="border-b last:border-0">
                          <td className="p-2 truncate max-w-[200px]">
                            {c.clientName}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {c.matches}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {c.transactions}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Avbryt
              </Button>
              <Button
                size="sm"
                onClick={handleCommit}
                className="sm-btn-solid"
              >
                Bekreft matching
              </Button>
            </div>
          </div>
        )}

        {phase === "committing" && (
          <div className="py-6 text-center space-y-3">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 sm-border border-t-transparent" />
            <p className="text-sm font-medium">
              Matcher poster for {group.members.length} klienter&hellip;
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="py-4 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full sm-bg-subtle">
                <PartyPopper className="h-7 w-7 sm-text" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {result
                    ? `${result.totalMatches} grupper matchet`
                    : "Matching fullført"}
                </p>
                {result && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.totalTransactions} transaksjoner ble avstemt på
                    tvers av {result.clients.length} klienter
                  </p>
                )}
              </div>
            </div>

            {result && result.clients.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left font-medium">Klient</th>
                      <th className="p-2 text-right font-medium">Matcher</th>
                      <th className="p-2 text-right font-medium">Åpne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.clients.map((c) => (
                      <tr key={c.clientId} className="border-b last:border-0">
                        <td className="p-2 truncate max-w-[200px]">
                          {c.clientName}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {c.matches}
                        </td>
                        <td className="p-2 text-right tabular-nums">
                          {c.remainingOpen}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex justify-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
              >
                <FileText className="h-3.5 w-3.5" />
                Eksporter rapport
              </Button>
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
