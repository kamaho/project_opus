"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Unplug,
  RefreshCw,
} from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  companyNo: number | null;
  companyName: string | null;
  lastSync: string | null;
}

interface VismaNxtConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VismaNxtConfigDialog({
  open,
  onOpenChange,
}: VismaNxtConfigDialogProps) {
  const { organization } = useOrganization();
  const tenantId = organization?.id;

  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/visma-nxt/status");
      if (res.ok) {
        setStatus(await res.json());
      } else {
        setStatus({ connected: false, companyNo: null, companyName: null, lastSync: null });
      }
    } catch {
      setStatus({ connected: false, companyNo: null, companyName: null, lastSync: null });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (open) fetchStatus();
  }, [open, fetchStatus]);

  const handleConnect = async () => {
    if (!tenantId) return;
    try {
      const res = await fetch(
        `/api/auth/visma-nxt/authorize?tenantId=${encodeURIComponent(tenantId)}`
      );
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch {
      // handled by redirect failure
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/visma-nxt/disconnect", {
        method: "POST",
      });
      setStatus({ connected: false, companyNo: null, companyName: null, lastSync: null });
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/visma-nxt/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(
          `Synkronisert: ${data.accounts} kontoer, ${data.balancesUpdated} saldoer`
        );
        fetchStatus();
      } else {
        setSyncResult(data.error ?? "Synkronisering feilet");
      }
    } catch {
      setSyncResult("Nettverksfeil under synkronisering");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Visma Business NXT</DialogTitle>
          <DialogDescription>
            Administrer tilkoblingen til Visma Business NXT.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-600" />
              <span className="text-sm font-medium">Tilkoblet</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                Aktiv
              </Badge>
            </div>

            {status.companyName && (
              <div className="rounded-md border px-3 py-2">
                <p className="text-xs text-muted-foreground">Selskap</p>
                <p className="text-sm font-medium">{status.companyName}</p>
                {status.companyNo && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selskapsnr: {status.companyNo}
                  </p>
                )}
              </div>
            )}

            {status.lastSync && (
              <p className="text-xs text-muted-foreground">
                Siste synkronisering:{" "}
                {new Intl.DateTimeFormat("nb-NO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(status.lastSync))}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                {syncing ? "Synkroniserer…" : "Synkroniser nå"}
              </Button>

              {syncResult && (
                <p className="text-xs text-muted-foreground">{syncResult}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleConnect}
                >
                  <ExternalLink className="size-3" />
                  Koble til på nytt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Unplug className="size-3" />
                  )}
                  Koble fra
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Ikke tilkoblet
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Koble til Visma Connect for å synkronisere hovedbok, kontoplan
              og reskontro automatisk.
            </p>

            <Button onClick={handleConnect} className="w-full gap-2">
              <ExternalLink className="size-4" />
              Koble til Visma Connect
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
