"use client";

import { useState } from "react";
import { useFormatting } from "@/contexts/ui-preferences-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Download, Loader2 } from "lucide-react";
import {
  getDemoMvaMelding,
  getDifferansekategoriLabel,
  MVA_DIFFERANSEKATEGORIER,
  type MvaMelding,
  type MvaDifferansekategori,
} from "@/lib/mva/demo-data";
import { ExportModal } from "@/components/export/export-modal";
import { ExportIntroOverlay } from "@/components/export/export-intro-overlay";
import { ReportButton } from "@/components/export/report-button";

type LineOverride = { category: MvaDifferansekategori | ""; comment: string };

const NUMBER_LOCALE_MAP: Record<string, string> = { nb: "nb-NO", en: "en-US", ch: "de-CH" };

function getInitialOverrides(): Record<string, LineOverride> {
  return {};
}

export function MvaAvstemmingView() {
  const { numberPref } = useFormatting();
  const formatNok = (value: number) =>
    new Intl.NumberFormat(NUMBER_LOCALE_MAP[numberPref] ?? "nb-NO", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const [melding, setMelding] = useState<MvaMelding | null>(null);
  const [loading, setLoading] = useState(false);
  const [lineOverrides, setLineOverrides] = useState<Record<string, LineOverride>>(getInitialOverrides);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportGenerating, setExportGenerating] = useState(false);

  function setLineOverride(mvaKode: string, patch: Partial<LineOverride>) {
    setLineOverrides((prev) => {
      const existing: LineOverride = prev[mvaKode] ?? { category: "", comment: "" };
      return { ...prev, [mvaKode]: { ...existing, ...patch } };
    });
  }

  async function handleHentFraAltinn() {
    setLoading(true);
    setLineOverrides(getInitialOverrides);
    try {
      // Demo: simulate network delay; later replace with real Altinn API.
      await new Promise((r) => setTimeout(r, 800));
      setMelding(getDemoMvaMelding());
    } finally {
      setLoading(false);
    }
  }

  if (melding === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">MVA-avstemming</h1>
          <p className="text-muted-foreground">
            Avstem MVA i regnskapet (konto 2700–2740) mot innrapportert MVA-melding fra Altinn.
          </p>
        </div>
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Hent MVA-melding</CardTitle>
            <CardDescription>
              Første steg er å hente MVA-meldingen fra Altinn for valgt termin. Ved direkte integrasjon hentes data automatisk; for demo brukes demo-data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleHentFraAltinn}
              disabled={loading}
              className="bg-primary text-primary-foreground"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Henter…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Hent MVA-melding fra Altinn
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDiff = melding.totalBeregnet - melding.totalBokfort;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">MVA-avstemming</h1>
          <p className="text-muted-foreground">
            Termin: {melding.termin} — Avstemming mot MVA-melding (demo-data).
          </p>
        </div>
        <ReportButton onClick={() => setExportOpen(true)} />
      </div>

      <ExportModal
        open={exportOpen && !exportGenerating}
        onOpenChange={setExportOpen}
        module="mva"
        title="Rapport — MVA-avstemming"
        getPayload={() => ({ mvaData: { melding, lineOverrides } })}
        onGeneratingStart={() => setExportGenerating(true)}
        onGeneratingEnd={() => setExportGenerating(false)}
      />

      {exportGenerating && (
        <ExportIntroOverlay
          viewMode="closed"
          openCount={0}
          matchedCount={0}
          mode="generating"
          showStats={false}
          onComplete={() => setExportGenerating(false)}
          onSkip={() => setExportGenerating(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>MVA-avstemming {melding.termin}</CardTitle>
          <CardDescription>
            Beregnet vs. bokført MVA. Ved differanse: velg årsak (f.eks. kodefeil i regnskapet) og evt. kommentar.
            Ved full integrasjon hentes melding fra Altinn og bokført fra regnskap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MVA-kode</TableHead>
                <TableHead>Beskrivelse</TableHead>
                <TableHead className="text-right font-mono tabular-nums">Grunnlag</TableHead>
                <TableHead className="text-right font-mono tabular-nums">Sats %</TableHead>
                <TableHead className="text-right font-mono tabular-nums">Beregnet</TableHead>
                <TableHead className="text-right font-mono tabular-nums">Bokført</TableHead>
                <TableHead className="text-right font-mono tabular-nums">Differanse</TableHead>
                <TableHead className="w-[180px]">Årsak</TableHead>
                <TableHead>Kommentar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {melding.linjer.map((linje) => {
                const diff = linje.beregnet - linje.bokfort;
                const override = lineOverrides[linje.mvaKode] ?? { category: "", comment: "" };
                const hasDiff = diff !== 0;
                return (
                  <TableRow key={linje.mvaKode}>
                    <TableCell className="font-medium">{linje.mvaKode}</TableCell>
                    <TableCell className="text-muted-foreground">{linje.beskrivelse}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNok(linje.grunnlag)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{linje.sats}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNok(linje.beregnet)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{formatNok(linje.bokfort)}</TableCell>
                    <TableCell className={`text-right font-mono tabular-nums ${hasDiff ? "text-destructive" : ""}`}>
                      <div className="flex flex-col items-end gap-0.5">
                        {diff === 0 ? "0" : formatNok(diff)}
                        {override.category ? (
                          <span
                            className={
                              override.category === "kodefeil"
                                ? "rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive"
                                : "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                            }
                          >
                            {getDifferansekategoriLabel(override.category as MvaDifferansekategori)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasDiff ? (
                        <Select
                          value={override.category || "_ingen_"}
                          onValueChange={(value) =>
                            setLineOverride(linje.mvaKode, {
                              category: value === "_ingen_" ? "" : (value as MvaDifferansekategori),
                            })
                          }
                        >
                          <SelectTrigger size="sm" className="h-8 w-full">
                            <SelectValue placeholder="Velg årsak" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_ingen_">Velg årsak</SelectItem>
                            {MVA_DIFFERANSEKATEGORIER.map((k) => (
                              <SelectItem key={k.value} value={k.value}>
                                {k.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasDiff ? (
                        <Input
                          placeholder="Forklaring (f.eks. feil kode i regnskapet)"
                          className="h-8 text-sm"
                          value={override.comment}
                          onChange={(e) => setLineOverride(linje.mvaKode, { comment: e.target.value })}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end border-t pt-4">
            <div className="flex gap-6 font-mono tabular-nums text-sm">
              <span className="text-muted-foreground">Sum beregnet: {formatNok(melding.totalBeregnet)}</span>
              <span className="text-muted-foreground">Sum bokført: {formatNok(melding.totalBokfort)}</span>
              <span className={totalDiff !== 0 ? "text-destructive font-medium" : ""}>
                Differanse: {formatNok(totalDiff)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
