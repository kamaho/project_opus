# Tegnseparerte filer og script-format

## Filtyper

Tegnseparerte filer kan være `*.csv`, `*.txt` eller uten endelse. Over `[TRANSER]` brukes:

- `FILTYPE;TEGNSEPARERT`
- For Excel: `FILTYPE;Excel`

## Skilletegn og kvalifikator

- **Skilletegn:** `SEPARATORTEGN;<tegn>` — semikolon, komma, tabulator eller vertikal strek. Tabulator: `SEPARATORTEGN;CHR(9)`.
- **Tekstkvalifikator** for felter som inneholder skilletegn: `TEKSTKVALIFIKATOR;"`.

## Felttilordning under [TRANSER]

- Format: `<Feltnavn>;<Indeks>` (indeks fra 1).
- Eksempel: `Belop;3` og `Ref;4`.
- **Datofelter** trenger format: `Dato1;7;DD.MM.YYYY`. Bruk Y/M/D for år/måned/dag.

## Beløp og valuta

- Enten én kolonne: `Belop;<Indeks>`.
- Eller adskilt: `Kredit;<Indeks>` og `Debet;<Indeks>` (behold `BARENYE;Belop;`).
- **Valuta:** Bruk Valutabelop i tillegg til Belop ved avstemming i fremmedvaluta.

## ID-deklarasjon

For å prosessere kun bestemte linjer: `ID;<tekst eller mønster>;<Indeks>`.

- Tekst: `ID;Visa;3`
- Dato/tall med joker: `ID;??.??.????;1`
- Uten ID prosesseres alle linjer.

## Avansert

- **Header:** `HEADERID;...;` og felt med `;HEADER`.
- **Flere linjer:** `Ref;1/3` (kolonne 1, linje 3).
- **Delstreng:** `Ref;3[15,5]`.
- **Sammenslåing:** `Ref;3&5&7`.
