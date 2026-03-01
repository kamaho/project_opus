---
title: Sentry — Feilovervåking
sidebar_position: 7
---


## Oversikt

Sentry fanger opp feil (exceptions), overvåker ytelse, og tar opp brukersesjoner
(Session Replay) for å hjelpe med feilsøking i produksjon. Integrasjonen dekker
tre runtime-miljøer: klient (browser), server (Node.js), og edge (Vercel Edge Runtime).

## Arkitektur

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Client-side │    │  Server-side │    │  Edge        │
│  (Browser)   │    │  (Node.js)   │    │  (Vercel)    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
                    Sentry.io Dashboard
                    (Events, Traces, Replays)
```

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `sentry.client.config.ts` | Klient-side Sentry-konfigurasjon |
| `sentry.server.config.ts` | Server-side Sentry-konfigurasjon |
| `sentry.edge.config.ts` | Edge runtime Sentry-konfigurasjon |
| `src/instrumentation.ts` | Sentry-initialisering (Next.js instrumentation) |
| `src/app/global-error.tsx` | Global error boundary med Sentry-rapportering |
| `src/app/dashboard/error.tsx` | Dashboard error boundary med Sentry-rapportering |
| `next.config.ts` | Sentry webpack plugin (source maps) |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd | Brukes av |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN for klient-side | Nei | Browser |
| `SENTRY_DSN` | DSN for server-side | Nei | Server + Edge |
| `SENTRY_ORG` | Sentry organisasjon | Nei (kun deploy) | Source maps |
| `SENTRY_PROJECT` | Sentry prosjektnavn (`account-control`) | Nei (kun deploy) | Source maps |
| `SENTRY_AUTH_TOKEN` | Auth token for source map upload | Nei (kun deploy) | Build |

## Konfigurasjon

### Klient-side (`sentry.client.config.ts`)

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,           // 10% av transaksjoner spores
  replaysSessionSampleRate: 0,      // Ingen random session replays
  replaysOnErrorSampleRate: 1.0,    // 100% replay ved feil
  integrations: [Sentry.replayIntegration()],
});
```

Nøkkelpunkter:
- **Session Replay** er aktivert kun ved feil (100%) — ikke for vanlige sesjoner (0%)
- **Traces** samples med 10%
- `request.data` fjernes fra events for å beskytte sensitiv finansdata

### Server-side (`sentry.server.config.ts`)

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
```

- Samme 10% trace sampling som klient
- `request.data` filtreres bort (sensitiv data)

### Error Boundaries

To error boundaries fanger UI-feil:

1. **`global-error.tsx`** — Fanger feil på toppnivå (hele appen)
2. **`dashboard/error.tsx`** — Fanger feil innenfor dashboard-layouten

Begge rapporterer automatisk til Sentry.

### Source Maps

Source maps lastes opp automatisk ved build via Sentry webpack plugin i `next.config.ts`.
Dette gir lesbare stack traces i Sentry i stedet for minifisert kode.

## Sensitiv data-filtrering

For å beskytte finansdata filtreres `request.data` bort fra alle events:

```typescript
beforeSend(event) {
  if (event.request?.data) {
    delete event.request.data;
  }
  return event;
}
```

Dette betyr at request body (som kan inneholde transaksjonsdata, beløp, etc.)
**aldri** sendes til Sentry.

## Graceful degradation

Sentry er fullstendig valgfri:
- Hvis DSN mangler, settes `enabled: false`
- Ingen feil kastes, ingen logger — Sentry er bare stille
- Appen fungerer 100% normalt uten Sentry

## Feilsøking

### Feil dukker ikke opp i Sentry

1. Sjekk at `NEXT_PUBLIC_SENTRY_DSN` (klient) eller `SENTRY_DSN` (server) er satt
2. Sjekk at DSN er korrekt format: `https://xxx@xxx.ingest.sentry.io/xxx`
3. Sjekk at Sentry-prosjektet ikke er deaktivert
4. Sjekk at feilen faktisk er uhandtert (caught exceptions rapporteres ikke automatisk)
5. Trace sampling (10%) kan bety at noen events droppes

### Source maps fungerer ikke (minifiserte stack traces)

1. Sjekk at `SENTRY_AUTH_TOKEN` er satt i build-miljøet
2. Sjekk at `SENTRY_ORG` og `SENTRY_PROJECT` er korrekte
3. Kjør build lokalt og sjekk for Sentry plugin-output
4. Se Sentry Dashboard → Settings → Source Maps for uploadet versjon

### Session Replay viser ikke noe

1. `replaysSessionSampleRate` er `0` — replay starter kun ved feil
2. Sjekk at feilen faktisk ble fanget av Sentry
3. Replay-data kan ta noen minutter å prosessere

### For mange events / høy kostnad

1. Sjekk `tracesSampleRate` — 0.1 betyr 10% av transaksjoner
2. Sjekk om det er en feil-loop (samme feil rapporteres gjentatte ganger)
3. Se Sentry Dashboard → Stats for forbruksoversikt
4. Vurder å legge til `ignoreErrors` for kjente, ufixede feil

## Sentry Dashboard

URL: https://sentry.io (varierer per org)

Her kan du:
- Se feil sortert etter frekvens og påvirkning
- Se stack traces med source maps
- Se Session Replays for feil-sesjoner
- Overvåke ytelse (tracing)
- Sette opp varsler (Slack, e-post, etc.)
- Se trender over tid

### Nyttige visninger

| Visning | Hva du ser |
|---|---|
| **Issues** | Alle unike feil, gruppert |
| **Performance** | Responstider, trege transaksjoner |
| **Replays** | Video-opptak av brukersesjoner med feil |
| **Alerts** | Konfigurerte varsler |
| **Stats** | Event-volum og kvoter |

## Viktig å vite

- Sentry er **ikke kritisk** — appen fungerer uten, men du mister feilinnsikt
- **Sensitiv data filtreres** — request bodies sendes aldri til Sentry
- **Session Replay** er kun aktiv ved feil (personvern)
- Source maps lastes opp under build — uten dem er stack traces uleselige
- Sampling rate (10%) betyr at ikke alle transaksjoner spores — juster ved behov
