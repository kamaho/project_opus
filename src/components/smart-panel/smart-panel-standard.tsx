"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Palette } from "lucide-react";
import type {
  TextSizePreference,
  TextWeightPreference,
  NumberFormatPreference,
  DateFormatPreference,
} from "@/lib/ui-preferences";
import { useUiPreferences } from "@/contexts/ui-preferences-context";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

const PANEL_TIPS = [
  "Høyreklikk på elementer med informasjonsstøtte for å lese forklaringer.",
  "Du finner flere UI-innstillinger under Innstillinger → Utseende.",
  "Skillelinjer i tabeller kan slås av eller på fra Design her eller i Innstillinger.",
];

const PANEL_TEXT_SIZE_OPTIONS: { value: TextSizePreference; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Stor" },
  { value: "larger", label: "Større" },
];

const PANEL_TEXT_WEIGHT_OPTIONS: { value: TextWeightPreference; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "medium", label: "Medium" },
  { value: "bold", label: "Halvfet" },
];

const PANEL_NUMBER_FORMAT_OPTIONS: { value: NumberFormatPreference; label: string; example: string }[] = [
  { value: "nb", label: "Norsk", example: "1 234 567,89" },
  { value: "en", label: "Engelsk", example: "1,234,567.89" },
  { value: "ch", label: "Sveitsisk", example: "1'234'567.89" },
];

const PANEL_DATE_FORMAT_OPTIONS: { value: DateFormatPreference; label: string; example: string }[] = [
  { value: "nb", label: "Norsk", example: "24.02.2026" },
  { value: "iso", label: "ISO", example: "2026-02-24" },
  { value: "us", label: "Amerikansk", example: "02/24/2026" },
];

/** Section heading style used in all Smart panels. */
export const SECTION_LABEL_CLASS =
  "text-xs font-medium text-muted-foreground uppercase tracking-wider";

export function SmartPanelSectionLabel({ children }: { children: ReactNode }) {
  return <p className={`px-3 pt-3 pb-1 ${SECTION_LABEL_CLASS}`}>{children}</p>;
}

export function DesignPanelContent() {
  const {
    preferences,
    updateTablePreferences,
    updateTypographyPreferences,
    updateFormattingPreferences,
  } = useUiPreferences();
  return (
    <div className="p-3 space-y-4">
      <p className="text-xs text-muted-foreground">
        Samme innstillinger som under Innstillinger → Utseende.
      </p>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <Label htmlFor="panel-table-dividers" className="text-sm">
            Synlige skillelinjer i tabeller
          </Label>
          <p className="text-xs text-muted-foreground">
            Linjer mellom rader og kolonner i alle tabeller.
          </p>
        </div>
        <Switch
          id="panel-table-dividers"
          checked={preferences.table.visibleDividers}
          onCheckedChange={(checked) =>
            updateTablePreferences({ visibleDividers: checked })
          }
        />
      </div>
      <div className="space-y-2 pt-2 border-t">
        <Label className="text-sm">Tekststørrelse</Label>
        <Select
          value={preferences.typography.textSize}
          onValueChange={(value) =>
            updateTypographyPreferences({ textSize: value as TextSizePreference })
          }
        >
          <SelectTrigger size="sm" className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANEL_TEXT_SIZE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Fetthet på tekst</Label>
        <Select
          value={preferences.typography.textWeight}
          onValueChange={(value) =>
            updateTypographyPreferences({ textWeight: value as TextWeightPreference })
          }
        >
          <SelectTrigger size="sm" className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANEL_TEXT_WEIGHT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <Label className="text-sm">Tallformat</Label>
        <Select
          value={preferences.formatting.numberFormat}
          onValueChange={(value) =>
            updateFormattingPreferences({ numberFormat: value as NumberFormatPreference })
          }
        >
          <SelectTrigger size="sm" className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANEL_NUMBER_FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span>{opt.label}</span>
                <span className="ml-2 text-muted-foreground font-mono text-xs">{opt.example}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Datoformat</Label>
        <Select
          value={preferences.formatting.dateFormat}
          onValueChange={(value) =>
            updateFormattingPreferences({ dateFormat: value as DateFormatPreference })
          }
        >
          <SelectTrigger size="sm" className="w-full h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PANEL_DATE_FORMAT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span>{opt.label}</span>
                <span className="ml-2 text-muted-foreground font-mono text-xs">{opt.example}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function SmartPanelDesignRow({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors text-left ${
        isActive ? "bg-muted/80 font-medium" : "hover:bg-muted/60"
      }`}
      onClick={onClick}
    >
      {isActive ? (
        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      ) : (
        <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="flex-1 font-medium">{isActive ? "Tilbake" : "Design"}</span>
      {!isActive && (
        <span className="text-xs text-muted-foreground shrink-0">UI-innstillinger</span>
      )}
    </button>
  );
}

export function SmartPanelInnstillingerSection({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <SmartPanelSectionLabel>Innstillinger</SmartPanelSectionLabel>
      <SmartPanelDesignRow isActive={isActive} onClick={onToggle} />
    </div>
  );
}

function TipsCarousel() {
  const [index, setIndex] = useState(0);
  const tip = PANEL_TIPS[index] ?? PANEL_TIPS[0];
  const hasPrev = index > 0;
  const hasNext = index < PANEL_TIPS.length - 1;
  return (
    <div className="p-3 flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={!hasPrev}
        onClick={() => setIndex((i) => Math.max(0, i - 1))}
        aria-label="Forrige tips"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <p className="text-xs text-muted-foreground flex-1 min-w-0">{tip}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        disabled={!hasNext}
        onClick={() => setIndex((i) => Math.min(PANEL_TIPS.length - 1, i + 1))}
        aria-label="Neste tips"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function SmartPanelTipsSection() {
  return (
    <div>
      <SmartPanelSectionLabel>Tips</SmartPanelSectionLabel>
      <TipsCarousel />
    </div>
  );
}
