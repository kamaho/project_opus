# Valgfri tallformatering og datoformat

**Dato:** 2026-02-24

---

## Hva

Brukeren kan nå velge **tallformat** og **datoformat** for hele appen — både fra Design-panelet (høyreklikk → Smart panel → Design) og fra Innstillinger → Utseende.

### Tilgjengelige formater

| Type | Valg | Eksempel |
|------|------|----------|
| **Tallformat** | Norsk (standard) | 1 234 567,89 |
| | Engelsk | 1,234,567.89 |
| | Sveitsisk | 1'234'567.89 |
| **Datoformat** | Norsk (standard) | 24.02.2026 |
| | ISO | 2026-02-24 |
| | Amerikansk | 02/24/2026 |

Norsk er **standard** fordi de fleste brukerne er norske. Innstillingen lagres i nettleseren og gjelder øyeblikkelig uten sidelasting.

---

## Hvorfor

- **Utenlandske kildefiler:** Kunder mottar ofte data fra internasjonale systemer med engelsk eller sveitsisk formatering. Ved å la brukeren velge visningsformat, presenteres dataen på en måte de er vant til — uansett kilde.
- **Gjenkjennelse:** Finansfolk jobber med tall hele dagen. Feil tusenskilletegn eller desimaltegn forårsaker usikkerhet og feil. Riktig formatering reduserer kognitiv belastning.
- **Internasjonal skalerbarhet:** Når produktet skal selges til nordiske eller europeiske markeder, er formatering allerede på plass.

---

## Hvor det virker

Formateringen gjelder **alle beløp og datoer** i appen:

| Område | Detaljer |
|--------|----------|
| Mengde 1 og Mengde 2 (åpne poster) | Beløp-kolonnen, dato-kolonnen, sum i filterbar |
| Saldovisning | Inngående saldo i begge mengder |
| Lukkede poster | Beløp, dato, differanse, matchdato |
| Kontoliste | Venstre/høyre saldo, siste transaksjon/avstemming |
| Smart panel (kontekstmeny) | Beløpvisning i motpost-søk |
| Importdialog | Saldoeffekt ved filimport |
| Filbehandler | Importdatoer |
| MVA-avstemming | NOK-beløp |
| Varsler | Datovisning |
| Innstillinger-siden | Eget Formatering-kort med tallformat og datoformat |

---

## Live-formatering i inputfelt

Beløpsfelt formaterer nå **mens brukeren skriver**, ikke bare når feltet mister fokus:

| Bruker skriver | Vises (norsk) | Vises (engelsk) |
|----------------|---------------|-----------------|
| `1234` | `1 234` | `1,234` |
| `1234567,89` | `1 234 567,89` | `1,234,567.89` |
| `-50000` | `-50 000` | `-50,000` |

Markøren holder seg på riktig posisjon etter at tusenskilletegn settes inn, slik at det er sømløst å skrive videre.

---

## Teknisk oversikt

| Fil | Rolle |
|-----|-------|
| `src/lib/ui-preferences.ts` | Preferansemodell, lagring, formateringsfunksjoner (`formatNumber`, `formatDate`, `formatAmountLive`) |
| `src/contexts/ui-preferences-context.tsx` | React context med `useFormatting()` hook |
| `src/components/smart-panel/smart-panel-standard.tsx` | Design-panel UI for tallformat/datoformat |
| `src/app/dashboard/settings/page.tsx` | Innstillinger-side med formateringskort |
| `src/components/matching/*` | Alle matchingkomponenter bruker `useFormatting()` |

---

## Salgsvinkel

> «Account Control tilpasser seg dine brukere — ikke omvendt. Tallformat, datoformat og visningsinnstillinger kan endres med to klikk, og gjelder umiddelbart i hele appen. Norske standarder ut av boksen, med støtte for internasjonale formater når dataen kommer fra utlandet.»
