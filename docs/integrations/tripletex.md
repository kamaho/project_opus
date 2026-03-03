# Tripletex — Regnskapssystem-integrasjon

> **Sist oppdatert:** 2026-03-03
> **Status:** Pilotklart
> **Eier:** Integrasjonsteamet

## Oversikt

Tripletex er et norsk regnskapssystem. Integrasjonen lar Revizo automatisk hente
regnskapsdata (hovedboksposteringer, banktransaksjoner, kontoplan, saldo) fra Tripletex
slik at brukerne slipper manuell import av filer.

Synkroniseringen kan gjøres:
- **Manuelt** — bruker klikker «Synkroniser nå» i UI
- **Automatisk** — cron-jobb hvert 30. minutt (konfigurerbart per klient)
- **Sanntid** — webhook-abonnement: Tripletex sender events ved endringer → Revizo synker inkrementelt

### Dataflyt

```
Tripletex REST API v2
         ↕                             ↓ (webhooks)
┌────────────────────────────────────────────────────────────────┐
│ Revizo                                                         │
│                                                                │
│  ┌─────────────────────┐   ┌──────────────────────────────┐   │
│  │ UI                  │   │ Cron (/api/cron/tripletex-sync)│  │
│  │ tripletex-config-   │   │ Vercel Cron, */30 * * * *     │  │
│  │ dialog.tsx           │   └──────────────┬───────────────┘  │
│  └──────────┬──────────┘                   │                   │
│             ↓                              ↓                   │
│  ┌──────────────────────────────────────────────┐              │
│  │ API Routes (/api/tripletex/*)                 │              │
│  │ connect · whoami · companies · accounts       │              │
│  │ sync-config · sync                            │              │
│  └──────────────────────┬───────────────────────┘              │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │ Tripletex Client (src/lib/tripletex.ts)       │              │
│  │ • Per-tenant credential resolution             │              │
│  │ • Session token management (cache + renewal)   │              │
│  │ • Retry med exponential backoff (3x)           │              │
│  │ • TripletexError med brukervenlige meldinger   │              │
│  └──────────────────────┬───────────────────────┘              │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │ Sync Engine (src/lib/tripletex/sync.ts)       │              │
│  │ syncCompany → syncAccounts → syncPostings     │              │
│  │ → syncBankTransactions → syncBalances          │              │
│  └──────────────────────┬───────────────────────┘              │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │ Mappers (mappers.ts) · Types (types.ts)       │              │
│  │ Pagination (pagination.ts)                    │              │
│  └──────────────────────┬───────────────────────┘              │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │ Database                                      │              │
│  │ tripletex_connections · tripletex_sync_configs │              │
│  │ companies · accounts · transactions · clients  │              │
│  │ webhook_inbox · webhook_subscriptions · sync_cursors│            │
│  └──────────────────────────────────────────────┘              │
│                         ↑                                      │
│  ┌──────────────────────────────────────────────┐              │
│  │ Webhook System                                │              │
│  │ POST /api/webhooks/tripletex → webhook_inbox   │              │
│  │ Railway Worker poll → debounce → sync          │              │
│  │ subscription-manager → Tripletex Event API    │              │
│  └──────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

---

## Filer i kodebasen

### Kjerne-bibliotek

| Fil | Beskrivelse |
|---|---|
| `src/lib/tripletex.ts` | API-klient: session tokens, retry, `TripletexError`, `tripletexRequest/Get/Post/Put/Delete`, `tripletexWhoAmI` |
| `src/lib/tripletex/sync.ts` | Synk-motor: `syncCompany`, `syncAccounts`, `syncPostings`, `syncBankTransactions`, `syncBalances`, `runFullSync` |
| `src/lib/tripletex/mappers.ts` | Datamapping Tripletex → Revizo, feltkonfigurasjon (`EnabledFields`, `FIELD_LABELS`) |
| `src/lib/tripletex/pagination.ts` | `fetchAllPages` — automatisk paginering (1000 per side) |
| `src/lib/tripletex/types.ts` | TypeScript-typer: `TxCompany`, `TxAccount`, `TxPosting`, `TxBankTransaction`, `TxBalance` |
| `src/lib/tripletex/index.ts` | Barrel-eksporter |

### API-ruter

| Fil | Metode | Beskrivelse |
|---|---|---|
| `src/app/api/tripletex/connect/route.ts` | GET, POST | Sjekk tilkoblingsstatus / koble til med tokens |
| `src/app/api/tripletex/whoami/route.ts` | GET | Helsesjekk — verifiser sesjon mot Tripletex |
| `src/app/api/tripletex/companies/route.ts` | GET | List selskaper tilgjengelig via tenant-tokens |
| `src/app/api/tripletex/accounts/route.ts` | GET | List kontoer (filtrerer vekk inaktive) |
| `src/app/api/tripletex/sync-config/route.ts` | GET, POST, PATCH | CRUD for synk-konfigurasjon per klient |
| `src/app/api/tripletex/sync/route.ts` | POST | Start manuell synkronisering |
| `src/app/api/cron/tripletex-sync/route.ts` | GET | Cron: automatisk synk med parallellisering |
| `src/app/api/webhooks/tripletex/route.ts` | POST | Mottar webhook events fra Tripletex (public) |
| `src/app/api/webhooks/subscriptions/route.ts` | GET, POST, DELETE | Webhook-abonnement per tenant |
| `src/app/api/admin/webhooks/inbox/route.ts` | GET, POST | Admin: list events, replay |
| `src/app/api/admin/webhooks/subscriptions/route.ts` | GET | Admin: list abonnementer |

### UI-komponenter

| Fil | Beskrivelse |
|---|---|
| `src/components/settings/tripletex-config-dialog.tsx` | Dialog: tilkobling, selskapsvalg, multi-konto, feltkonfigurasjon |
| `src/components/settings/tripletex-tab.tsx` | Innstillinger-fane med komplett tilkoblingsflow |

### Webhook-system

| Fil | Beskrivelse |
|---|---|
| `src/lib/webhooks/receiver.ts` | Generisk insert-funksjon: `receiveWebhook()`, `receiveWebhookBatch()` |
| `src/lib/webhooks/subscription-manager.ts` | Subscription CRUD: `subscribe()`, `unsubscribe()`, `verifySubscription()` |
| `src/lib/webhooks/sources/types.ts` | Felles typer: `WebhookSourceAdapter`, `NormalizedWebhookEvent` |
| `src/lib/webhooks/sources/tripletex.ts` | Tripletex-adapter: validering, normalisering, event-mapping |
| `src/app/api/webhooks/tripletex/route.ts` | POST-endepunkt for Tripletex webhooks (public) |
| `src/app/api/webhooks/subscriptions/route.ts` | Subscription-håndtering (GET/POST/DELETE) |
| `src/app/api/admin/webhooks/inbox/route.ts` | Admin: list events, replay feilede |
| `src/app/api/admin/webhooks/subscriptions/route.ts` | Admin: list abonnementer |
| `worker/webhook-processor.ts` | Worker: poll, debounce, routing, retry |

### Adapter

| Fil | Beskrivelse |
|---|---|
| `src/lib/accounting/adapters/tripletex.ts` | Accounting-adapter: lønn, MVA, kundreskontro, leverandørreskontro, feriepenger |

### Sikkerhet og kryptering

| Fil | Beskrivelse |
|---|---|
| `src/lib/crypto.ts` | AES-256-GCM kryptering/dekryptering av tokens |
| `scripts/encrypt-tripletex-tokens.ts` | Engangsskript for å kryptere eksisterende tokens i DB |

### Konfigurasjon

| Fil | Beskrivelse |
|---|---|
| `vercel.json` | Vercel Cron: `/api/cron/tripletex-sync` hvert 30. minutt |
| `src/middleware.ts` | Unntar `/api/cron/(.*)` og `/api/webhooks/(.*)` fra autentisering |

---

## Sikkerhet

### Token-lagring

Tripletex consumer- og employee-tokens lagres **kryptert** i databasen:

| Aspekt | Implementasjon |
|---|---|
| **Algoritme** | AES-256-GCM |
| **Nøkkel** | `ENCRYPTION_KEY` env var (64 hex-tegn / 32 bytes) |
| **Format** | `enc::` prefix + base64(IV + ciphertext + auth tag) |
| **Deteksjon** | `isEncrypted()` sjekker prefix — støtter migrering fra plaintext |

### Cron-autentisering

Cron-endepunktet er beskyttet med `CRON_SECRET`:
```
Authorization: Bearer {CRON_SECRET}
```
Middleware unntar `/api/cron/(.*)` fra Clerk-autentisering.

### Multi-tenancy

- Alle API-ruter bruker `withTenant()` — krever autentisert bruker + organisasjon
- `connect/route.ts` krever i tillegg admin-rolle (`requireAdmin`)
- Synk-konfigurasjoner er isolert per `tenantId`
- Credential resolution sjekker per-tenant DB-oppføring først, faller tilbake til env vars

---

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|---|---|---|
| `TRIPLETEX_API_BASE_URL` | API base-URL (fallback for tenants uten egne tokens) | Nei* |
| `TRIPLETEX_CONSUMER_TOKEN` | Consumer token (fallback) | Nei* |
| `TRIPLETEX_EMPLOYEE_TOKEN` | Employee token (fallback) | Nei* |
| `ENCRYPTION_KEY` | 64 hex-tegn for AES-256-GCM kryptering av tokens | **Ja** |
| `CRON_SECRET` | Autentisering for cron-endepunkt | **Ja** |

\* Env-var-tokens er kun nødvendig som fallback. I produksjon lagres per-tenant tokens kryptert i DB.

### Test vs. produksjon

| Miljø | Base-URL |
|---|---|
| Test | `https://api-test.tripletex.tech/v2` |
| Produksjon | `https://tripletex.no/v2` |

**Viktig**: Bruk alltid testmiljøet under utvikling. Consumer token og employee token
er ulike for test og prod.

---

## Autentisering mot Tripletex API

Tripletex bruker et **trestegs token-system**:

### 1. Consumer Token

Identifiserer Revizo som integrasjonspartner. Utstedes av Tripletex når man registrerer
en integrasjon. Langsiktig — endres sjelden.

### 2. Employee Token

Identifiserer en spesifikk bruker/tilgang. Kan ha begrensede rettigheter.
Hentes fra Tripletex under **Innstillinger → Integrasjon → API-tilgang**.

### 3. Session Token

Midlertidig token som opprettes med consumer + employee tokens.
Utløper ved **midnatt CET** samme dag. Caches i minnet og fornyes automatisk.

```
Consumer Token + Employee Token
         ↓
PUT /token/session/:create
         ↓
Session Token (gyldig til midnatt)
         ↓
Basic Auth: {companyId}:{sessionToken}
         ↓
Alle API-forespørsler
```

### Session-cache

Session tokens caches i en modul-level array med nøkkel basert på SHA-256 hash av
`baseUrl:consumerToken:employeeToken`. Tokenet gjenbrukes så lenge `expirationDate > today`.

**Serverless-merknad**: I Vercel serverless tømmes cachen ved cold starts. Dette er
forventet oppførsel — nytt session token opprettes automatisk. Tripletex tillater
flere samtidige session tokens.

---

## Retry-logikk og feilhåndtering

### Retry

Alle forespørsler via `tripletexRequest()` har automatisk retry:

| Parameter | Verdi |
|---|---|
| Maks forsøk | 3 (+ opprinnelig = 4 totalt) |
| Retrybare statuskoder | 429, 500, 502, 503, 504 |
| Backoff | Eksponentiell: 1s → 2s → 4s (maks 8s) |
| Nettverksfeil | Retries DNS-feil, timeouts, connection refused |

### TripletexError

Alle API-feil mappes til `TripletexError` med:
- `message` — teknisk feilmelding (for logger)
- `statusCode` — HTTP statuskode fra Tripletex
- `userMessage` — brukervennlig norsk melding for UI

| Statuskode | Brukermelding |
|---|---|
| 400 | Ugyldig forespørsel til Tripletex. Sjekk konfigurasjonen. |
| 401 | Tripletex-autentisering feilet. Sjekk at tokenene er korrekte. |
| 403 | Ingen tilgang. Sjekk at brukerrettigheter er satt opp i Tripletex. |
| 404 | Ressursen ble ikke funnet i Tripletex. Sjekk kontokonfigurasjonen. |
| 429 | For mange forespørsler til Tripletex. Prøv igjen om litt. |
| 500–503 | Tripletex-serveren / midlertidig utilgjengelig. Prøv igjen senere. |

Alle API-ruter bruker `instanceof TripletexError` for å returnere `userMessage` til klienten.

---

## Tilkoblingsflyt

### Ny tilkobling (bruker)

```
1. Bruker åpner Innstillinger → Integrasjoner → Tripletex
2. Dialog viser "Ikke tilkoblet"
3. Bruker limer inn Consumer Token + Employee Token
4. Valgfritt: krysser av for testmiljø
5. Klikker "Koble til Tripletex"
         ↓
POST /api/tripletex/connect
  → Validerer tokens (ikke tomme)
  → Padder Base64 (Tripletex-tokens kan mangle padding)
  → Oppretter session token mot Tripletex
  → Kjører whoAmI for å verifisere
  → Krypterer tokens med AES-256-GCM
  → Upsert i tripletex_connections (per tenant)
  → Logger audit event
  → Returnerer selskapsnavn
         ↓
6. Dialog viser "Koblet til Tripletex (Selskapsnavn)"
7. Selskaper, kontoer og klienter lastes automatisk
```

### Re-tilkobling

Ved gjentatt tilkobling brukes `onConflictDoUpdate` på `tenantId`, slik at
eksisterende tokens overskrives med nye krypterte verdier.

---

## Synkronisering

### Konfigurasjon per klient

Hver klient kan ha én `tripletex_sync_config` som definerer:

| Felt | Beskrivelse |
|---|---|
| `tripletexCompanyId` | Hvilket Tripletex-selskap som synkes |
| `set1TripletexAccountIds` | Konto-IDer for **Sett 1** (hovedbok) |
| `set2TripletexAccountIds` | Konto-IDer for **Sett 2** (bank) |
| `enabledFields` | Hvilke transaksjonsfelt som mappes |
| `dateFrom` | Startdato for synk |
| `syncIntervalMinutes` | Automatisk synk-intervall (standard: 60 min) |
| `lastSyncPostingId` | Bookmark for inkrementell posting-synk |
| `lastSyncBankTxId` | Bookmark for inkrementell bank tx-synk |
| `lastSyncAt` | Siste vellykkede synk-tidspunkt |
| `isActive` | Aktiv/pauset |

### Hva som synkes

| Data | Tripletex-endepunkt | Revizo-tabell | Sett |
|---|---|---|---|
| Selskap | `GET /company/{id}` | `companies` | — |
| Kontoplan | `GET /ledger/account` | `accounts` | — |
| Hovedboksposteringer | `GET /ledger/posting` | `transactions` | Sett 1 |
| Banktransaksjoner | `GET /bank/statement/transaction` | `transactions` | Sett 2 |
| Saldo (åpningsbalanse) | `GET /balance` | `clients` | — |

### Synk-prosessen (`runFullSync`)

```
runFullSync(configId)
  │
  ├─ 1. syncPostings(config)
  │     → Inkrementell: id > lastSyncPostingId
  │     → Henter alle sider (1000/side)
  │     → Mapper via mapPosting() med enabledFields
  │     → Filtrerer duplikater via externalId
  │     → Batch-insert (500 per batch)
  │     → Oppdaterer lastSyncPostingId
  │
  ├─ 2. syncBankTransactions(config)
  │     → Inkrementell: id > lastSyncBankTxId
  │     → Samme mønster som postings
  │
  └─ 3. syncBalances(config)
        → Henter åpningsbalanse for sett 1 + sett 2
        → Oppdaterer clients.openingBalanceSet1/Set2
        → Ikke-fatal: feil ignoreres
```

### Inkrementell synk

Ved første synk hentes alle data fra `dateFrom` til i dag. Ved påfølgende synk brukes
`lastSyncPostingId` / `lastSyncBankTxId` som filter (`id=>{lastId}`) slik at kun
nye posteringer hentes.

Som ekstra sikkerhet filtreres også duplikater via `externalId`-sjekk mot eksisterende
transaksjoner i databasen.

### Datamapping

`mappers.ts` konverterer Tripletex-format til Revizo `MappedTransaction`:

| Tripletex-felt | Revizo-felt | Kommentar |
|---|---|---|
| `posting.date` | `date1` | |
| `posting.amount` | `amount` | Formatert med 2 desimaler |
| `posting.account.number` | `accountNumber` | Kan deaktiveres via `enabledFields` |
| `posting.voucher.number` | `bilag` | Kan deaktiveres |
| `posting.invoice.invoiceNumber` | `faktura` | Kan deaktiveres |
| `posting.description` | `description` | Kan deaktiveres |
| `posting.amountCurrency` | `foreignAmount` | Kan deaktiveres |
| `posting.id` | `externalId` | Prefix `posting:` / `bank:` |
| — | `sourceType` | Alltid `"tripletex"` |
| — | `matchStatus` | Alltid `"unmatched"` |
| `bankTransaction.transactionDate` | `date1` | |
| `bankTransaction.amount` | `amount` | |
| `bankTransaction.archiveReference` | `reference` | |

### Konfigurerbare felt (`enabledFields`)

Brukeren kan velge hvilke felt som hentes fra Tripletex:

| Felt | Standard | Beskrivelse |
|---|---|---|
| `description` | På | Beskrivelse/tekst |
| `bilag` | På | Bilagsnummer (voucher) |
| `faktura` | Av | Fakturanummer |
| `reference` | På | Referanse |
| `foreignAmount` | Av | Valutabeløp |
| `accountNumber` | På | Kontonummer |

Beløp (`amount`), dato (`date1`) og fortegn (`sign`) hentes alltid.

### Automatisk synk (Cron)

**Endepunkt:** `GET /api/cron/tripletex-sync`
**Schedule:** `*/15 * * * *` (hvert 15. minutt, konfigurert i `vercel.json`)
**Timeout:** 300 sekunder (Vercel-maks)

Cron-jobben:
1. Henter alle aktive konfigurasjoner der `lastSyncAt` + `syncIntervalMinutes` er passert
2. Kjører `runFullSync` for hver med parallellisering (maks 3 samtidige)
3. Feil i én konfig påvirker ikke de andre (error isolation)
4. Alle feil rapporteres til Sentry med `configId` og `clientId` som tags
5. Returnerer samlet resultat med antall vellykkede og feilede

---

## Accounting Adapter

Filen `src/lib/accounting/adapters/tripletex.ts` implementerer `AccountingSystemAdapter`
og gir tilgang til avansert regnskapsdata direkte fra Tripletex:

| Funksjon | Tripletex-endepunkt | Beskrivelse |
|---|---|---|
| `testConnection()` | `/token/session/>whoAmI` | Verifiser tilkobling |
| `getPayrollData(period)` | `/salary/payslip` | Lønnsdata med ansatte, bruttolønn, skatt, AGA |
| `getVatTransactions(period)` | `/ledger/posting` (med vatType) | MVA-transaksjoner |
| `getVatSummary(period)` | (beregnet fra transaksjoner) | Oppsummert MVA per kode |
| `getAccountsReceivable(date)` | `/invoice` | Utestående kundefakturaer |
| `getAccountsPayable(date)` | `/supplierInvoice` | Utestående leverandørfakturaer |
| `getHolidayPayData(year)` | (beregnet fra lønn) | Feriepengegrunnlag (10.2% standard) |

Adapteren brukes av rapportmodulen for å generere kontrollrapporter.

---

## Database-skjema

### `tripletex_connections`

Lagrer krypterte API-credentials per tenant.

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primærnøkkel |
| `tenant_id` | text | Organisasjons-ID (Clerk), unik |
| `consumer_token` | text | Kryptert consumer token |
| `employee_token` | text | Kryptert employee token |
| `base_url` | text | API base-URL (default: `https://tripletex.no/v2`) |
| `label` | text | Selskapsnavn fra whoAmI |
| `is_active` | boolean | Aktiv/deaktivert |
| `verified_at` | timestamptz | Siste vellykkede verifisering |
| `created_at` | timestamptz | Opprettet |
| `updated_at` | timestamptz | Sist oppdatert |

**Indeks:** `idx_tripletex_conn_tenant` (unik på `tenant_id`)

### `tripletex_sync_configs`

Synk-konfigurasjon per klient.

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primærnøkkel |
| `client_id` | uuid | FK til `clients`, unik (1:1) |
| `tenant_id` | text | Organisasjons-ID |
| `tripletex_company_id` | integer | Tripletex selskaps-ID |
| `set1_tripletex_account_id` | integer | Legacy: enkelt konto-ID for sett 1 |
| `set2_tripletex_account_id` | integer | Legacy: enkelt konto-ID for sett 2 |
| `set1_tripletex_account_ids` | jsonb | Array av konto-IDer for sett 1 |
| `set2_tripletex_account_ids` | jsonb | Array av konto-IDer for sett 2 |
| `enabled_fields` | jsonb | Konfigurasjon av aktive felt |
| `date_from` | date | Synk startdato |
| `last_sync_at` | timestamptz | Siste vellykkede synk |
| `last_sync_posting_id` | integer | Bookmark for inkrementell posting-synk |
| `last_sync_bank_tx_id` | integer | Bookmark for inkrementell bank tx-synk |
| `sync_interval_minutes` | integer | Auto-synk intervall (default: 60) |
| `is_active` | boolean | Aktiv/pauset |
| `created_at` | timestamptz | Opprettet |
| `updated_at` | timestamptz | Sist oppdatert |

**Indekser:**
- `idx_tripletex_sync_client` (unik på `client_id`)
- `idx_tripletex_sync_active` (`is_active`, `last_sync_at`)

### `webhook_inbox`

Persistent kø for innkommende webhook-events.

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primærnøkkel |
| `tenant_id` | text | Organisasjons-ID |
| `source` | text | Kilde (`tripletex`, `visma_nxt`, `poweroffice`) |
| `event_type` | text | Normalisert type (`transaction.created` etc.) |
| `external_id` | text | Dedupliseringsnøkkel (unik per tenant+source) |
| `payload` | jsonb | Rå webhook-data |
| `status` | text | `pending` / `processing` / `completed` / `failed` / `skipped` |
| `attempts` | integer | Antall prosesseringsforsøk |
| `last_error` | text | Siste feilmelding |
| `process_after` | timestamptz | Tidligste tidspunkt for prosessering (debounce + backoff) |
| `processed_at` | timestamptz | Tidspunkt for ferdig prosessering |
| `created_at` | timestamptz | Mottatt tidspunkt |

**Indekser:**
- `idx_webhook_inbox_dedup` (unik: `tenant_id`, `source`, `external_id`)
- `idx_webhook_inbox_pending` (`status`, `process_after`)
- `idx_webhook_inbox_tenant` (`tenant_id`, `source`, `created_at`)

### `webhook_subscriptions`

Aktive webhook-abonnementer per tenant.

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primærnøkkel |
| `tenant_id` | text | Organisasjons-ID |
| `source` | text | Kilde |
| `external_sub_id` | text | Kommaseparerte abonnement-IDer fra kilden |
| `webhook_url` | text | Callback-URL |
| `secret` | text | Kryptert Bearer token (AES-256-GCM) |
| `event_types` | jsonb | Array av abonnerte event-typer |
| `status` | text | `active` / `paused` / `revoked` |
| `last_event_at` | timestamptz | Siste mottatte event |
| `created_at` | timestamptz | Opprettet |
| `updated_at` | timestamptz | Sist oppdatert |

**Indeks:** `idx_webhook_sub_tenant_source` (unik: `tenant_id`, `source`)

### `sync_cursors`

Generisk tabell for inkrementelle sync-bookmarks. Kilde-agnostisk — klar for Visma NXT,
PowerOffice og fremtidige integrasjoner uten schema-endringer.

| Kolonne | Type | Beskrivelse |
|---|---|---|
| `id` | uuid | Primærnøkkel |
| `tenant_id` | text | Organisasjons-ID |
| `source` | text | Kilde (`tripletex`, `visma_nxt`, `poweroffice`) |
| `cursor_type` | text | Hva cursoren tracker (`last_posting_id`, `last_bank_tx_id`, `changed_since` etc.) |
| `cursor_value` | text | Verdien (ID, timestamp, offset) |
| `metadata` | jsonb | Valgfri ekstra-info (f.eks. account_id, config_id) |
| `updated_at` | timestamptz | Sist oppdatert |

**Indekser:**
- `idx_sync_cursors_lookup` (unik: `tenant_id`, `source`, `cursor_type`)
- `idx_sync_cursors_source` (`source`, `updated_at`)

**Designbeslutning:** Tripletex bruker fortsatt sine spesialiserte bookmarks i
`tripletex_sync_configs` (`lastSyncPostingId`, `lastSyncBankTxId`). Når Visma NXT
eller PowerOffice legges til, brukes `sync_cursors` direkte i stedet for å legge
kilde-spesifikke kolonner i en felles tabell. Over tid kan Tripletex-bookmarks
migreres hit.

### Relaterte kolonner i andre tabeller

| Tabell | Kolonne | Beskrivelse |
|---|---|---|
| `companies` | `tripletex_company_id` | Tripletex selskaps-ID (for upsert) |
| `accounts` | `tripletex_account_id` | Tripletex konto-ID (for upsert) |
| `transactions` | `external_id` | `posting:{id}` / `bank:{id}` (duplikatfiltrering) |
| `transactions` | `source_type` | `"tripletex"` |

---

## API-endepunkter (detalj)

### `GET /api/tripletex/connect`

Sjekker om tenanten har en aktiv Tripletex-tilkobling.

**Response:**
```json
{ "connection": { "id": "uuid", "label": "Firma AS", "isActive": true, "verifiedAt": "..." } }
```

### `POST /api/tripletex/connect`

Kobler til Tripletex med oppgitte tokens. Krever admin-rolle.

**Request:**
```json
{
  "consumerToken": "...",
  "employeeToken": "...",
  "isTest": false
}
```

**Response (suksess):**
```json
{
  "ok": true,
  "connection": { "id": "uuid", "label": "Firma AS", "verifiedAt": "..." },
  "company": { "id": 12345, "name": "Firma AS" }
}
```

**Response (feil):**
```json
{ "error": "Consumer token er ugyldig eller finnes ikke. Sjekk at du har kopiert riktig token fra Tripletex." }
```

### `GET /api/tripletex/whoami`

Verifiserer at Tripletex-sesjonen er gyldig.

**Response:**
```json
{
  "value": {
    "employee": { "id": 1, "firstName": "Ola", "lastName": "Nordmann" },
    "company": { "id": 12345, "name": "Firma AS" }
  }
}
```

### `GET /api/tripletex/companies`

Lister selskaper tilgjengelig for tokenet. Inkluderer eget selskap +
selskaper med login-tilgang (for regnskapsførere).

**Response:**
```json
{
  "companies": [
    { "id": 12345, "name": "Firma AS", "orgNumber": "912345678", "type": "CUSTOMER" }
  ]
}
```

### `GET /api/tripletex/accounts`

Lister aktive kontoer fra Tripletex-kontoplanen. Filtrerer vekk inaktive.

**Response:**
```json
{
  "accounts": [
    {
      "id": 100,
      "number": 1920,
      "name": "Bankkonto",
      "displayName": "1920 Bankkonto",
      "isBankAccount": true,
      "requireReconciliation": true
    }
  ]
}
```

### `POST /api/tripletex/sync-config`

Oppretter eller oppdaterer synk-konfigurasjon for en klient. Kjører også
initial synk av selskap, kontoplan, og transaksjoner.

**Request:**
```json
{
  "clientId": "uuid",
  "tripletexCompanyId": 12345,
  "set1TripletexAccountIds": [100, 101],
  "set2TripletexAccountIds": [200],
  "enabledFields": { "description": true, "bilag": true, "faktura": false },
  "dateFrom": "2026-01-01",
  "syncIntervalMinutes": 60
}
```

**Response:**
```json
{
  "config": { "id": "uuid", "..." : "..." },
  "syncResult": {
    "postings": { "fetched": 1500, "inserted": 1500 },
    "bankTransactions": { "fetched": 300, "inserted": 300 },
    "balancesUpdated": true
  }
}
```

### `POST /api/tripletex/sync`

Trigger manuell synk for en klient.

**Request:**
```json
{ "clientId": "uuid" }
```
eller
```json
{ "syncConfigId": "uuid" }
```

### `GET /api/cron/tripletex-sync`

Automatisk synk av alle aktive konfigurasjoner. Krever `Authorization: Bearer {CRON_SECRET}`.

**Response:**
```json
{
  "synced": 5,
  "succeeded": 4,
  "failed": 1,
  "results": [...],
  "timestamp": "2026-03-02T12:30:00.000Z"
}
```

---

## Webhook-system (sanntid)

### Oversikt

Webhook-systemet gir sanntidsoppdateringer fra Tripletex. Når data endres i Tripletex
(f.eks. ny bilagsposteringer, kontoplansendringer) sender Tripletex et event til Revizo,
som automatisk synkroniserer de relevante dataene.

Cron-synk (hvert 30 min) fungerer som **fallback** — webhooks er primary, cron er safety net.

### Arkitektur

```
Tripletex Event API
       ↓ (webhook POST)
POST /api/webhooks/tripletex?tenant={tenantId}
       ↓ (validere, normalisere, INSERT)
webhook_inbox (persistent kø)
       ↓ (poll hvert 5s)
Railway Worker (webhook-processor)
       ↓ (debounce, gruppering)
runFullSync / syncAccounts (eksisterende sync)
```

### Event-typer

| Tripletex Event | Normalisert | Handling |
|---|---|---|
| `voucher.create` | `transaction.created` | Inkrementell synk av postings + bank tx |
| `voucher.update` | `transaction.updated` | Inkrementell synk |
| `voucher.delete` | `transaction.deleted` | Inkrementell synk |
| `account.create` | `account.created` | Synk kontoplan |
| `account.update` | `account.updated` | Synk kontoplan |
| `account.delete` | `account.deleted` | Synk kontoplan |
| `connection.revoked` | (intern) | Deaktiver tilkobling, varsle bruker |

### Debounce

Når Tripletex sender mange events i rask rekkefølge (f.eks. 200 posteringer importert),
grupperes de etter `(tenant, source, eventTypePrefix)` og trigges ÉN sync per gruppe.
F.eks. 200 `transaction.created` events = 1 `runFullSync()`.

### Autentisering

Tripletex webhooks bruker en **Bearer token** som settes i `authHeaderValue` ved opprettelse
av abonnementet. Tokenet genereres og lagres **kryptert** (AES-256-GCM) i
`webhook_subscriptions.secret`. Ved mottak valideres `Authorization: Bearer {token}` mot
lagret verdi.

### Abonnementsstyring

Webhook-abonnementer opprettes **automatisk** når en bruker kobler til Tripletex via
`POST /api/tripletex/connect`. `subscribe()` kaller Tripletex Event Subscription API:

```
POST /v2/event/subscription
{
  "event": "voucher.create",
  "targetUrl": "https://app.revizo.no/api/webhooks/tripletex?tenant={tenantId}",
  "authHeaderName": "Authorization",
  "authHeaderValue": "Bearer {random_secret}"
}
```

Ved frakobling fjernes abonnementene via `unsubscribe()` → `DELETE /v2/event/subscription/{id}`.

### Retry og feilhåndtering

| Parameter | Verdi |
|---|---|
| Maks forsøk | 5 |
| Backoff | Eksponentiell: 30s → 60s → 120s → 240s → 480s |
| Permanent feil | Status `"failed"` + Sentry-alert etter 5 forsøk |
| Concurrency | `FOR UPDATE SKIP LOCKED` — støtter flere Worker-instanser |

### Webhook-kø (`webhook_inbox`)

| Status | Beskrivelse |
|---|---|
| `pending` | Mottatt, venter på prosessering |
| `processing` | Worker har plukket opp |
| `completed` | Prosessert OK |
| `failed` | Permanent feil (5 forsøk) |
| `skipped` | Hoppet over (ukjent type, deaktivert tilkobling) |

### Admin-endepunkter

- `GET /api/admin/webhooks/inbox?status=failed` — se feilede events
- `POST /api/admin/webhooks/inbox` med `{ ids: [...] }` — replay feilede (sett tilbake til pending)
- `GET /api/admin/webhooks/subscriptions` — se aktive abonnementer

### Health-check

`GET /api/health` inkluderer nå webhook-status:
```json
{
  "checks": {
    "database": "ok",
    "webhookInbox": {
      "stalePending": 0,
      "totalPending": 2,
      "totalFailed": 0
    }
  }
}
```
`stalePending > 0` (events eldre enn 10 min) indikerer prosesseringsproblemer.

---

## Feilsøking

### Tilkoblingsproblemer

| Symptom | Årsak | Løsning |
|---|---|---|
| «Tripletex-autentisering feilet» | Feil tokens | Sjekk consumer + employee tokens i Tripletex admin |
| «Ingen tilgang» | Manglende rettigheter | Sjekk brukerrettigheter i Tripletex |
| «Kunne ikke koble til Tripletex» | Nettverksfeil | Sjekk internett, Tripletex-status |
| «Tripletex session creation failed» | Ugyldig token-kombinasjon | Verifiser at tokens er for riktig miljø (test/prod) |

### Synk-problemer

| Symptom | Årsak | Løsning |
|---|---|---|
| Synk kjører men 0 nye poster | Alt allerede synket | Sjekk `lastSyncPostingId` — data er inkrementell |
| Synk kjører men ingen data | Feil kontoer valgt | Sjekk set1/set2 konto-IDer i synk-konfig |
| Synk er treg | Mange sider å paginere | Normal for første synk med mye historikk |
| Duplikater | Bør ikke skje | `externalId`-sjekk forhindrer dette |
| Feil beløp/dato | Mapping-problem | Sjekk `mappers.ts` og `enabledFields` |

### Cron-problemer

| Symptom | Årsak | Løsning |
|---|---|---|
| Cron kjører ikke | Vercel-konfig | Sjekk `vercel.json` og Vercel Dashboard → Crons |
| Cron feiler stille | Tidligere manglet rapportering | Nå rapporteres til Sentry med tags |
| Cron timeout | For mange konfigurasjoner | `maxDuration: 300`, parallell med maks 3 samtidige |

### Webhook-problemer

| Symptom | Årsak | Løsning |
|---|---|---|
| «No active subscription» (401) | Abonnement mangler for tenant | Sjekk `webhook_subscriptions` i DB, opprett nytt via API |
| Events mottas men prosesseres ikke | Worker er nede | Sjekk Railway Worker-status og logger |
| `stalePending > 0` i health-check | Worker henger/er treg | Restart Worker, sjekk for blokkerte queries |
| Events feiler permanent | Synk-feil etter 5 forsøk | Sjekk Sentry, bruk replay via admin-endepunkt |
| Duplikater i inbox | Normal oppførsel | `ON CONFLICT DO NOTHING` — ignoreres automatisk |
| Tripletex deaktiverer subscription | Callback URL nede for lenge | Sjekk `GET /v2/event/subscription`, re-aktiver med PUT |

### Krypteringsproblemer

| Symptom | Årsak | Løsning |
|---|---|---|
| «ENCRYPTION_KEY not set» | Env var mangler | Generer med `openssl rand -hex 32` |
| Dekryptering feiler | Feil nøkkel | Sjekk at `ENCRYPTION_KEY` er lik i alle miljøer |
| Tokens leses som plaintext | Eldre data | Kjør `scripts/encrypt-tripletex-tokens.ts` |

---

## Kjente begrensninger

| Begrensning | Risiko | Kommentar |
|---|---|---|
| Session-cache er in-memory | Lav | Ekstra session-opprettelser ved cold starts, men ingen funksjonsfeil |
| Balansesync bruker kun første konto per sett | Lav | Åpningsbalanse kan bli unøyaktig for multi-konto-oppsett |
| Feriepenger hardkodet til 10.2% | Lav | Standard rate; 12% for tariffavtaler dekkes ikke |
| `/company/>withLoginAccess` ikke paginert | Lav | Bruker `count: 1000`, dekker de fleste tilfeller |
| Accounting adapter: `otherDeductions` ikke summert | Lav | Initialisert til 0, aldri akkumulert fra payslips |

---

## Tripletex API-referanse

- **API Explorer (prod)**: https://tripletex.no/v2-docs/
- **API Explorer (test)**: https://api-test.tripletex.tech/v2-docs/
- **Integrasjonsportal**: https://developer.tripletex.no/
- **Statusside**: https://status.tripletex.no

---

## Endringslogg

| Dato | Endring |
|---|---|
| 2026-03-02 | Inkrementell synk: bruker `lastSyncPostingId`/`lastSyncBankTxId` som API-filter |
| 2026-03-02 | Cron: parallell prosessering (maks 3), Sentry-rapportering, error isolation |
| 2026-03-02 | `TripletexError` med brukervennlige norske meldinger i alle API-ruter |
| 2026-03-02 | Retry-logikk: 3x med exponential backoff for transiente feil |
| 2026-03-02 | Per-tenant kryptert token-lagring (AES-256-GCM) |
| 2026-03-02 | Multi-konto-valg (erstatter enkelt konto-velger) |
| 2026-03-02 | `syncAccounts` oppdaterer nå eksisterende kontoer |
| 2026-03-02 | Accounting adapter for lønn, MVA, reskontro, feriepenger |
| 2026-03-02 | Komplett feilhåndtering med `TripletexError` i alle API-ruter |
| 2026-03-03 | Webhook Inbox System: sanntidsoppdateringer fra Tripletex |
| 2026-03-03 | Ny tabeller: `webhook_inbox`, `webhook_subscriptions` |
| 2026-03-03 | Webhook-mottaker, Tripletex adapter (validering, normalisering) |
| 2026-03-03 | Subscription manager med auto-subscribe ved connect |
| 2026-03-03 | Railway Worker: ny poll-loop for webhook-prosessering (5s) |
| 2026-03-03 | Debounce: grupperer events per (tenant, source, type) |
| 2026-03-03 | Admin-endepunkter: inbox, replay, subscriptions |
| 2026-03-03 | Health-check utvidet med webhook-status |
| 2026-03-03 | `sync_cursors`-tabell: generisk bookmark-lagring for fremtidige kilder |
| 2026-03-03 | Cron-intervall endret fra 30 → 15 min (bedre fallback-SLA) |
