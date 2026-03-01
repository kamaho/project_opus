---
title: Tripletex — Regnskap
sidebar_position: 8
---


## Oversikt

Tripletex er et norsk regnskapssystem. Integrasjonen lar Revizo automatisk hente
regnskapsdata (hovedboksposteringer, banktransaksjoner, kontoplan, saldo) fra Tripletex
slik at brukerne slipper manuell import av filer.

Synkroniseringen kan gjøres manuelt (bruker klikker «Synkroniser») eller automatisk
via cron-jobb.

## Arkitektur

```
┌──────────────────────────────────────────────────────┐
│ Revizo                                               │
│                                                      │
│  UI (config dialog)                                  │
│       ↓                                              │
│  API Routes (/api/tripletex/*)                       │
│       ↓                                              │
│  Tripletex Client (src/lib/tripletex.ts)             │
│    - Session token management                        │
│    - Basic Auth (companyId:sessionToken)              │
│       ↓                                              │
│  Sync Engine (src/lib/tripletex/sync.ts)             │
│    - syncCompany, syncAccounts                       │
│    - syncPostings (Set 1), syncBankTransactions (Set 2) │
│    - syncBalances                                    │
│       ↓                                              │
│  Mappers (src/lib/tripletex/mappers.ts)              │
│    - Tripletex-format → Revizo-format                │
│       ↓                                              │
│  Database (transactions, accounts, companies)        │
└──────────────────────────────────────────────────────┘
                    ↕
          Tripletex REST API v2
          (api.tripletex.no/v2)
```

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/lib/tripletex.ts` | API-klient: session tokens, authenticated requests |
| `src/lib/tripletex/sync.ts` | Sync-logikk: company, accounts, postings, bank tx, balances |
| `src/lib/tripletex/mappers.ts` | Datamapping Tripletex → Revizo |
| `src/lib/tripletex/pagination.ts` | Paginering av Tripletex API-svar |
| `src/lib/tripletex/types.ts` | TypeScript-typer for Tripletex-data |
| `src/lib/tripletex/index.ts` | Eksporter |
| `src/app/api/tripletex/whoami/route.ts` | Helsesjekk-endepunkt |
| `src/app/api/tripletex/companies/route.ts` | List selskaper fra Tripletex |
| `src/app/api/tripletex/accounts/route.ts` | List kontoer fra Tripletex |
| `src/app/api/tripletex/sync-config/route.ts` | CRUD for synk-konfigurasjon |
| `src/app/api/tripletex/sync/route.ts` | Manuell synkronisering |
| `src/app/api/cron/tripletex-sync/route.ts` | Automatisk synk (cron-jobb) |
| `src/components/settings/tripletex-config-dialog.tsx` | UI for konfigurasjon |
| `src/components/settings/tripletex-tab.tsx` | Innstillinger-fane |
| `src/lib/db/migrations/0008_add_tripletex_integration.sql` | Database-migrasjon |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd | Eksempel |
|---|---|---|---|
| `TRIPLETEX_API_BASE_URL` | API base-URL | Ja (for integrasjon) | `https://tripletex.no/v2` (prod) |
| `TRIPLETEX_CONSUMER_TOKEN` | Consumer token (identifiserer Revizo som integrasjon) | Ja (for integrasjon) | — |
| `TRIPLETEX_EMPLOYEE_TOKEN` | Employee token (identifiserer brukeren) | Ja (for integrasjon) | — |

### Test vs. produksjon

| Miljø | Base-URL |
|---|---|
| Test | `https://api-test.tripletex.tech/v2` |
| Produksjon | `https://tripletex.no/v2` |

**Viktig**: Bruk alltid test-miljøet under utvikling. Consumer token og employee token
er ulike for test og prod.

## Autentisering

Tripletex bruker et **trestegs token-system**:

### 1. Consumer Token

Identifiserer Revizo som integrasjonspartner. Utstedes av Tripletex når man registrerer
en integrasjon. Langsiktig — endres sjelden.

### 2. Employee Token

Identifiserer en spesifikk bruker/tilgang. Kan ha begrensede rettigheter.

### 3. Session Token

Midlertidig token som opprettes med consumer + employee tokens. Utløper ved **midnatt CET**
samme dag. Caches i minnet og fornyes automatisk.

```
Consumer Token + Employee Token → Session Token (via PUT /token/session/:create)
                                       ↓
                              Basic Auth: companyId:sessionToken
                                       ↓
                              API-forespørsler
```

### Session token-flyten i koden

```typescript
// Automatisk i tripletex.ts:
const sessionToken = await getSessionToken();
// 1. Sjekker cache — returnerer cachet token hvis gyldig
// 2. Ellers: POST til /token/session/:create med consumer + employee tokens
// 3. Cacher nytt token med utløpsdato (i morgen)
```

## Synkronisering

### Konfigurasjon

Hver klient kan ha en `tripletex_sync_config` som definerer:

- Hvilket Tripletex-selskap som skal synkes
- Hvilke kontoer som hører til **Mengde 1** (hovedbok) og **Mengde 2** (bank)
- Startdato (`dateFrom`)
- Siste synk-tidspunkt og bookmark-IDer for inkrementell synk

### Hva som synkes

| Data | Tripletex-endepunkt | Revizo-tabell | Set |
|---|---|---|---|
| Selskap | `/company/{id}` | `companies` | — |
| Kontoplan | `/ledger/account` | `accounts` | — |
| Hovedboksposteringer | `/ledger/posting` | `transactions` | Mengde 1 |
| Banktransaksjoner | `/bank/statement/transaction` | `transactions` | Mengde 2 |
| Saldo (åpningsbalanse) | `/balance` | `clients` | — |

### Synk-prosessen (runFullSync)

```
1. syncPostings(config)          — Hent ledger postings → transactions (set 1)
2. syncBankTransactions(config)  — Hent bank tx → transactions (set 2)
3. syncBalances(config)          — Oppdater åpningsbalanser
```

### Inkrementell synk

Synk-motoren holder styr på siste synkede ID (`lastSyncPostingId`, `lastSyncBankTxId`)
for å unngå å hente data som allerede er importert. Duplikater filtreres også via
`externalId`-unikhet i databasen.

### Paginering

Tripletex API har en grense på **1000 elementer per side**. `fetchAllPages()` i
`pagination.ts` håndterer dette automatisk og henter alle sider.

### Data-mapping

`mappers.ts` konverterer Tripletex-format til Revizo-format:

| Tripletex | Revizo |
|---|---|
| `posting.date` | `transaction.date1` |
| `posting.amount` | `transaction.amount` |
| `posting.account.number` | `transaction.accountNumber` |
| `posting.voucher.number` | `transaction.bilag` |
| `posting.invoiceNumber` | `transaction.faktura` |
| `bankTransaction.amountCurrency` | `transaction.amount` |
| `bankTransaction.description` | `transaction.description` |

### Automatisk synk (Cron)

En cron-jobb (`/api/cron/tripletex-sync`) kjører regelmessig og synkroniserer
alle aktive konfigurasjoner. Konfigurert via Vercel Cron Jobs.

## API-endepunkter

| Metode | Sti | Beskrivelse |
|---|---|---|
| GET | `/api/tripletex/whoami` | Helsesjekk — verifiser tilkobling |
| GET | `/api/tripletex/companies` | List tilgjengelige selskaper |
| GET | `/api/tripletex/accounts?companyId=X` | List kontoer for et selskap |
| GET/POST/PUT | `/api/tripletex/sync-config` | CRUD for synk-konfigurasjon |
| POST | `/api/tripletex/sync` | Start manuell synkronisering |
| GET | `/api/cron/tripletex-sync` | Cron: automatisk synk |

## Feilsøking

### «Tripletex session creation failed»

1. Sjekk at `TRIPLETEX_CONSUMER_TOKEN` og `TRIPLETEX_EMPLOYEE_TOKEN` er korrekte
2. Sjekk at du bruker riktig `TRIPLETEX_API_BASE_URL` (test vs. prod)
3. Token kan ha utløpt — sjekk i Tripletex-admin
4. Se logger for detaljert feilmelding fra Tripletex API

### «Tripletex session response missing token»

API-kallet lyktes, men responsen mangler token. Sjekk:
1. At tokens er gyldige og ikke deaktiverte
2. At API-versjonen er korrekt (v2)

### Synk kjører men ingen data importeres

1. Sjekk at synk-konfig har riktige konto-IDer (set1/set2)
2. Sjekk at `dateFrom` er satt riktig (ikke fremtidig dato)
3. Sjekk om det allerede finnes data med samme `externalId` (duplikatfiltrering)
4. Kjør `/api/tripletex/whoami` for å verifisere tilkobling
5. Sjekk at det finnes data i Tripletex for den aktuelle perioden

### Synk er treg

1. Tripletex har paginering på 1000 — mange sider = mange API-kall
2. Sjekk antall kontoer i synk-konfig — flere kontoer = flere parallelle hentinger
3. Sjekk Tripletex API-responstider (de kan ha nedetid/treg respons)
4. Inkrementell synk bør være raskere enn full synk (sjekk bookmark-IDer)

### Data er feil / mapping-problemer

1. Sjekk `mappers.ts` for mapping-logikk
2. Sammenlign data i Tripletex med Revizo — se på `externalId` for å finne samme post
3. Sjekk `enabledFields` i synk-konfig — noen felter kan være deaktivert

### Cron-jobb kjører ikke

1. Sjekk Vercel Cron-konfigurasjon i `vercel.json`
2. Sjekk Vercel Dashboard → Crons for kjøringslogg
3. Sjekk at cron-endepunktet er riktig autentisert

### Session token-cache er ugyldig

Session tokens caches i minnet (variabel `cachedSession`). Ved serverless-deploy
kan cachen tømmes mellom kall. Systemet håndterer dette automatisk — nytt token
opprettes ved behov. Hvis det allikevel er problemer:
1. Sjekk at klokken på serveren er riktig (token utløper ved midnatt CET)
2. Sjekk Tripletex API-status

## Tripletex API-dokumentasjon

- **API Explorer**: https://tripletex.no/v2-docs/
- **Test-miljø**: https://api-test.tripletex.tech/v2-docs/
- **Integrasjon-portal**: https://developer.tripletex.no/

## Database-skjema

Synk-konfigurasjonen lagres i `tripletex_sync_configs`-tabellen:

| Kolonne | Beskrivelse |
|---|---|
| `id` | Primærnøkkel |
| `clientId` | Referanse til Revizo-klient |
| `tenantId` | Organisasjon (fra Clerk) |
| `tripletexCompanyId` | Tripletex selskaps-ID |
| `set1TripletexAccountIds` | Konto-IDer for Mengde 1 (hovedbok) |
| `set2TripletexAccountIds` | Konto-IDer for Mengde 2 (bank) |
| `dateFrom` | Synk startdato |
| `lastSyncPostingId` | Bookmark for inkrementell posting-synk |
| `lastSyncBankTxId` | Bookmark for inkrementell bank tx-synk |
| `lastSyncAt` | Siste vellykkede synk-tidspunkt |
| `enabledFields` | Hvilke felter som skal synkes/mappes |

## Viktig å vite

- Tripletex-integrasjonen er **ikke kritisk** — brukere kan importere filer manuelt
- Session tokens utløper ved **midnatt CET** — fornyes automatisk
- **Consumer token** er knyttet til Revizo som integrasjon — endres sjelden
- **Employee token** kan ha begrensede rettigheter — sjekk tilgang i Tripletex
- Paginering er automatisk — maks 1000 per side fra Tripletex
- Duplikater filtreres via `externalId` — trygt å kjøre synk flere ganger
- Test alltid mot `api-test.tripletex.tech` under utvikling
- Tripletex API kan ha nedetid — sjekk https://status.tripletex.no
