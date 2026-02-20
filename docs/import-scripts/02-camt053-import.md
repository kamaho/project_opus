# CAMT.053 – Import og script

## Standard vi bruker

Når kunden bestiller CAMT.053 / ISO20022 XML, ønsker vi **standard** format (c53s, camt.053s, camt053st). Mappingkode for DNB: **C053V2BA_ Sumposts only for both debit and credit** (basis/enkel).

Vi trenger normalt **ikke** camt.053 **utvidet** med mindre banken tilbyr det uten ekstra oppsett. Sjekk om filen er utvidet ved å søke i eksempelfilen etter kommentaren: `<!--Camt053 Extended details starts-->`.

## Kontroller at det er CAMT.053

Før script settes opp: sjekk at filene faktisk er **camt.053**, ikke camt.054. Banker aktiverer ofte feil filtype. Sjekk filhodet i Notepad/Notepad++:

- **Ønsket:** `xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"`
- **Vi støtter ikke camt.054** – be kunden stoppe med camt.054 og kun sende camt.053.

## Kontonr: BBAN vs IBAN

- Hvis filen har **BBAN** (uten landkode foran kontonummeret), bruk **AccountIdentification** for Kontonr (script eksempel 2, f.eks. SR-bank).
- Ellers bruk **Iban** for Kontonr (script eksempel 1, Nordea/DNB, TietoEvry).

I XML: under `<Acct>/<Id>/<Othr>` står kontonummeret; under `<SchmeNm>/<Cd>` står **BBAN** eller annet. Ved BBAN brukes AccountIdentification.

## Scripttyper

- **Alle poster uten remittance** (vanligst): `PARSEMODE;ALLRECORDSWITHOUTREMITTANCE;` – bruk som standard med mindre kunden trenger remittance eller sum-poster.
- **Sum-poster:** `PARSEMODE;SUMRECORDS;` – mindre brukt; bruker andre felt (f.eks. TxAmt, Proprietary) og kan inkludere CHECKDUPLICATES.

## Duplikater

- **BARENYE** på Dim2 med fallback (f.eks. `Dim2;Dim2;Fallback="TOM"`) løser mange tilfeller der for mange poster markeres som duplikater.
- **CHECKDUPLICATES** er fjernet i eksempel 1 pga. for høy feilrate; bruk Dim2 for BARENYE-duplikatsjekk.
- For Danske Bank: «Toppkonto» (sumfil daglig) kan gi duplikater – da kan CHECKDUPLICATES brukes (se f.eks. Sognekraft i Zendesk).

## Én script per bank

Når kunden har flere banker med camt.053, lag **én script per bank**. Scriptnavn: **Camt.053 - Banknavn**.
