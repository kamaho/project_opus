"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttachmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  transactionIds: string[];
  onUploaded?: () => void;
}

export function AttachmentDialog({
  open,
  onOpenChange,
  clientId,
  transactionIds,
  onUploaded,
}: AttachmentDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToAll = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      setDone(false);
      setProgress(0);

      const fileArray = Array.from(files);
      let completed = 0;

      for (const txId of transactionIds) {
        const formData = new FormData();
        for (const file of fileArray) {
          formData.append("files", file);
        }
        try {
          await fetch(`/api/clients/${clientId}/transactions/${txId}/attachments`, {
            method: "POST",
            body: formData,
          });
        } catch {
          // continue with remaining
        }
        completed++;
        setProgress(Math.round((completed / transactionIds.length) * 100));
      }

      setUploading(false);
      setDone(true);
      onUploaded?.();
    },
    [clientId, transactionIds, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (e.dataTransfer.files?.length) {
        uploadToAll(e.dataTransfer.files);
      }
    },
    [uploadToAll]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!uploading) {
          onOpenChange(v);
          if (!v) setDone(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Last opp vedlegg til {transactionIds.length} transaksjon{transactionIds.length > 1 ? "er" : ""}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm font-medium">Vedlegg lastet opp</p>
            <p className="text-xs text-muted-foreground">
              {transactionIds.length} transaksjoner oppdatert
            </p>
          </div>
        ) : (
          <div
            className={cn(
              "border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer",
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
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{progress}% ferdig</p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Dra og slipp filer her, eller klikk for å velge
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Filene lastes opp til alle {transactionIds.length} valgte transaksjoner
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) uploadToAll(e.target.files);
            e.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
