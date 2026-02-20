# import-scripts

Kjernefunksjoner fra **script_builder** for filtolkning og script-generering, integrert i project_opus.

## Innhold

- **types** — Interne feltnavn, script-labels, kolonnemapping, datoformater
- **detectors** — `detectSeparator`, `detectDateFormat`, `detectDataType`, `detectTextQualifier`, `guessField` (header → date1/amount/ref/description)
- **csv-meta** — `parseCsvToMeta` (CSV → forhåndsvisning + forslog), `metaToCsvConfig` (→ CsvParserConfig)
- **script-format** — `generateCsvScript`, `configToScript`, `classifyLine` (syntaks for script-visning)
- **camt-detector** — `detectCamt` (CAMT.053 vs 054, BBAN vs IBAN)
- **camt-script** — `getCamt053Script` (ferdige script for IBAN/BBAN, alle poster vs sum-poster)

## Bruk

- Ved CSV-import i matching-view brukes `parseCsvToMeta` + `metaToCsvConfig` for å foreslå kolonnemapping, så forhåndsvisning får riktig dato/beløp/tekst.
- Dokumentasjon og script-regler: `docs/import-scripts/`.

## Kilde

Script Builder (Vite-app) ligger utenfor repo; kunnskapsbasen og logikken er portet hit for bruk i Next.js.
