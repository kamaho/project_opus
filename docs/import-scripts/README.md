# Importscript og filtolking — kunnskapsbase

Denne mappen inneholder dokumentasjon om hvordan vi leser filer, tolker dem og lager innlesningsscript. Kunnskapen stammer fra **script_builder**-prosjektet og brukes i project_opus for:

- Automatisk gjenkjenning av skilletegn, datoformat og felt (detectors)
- Forslag til kolonne-mapping ved CSV-import
- Generering av script-format for tegne-separerte filer og CAMT.053
- Validering og hjelpetekster i UI

## Filer

| Fil | Innhold |
|-----|--------|
| [01-tegnseparert-script-format.md](./01-tegnseparert-script-format.md) | CSV/tegne-separert: FILTYPE, SEPARATORTEGN, TEKSTKVALIFIKATOR, feltindeks, Dato1/Belop/Ref, ID, BARENYE |
| [02-camt053-import.md](./02-camt053-import.md) | CAMT.053: standard vs utvidet, BBAN vs IBAN, PARSEMODE, duplikater |

## Mapping til project_opus

- **Interne felt** (parsers/types): `date1`, `amount`, `reference`, `description`, `accountNumber`, `currency`, `dim1`–`dim7`, `sign`.
- **Script/AC-feltnavn** (i dokumentasjonen): `Dato1`, `Belop`, `Ref`, `Tekst`, `Kontonr`, `Valutakode`, `Dim1`–`Dim7`.
- Logikk for auto-deteksjon og script-generering ligger i `src/lib/import-scripts/`.

## Script Builder-kilde

Det opprinnelige Script Builder-prosjektet (Vite + React) ligger utenfor denne repo (f.eks. `script_builder/`). Her har vi portet kjernefunksjonene slik at de kan brukes i Next.js-appen uten å kjøre et eget verktøy.
