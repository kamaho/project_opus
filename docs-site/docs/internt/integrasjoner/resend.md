---
title: Resend — E-post
sidebar_position: 6
---


## Oversikt

Resend håndterer all e-postsending i Revizo. Vi sender transaksjonelle e-poster —
dvs. e-poster utløst av hendelser i systemet, ikke markedsføring. Alle e-poster er
HTML-baserte med et design som følger Revizo sin visuelle profil.

## Arkitektur

```
Hendelse i Revizo (import, Smart Match, notat-omtale)
        ↓
Notification-system oppretter in-app-varsling
        ↓
Henter brukerens e-post fra Clerk
        ↓
Bygger HTML-e-post med Revizo-designtokens
        ↓
Sender via Resend API
```

## E-posttyper

| Type | Utløser | Subject-linje |
|---|---|---|
| **Notat-omtale** | Bruker nevnes med @mention i et notat | `{navn} nevnte deg i et notat` |
| **Smart Match fullført** | Smart Match kjøring er ferdig | `{klient} — ferdig avstemt ✓` eller `{klient} — {pct}% avstemt, {n} poster gjenstår` |
| **Import fullført** | Fil-import er behandlet | `Import fullført — {n} poster importert for {klient}` |
| **Agent-rapport** | Automatisk agent kjører rapport | `Revizo Rapport — {klient} — {dato}` |

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/lib/resend.ts` | Resend-klient, HTML-maler og sende-funksjoner |
| `src/lib/notifications.ts` | Orkestrerer in-app + e-postvarsling |
| `src/lib/ai/actions.ts` | AI-agent sender rapporter via Resend |
| `worker/job-runner.ts` | Background worker sender e-poster |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd | Default |
|---|---|---|---|
| `RESEND_API_KEY` | API-nøkkel for Resend | Ja (for e-post) | — |
| `RESEND_FROM_ADDRESS` | Avsenderadresse | Nei | `Revizo <noreply@accountcontrol.no>` |
| `NEXT_PUBLIC_APP_URL` | Base-URL for lenker i e-poster | Nei | `""` |

## Nøkkelfunksjoner

### Sende e-post om notat-omtale

```typescript
import { sendNoteMentionEmail } from "@/lib/resend";

await sendNoteMentionEmail({
  toEmail: "bruker@firma.no",
  fromUserName: "Ola Nordmann",
  noteText: "Sjekk denne transaksjonen",
  transactionDescription: "Faktura #1234",
  link: "https://app.revizo.no/dashboard/clients/abc/matching",
});
```

### Sende Smart Match-resultat

```typescript
import { sendSmartMatchEmail } from "@/lib/resend";

await sendSmartMatchEmail({
  toEmail: "bruker@firma.no",
  userName: "Ola Nordmann",
  clientName: "Bedrift AS",
  transactionCount: 150,
  periodFrom: "2026-01-01",
  periodTo: "2026-01-31",
  remainingOpen: 3,
  totalItems: 200,
  link: "https://app.revizo.no/dashboard/clients/abc/matching",
});
```

### Sende agent-rapport med PDF-vedlegg

```typescript
import { sendAgentReportEmail } from "@/lib/resend";

await sendAgentReportEmail({
  toEmail: "bruker@firma.no",
  userName: "Ola Nordmann",
  clientName: "Bedrift AS",
  matchCount: 45,
  transactionCount: 300,
  openItemsSet1: 5,
  openItemsSet2: 8,
  totalSet1: 150000.00,
  totalSet2: 149500.00,
  link: "https://...",
  pdfBuffer: pdfFileAsBuffer, // Valgfritt PDF-vedlegg
  reportDate: "2026-02-28",
});
```

## E-postdesign

Alle e-poster bruker en konsistent HTML-layout med designtokens som matcher Revizo:

| Token | Verdi | Beskrivelse |
|---|---|---|
| `bg` | `#fafafa` | Bakgrunn |
| `card` | `#ffffff` | Kort-bakgrunn |
| `fg` | `#171717` | Tekst |
| `muted` | `#737373` | Sekundær tekst |
| `brand` | `#38c96c` | Neon grønn (brand accent) |
| `btnBg` | `#171717` | Knapp-bakgrunn (mørk) |
| `radius` | `8px` | Avrunding |

Layout-strukturen:
1. **Header** — Revizo-logo (tekst + grønn dot)
2. **Card** — Hovedinnhold i hvitt kort med border
3. **Footer** — Avsenderinfo

Hjelpefunksjoner for innholdselementer: `heading()`, `paragraph()`, `mutedText()`,
`cta()` (call-to-action knapp), `statRow()`, `divider()`.

## Graceful degradation

Hvis `RESEND_API_KEY` mangler:
- `resend`-klienten settes til `null`
- Alle sende-funksjoner sjekker `if (!resend) return` tidlig
- In-app-varslingene fungerer fortsatt — kun e-post deaktiveres
- En `console.warn` logges ved oppstart

## Flyten: Varsling → E-post

Notification-systemet i `src/lib/notifications.ts` orkestrerer begge kanalene:

1. Lagrer in-app-varsling i `notifications`-tabellen
2. Henter brukerens e-postadresse fra Clerk (`clerkClient().users.getUser()`)
3. Kaller passende sende-funksjon fra `src/lib/resend.ts`
4. E-postfeil fanges og logges — de kastes **ikke** oppover (non-fatal)

## Feilsøking

### E-poster sendes ikke

1. Sjekk at `RESEND_API_KEY` er satt og gyldig
2. Sjekk at domenet er verifisert i Resend Dashboard
3. Se logger for `[resend] ... failed:` meldinger
4. Sjekk at brukerens e-postadresse finnes i Clerk

### E-poster havner i spam

1. Sjekk at DNS-records (SPF, DKIM, DMARC) er konfigurert for `accountcontrol.no`
2. Verifiser domenet i Resend Dashboard
3. Sjekk at `RESEND_FROM_ADDRESS` matcher et verifisert domene

### Feil avsenderadresse

Sjekk `RESEND_FROM_ADDRESS` miljøvariabel. Default er `Revizo <noreply@accountcontrol.no>`.

### PDF-vedlegg mangler i rapport-e-post

1. Sjekk at `pdfBuffer` faktisk genereres (se `worker/job-runner.ts`)
2. Sjekk filstørrelse — Resend har begrensning på vedleggstørrelse (25 MB)
3. Se logger for feil i PDF-generering

### Bruker mottar ikke e-post men in-app-varsling fungerer

1. E-posten finnes kanskje ikke i Clerk (sjekk `user.emailAddresses`)
2. E-postsendingen feilet silently — sjekk logger
3. Resend kan ha rate-limitert — sjekk Resend Dashboard

## Resend Dashboard

URL: https://resend.com/emails

Her kan du:
- Se sendte e-poster og status (delivered, bounced, etc.)
- Administrere domener og DNS-verifisering
- Se API-bruk og feilrater
- Sjekke bounce- og klagestatistikk
- Administrere API-nøkler

## Viktig å vite

- Resend er **ikke kritisk** — appen fungerer uten, men brukere mottar ikke e-poster
- E-postfeil er **non-fatal** — de logges men krasjer ikke prosessen
- In-app-varsling fungerer alltid, uavhengig av Resend
- Avsender-e-posten MÅ høre til et verifisert domene i Resend
- Alle e-poster er på **norsk** (bokmål)
- E-postene bruker inline CSS (ikke stylesheets) for e-postklient-kompatibilitet
