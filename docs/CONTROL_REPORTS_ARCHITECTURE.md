# Kontrollrapporter — Arkitektur

> **Kjerneinnsikt:** Revizo er et kontrollsystem. Det henter data fra regnskapssystemer
> og offentlige kilder (Altinn), kjører avstemminger mellom dem, og rapporterer avvik.
> Rapportene er ikke dokumentgenerering — de er **resultatet av kontroller**.

---

## 1. Systemmodell

```
┌─────────────────────────────────┐
│     REGNSKAPSSYSTEMER           │
│  Tripletex · Visma NXT          │
│  PowerOffice · Xledger          │
│  Finago · Business Central      │
│  Unimicro                       │
└──────────────┬──────────────────┘
               │ Adapter-pattern
               ▼
┌──────────────────────────────────┐
│         REVIZO CORE              │
│                                  │
│  ┌──────────┐  ┌──────────────┐ │
│  │ Data     │  │ Kontroll-    │ │
│  │ Fetchers │→ │ motorer      │ │
│  └──────────┘  └──────┬───────┘ │
│                       │         │
│              ┌────────▼───────┐ │
│              │ Rapport-       │ │
│              │ generering     │ │
│              └────────────────┘ │
└──────────────────────────────────┘
               ▲
               │ ID-porten OAuth
┌──────────────┴──────────────────┐
│         ALTINN                   │
│  A07 (lønn) · MVA-melding       │
│  (fremtidig: Aksjonær, Skatt)   │
└──────────────────────────────────┘
```

---

## 2. Tre arkitekturlag

### Lag 1: Accounting System Adapters
Abstraksjonslag som normaliserer data fra ulike regnskapssystemer til et felles format.
**Én adapter per system.** Alle implementerer samme interface.

### Lag 2: Kontrollmotorer
Forretningslogikken. Tar normalisert data fra adapter + Altinn-data,
kjører regler, og produserer kontrollresultat med avvik.

### Lag 3: Rapportgenerering
Tar kontrollresultat og genererer PDF/Excel.
Felles for alle kontrolltyper — kun presentasjon.

---

## 3. Lag 1: Accounting System Adapter

### Interface — alle systemer implementerer dette

```typescript
// src/lib/accounting/types.ts

/**
 * Felles interface for alle regnskapssystem-adaptere.
 * Hver metode returnerer normalisert data.
 * Metoder som systemet ikke støtter kaster NotSupportedError.
 */
export interface AccountingSystemAdapter {
  readonly systemId: string;      // "tripletex" | "visma_nxt" | "poweroffice" | etc.
  readonly systemName: string;    // "Tripletex" | "Visma NXT" | etc.

  // Autentisering
  testConnection(): Promise<boolean>;

  // Lønnsdata
  getPayrollData(params: PeriodParams): Promise<PayrollData>;

  // MVA
  getVatTransactions(params: PeriodParams): Promise<VatTransaction[]>;
  getVatSummary(params: PeriodParams): Promise<VatSummary>;

  // Reskontro
  getAccountsReceivable(asOfDate: Date): Promise<ReceivableEntry[]>;
  getAccountsPayable(asOfDate: Date): Promise<PayableEntry[]>;

  // Feriepenger
  getHolidayPayData(year: number): Promise<HolidayPayData>;

  // Anlegg (fremtidig)
  // getFixedAssets(): Promise<FixedAsset[]>;
}

// --- Normaliserte datatyper ---

export interface PeriodParams {
  year: number;
  month?: number;       // 1-12, undefined = hele året
  quarter?: number;     // 1-4, undefined = ikke kvartalsfilter
}

export interface PayrollData {
  period: PeriodParams;
  employees: PayrollEmployee[];
  totals: {
    grossPay: number;          // Brutto lønn
    taxDeductions: number;     // Skattetrekk
    employerContributions: number; // Arbeidsgiveravgift
    netPay: number;            // Netto lønn
    pensionContributions: number;
    otherDeductions: number;
  };
}

export interface PayrollEmployee {
  employeeId: string;
  name: string;
  nationalId?: string;    // Fødselsnr — kun hvis nødvendig for A07-matching
  grossPay: number;
  taxDeductions: number;
  employerContributions: number;
  netPay: number;
  pensionContributions: number;
  benefits: PayrollBenefit[];
}

export interface PayrollBenefit {
  code: string;           // A-meldingskode
  description: string;
  amount: number;
}

export interface VatTransaction {
  date: Date;
  voucherNumber: string;
  description: string;
  accountNumber: string;
  vatCode: string;        // Norsk MVA-kode (1, 3, 5, 6, etc.)
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface VatSummary {
  period: PeriodParams;
  lines: VatSummaryLine[];
  totalBasis: number;
  totalVat: number;
}

export interface VatSummaryLine {
  vatCode: string;
  description: string;    // "Innenlands omsetning 25%"
  basis: number;          // Grunnlag
  rate: number;           // Sats (25, 15, 12, 0)
  vatAmount: number;      // Beregnet MVA
}

export interface ReceivableEntry {
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

export interface PayableEntry {
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
}

export interface HolidayPayData {
  year: number;                    // Opptjeningsår
  employees: HolidayPayEmployee[];
  totalBasis: number;              // Totalt feriepengegrunnlag
  totalHolidayPay: number;         // Total feriepengebeløp
}

export interface HolidayPayEmployee {
  employeeId: string;
  name: string;
  holidayPayBasis: number;         // Feriepengegrunnlag
  rate: number;                    // Sats (10.2%, 12% for 60+)
  calculatedHolidayPay: number;
  paidHolidayPay: number;          // Allerede utbetalt
  remaining: number;               // Gjenstående
}
```

### Adapter-registry

```typescript
// src/lib/accounting/registry.ts

import type { AccountingSystemAdapter } from "./types";

const adapters: Record<string, () => Promise<AccountingSystemAdapter>> = {
  tripletex: () => import("./adapters/tripletex").then(m => m.createTripletexAdapter),
  visma_nxt: () => import("./adapters/visma-nxt").then(m => m.createVismaNxtAdapter),
  poweroffice: () => import("./adapters/poweroffice").then(m => m.createPowerOfficeAdapter),
  xledger: () => import("./adapters/xledger").then(m => m.createXledgerAdapter),
  finago: () => import("./adapters/finago").then(m => m.createFinagoAdapter),
  business_central: () => import("./adapters/business-central").then(m => m.createBCAdapter),
  unimicro: () => import("./adapters/unimicro").then(m => m.createUnimicroAdapter),
};

export async function getAdapter(
  systemId: string,
  credentials: SystemCredentials
): Promise<AccountingSystemAdapter> {
  const factory = adapters[systemId];
  if (!factory) throw new Error(`Unknown accounting system: ${systemId}`);
  const create = await factory();
  return create(credentials);
}

export function getSupportedSystems(): { id: string; name: string }[] {
  return [
    { id: "tripletex", name: "Tripletex" },
    { id: "visma_nxt", name: "Visma NXT" },
    { id: "poweroffice", name: "PowerOffice Go" },
    { id: "xledger", name: "Xledger" },
    { id: "finago", name: "Finago" },
    { id: "business_central", name: "Business Central" },
    { id: "unimicro", name: "Uni Micro" },
  ];
}
```

### Mappestruktur

```
src/lib/accounting/
├── types.ts                  # Felles interface og normaliserte typer
├── registry.ts               # Adapter-registry
├── adapters/
│   ├── tripletex.ts          # Bygger på eksisterende src/lib/tripletex/
│   ├── visma-nxt.ts          # Stub → implementer når API-tilgang er klar
│   ├── poweroffice.ts        # Stub
│   ├── xledger.ts            # Stub
│   ├── finago.ts             # Stub
│   ├── business-central.ts   # Stub
│   └── unimicro.ts           # Stub
```

**V1-strategi:** Implementer Tripletex-adapteren fullt. Andre systemer er stubs
som kaster `NotSupportedError` — de bygges ut etter hvert som API-tilgang er klar.

---

## 4. Altinn 3-integrasjon

### Altinn 3 vs Altinn 2

Altinn 2 API fases ut. Revizo bygger KUN mot **Altinn 3 API** (https://docs.altinn.studio/nb/api/).

Viktige forskjeller:
- Altinn 3 bruker **Maskinporten** og/eller **ID-porten** for autentisering
- API-er er REST-basert med ny URL-struktur under `platform.altinn.no`
- Instanser (skjemainnleveringer) hentes via Instances API
- A-melding og MVA-melding er tilgjengelige som "apps" i Altinn 3

### Autentiseringsmodell

```
Tilnærming A: Maskinporten (systembruker — anbefalt for automatisering)
  → Virksomheten gir Revizo tilgang via Altinn autorisasjon
  → Revizo autentiserer med JWT grant mot Maskinporten
  → Ingen brukerinteraksjon nødvendig etter oppsett
  → Best for: automatiske kontroller, bakgrunnsjobber

Tilnærming B: ID-porten (personlig innlogging)
  → Bruker logger inn med BankID
  → Revizo får delegert tilgang
  → Best for: førstegangs oppsett, ad-hoc kontroller
```

**Anbefaling:** Støtt begge. ID-porten for onboarding og manuell bruk,
Maskinporten for automatiserte kontroller (passer perfekt med automatiseringssystemet).

### Altinn 3 API-endepunkter vi trenger

```
# Instanser — hent innleverte skjemaer
GET /storage/api/v1/instances?appId={appId}&instanceOwner.partyId={partyId}

# Data — hent skjemadata for en instans
GET /storage/api/v1/instances/{instanceOwnerPartyId}/{instanceGuid}/data/{dataGuid}

# Relevante Altinn-apper:
# - skd/a-melding (A-melding / A07)
# - skd/mva-melding (MVA-melding)
# - skd/skattemelding (fremtidig)
```

### Maskinporten-flyt

```typescript
// src/lib/altinn/maskinporten.ts

/**
 * Maskinporten JWT Grant-flyt for Altinn 3.
 *
 * Forutsetninger:
 * 1. Revizo er registrert som klient i Maskinporten (via Samarbeidsportalen)
 * 2. Virksomheten (kundens org) har delegert riktige scopes til Revizo
 *    via Altinn autorisasjon
 *
 * Flyt:
 * 1. Revizo lager en JWT med claims (iss, scope, aud, etc.)
 * 2. JWT signeres med Revizos private nøkkel (JWK)
 * 3. JWT sendes til Maskinporten token-endepunkt
 * 4. Maskinporten returnerer access_token
 * 5. Access token brukes i Authorization-header mot Altinn 3 API
 *
 * Scopes:
 *   altinn:instances.read — Les instanser (innleverte skjemaer)
 *   altinn:instances.write — Ikke nødvendig for kontroll
 *
 * Miljøvariabler:
 *   MASKINPORTEN_CLIENT_ID
 *   MASKINPORTEN_JWK_PRIVATE_KEY (JSON Web Key, privat nøkkel)
 *   MASKINPORTEN_ISSUER (https://maskinporten.no eller test)
 *   MASKINPORTEN_TOKEN_ENDPOINT
 *   ALTINN_PLATFORM_URL (https://platform.altinn.no)
 */

import * as jose from "jose"; // npm install jose

export interface MaskinportenConfig {
  clientId: string;
  privateKey: jose.KeyLike;  // JWK privat nøkkel
  issuer: string;
  tokenEndpoint: string;
  scopes: string[];
}

export async function getMaskinportenToken(
  config: MaskinportenConfig,
  targetOrgNumber: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Lag JWT grant
  const jwt = await new jose.SignJWT({
    scope: config.scopes.join(" "),
    consumer_org: targetOrgNumber, // Hvilken org vi ber om tilgang for
  })
    .setProtectedHeader({ alg: "RS256", kid: "revizo-key-1" })
    .setIssuer(config.clientId)
    .setAudience(config.issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + 120) // 2 minutter
    .setJti(crypto.randomUUID())
    .sign(config.privateKey);

  // Bytt JWT mot access token
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Maskinporten token error: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}
```

### ID-porten OAuth-flyt (for manuell tilgang)

```typescript
// src/lib/altinn/id-porten.ts

/**
 * ID-porten autentisering for Altinn 3.
 *
 * Flyt:
 * 1. Bruker klikker "Koble til Altinn" i Revizo
 * 2. Redirect til ID-porten authorize-endepunkt
 * 3. Bruker logger inn med BankID/MinID
 * 4. Callback til Revizo med auth code
 * 5. Revizo bytter code mot access + refresh token
 * 6. Tokens lagres kryptert i DB
 * 7. Access token brukes for Altinn 3 API
 *
 * Miljøvariabler:
 *   IDPORTEN_CLIENT_ID
 *   IDPORTEN_CLIENT_SECRET (eller JWK for private_key_jwt)
 *   IDPORTEN_WELL_KNOWN (https://idporten.no/.well-known/openid-configuration)
 *   IDPORTEN_REDIRECT_URI
 *   IDPORTEN_SCOPES (openid, altinn:instances.read)
 */

export interface IdPortenTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  pid?: string;  // Personidentifikator (fødselsnr) — hash denne
}
```

### Altinn 3 Data Client

```typescript
// src/lib/altinn/client.ts

export interface AltinnClient {
  // A-melding / A07 — Lønn og arbeidsgiveravgift
  getAMelding(orgNumber: string, period: PeriodParams): Promise<A07Data>;

  // MVA-melding
  getVatReturn(orgNumber: string, period: VatPeriodParams): Promise<VatReturnData>;

  // Generisk: hent instanser for en app
  getInstances(appId: string, partyId: string): Promise<AltinnInstance[]>;

  // Hent data fra en spesifikk instans
  getInstanceData(instanceId: string, dataId: string): Promise<unknown>;
}

/**
 * Altinn 3 Platform API klient.
 */
export class Altinn3Client implements AltinnClient {
  constructor(
    private platformUrl: string,
    private getAccessToken: (orgNumber: string) => Promise<string>
  ) {}

  async getAMelding(orgNumber: string, period: PeriodParams): Promise<A07Data> {
    const token = await this.getAccessToken(orgNumber);

    // 1. Hent instanser for a-melding appen, filtrert på periode
    const instances = await this.getInstances(
      "skd/a-melding",  // Altinn app-ID for a-melding
      orgNumber,
      token
    );

    // 2. Filtrer på riktig periode
    const relevantInstances = instances.filter(inst =>
      matchesPeriod(inst, period)
    );

    // 3. Hent data for hver instans og normaliser
    const data = await Promise.all(
      relevantInstances.map(inst => this.fetchAndParseAMelding(inst, token))
    );

    // 4. Aggreger til A07Data format
    return aggregateAMeldingData(data, period);
  }

  async getVatReturn(orgNumber: string, period: VatPeriodParams): Promise<VatReturnData> {
    const token = await this.getAccessToken(orgNumber);

    // Tilsvarende: hent MVA-melding instanser, parse, normaliser
    const instances = await this.getInstances("skd/mva-melding", orgNumber, token);
    // ...
  }

  private async getInstances(
    appId: string,
    orgNumber: string,
    token: string
  ): Promise<AltinnInstance[]> {
    const response = await fetch(
      `${this.platformUrl}/storage/api/v1/instances?appId=${appId}&instanceOwner.organisationNumber=${orgNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) throw new Error(`Altinn API error: ${response.status}`);
    return response.json();
  }
}
```

### Altinn data-typer (uendret)

```typescript
export interface A07Data {
  orgNumber: string;
  period: PeriodParams;
  employees: A07Employee[];
  totals: {
    grossPay: number;
    taxDeductions: number;
    employerContributions: number;
    pensionContributions: number;
  };
}

export interface A07Employee {
  nationalId: string;      // Fødselsnr — hash ved lagring
  name: string;
  incomeEntries: A07IncomeEntry[];
}

export interface A07IncomeEntry {
  code: string;            // A-meldingskode
  description: string;
  amount: number;
  period: string;          // "2026-01"
}

export interface VatReturnData {
  orgNumber: string;
  termYear: number;
  termPeriod: number;      // 1-6 for toMånedersTermin
  lines: VatReturnLine[];
  totalBasis: number;
  totalVat: number;
  submittedDate?: Date;
}

export interface VatReturnLine {
  postNumber: string;      // "1", "2", "3", etc.
  description: string;
  basis: number;
  vatAmount: number;
}
```

### Lagring — Altinn-tilkoblinger og tokens

```sql
CREATE TABLE altinn_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,              -- Clerk userId som satte opp
  org_number TEXT NOT NULL,           -- Norsk organisasjonsnummer
  auth_method TEXT NOT NULL,          -- 'maskinporten' | 'id_porten'

  -- ID-porten tokens (kun hvis auth_method = 'id_porten')
  access_token TEXT,                  -- KRYPTERT (AES-256-GCM)
  refresh_token TEXT,                 -- KRYPTERT
  token_expires_at TIMESTAMPTZ,

  -- Maskinporten (tokens caches in-memory, ikke lagret)
  -- Maskinporten-nøkler er globale for Revizo, ikke per-tenant

  scopes TEXT NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,

  UNIQUE(tenant_id, org_number)
);
```

### Registreringer som MÅ gjøres

| Hva | Hvor | Status | Estimert tid |
|-----|------|--------|--------------|
| Registrer Revizo i Maskinporten | Samarbeidsportalen (digdir.no) | **START NÅ** | 1–4 uker |
| Registrer Revizo i ID-porten | Samarbeidsportalen | **START NÅ** | 1–4 uker |
| Definer nødvendige scopes | Samarbeidsportalen | Sammen med registrering | — |
| Testmiljø-tilgang (ver2/tt02) | Samarbeidsportalen | Start her | Raskere |
| Sett opp JWK-nøkkelpar | Internt | Kan gjøres umiddelbart | 30 min |

---

## 5. Lag 2: Kontrollmotorer

### Kontrolltyper

| Kontroll | Kilde A (regnskap) | Kilde B (Altinn/beregning) | Hva sjekkes |
|----------|-------------------|---------------------------|-------------|
| **Lønn vs A07** | PayrollData | A07Data | Brutto, skatt, AGA per ansatt per periode |
| **MVA-avstemming** | VatSummary | VatReturnData | MVA-grunnlag og beløp per kode vs innlevert melding |
| **Kundefordringer** | ReceivableEntry[] | (intern aldersberegning) | Aldersfordeling, forfalt, forventet tap |
| **Leverandørgjeld** | PayableEntry[] | (intern aldersberegning) | Aldersfordeling, forfalt |
| **Feriepenger** | HolidayPayData | (beregningsmotor) | Grunnlag × sats vs bokført avsetning |

### Felles kontrollresultat-type

```typescript
// src/lib/controls/types.ts

export type ControlType =
  | "payroll_a07"
  | "vat_reconciliation"
  | "accounts_receivable"
  | "accounts_payable"
  | "holiday_pay";

export type Severity = "ok" | "info" | "warning" | "error";

export interface ControlResult {
  controlType: ControlType;
  title: string;                    // Norsk: "Lønnsavstemming mot A07"
  period: PeriodParams;
  executedAt: Date;
  overallStatus: Severity;          // Verste alvorlighet blant alle avvik
  summary: ControlSummary;
  deviations: Deviation[];          // Alle avvik funnet
  sourceALabel: string;             // "Tripletex"
  sourceBLabel: string;             // "Altinn A07"
  metadata: Record<string, unknown>;
}

export interface ControlSummary {
  totalChecked: number;             // Antall poster/linjer sjekket
  totalDeviations: number;
  totalDeviationAmount: number;     // Sum avviksbeløp
  deviationsByServerity: Record<Severity, number>;
}

export interface Deviation {
  id: string;
  severity: Severity;
  category: string;                 // "employee" | "vat_code" | "invoice" | etc.
  description: string;              // Norsk: "Brutto lønn avviker med 2 500 kr for Ola Nordmann"
  referenceA: string;               // Verdi fra kilde A
  referenceB: string;               // Verdi fra kilde B
  amountA: number;
  amountB: number;
  difference: number;
  details?: Record<string, unknown>;
}
```

### Kontrollmotor — eksempel: Lønn vs A07

```typescript
// src/lib/controls/engines/payroll-a07.ts

export async function runPayrollA07Control(
  payroll: PayrollData,
  a07: A07Data,
  tolerance: number = 1.0  // Tillatt avvik i kr (avrunding)
): Promise<ControlResult> {
  const deviations: Deviation[] = [];

  // 1. Match ansatte mellom regnskap og A07
  for (const employee of payroll.employees) {
    const a07Employee = findMatchingA07Employee(employee, a07.employees);

    if (!a07Employee) {
      deviations.push({
        id: generateId(),
        severity: "error",
        category: "employee",
        description: `${employee.name} finnes i regnskap men ikke i A07`,
        referenceA: employee.employeeId,
        referenceB: "-",
        amountA: employee.grossPay,
        amountB: 0,
        difference: employee.grossPay,
      });
      continue;
    }

    // 2. Sjekk brutto lønn
    const a07Gross = sumA07Income(a07Employee);
    if (Math.abs(employee.grossPay - a07Gross) > tolerance) {
      deviations.push({
        severity: Math.abs(employee.grossPay - a07Gross) > 1000 ? "error" : "warning",
        category: "gross_pay",
        description: `Brutto lønn avviker med ${formatNOK(employee.grossPay - a07Gross)} for ${employee.name}`,
        amountA: employee.grossPay,
        amountB: a07Gross,
        difference: employee.grossPay - a07Gross,
        // ...
      });
    }

    // 3. Sjekk skattetrekk, AGA, pensjon...
  }

  // 4. Sjekk ansatte i A07 som IKKE finnes i regnskap
  for (const a07Emp of a07.employees) {
    if (!findMatchingPayrollEmployee(a07Emp, payroll.employees)) {
      deviations.push({
        severity: "error",
        category: "employee",
        description: `${a07Emp.name} finnes i A07 men ikke i regnskap`,
        // ...
      });
    }
  }

  // 5. Sjekk totaler
  // Brutto, skatt, AGA på aggregert nivå

  return buildControlResult("payroll_a07", "Lønnsavstemming mot A07", deviations, payroll, a07);
}
```

### Mappestruktur

```
src/lib/controls/
├── types.ts                  # ControlResult, Deviation, etc.
├── runner.ts                 # Kjører en kontroll end-to-end (hent data → motor → resultat)
├── engines/
│   ├── payroll-a07.ts        # Lønn vs A07
│   ├── vat-reconciliation.ts # MVA-avstemming
│   ├── accounts-receivable.ts # Kundefordringer (aldersfordeling)
│   ├── accounts-payable.ts   # Leverandørgjeld (aldersfordeling)
│   └── holiday-pay.ts        # Feriepenger
```

---

## 6. Lag 3: Rapportgenerering

### Felles rapportgenerator

Tar et `ControlResult` og genererer PDF eller Excel.

```typescript
// src/lib/controls/report-generator.ts

export async function generateControlReport(
  result: ControlResult,
  format: "pdf" | "excel",
  options?: ReportOptions
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  switch (format) {
    case "pdf":
      return generatePdfReport(result, options);
    case "excel":
      return generateExcelReport(result, options);
  }
}
```

### PDF-struktur (felles for alle kontrolltyper)

```
┌─────────────────────────────────────┐
│ REVIZO                    Logo      │
│                                     │
│ [Kontrolltype] — [Selskap]          │
│ Periode: [Periode]                  │
│ Kjørt: [Dato/tid]                   │
│                                     │
│ ┌─ Sammendrag ────────────────────┐ │
│ │ Status: ● Avvik funnet          │ │
│ │ Poster sjekket: 24              │ │
│ │ Avvik: 3 (2 feil, 1 advarsel)  │ │
│ │ Sum avvik: 12 500 kr            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Detaljer ──────────────────────┐ │
│ │ (Tabell med alle avvik)         │ │
│ │ Alvorlighet | Beskrivelse | ... │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Kilde A: [System] ────────────┐ │
│ │ (Oppsummering av kildedata)     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Kilde B: [Altinn/Beregning] ──┐ │
│ │ (Oppsummering av referansedata) │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 7. Database — Kontrollresultater

```sql
CREATE TABLE control_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  client_id UUID REFERENCES clients(id),  -- Valgfri — noen kontroller er per selskap
  control_type TEXT NOT NULL,              -- 'payroll_a07', 'vat_reconciliation', etc.
  period_year INT NOT NULL,
  period_month INT,
  period_quarter INT,
  overall_status TEXT NOT NULL,            -- 'ok', 'warning', 'error'
  summary JSONB NOT NULL,                  -- ControlSummary
  deviations JSONB NOT NULL,              -- Deviation[]
  source_a_system TEXT NOT NULL,           -- 'tripletex', 'visma_nxt', etc.
  source_b_system TEXT NOT NULL,           -- 'altinn_a07', 'altinn_vat', 'calculated'
  report_pdf_url TEXT,                     -- Supabase Storage URL
  report_excel_url TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by TEXT NOT NULL,               -- userId
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX control_results_tenant_idx ON control_results(tenant_id);
CREATE INDEX control_results_company_idx ON control_results(company_id);
CREATE INDEX control_results_type_period_idx ON control_results(control_type, period_year, period_month);
```

---

## 8. API-ruter

```
# Kontroller
POST   /api/controls/run              → Kjør en kontroll (type, company, period)
GET    /api/controls/results          → Liste kontrollresultater (filtrert)
GET    /api/controls/results/[id]     → Detaljer for én kontroll
GET    /api/controls/results/[id]/pdf → Last ned PDF
GET    /api/controls/results/[id]/excel → Last ned Excel

# Altinn
GET    /api/altinn/auth-url           → Få ID-porten authorize URL
GET    /api/altinn/callback           → OAuth callback (bytter code mot tokens)
GET    /api/altinn/connections        → Liste tilkoblede organisasjoner
DELETE /api/altinn/connections/[id]   → Koble fra
GET    /api/altinn/a07                → Hent A07-data (proxy)
GET    /api/altinn/vat-return         → Hent MVA-melding (proxy)

# Regnskapssystem-adaptere
GET    /api/accounting/systems        → Liste støttede systemer
POST   /api/accounting/connect        → Koble til system (credentials)
GET    /api/accounting/connections     → Liste tilkoblede systemer
```

---

## 9. UI-flyt — Kjør kontroll

### Steg 1: Velg kontroll

```
┌─ Kontroller ──────────────────── [Kjør kontroll] ┐
│                                                    │
│  ┌───────────────┐  ┌───────────────┐             │
│  │ 💰 Lønn       │  │ 🧾 MVA       │             │
│  │ vs A07        │  │ avstemming    │             │
│  └───────────────┘  └───────────────┘             │
│  ┌───────────────┐  ┌───────────────┐             │
│  │ 📥 Kunde-     │  │ 📤 Leverandør-│             │
│  │ fordringer    │  │ gjeld         │             │
│  └───────────────┘  └───────────────┘             │
│  ┌───────────────┐                                │
│  │ 🏖 Ferie-     │                                │
│  │ penger        │                                │
│  └───────────────┘                                │
│                                                    │
│  [Velg selskap ▼]  [Velg periode ▼]               │
│                                                    │
│  [Kjør kontroll →]                                 │
└────────────────────────────────────────────────────┘
```

### Steg 2: Resultatvisning

```
┌─ Lønnsavstemming mot A07 ─────────────────────────┐
│  Bedrift AS · Januar 2026                          │
│                                                    │
│  ┌─ Status ──────────────────────────────────┐    │
│  │  ⚠️ 3 avvik funnet (2 feil, 1 advarsel)  │    │
│  │  24 ansatte sjekket · Sum avvik: 12 500 kr│    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  ┌─ Avvik ───────────────────────────────────┐    │
│  │ 🔴 Ola Nordmann — Brutto avviker 8 000 kr│    │
│  │    Regnskap: 45 000 · A07: 37 000         │    │
│  │                                            │    │
│  │ 🔴 Kari Hansen — Finnes ikke i A07        │    │
│  │    Regnskap: 38 000 · A07: -              │    │
│  │                                            │    │
│  │ 🟡 Per Olsen — AGA avviker 500 kr         │    │
│  │    Regnskap: 6 330 · A07: 5 830           │    │
│  └───────────────────────────────────────────┘    │
│                                                    │
│  [📄 Last ned PDF]  [📊 Last ned Excel]           │
└────────────────────────────────────────────────────┘
```

---

## 10. Integrasjon med automatiseringssystemet

Kontroller blir en ny steg-type i automatiseringer:

```typescript
// Ny steg-type
export type StepType = "smart_match" | "report" | "alert" | "control";

export interface ControlStepConfig {
  controlType: ControlType;     // "payroll_a07", "vat_reconciliation", etc.
  generateReport: boolean;
  reportFormat: "pdf" | "excel" | "both";
}
```

Eksempel-automatisering:
```
Hver 5. i måneden:
  → Kjør lønn vs A07-kontroll
  → Kjør MVA-avstemming
  → Generer rapport (PDF)
  → Varsle hvis avvik funnet
```

---

## 11. Implementeringsrekkefølge

| Fase | Hva | Estimat | Avhengigheter |
|------|-----|---------|---------------|
| **R1** | Accounting adapter interface + Tripletex-adapter | 3–4t | Eksisterende Tripletex-kode |
| **R2** | Altinn-integrasjon (ID-porten OAuth + A07 + MVA) | 6–8t | ID-porten registrering |
| **R3** | Kontrollmotorer (lønn, MVA) | 4–6t | R1 + R2 |
| **R4** | Kundefordringer + leverandørgjeld (aldersfordeling) | 3–4t | R1 |
| **R5** | Feriepenger-kontroll | 2–3t | R1 |
| **R6** | Rapportgenerering (PDF + Excel) | 3–4t | R3 |
| **R7** | UI — kontroll-kjøring og resultater | 3–4t | R3 + R6 |
| **R8** | Integrer "control" som steg i automatiseringer | 2–3t | R3 + A1-A3 |

**Kritisk sti:** R1 → R3 → R6 → R7 (lønn/MVA end-to-end)
**Parallelt:** R2 kan starte umiddelbart (ID-porten-registrering tar tid)
**Parallelt:** R4 + R5 er uavhengige av Altinn

### Viktig: ID-porten-registrering

Du må registrere Revizo som klient hos Digitaliseringsdirektoratet.
**Start dette NÅ** — det kan ta uker å få godkjent.
- Test-miljø: https://samarbeidsportalen.digdir.no (ver2 / test)
- Produksjon: Krever avtale

---

## 12. Andre regnskapssystem-adaptere (etter v1)

For hvert nytt system:
1. Implementer `AccountingSystemAdapter` interface
2. Legg til i registry
3. Opprett tilkoblings-UI
4. Alt annet (kontroller, rapporter, automatiseringer) fungerer automatisk

Prioritert rekkefølge basert på norsk markedsandel:
1. **Tripletex** (v1 — har dette)
2. **Visma NXT** — størst i Norge
3. **PowerOffice Go** — vokser raskt
4. **Xledger** — større virksomheter
5. **Business Central** — enterprise
6. **Finago** — automasjon
7. **Unimicro** — nisje
