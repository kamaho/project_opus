"use client";

import { useState } from "react";
import { Download, FileText, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DocFile {
  id: string;
  filename: string;
  filePath: string;
  fileSize: number | null;
  contentType: string | null;
}

interface DocRequest {
  requestId: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  message: string | null;
  createdAt: string | null;
  completedAt: string | null;
  files: DocFile[];
}

interface DocumentFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kundeNavn: string;
  requests: DocRequest[];
}

function formatDate(d: string | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "Venter", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  completed: { text: "Mottatt", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  expired: { text: "Utløpt", className: "bg-muted text-muted-foreground" },
  cancelled: { text: "Kansellert", className: "bg-muted text-muted-foreground" },
};

export function DocumentFilesDialog({
  open,
  onOpenChange,
  kundeNavn,
  requests,
}: DocumentFilesDialogProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(file: DocFile) {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/document-requests/files/${file.id}/download`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch {
      // fallback: try inline
      window.open(`/api/document-requests/files/${file.id}/download?inline=1`, "_blank");
    } finally {
      setDownloadingId(null);
    }
  }

  const totalFiles = requests.reduce((sum, r) => sum + r.files.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            Dokumenter — {kundeNavn}
          </DialogTitle>
        </DialogHeader>

        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Ingen dokumentforespørsler for denne kunden.
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {requests.map((req) => {
              const statusInfo = STATUS_LABEL[req.status] ?? STATUS_LABEL.pending;
              return (
                <div key={req.requestId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0", statusInfo.className)}>
                        {statusInfo.text}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {req.contactName ?? req.contactEmail ?? "Ekstern"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatDate(req.createdAt)}
                    </span>
                  </div>

                  {req.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.message}</p>
                  )}

                  {req.files.length > 0 ? (
                    <div className="space-y-1">
                      {req.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 group/file"
                        >
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate flex-1">{file.filename}</span>
                          {file.fileSize && (
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatFileSize(file.fileSize)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover/file:opacity-100 transition-opacity"
                            onClick={() => handleDownload(file)}
                            disabled={downloadingId === file.id}
                          >
                            {downloadingId === file.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Ingen filer lastet opp ennå
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {totalFiles > 0 && (
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            {totalFiles} {totalFiles === 1 ? "fil" : "filer"} mottatt
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
