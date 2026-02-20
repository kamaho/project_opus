# Import-system

Import-systemet lar brukere laste opp filer fra ulike kilder og konvertere dem til transaksjoner i databasen.

## Støttede filtyper

| Filtype        | Parser           | Detektert via                           | Bruk                              |
|----------------|------------------|-----------------------------------------|------------------------------------|
| **Excel**      | `xlsx`           | .xlsx, .xls filendelse                 | Hovedbok-eksport, bankutskrift     |
| **CSV**        | `papaparse`      | .csv filendelse, eller .txt med separator| Generisk tabellfil                |
| **CAMT.053**   | `fast-xml-parser`| .xml/.camt filendelse, XML-innhold      | Bankutskrift (ISO 20022)          |
| **Klink**      | Egenutviklet     | .txt uten separator, starts with 1XX    | Nordea/DNB fastlengde-filer       |

## Wizard-flyt (Excel og CSV)

For Excel og CSV brukes en steg-for-steg wizard (`ColumnImportWizard`):

```
Steg 1: "Velg overskriftsrad"
  → Vis alle rå rader, bruker klikker på raden med kolonne-navn
  → Rader over fjernes, valgt rad brukes som header

Steg 2: "Velg dato-kolonne"
  → Bruker klikker på kolonnen med dato-verdier
  → Kolonnen flyttes visuelt til venstre (grønn)

Steg 3: "Velg beløps-kolonne"
  → Bruker klikker på beløps-kolonnen
  → Alternativ: "Kredit + Debit" for to separate kolonner
  → Kolonnen flyttes til venstre (grønn)

Steg 4: "Velg ekstra kolonner" (valgfritt)
  → Bruker klikker kolonne-header, velger felt fra dropdown
  → Progressbar: 0-2 felt = gul, 3-4 = grønn, 5+ = utmerket
  → Kan hoppes over

Steg 5: "Bekreft"
  → Viser kun valgte kolonner med mapping
  → "Bekreft og importer" sender til API
```

### Nøkkelkomponenter

| Fil                                             | Ansvar                                       |
|--------------------------------------------------|----------------------------------------------|
| `src/components/import/column-import-wizard.tsx`  | Wizard UI og steg-logikk                    |
| `src/components/import/import-preview.tsx`        | Legacy preview (brukes for CAMT/Klink)       |
| `src/components/matching/matching-view-client.tsx` | Orkestrerer dialog, wizard og import-kall   |

## Parsere

### CSV-parser (`src/lib/parsers/csv-parser.ts`)

- Bruker **PapaParse** for parsing
- Støtter skilletegn: `;`, `,`, `\t`
- `dataStartRow`: hopper over N rader før header (for filer med metadata-rader)
- `hasHeader: true`: bruker første (gjenstående) rad som header
- Kolonner kan spesifiseres som nummer (indeks) eller streng (header-navn)
- Normaliserer beløp (håndterer komma/punktum som desimalseparator)
- Normaliserer datoer til ISO (YYYY-MM-DD)
- Støtter `amount` ELLER `credit` + `debit`

### Excel-parser (`src/lib/parsers/excel-parser.ts`)

- Bruker **xlsx** (SheetJS) med `cellDates: true` og `raw: false`
- `dataStartRow`: rad der data starter (header er raden over)
- `dateFormats`: spesifiserer datoformat per felt (DD.MM.YYYY, YYYY-MM-DD, etc.)
- Håndterer Excel serial dates, Date-objekter og dato-strenger
- `headerExtractions`: kan hente verdier fra header-området (f.eks. kontonr)
- Støtter `amount` ELLER `credit` + `debit`

### CAMT-parser (`src/lib/parsers/camt-parser.ts`)

- Parser CAMT.053 bankutskrifter (ISO 20022 XML)
- Håndterer base64-innkapslet CAMT (AutoPay-format)
- Validerer at det er CAMT.053 (avviser CAMT.054)
- Ekstrakter: kontonummer (IBAN/BBAN), beløp, dato, referanse, beskrivelse

### Klink-parser (`src/lib/parsers/klink-parser.ts`)

- Parser fastlengde-filer (Nordea, DNB Telepay, Nornett)
- Krever en **spec** som definerer felt-posisjoner og -lengder
- Støtter multiline-records (DNB Telepay)
- Håndterer SIGNBIT og FORTEGN for fortegn

## Detektorer (`src/lib/import-scripts/detectors.ts`)

Auto-detektering av filformat:

| Funksjon                | Detekterer                          |
|-------------------------|-------------------------------------|
| `detectSeparator()`     | Skilletegn (`;`, `,`, `\t`, `\|`)   |
| `detectDateFormat()`    | Datoformat fra samples               |
| `detectDataType()`      | "date", "number" eller "text"        |
| `detectTextQualifier()` | Anførselstegn-type                   |
| `guessField()`          | Mapper kolonne-header til felt       |

## Interne felt

Alle parsere konverterer til `ParsedTransaction` med disse feltene:

**Obligatoriske:**
- `amount` — beløp (eller beregnet fra credit/debit)
- `date1` — hoveddato (ISO YYYY-MM-DD)

**Vanlige:**
- `date2`, `reference`, `description`, `accountNumber`, `currency`, `sign`

**Utvidede (dimensjoner etc.):**
- `dim1`–`dim10`, `buntref`, `notat`, `bilag`, `faktura`, `forfall`, `periode`, `importNumber`, `avgift`, `tilleggstekst`, `ref2`–`ref6`, `anleggsnr`, `anleggsbeskrivelse`, `bilagsart`, `avsnr`, `tid`, `avvikendeDato`, `rate`, `kundenavn`, `kontonummerBokføring`

## Datoformat-håndtering

Parseren detekterer automatisk datoformat fra data-samples:

| Mønster             | Format        | Eksempel      |
|---------------------|---------------|---------------|
| `YYYY-MM-DD`        | ISO           | 2025-12-15    |
| `DD.MM.YYYY`        | Norsk         | 15.12.2025    |
| `DD/MM/YYYY`        | Europeisk     | 15/12/2025    |
| `YYYYMMDD`          | Kompakt       | 20251215      |
| Excel serial number | Auto-konvert  | 45640         |
| JavaScript Date     | Auto-konvert  | Date object   |

Viktig: datoformatet detekteres fra de faktiske verdiene i kolonnen, ikke hardkodet.
