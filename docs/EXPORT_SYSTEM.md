# Eksportsystem — PDF og XLSX

Revizo har et template-basert eksportsystem for å generere PDF- og XLSX-rapporter. Systemet bruker et registry-mønster som gjør det enkelt å legge til nye moduler og formater.

## Arkitektur

```
ExportModal (UI)
    │
    └── POST /api/export
            │
            └── generateExport(request, context)
                    │
                    ├── registry.ts → getTemplate(module, format)
                    │
                    └── Template
                          ├── buildViewModel(payload, context) → ViewModel
                          └── renderPdf(vm) / renderXlsx(vm) → Buffer
```

## Registry-mønster

Alle templates registreres ved import via side-effect imports:

```typescript
// service.ts
import "./templates/mva/mva-register";
import "./templates/matching/matching-register";
```

### Registrering

```typescript
import { registerTemplate } from "../registry";
registerTemplate("matching", { buildViewModel, renderPdf, renderXlsx });
```

### Template-kontrakt

```typescript
interface ExportTemplate<TViewModel> {
  buildViewModel: (payload: unknown, context: ExportContext) => Promise<TViewModel>;
  renderPdf?: (vm: TViewModel) => Promise<Buffer>;
  renderXlsx?: (vm: TViewModel) => Promise<Buffer>;
}
```

Ikke alle templates trenger begge formater — `getTemplate()` validerer at det valgte formatet støttes.

## Støttede moduler

### MVA-rapport (`mva`)

Genererer MVA-avstemmingsrapport med linjer, satser, differanser og kommentarer.

**Payload:**
```typescript
interface MvaExportPayload {
  melding: MvaMelding;
  lineOverrides: Record<string, { category: string; comment: string }>;
}
```

**View model:** `MvaExportViewModel` med termin, totalberegninger, linjer med beregnet/bokført/differanse.

### Matching-rapport (`matching`)

Genererer rapport for åpne eller lukkede poster per klient.

**Payload:**
```typescript
interface MatchingExportPayload {
  clientId: string;
  reportType: "open" | "closed";
  dateFrom?: string;
  dateTo?: string;
}
```

**View model:** `MatchingExportViewModel` — varierer etter rapporttype:

| Rapporttype | Data |
|-------------|------|
| `open` | Umatchede transaksjoner per sett, antall, totaler |
| `closed` | Matchgrupper med tilhørende transaksjoner, differanser |

View model-bygger henter klientinfo, kontonavn og transaksjoer fra databasen.

## Formater

| Format | Bibliotek | MIME-type |
|--------|-----------|-----------|
| PDF | pdfmake | `application/pdf` |
| XLSX | xlsx | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

### Filnavnkonvensjon

```
{modul}-rapport-{YYYY-MM-DD}.{pdf|xlsx}
```

## Kontekst

Alle eksporter mottar en `ExportContext` med tilgangsinformasjon:

```typescript
interface ExportContext {
  tenantId: string;
  userId: string;
  userEmail?: string;
}
```

## API-endepunkt

### `POST /api/export`

**Request body:**
```json
{
  "module": "matching",
  "format": "pdf",
  "matchingParams": {
    "clientId": "uuid",
    "reportType": "open",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31"
  }
}
```

**Respons:** Binær fil-nedlasting med riktig Content-Type og Content-Disposition.

## Legge til ny modul

For å legge til en ny eksportmodul (f.eks. "balance"):

1. Opprett `src/lib/export/templates/balance/`
2. Definer view model i `balance-viewmodel.ts`
3. Implementer `balance-pdf.ts` og/eller `balance-xlsx.ts`
4. Registrer med `registerTemplate("balance", { ... })` i `balance-register.ts`
5. Importer `balance-register.ts` i `service.ts`
6. Legg til `"balance"` i `ExportModule`-typen

## UI-komponent

`ExportModal` (`src/components/export/export-modal.tsx`):
- Modal som åpnes via rapportknappen
- Velg format (PDF/XLSX)
- Viser forhåndsvisning av rapportens innhold
- Laster ned generert fil

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `src/lib/export/service.ts` | `generateExport()` — hoveddistributor |
| `src/lib/export/types.ts` | Alle typer, payloads, view models |
| `src/lib/export/registry.ts` | Template-registrering og oppslag |
| `src/lib/export/templates/mva/` | MVA-templates (viewmodel, PDF, XLSX) |
| `src/lib/export/templates/matching/` | Matching-templates (viewmodel, PDF, XLSX) |
| `src/components/export/export-modal.tsx` | UI-komponent |
| `src/app/api/export/route.ts` | API-endepunkt |
