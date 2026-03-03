---
title: Tripletex — Regnskap
sidebar_position: 8
---

# Tripletex — Regnskapssystem-integrasjon

> **Status:** Pilotklart | **Sist oppdatert:** 2026-03-03
>
> Komplett intern teknisk dokumentasjon: [`docs/integrations/tripletex.md`](https://github.com/your-org/revizo/blob/main/docs/integrations/tripletex.md)

## Oversikt

Tripletex-integrasjonen lar Revizo automatisk synkronisere regnskapsdata
(hovedboksposteringer, banktransaksjoner, kontoplan, saldo) fra Tripletex.
Bruker slipper manuell import av filer.

**To synk-moduser:**
- **Manuelt** — bruker klikker «Synkroniser nå»
- **Automatisk** — cron-jobb hvert 30. minutt (Vercel Cron)

## Arkitektur

```
Tripletex REST API v2
         ↕
 Revizo Tripletex Client (retry, session mgmt, per-tenant auth)
         ↓
 Sync Engine (inkrementell: postings, bank tx, balances)
         ↓
 Mappers (Tripletex → Revizo-format, konfigurerbare felt)
         ↓
 Database (transactions, accounts, companies)
```

## Nøkkelfiler

| Fil | Formål |
|---|---|
| `src/lib/tripletex.ts` | API-klient, session tokens, retry (3x), `TripletexError` |
| `src/lib/tripletex/sync.ts` | `runFullSync`, `syncPostings`, `syncBankTransactions`, `syncBalances` |
| `src/lib/tripletex/mappers.ts` | Datamapping, `enabledFields`, `FIELD_LABELS` |
| `src/lib/tripletex/pagination.ts` | `fetchAllPages` (1000/side) |
| `src/lib/accounting/adapters/tripletex.ts` | Lønn, MVA, reskontro, feriepenger |
| `src/app/api/tripletex/connect/route.ts` | GET (status) + POST (koble til med tokens) |
| `src/app/api/tripletex/sync-config/route.ts` | GET/POST/PATCH for synk-konfigurasjon |
| `src/app/api/cron/tripletex-sync/route.ts` | Automatisk synk (parallell, Sentry) |
| `src/components/settings/tripletex-config-dialog.tsx` | Full tilkobling + konfigurasjon UI |

## Sikkerhet

| Aspekt | Implementasjon |
|---|---|
| Token-lagring | AES-256-GCM kryptert (`ENCRYPTION_KEY` env var) |
| Cron-auth | `CRON_SECRET` bearer token |
| Multi-tenancy | `withTenant()` + `requireAdmin` for connect |
| Credential resolution | Per-tenant DB → env var fallback |

## Miljøvariabler

| Variabel | Formål | Påkrevd |
|---|---|---|
| `ENCRYPTION_KEY` | Token-kryptering (64 hex-tegn) | **Ja** |
| `CRON_SECRET` | Cron-autentisering | **Ja** |
| `TRIPLETEX_API_BASE_URL` | Fallback API-URL | Nei |
| `TRIPLETEX_CONSUMER_TOKEN` | Fallback consumer token | Nei |
| `TRIPLETEX_EMPLOYEE_TOKEN` | Fallback employee token | Nei |

## Synk-detaljer

### Inkrementell synk

- **Første synk:** Henter alt fra `dateFrom` til i dag
- **Påfølgende synk:** Bruker `id=>{lastSyncPostingId}` som filter
- **Duplikatbeskyttelse:** `externalId`-sjekk (`posting:{id}` / `bank:{id}`)
- **Batch-størrelse:** 500 per insert

### Cron (`/api/cron/tripletex-sync`)

- Kjører hvert 30. minutt (`vercel.json`)
- Parallell prosessering: maks 3 samtidige synk
- Error isolation: én feilende synk stopper ikke andre
- Sentry-rapportering per feil (med `configId` og `clientId` tags)
- Timeout: 300 sekunder (Vercel-maks)

### Konfigurerbare felt

| Felt | Standard | Beskrivelse |
|---|---|---|
| `description` | På | Beskrivelse |
| `bilag` | På | Bilagsnummer |
| `faktura` | Av | Fakturanummer |
| `reference` | På | Referanse |
| `foreignAmount` | Av | Valutabeløp |
| `accountNumber` | På | Kontonummer |

## Feilhåndtering

Alle API-ruter bruker `TripletexError` med norske brukermeldinger:

| Statuskode | Brukermelding |
|---|---|
| 401 | Tripletex-autentisering feilet. Sjekk at tokenene er korrekte. |
| 403 | Ingen tilgang. Sjekk at brukerrettigheter er satt opp i Tripletex. |
| 429 | For mange forespørsler til Tripletex. Prøv igjen om litt. |
| 5xx | Tripletex-serveren svarte med en feil. Prøv igjen senere. |

Retry: 3 forsøk med exponential backoff (1s → 2s → 4s) for 429 og 5xx.

## Webhook-system (sanntid)

Sanntidsoppdateringer via Tripletex Event API:

- **Mottak:** `POST /api/webhooks/tripletex?tenant={id}` → `webhook_inbox`
- **Prosessering:** Railway Worker poller hvert 5s, debouncer, kjører sync
- **Abonnement:** Opprettes automatisk ved connect, lagres i `webhook_subscriptions`
- **Auth:** Bearer token (kryptert AES-256-GCM), valideres ved mottak
- **Retry:** 5 forsøk med exponential backoff (30s → 480s), Sentry ved permanent feil
- **Cron:** Beholdes som fallback — webhooks er «best effort»

### Event-typer

`voucher.create/update/delete` → inkrementell sync, `account.create/update/delete` → kontoplan-sync

### Admin

- `GET /api/admin/webhooks/inbox?status=failed` — se feilede events
- `POST /api/admin/webhooks/inbox` + `{ ids: [...] }` — replay
- `GET /api/admin/webhooks/subscriptions` — se abonnementer

## Database-tabeller

### `tripletex_connections`

Per-tenant krypterte API-credentials. Unik på `tenant_id`.

### `tripletex_sync_configs`

Synk-konfigurasjon per klient. Unik på `client_id`. Inkluderer:
- Konto-valg (sett 1 + sett 2, multi-konto)
- Bookmark-IDer for inkrementell synk
- Synk-intervall og status

### `webhook_inbox`

Persistent kø for webhook-events. Dedupliseres via `(tenant_id, source, external_id)`.

### `webhook_subscriptions`

Aktive abonnementer per tenant/source. Unik på `(tenant_id, source)`.

## Feilsøking (hurtigguide)

| Problem | Sjekk |
|---|---|
| «Autentisering feilet» | Consumer/employee tokens, riktig miljø (test/prod) |
| Synk gir 0 poster | `lastSyncPostingId` — data er allerede synket |
| Cron kjører ikke | `vercel.json`, Vercel Dashboard → Crons |
| Tokens leses feil | `ENCRYPTION_KEY` lik i alle miljøer |
| Kontonavn utdatert | `syncAccounts` oppdaterer nå eksisterende kontoer |
| Webhooks mottas ikke | Sjekk `webhook_subscriptions.status`, re-subscribe om nødvendig |
| Webhook-events prosesseres ikke | Sjekk Railway Worker og `GET /api/health` (`stalePending`) |

## Lenker

- [Tripletex API Explorer](https://tripletex.no/v2-docs/)
- [Tripletex Test-miljø](https://api-test.tripletex.tech/v2-docs/)
- [Tripletex Statusside](https://status.tripletex.no)
- [Intern teknisk docs](https://github.com/your-org/revizo/blob/main/docs/integrations/tripletex.md)
