# Import: Excel, fastlengde (Klink/Nornett/Telepay), kredit/debit og utvidede felt

**Dato:** 2025-02-19  

Korte notater om endringer knyttet til import: nye filtyper, kredit/debit-sammenstilling og utvidelse av mappbare felter.

---

## 1. Excel-import med forhåndsvisning og kolonnemapping

- **Hva:** Støtte for å importere .xlsx/.xls med samme flyt som CSV: forhåndsvisning av innhold og manuell mapping av kolonner til interne felter. Ingen manuelt script.
- **Hvor:** `src/lib/parsers/excel-parser.ts`, `src/lib/parsers/types.ts` (ExcelParserConfig), import-API og matching-view (parserType "excel").
- **Viktig:** Dato bruker standardformat DD.MM.YYYY; valgfri «Første datarad» (0–20) for filer med metadata-rader. API støtter også `headerExtractions` (f.eks. Kontonr fra header-celle).

---

## 2. Fastlengde-filer (Klink, Nornett, DNB Telepay)

- **Hva:** Parser for TXT-filer med fastlengde-format: spec med FILTYPE, BEHANDL1, [Transer], evt. FACTOR og MULTILINESEGMENTID. Bruker limer inn spec i import-dialogen.
- **Filtyper:**
  - **Klink (Nordea):** FASTLENGDEMULTILINE, SIGNBIT for beløp, YYMMDD.
  - **Nornett:** FASTLENGDE, FORTEGN (separat sign-kolonne), FACTOR;0.01, YYYYMMDD.
  - **DNB Telepay:** FASTLENGDEMULTILINE, MULTILINESEGMENTID (SWI02/SWI07), linjenummer per felt, FORTEGN og FACTOR.
- **Hvor:** `src/lib/parsers/klink-parser.ts`, `parserType: "klink"` i API og import-UI.

---

## 3. Kredit- og debit-kolonner → ett beløp med fortegn

- **Hva:** Filer som har separate Kredit- og Debit-kolonner kan mappes slik at systemet regner ut ett beløp: **Beløp = Kredit − Debit** med automatisk fortegn (positiv når kredit ≥ debit, negativ ellers).
- **Hvor:** CSV-parser og Excel-parser sjekker om både `credit` og `debit` er mappet; i så fall brukes de i stedet for en enkelt `amount`-kolonne. Import-validering godtar «Beløp» eller «Kredit + Debit».

---

## 4. Utvidede mappbare felter (som i gamle løsningen)

- **Hva:** Kolonnetilordningen støtter nå alle feltene fra den gamle løsningen, inkl. Kredit, Debit, Dato 2, Dim 8–10, Buntref, Notat, Bilag, Faktura, Forfall, Periode, Importnummer, Avgift, Tilleggstekst, Ref 2–6, Anleggsnr., Anleggsbeskrivelse, Bilagsart, Avsnr., Tid, Avvikende dato, Rate, Kundenavn, Kontonummer for bokføring, Fortegn.
- **Hvor:** `src/lib/import-scripts/types.ts` (INTERNAL_FIELDS, SCRIPT_FIELD_LABELS), `src/lib/parsers/types.ts` (ParsedTransaction), CSV/Excel-parsere og ImportPreview-dropdown.
- **Lagring:** Dim 8, 9 og 10 er lagt til i tabellen `transactions` (migrering). Øvrige nye felt er mappbare og leses inn; lagring i DB utover eksisterende kolonner er ikke implementert (kan evt. løses med `extra`-kolonne senere).

---

## 5. Import-preview: justerbare kolonner og horisontal scroll

- **Hva:** I CSV/Excel-forhåndsvisningen kan brukeren justere kolonnebredde via resize-handles i header, og tabellen har horisontal scroll ved mange kolonner.
- **Hvor:** `src/components/import/import-preview.tsx`.

---

## 6. DEVELOPMENT_RULES og compliance

- **Hva:** DEVELOPMENT_RULES.md er lagt i prosjektrot; compliance-sjekk er dokumentert i `docs/DEVELOPMENT_RULES_COMPLIANCE.md`. Import-API returnerer ikke lenger interne feildetaljer ved 500 (generisk melding + logging).
- **Hvor:** `DEVELOPMENT_RULES.md`, `docs/DEVELOPMENT_RULES_COMPLIANCE.md`, `src/app/api/import/route.ts`.
