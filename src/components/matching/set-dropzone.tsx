"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { FileSpreadsheet } from "lucide-react";

interface SetDropzoneProps {
  label: string;
  onFile: (file: File) => void;
  accept?: string;
  className?: string;
}

export function SetDropzone({
  label,
  onFile,
  accept = ".csv,.txt,.xlsx,.xls,.xml,.camt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/xml,text/xml",
  className,
}: SetDropzoneProps) {
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
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
    <div
      className={cn(
        "flex flex-1 flex-col min-w-0 border-r last:border-r-0 bg-muted/20",
        className
      )}
    >
      <div className="flex-1 flex items-center justify-center p-6">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center w-full min-h-[200px] rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            drag
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30"
          )}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-3" />
          <span className="text-sm font-medium text-center text-foreground">
            {label}
          </span>
          <span className="text-muted-foreground text-xs mt-1 text-center">
            CSV, Excel, TXT, CAMT.053 (XML) m.m.
          </span>
          <span className="text-muted-foreground text-xs mt-0.5 text-center">
            Klikk for å velge fil
          </span>
        </label>
      </div>
    </div>
  );
}
