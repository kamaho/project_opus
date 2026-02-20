"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";

interface FileDropzoneProps {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({
  onFile,
  accept = ".csv,.xml,.camt,text/csv,application/xml,text/xml",
  disabled,
  className,
}: FileDropzoneProps) {
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      e.target.value = "";
    },
    [onFile]
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
        drag ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
      <span className="text-sm font-medium text-center">
        Dra fil hit eller klikk for å velge
      </span>
      <span className="text-muted-foreground text-xs mt-1">CSV eller CAMT.053 (XML)</span>
    </label>
  );
}
