"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportHeaderProps {
  reportId: string;
  tittel: string;
  firma: string;
  aldersfordeltPer: string;
  generertDato: string;
  format?: string;
}

export function ReportHeader({
  reportId,
  tittel,
  firma,
  aldersfordeltPer,
  generertDato,
  format,
}: ReportHeaderProps) {
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

  const formattedDate = new Date(generertDato).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDownload = async (fmt: "pdf" | "excel") => {
    setDownloading(fmt);
    try {
      const res = await fetch(`/api/reports/${reportId}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tittel}.${fmt === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/rapporter">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">Rapporter</span>
          </Button>
        </Link>
        <div className="h-5 w-px bg-border" />
        <div>
          <h1 className="text-lg font-semibold leading-tight">{tittel}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {firma} · Aldersfordelt per {aldersfordeltPer} · Generert {formattedDate}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(!format || format === "pdf") && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
          >
            {downloading === "pdf" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Last ned PDF
          </Button>
        )}
        {(!format || format === "excel") && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => handleDownload("excel")}
            disabled={downloading !== null}
          >
            {downloading === "excel" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            Last ned Excel
          </Button>
        )}
      </div>
    </div>
  );
}
