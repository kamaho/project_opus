/**
 * Demo data for MVA-avstemming. Replaces Altinn-fetch until direct integration exists.
 * Structure aligned with RF-0002/RF-0004 MVA-melding (termin, koder, grunnlag, beregnet).
 * Differansekategorier per REPORT_MODULE_SPEC Del 4.2.
 */

/** Årsak til differanse på en MVA-linje (bruker kan merke kodefeil etc.). */
export type MvaDifferansekategori =
  | "kodefeil"
  | "avrunding"
  | "periodiseringsfeil"
  | "innforsels_mva"
  | "omvendt_avgiftsplikt";

export const MVA_DIFFERANSEKATEGORIER: { value: MvaDifferansekategori; label: string }[] = [
  { value: "kodefeil", label: "Kodefeil" },
  { value: "avrunding", label: "Avrunding" },
  { value: "periodiseringsfeil", label: "Periodiseringsfeil" },
  { value: "innforsels_mva", label: "Innførsels-MVA" },
  { value: "omvendt_avgiftsplikt", label: "Omvendt avgiftsplikt" },
];

export function getDifferansekategoriLabel(value: MvaDifferansekategori): string {
  return MVA_DIFFERANSEKATEGORIER.find((k) => k.value === value)?.label ?? value;
}

export interface MvaMeldingLinje {
  /** MVA-kode (f.eks. 3, 31, 81) */
  mvaKode: string;
  /** Beskrivelse */
  beskrivelse: string;
  /** Grunnlag (beløp) */
  grunnlag: number;
  /** Sats (prosent) */
  sats: number;
  /** Beregnet MVA (grunnlag × sats) */
  beregnet: number;
  /** Bokført MVA (regnskap 2700–2740) */
  bokfort: number;
}

export interface MvaMelding {
  /** Termin (f.eks. "2024-Q4" eller "2024-11") */
  termin: string;
  /** Innrapportert/beregnet totalt */
  totalBeregnet: number;
  /** Bokført totalt */
  totalBokfort: number;
  /** Linjer per MVA-kode */
  linjer: MvaMeldingLinje[];
}

/** Demo MVA-melding for én termin. */
export function getDemoMvaMelding(): MvaMelding {
  const linjer: MvaMeldingLinje[] = [
    { mvaKode: "3", beskrivelse: "Salg varer/services 25 %", grunnlag: 1_200_000, sats: 25, beregnet: 300_000, bokfort: 299_500 },
    { mvaKode: "31", beskrivelse: "Utgående MVA 25 % (andre)", grunnlag: 80_000, sats: 25, beregnet: 20_000, bokfort: 20_000 },
    { mvaKode: "81", beskrivelse: "Inngående MVA", grunnlag: 400_000, sats: 25, beregnet: 100_000, bokfort: 99_800 },
  ];
  const totalBeregnet = linjer.reduce((s, l) => s + l.beregnet, 0);
  const totalBokfort = linjer.reduce((s, l) => s + l.bokfort, 0);
  return {
    termin: "2024-4",
    totalBeregnet,
    totalBokfort,
    linjer,
  };
}
