"use client";

import { useState, useCallback } from "react";
import { parseFile, detectFileType, readFileAsText } from "@/lib/parsers";
import type { ParsedTransaction, CsvParserConfig } from "@/lib/parsers";
import { FileDropzone } from "@/components/import/file-dropzone";
import { ImportPreview } from "@/components/import/import-preview";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_CSV_CONFIG: CsvParserConfig = {
  delimiter: ";",
  decimalSeparator: ",",
  hasHeader: true,
  columns: {
    date1: 0,
    amount: 1,
    description: 2,
    reference: 3,
  },
};

export function ImportPageClient({ clientId }: { clientId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [setNumber, setSetNumber] = useState<1 | 2>(1);
  const [parserType, setParserType] = useState<"csv" | "camt">("csv");
  const [csvDelimiter, setCsvDelimiter] = useState<";" | "," | "\t">(";");
  const [preview, setPreview] = useState<{
    transactions: ParsedTransaction[];
    errors: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    recordCount: number;
    errors: string[];
  } | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    const detected = detectFileType(f.name);
    const pType = detected === "camt" ? "camt" : "csv";
    setParserType(pType);

    readFileAsText(f).then((content) => {
      const config: CsvParserConfig | undefined =
        pType === "csv"
          ? { ...DEFAULT_CSV_CONFIG, delimiter: csvDelimiter }
          : undefined;
      const out = parseFile(content, pType, config);
      setPreview({ transactions: out.transactions, errors: out.errors });
    });
  }, [csvDelimiter]);

  const handleImport = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("clientId", clientId);
      formData.set("setNumber", String(setNumber));
      formData.set("parserType", parserType);
      if (parserType === "csv") {
        formData.set(
          "csvConfig",
          JSON.stringify({
            ...DEFAULT_CSV_CONFIG,
            delimiter: csvDelimiter,
          })
        );
      }

      const res = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({
          recordCount: 0,
          errors: [data.error ?? "Import feilet", ...(data.errors ?? [])],
        });
        return;
      }
      setResult({
        recordCount: data.recordCount ?? 0,
        errors: data.errors ?? [],
      });
      setFile(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Mengde</Label>
          <Select
            value={String(setNumber)}
            onValueChange={(v) => setSetNumber(v === "2" ? 2 : 1)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Mengde 1 (hovedbok)</SelectItem>
              <SelectItem value="2">Mengde 2 (bank)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Filtype / parser</Label>
          <Select
            value={parserType}
            onValueChange={(v) => {
              setParserType(v as "csv" | "camt");
              setPreview(null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="camt">CAMT.053 (XML)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {parserType === "csv" && (
        <div>
          <Label>CSV-skille-tegn</Label>
          <Select
            value={csvDelimiter}
            onValueChange={(v) => {
              const delim = v as ";" | "," | "\t";
              setCsvDelimiter(delim);
              if (file) {
                readFileAsText(file).then((content) => {
                  const out = parseFile(content, "csv", {
                    ...DEFAULT_CSV_CONFIG,
                    delimiter: delim,
                  });
                  setPreview({ transactions: out.transactions, errors: out.errors });
                });
              }
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=";">Semikolon (;)</SelectItem>
              <SelectItem value=",">Komma (,)</SelectItem>
              <SelectItem value="\t">Tabulator</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <FileDropzone onFile={handleFile} />

      {preview && (
        <>
          <ImportPreview
            transactions={preview.transactions}
            errors={preview.errors}
          />
          <Button
            onClick={handleImport}
            disabled={loading || preview.transactions.length === 0}
          >
            {loading ? "Importerer…" : "Bekreft import"}
          </Button>
        </>
      )}

      {result && (
        <div
          className={
            result.errors.length > 0
              ? "rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4"
              : "rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4"
          }
        >
          <p className="font-medium">
            {result.recordCount} transaksjoner importert.
          </p>
          {result.errors.length > 0 && (
            <ul className="list-disc list-inside text-sm mt-1">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
