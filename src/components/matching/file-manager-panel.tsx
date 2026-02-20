"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  FileText,
  Trash2,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportRecord {
  id: string;
  setNumber: number;
  filename: string;
  fileSize: number | null;
  recordCount: number | null;
  status: string | null;
  importedBy: string | null;
  createdAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  daysRemaining: number | null;
}

interface FileManagerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  set1Label: string;
  set2Label: string;
  onRefresh: () => void;
}

type Tab = "active" | "deleted";

export function FileManagerPanel({
  open,
  onOpenChange,
  clientId,
  set1Label,
  set2Label,
  onRefresh,
}: FileManagerPanelProps) {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [error, setError] = useState<string | null>(null);

  const fetchImports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/imports`);
      if (!res.ok) throw new Error("Kunne ikke hente importer");
      const data = await res.json();
      setImports(data.imports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "En feil oppstod");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open) fetchImports();
  }, [open, fetchImports]);

  const handleSoftDelete = async (importId: string, setNumber: number) => {
    setActionLoading(importId);
    try {
      const res = await fetch(`/api/clients/${clientId}/matching?setNumber=${setNumber}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunne ikke slette");
      await fetchImports();
      onRefresh();
    } catch {
      setError("Kunne ikke slette importen");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (importId: string) => {
    setActionLoading(importId);
    try {
      const res = await fetch(`/api/clients/${clientId}/matching`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId }),
      });
      if (!res.ok) throw new Error("Kunne ikke gjenopprette");
      await fetchImports();
      onRefresh();
    } catch {
      setError("Kunne ikke gjenopprette importen");
    } finally {
      setActionLoading(null);
    }
  };

  const activeImports = imports.filter((i) => !i.isDeleted && i.status === "completed");
  const deletedImports = imports.filter((i) => i.isDeleted);

  const setLabel = (setNum: number) => (setNum === 1 ? set1Label : set2Label);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Filbehandler</SheetTitle>
          <SheetDescription>
            Oversikt over importerte filer. Slettede filer fjernes permanent etter 14 dager.
          </SheetDescription>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            type="button"
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("active")}
          >
            Aktive ({activeImports.length})
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "deleted"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setTab("deleted")}
          >
            Slettede ({deletedImports.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive px-3 py-2 text-sm mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "active" ? (
            activeImports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p>Ingen aktive importer</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeImports.map((imp) => (
                  <div
                    key={imp.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{imp.filename}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5">
                            {setLabel(imp.setNumber)}
                          </span>
                          <span>{imp.recordCount ?? 0} rader</span>
                          <span>{formatSize(imp.fileSize)}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 shrink-0"
                        onClick={() => handleSoftDelete(imp.id, imp.setNumber)}
                        disabled={actionLoading === imp.id}
                        title="Slett fil"
                      >
                        {actionLoading === imp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      <span>Importert {formatDate(imp.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : deletedImports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
              <Trash2 className="h-8 w-8 mb-2 opacity-50" />
              <p>Ingen slettede filer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deletedImports.map((imp) => (
                <div
                  key={imp.id}
                  className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-600 shrink-0" />
                        <span className="text-sm font-medium truncate">{imp.filename}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5">
                          {setLabel(imp.setNumber)}
                        </span>
                        <span>{imp.recordCount ?? 0} rader</span>
                        <span>{formatSize(imp.fileSize)}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-8 shrink-0"
                      onClick={() => handleRestore(imp.id)}
                      disabled={actionLoading === imp.id}
                    >
                      {actionLoading === imp.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Gjenopprett
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Slettet {formatDate(imp.deletedAt)}</span>
                    </div>
                    {imp.daysRemaining !== null && (
                      <div className={cn(
                        "flex items-center gap-1 font-medium",
                        imp.daysRemaining <= 3 ? "text-destructive" : "text-amber-600"
                      )}>
                        <AlertTriangle className="h-3 w-3" />
                        <span>
                          {imp.daysRemaining === 0
                            ? "Slettes i dag"
                            : `Slettes om ${imp.daysRemaining} dag${imp.daysRemaining === 1 ? "" : "er"}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
