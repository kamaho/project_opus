import type { ControlType } from "./types";

// ---------------------------------------------------------------------------
// Control Registry — statisk definisjon av alle kontrolltyper
// ---------------------------------------------------------------------------

export type ControlCategory =
  | "reconciliation"
  | "payroll"
  | "periodization"
  | "receivables"
  | "payables"
  | "tax"
  | "balance"
  | "compliance";

export interface ControlParameter {
  key: string;
  label: string;
  type: "number" | "boolean" | "select" | "days";
  defaultValue: unknown;
  options?: { value: unknown; label: string }[];
  unit?: string;
  description?: string;
}

export interface ControlDefinition {
  id: ControlType;
  name: string;
  description: string;
  category: ControlCategory;
  parameters: ControlParameter[];
  supportedSystems: ("tripletex" | "visma_nxt" | "poweroffice" | "all")[];
  /** Controls that are not yet implemented show as "coming soon" in UI */
  implemented: boolean;
}

export const CONTROL_REGISTRY: ControlDefinition[] = [
  {
    id: "accounts_receivable",
    name: "Kundefordringer",
    description: "Aldersfordeling og forfallskontroll av kundefordringer",
    category: "receivables",
    supportedSystems: ["all"],
    implemented: true,
    parameters: [
      {
        key: "overdueWarningDays",
        label: "Advarsel etter dager forfalt",
        type: "days",
        defaultValue: 30,
        description: "Generer advarsel for fakturaer forfalt over dette antall dager",
      },
      {
        key: "overdueErrorDays",
        label: "Feil etter dager forfalt",
        type: "days",
        defaultValue: 90,
        description: "Generer feil for fakturaer forfalt over dette antall dager",
      },
      {
        key: "totalOverdueWarningAmount",
        label: "Totalgrense forfalt",
        type: "number",
        defaultValue: 100_000,
        unit: "kr",
        description: "Generer advarsel når totalt forfalt beløp overstiger dette",
      },
      {
        key: "customerOverdueWarningAmount",
        label: "Kundegrense forfalt",
        type: "number",
        defaultValue: 50_000,
        unit: "kr",
        description: "Generer advarsel når én kundes forfalte beløp overstiger dette",
      },
      {
        key: "minAmount",
        label: "Minimumsbeløp",
        type: "number",
        defaultValue: 0,
        unit: "kr",
        description: "Ignorer fakturaer under dette beløpet",
      },
      {
        key: "maxOverdueCount",
        label: "Maks antall forfalte",
        type: "number",
        defaultValue: Infinity,
        description: "Generer advarsel hvis flere enn dette antallet fakturaer er forfalt",
      },
    ],
  },
  {
    id: "accounts_payable",
    name: "Leverandørgjeld",
    description: "Aldersfordeling og forfallskontroll av leverandørgjeld",
    category: "payables",
    supportedSystems: ["all"],
    implemented: true,
    parameters: [
      {
        key: "overdueWarningDays",
        label: "Advarsel etter dager forfalt",
        type: "days",
        defaultValue: 14,
      },
      {
        key: "overdueErrorDays",
        label: "Feil etter dager forfalt",
        type: "days",
        defaultValue: 60,
      },
      {
        key: "totalOverdueWarningAmount",
        label: "Totalgrense forfalt",
        type: "number",
        defaultValue: 100_000,
        unit: "kr",
      },
      {
        key: "supplierOverdueWarningAmount",
        label: "Leverandørgrense forfalt",
        type: "number",
        defaultValue: 50_000,
        unit: "kr",
      },
    ],
  },
  {
    id: "payroll_a07",
    name: "Lønnsavstemming",
    description:
      "Kontrollerer intern konsistens i lønnsdata. Krysssjekk mot A-melding kommer når Altinn-integrasjon er klar.",
    category: "payroll",
    supportedSystems: ["all"],
    implemented: true,
    parameters: [
      {
        key: "tolerance",
        label: "Toleransegrense",
        type: "number",
        defaultValue: 1,
        unit: "kr",
        description: "Ignorer differanser under dette beløpet",
      },
      {
        key: "checkNetPay",
        label: "Sjekk netto lønn",
        type: "boolean",
        defaultValue: true,
        description: "Verifiser at brutto - trekk = netto per ansatt",
      },
      {
        key: "flagMissingPension",
        label: "Flagg manglende pensjon",
        type: "boolean",
        defaultValue: true,
        description: "Varsle hvis ansatt mangler pensjonsinnbetaling",
      },
      {
        key: "flagZeroTax",
        label: "Flagg null skattetrekk",
        type: "boolean",
        defaultValue: true,
        description: "Varsle hvis ansatt med lønn mangler skattetrekk",
      },
      {
        key: "grossPayWarningThreshold",
        label: "Minimum brutto for varsler",
        type: "number",
        defaultValue: 0,
        unit: "kr",
        description: "Ignorer ansatte med brutto lønn under dette beløpet for pensjon/skatt-varsler",
      },
    ],
  },
  {
    id: "vat_reconciliation",
    name: "MVA-avstemming",
    description:
      "Sammenligner beregnet MVA fra regnskap mot innrapportert MVA-oppgave",
    category: "tax",
    supportedSystems: ["all"],
    implemented: false,
    parameters: [
      {
        key: "tolerance",
        label: "Toleransegrense",
        type: "number",
        defaultValue: 1,
        unit: "kr",
      },
    ],
  },
  {
    id: "periodization",
    name: "Periodiseringskontroll",
    description:
      "Sjekker at forskuddsbetalinger og påløpte kostnader er korrekt periodisert",
    category: "periodization",
    supportedSystems: ["all"],
    implemented: true,
    parameters: [
      {
        key: "minBalance",
        label: "Minimumsaldo",
        type: "number",
        defaultValue: 5_000,
        unit: "kr",
        description: "Ignorer kontoer med saldo under dette beløpet",
      },
      {
        key: "flagStaleAccounts",
        label: "Flagg inaktive kontoer",
        type: "boolean",
        defaultValue: true,
        description: "Varsle om periodiseringskontoer uten bevegelse i perioden",
      },
    ],
  },
  {
    id: "holiday_pay",
    name: "Feriepenger",
    description:
      "Kontrollerer feriepengegrunnlag og avsetninger mot beregnet beløp",
    category: "payroll",
    supportedSystems: ["all"],
    implemented: false,
    parameters: [
      {
        key: "tolerance",
        label: "Toleransegrense",
        type: "number",
        defaultValue: 100,
        unit: "kr",
      },
    ],
  },
];

export function getControlDefinition(
  controlType: ControlType
): ControlDefinition | undefined {
  return CONTROL_REGISTRY.find((d) => d.id === controlType);
}

export function getDefaultParameters(
  controlType: ControlType
): Record<string, unknown> {
  const def = getControlDefinition(controlType);
  if (!def) return {};
  const params: Record<string, unknown> = {};
  for (const p of def.parameters) {
    params[p.key] = p.defaultValue;
  }
  return params;
}
