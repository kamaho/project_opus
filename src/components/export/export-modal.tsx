"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type { ExportFormat, ExportModule } from "@/lib/export/types";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ExportModule;
  title?: string;
  getPayload: () => Record<string, unknown>;
  /** Kalles når generering starter (før fetch). */
  onGeneratingStart?: () => void;
  /** Kalles når generering er ferdig (suksess eller feil). */
  onGeneratingEnd?: () => void;
}

/** Minimum tid overlay-animasjonen spilles før «Lagre som»-dialogen vises. */
const MIN_ANIMATION_MS = 3000;

export function ExportModal({
  open,
  onOpenChange,
  module,
  title,
  getPayload,
  onGeneratingStart,
  onGeneratingEnd,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    onGeneratingStart?.();
    const startTime = Date.now();

    try {
      const payload = getPayload();
      const body = { module, format, ...payload };

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Eksport feilet" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fileNameMatch = disposition?.match(/filename="(.+)"/);
      const fileName =
        fileNameMatch?.[1] ??
        `${module}-rapport.${format === "pdf" ? "pdf" : "xlsx"}`;

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_ANIMATION_MS - elapsed);

      setTimeout(() => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        onOpenChange(false);
        onGeneratingEnd?.();
      }, remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
      onGeneratingEnd?.();
    } finally {
      setLoading(false);
    }
  }

  const displayTitle = title ?? "Eksporter rapport";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>
            Velg format og generer rapporten for nedlasting.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 py-4">
          <button
            type="button"
            onClick={() => setFormat("pdf")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
              format === "pdf"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <FileText
              className={`h-8 w-8 ${format === "pdf" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className={`text-sm font-medium ${format === "pdf" ? "text-primary" : ""}`}>
              PDF
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFormat("xlsx")}
            className={`flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
              format === "xlsx"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            <FileSpreadsheet
              className={`h-8 w-8 ${format === "xlsx" ? "text-primary" : "text-muted-foreground"}`}
            />
            <span className={`text-sm font-medium ${format === "xlsx" ? "text-primary" : ""}`}>
              Excel
            </span>
          </button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Avbryt
          </Button>
          <Button onClick={handleGenerate} disabled={loading}>
            <Download className="h-4 w-4" />
            Last ned {format === "pdf" ? "PDF" : "Excel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
