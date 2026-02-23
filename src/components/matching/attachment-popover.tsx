"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Trash2, Download, Eye, FileText, File as FileIcon, Image, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  id: string;
  filename: string;
  fileSize: number | null;
  contentType: string | null;
  createdAt: string | null;
}

interface AttachmentPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  transactionId: string;
  onAttachmentsChanged?: (hasAttachments: boolean) => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(contentType: string | null) {
  if (!contentType) return FileIcon;
  if (contentType.startsWith("image/")) return Image;
  if (contentType.includes("pdf") || contentType.includes("text")) return FileText;
  return FileIcon;
}

export function AttachmentPopover({
  open,
  onOpenChange,
  clientId,
  transactionId,
  onAttachmentsChanged,
}: AttachmentPopoverProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; filename: string; contentType: string | null; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, transactionId]);

  useEffect(() => {
    if (open) fetchAttachments();
  }, [open, fetchAttachments]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        const formData = new FormData();
        for (const file of Array.from(files)) {
          formData.append("files", file);
        }
        const res = await fetch(`/api/clients/${clientId}/transactions/${transactionId}/attachments`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          await fetchAttachments();
          onAttachmentsChanged?.(true);
        }
      } finally {
        setUploading(false);
      }
    },
    [clientId, transactionId, fetchAttachments, onAttachmentsChanged]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [uploadFiles]
  );

  const handleDelete = useCallback(
    async (attachmentId: string) => {
      setDeletingId(attachmentId);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/transactions/${transactionId}/attachments/${attachmentId}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          const next = attachments.filter((a) => a.id !== attachmentId);
          setAttachments(next);
          onAttachmentsChanged?.(next.length > 0);
        }
      } finally {
        setDeletingId(null);
      }
    },
    [clientId, transactionId, attachments, onAttachmentsChanged]
  );

  const handleDownload = useCallback(
    async (attachmentId: string) => {
      const res = await fetch(
        `/api/clients/${clientId}/transactions/${transactionId}/attachments/${attachmentId}/download`
      );
      if (!res.ok) return;
      const data = await res.json();
      window.open(data.url, "_blank");
    },
    [clientId, transactionId]
  );

  const canPreviewInline = useCallback((contentType: string | null) => {
    if (!contentType) return false;
    return contentType.startsWith("image/") || contentType === "application/pdf";
  }, []);

  const handlePreview = useCallback(
    async (attachment: Attachment) => {
      if (!canPreviewInline(attachment.contentType)) {
        handleDownload(attachment.id);
        return;
      }
      setPreviewLoading(true);
      try {
        const res = await fetch(
          `/api/clients/${clientId}/transactions/${transactionId}/attachments/${attachment.id}/download`
        );
        if (!res.ok) return;
        const data = await res.json();
        setPreviewAttachment({
          id: attachment.id,
          filename: attachment.filename,
          contentType: attachment.contentType,
          url: data.url,
        });
      } finally {
        setPreviewLoading(false);
      }
    },
    [clientId, transactionId, canPreviewInline, handleDownload]
  );

  const hasAttachments = attachments.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPreviewAttachment(null); onOpenChange(v); }}>
      <DialogContent className={cn("sm:max-w-sm transition-all", previewAttachment && "sm:max-w-lg")}>
        {previewAttachment ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => setPreviewAttachment(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="truncate text-sm">{previewAttachment.filename}</DialogTitle>
              </div>
            </DialogHeader>
            <div className="relative w-full max-h-[60vh] overflow-auto rounded-md border bg-muted/30">
              {previewAttachment.contentType?.startsWith("image/") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.filename}
                  className="w-full h-auto object-contain"
                />
              ) : previewAttachment.contentType === "application/pdf" ? (
                <iframe
                  src={previewAttachment.url}
                  title={previewAttachment.filename}
                  className="w-full h-[55vh] border-0"
                />
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(previewAttachment.url, "_blank")}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Last ned
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Vedlegg</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : hasAttachments ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {attachments.length} vedlegg
                  </p>
                  <div className="max-h-48 overflow-auto space-y-1">
                    {attachments.map((a) => {
                      const Icon = getFileIcon(a.contentType);
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 p-1.5 rounded-md border text-sm hover:bg-muted/50 transition-colors"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm leading-tight">{a.filename}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(a.fileSize)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => handlePreview(a)}
                            disabled={previewLoading}
                            title={canPreviewInline(a.contentType) ? "Forhåndsvis" : "Åpne i ny fane"}
                          >
                            {previewLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0"
                            onClick={() => handleDownload(a.id)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                          >
                            {deletingId === a.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div
                className={cn(
                  "border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Dra og slipp filer her, eller klikk for å velge
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
