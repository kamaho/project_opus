"use client";

import type {
  TextSizePreference,
  TextWeightPreference,
  NumberFormatPreference,
  DateFormatPreference,
} from "@/lib/ui-preferences";
import { useUiPreferences } from "@/contexts/ui-preferences-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const TEXT_SIZE_OPTIONS: { value: TextSizePreference; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Stor" },
  { value: "larger", label: "Større" },
];

const TEXT_WEIGHT_OPTIONS: { value: TextWeightPreference; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "bold", label: "Halvfet" },
];

const NUMBER_FORMAT_OPTIONS: { value: NumberFormatPreference; label: string; example: string }[] = [
  { value: "nb", label: "Norsk", example: "1 234 567,89" },
  { value: "en", label: "Engelsk", example: "1,234,567.89" },
  { value: "ch", label: "Sveitsisk", example: "1'234'567.89" },
];

const DATE_FORMAT_OPTIONS: { value: DateFormatPreference; label: string; example: string }[] = [
  { value: "nb", label: "Norsk", example: "24.02.2026" },
  { value: "iso", label: "ISO", example: "2026-02-24" },
  { value: "us", label: "Amerikansk", example: "02/24/2026" },
];

export default function SettingsPage() {
  const { preferences, updateTablePreferences, updateTypographyPreferences, updateFormattingPreferences } = useUiPreferences();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Innstillinger</h1>
        <p className="text-muted-foreground">
          Tenant-innstillinger og parser-konfigurasjon. Kommer snart.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Utseende</h2>
        <p className="text-sm text-muted-foreground">
          Tilpass hvordan programmet ser ut. Endringene gjelder alle tabeller og
          komponenter i appen.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Tabeller</CardTitle>
            <CardDescription>
              Styr linjer mellom rader og kolonner i alle tabeller.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="table-dividers" className="text-base">
                Synlige skillelinjer i tabeller
              </Label>
              <p className="text-sm text-muted-foreground">
                Vis tydelige linjer mellom rader og kolonner for enklere å skille
                data.
              </p>
            </div>
            <Switch
              id="table-dividers"
              checked={preferences.table.visibleDividers}
              onCheckedChange={(checked) =>
                updateTablePreferences({ visibleDividers: checked })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typografi</CardTitle>
            <CardDescription>
              Juster tekststørrelse og fetthet for bedre lesbarhet. Gjelder hele appen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tekststørrelse</Label>
              <p className="text-sm text-muted-foreground">
                Basisstørrelse på tekst (for eksempel ved svaksynthet).
              </p>
              <Select
                value={preferences.typography.textSize}
                onValueChange={(value) =>
                  updateTypographyPreferences({ textSize: value as TextSizePreference })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fetthet på tekst</Label>
              <p className="text-sm text-muted-foreground">
                Gjør brødtekst tydeligere uten å påvirke overskrifter for mye.
              </p>
              <Select
                value={preferences.typography.textWeight}
                onValueChange={(value) =>
                  updateTypographyPreferences({ textWeight: value as TextWeightPreference })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_WEIGHT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formatering</CardTitle>
            <CardDescription>
              Velg hvordan tall og datoer vises i appen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Tallformat</Label>
              <p className="text-sm text-muted-foreground">
                Bestemmer tusenskilletegn og desimaltegn for alle beløp.
              </p>
              <Select
                value={preferences.formatting.numberFormat}
                onValueChange={(value) =>
                  updateFormattingPreferences({ numberFormat: value as NumberFormatPreference })
                }
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span>{opt.label}</span>
                      <span className="ml-2 text-muted-foreground font-mono text-xs">{opt.example}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Datoformat</Label>
              <p className="text-sm text-muted-foreground">
                Bestemmer rekkefølge og skilletegn for datoer.
              </p>
              <Select
                value={preferences.formatting.dateFormat}
                onValueChange={(value) =>
                  updateFormattingPreferences({ dateFormat: value as DateFormatPreference })
                }
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span>{opt.label}</span>
                      <span className="ml-2 text-muted-foreground font-mono text-xs">{opt.example}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
