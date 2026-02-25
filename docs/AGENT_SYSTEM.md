# Revizo Agent — Automatisk Smart Match og Rapportering

Revizo Agent er et bakgrunnsjobb-system som automatisk kjører Smart Match og genererer PDF-rapporter på e-post etter en konfigurerbar tidsplan.

## Arkitektur

```
┌─────────────────────────────────┐
│     Next.js App (web)           │
│                                 │
│  AgentReportSettings UI         │
│  ├── GET/PUT /agent-config      │
│  └── GET /agent-logs            │
│                                 │
│  Skriver til:                   │
│  agent_report_configs           │
├─────────────────────────────────┤

        ↕ Supabase PostgreSQL

┌─────────────────────────────────┐
│     Railway Worker (Node.js)    │
│                                 │
│  worker/index.ts                │
│  ├── Poll-loop (30s)            │
│  ├── Job claiming med locking   │
│  ├── Concurrency control        │
│  └── Graceful shutdown          │
│                                 │
│  worker/job-runner.ts           │
│  ├── runAutoMatch()             │
│  ├── generateExport() → PDF     │
│  └── sendAgentReportEmail()     │
│                                 │
│  Leser/skriver:                 │
│  agent_report_configs           │
│  agent_job_logs                 │
└─────────────────────────────────┘
```

## Hvordan det fungerer

1. Bruker aktiverer Revizo Agent via innstillingspanelet i matching-visningen
2. Konfigurerer frekvens for Smart Match og rapporter, samt spesifikke datoer
3. API-ruten beregner `nextMatchRun` og `nextReportRun` basert på valgt tidsplan
4. Railway Worker poller databasen hvert 30. sekund etter due configs
5. Når en config er due: worker claimer den med locking, kjører Smart Match, genererer PDF, sender e-post
6. Logger resultatet i `agent_job_logs` og beregner neste kjøring

## Worker-arkitektur

### Poll-loop (`worker/index.ts`)

Workeren er en persistent Node.js-prosess som kjører kontinuerlig:

```
while (!shuttingDown) {
    cleanStaleLocks()
    configs = claimDueConfigs()
    for each config: processConfig(config)  // async, ikke blocking
    sleep(POLL_INTERVAL)
}
```

### Job claiming

Optimistisk locking forhindrer at flere workers tar samme jobb:

1. `SELECT` configs der `enabled = true`, `lockedAt IS NULL`, og `nextMatchRun <= now` ELLER `nextReportRun <= now`
2. For hver rad: `UPDATE SET lockedAt = now, lockedBy = workerId WHERE id = ? AND lockedAt IS NULL`
3. Kun rader som faktisk ble oppdatert (ingen annen worker tok den) returneres

### Stale lock cleanup

Hvis en worker crasher midt i en jobb, vil locken bli liggende. Cleanup-logikken fjerner locks eldre enn `LOCK_TIMEOUT` (default 10 minutter).

### Concurrency control

`WORKER_CONCURRENCY` (default 3) begrenser antall samtidige jobber. Nye configs claimes ikke før aktive jobber er under grensen.

### Graceful shutdown

Ved `SIGTERM`/`SIGINT`:
1. Stopper polling
2. Venter opptil 60 sekunder for aktive jobber
3. Lukker database-tilkobling
4. Avslutter prosessen

## Jobb-runner (`worker/job-runner.ts`)

Hver jobb utfører opptil 3 steg:

### Steg 1: Smart Match (hvis `matchDue`)
- Kaller `runAutoMatch(clientId, "system-agent")` fra matching engine
- Fanger antall matcher og transaksjoner

### Steg 2: PDF-rapport (hvis `reportDue`)
- Kaller `generateExport()` med matching-modul, PDF-format, og rapporttype
- Støttede rapporttyper: `open_items` (åpne poster). Utvidbar for fremtidige typer.

### Steg 3: E-post
- Henter klientinfo, åpne poster-statistikk, og brukerens e-post parallelt
- Sender e-post via Resend med:
  - Nøkkeltall i e-posten (nye matcher, åpne poster per mengde, saldo, differanse)
  - PDF-vedlegg (hvis generert)
  - Direktelenke til klienten i Revizo

### Feilhåndtering

| Scenario | Status |
|----------|--------|
| Alt vellykket | `success` |
| Smart Match feilet, rapport ok | `partial` |
| Rapport feilet, Smart Match ok | `partial` |
| Alt feilet | `failed` |

Feilmeldinger lagres i `agent_job_logs.error_message`.

## Tidsplanlegging

### Schedule-presets

| Preset | Beskrivelse |
|--------|-------------|
| `daily` | Daglig |
| `weekly_mon` – `weekly_sun` | Ukentlig på angitt dag |
| `biweekly` | Annenhver uke (mandag) |
| `monthly_1` | 1. i hver måned |
| `monthly_15` | 15. i hver måned |

### Spesifikke datoer

Brukere kan legge til enkeltdatoer for ekstra kjøringer (f.eks. årsavslutning, MVA-frist). Disse kombineres med den faste tidsplanen — den tidligste av de to brukes.

### Tidspunktberegning (`agent-scheduler.ts`)

- `calculateNextRun(schedule, preferredTime, after)` — beregner neste kjøring basert på preset
- `getNextSpecificDate(dates, preferredTime, after)` — finner neste spesifikke dato
- `effectiveNextRun(schedule, specificDates, preferredTime, after)` — returnerer den tidligste av schedule og spesifikke datoer
- `isDue(config)` — sjekker om Smart Match og/eller rapport er forfalt

## Databasetabeller

### `agent_report_configs`

Én rad per klient. Lagrer konfigurasjon og tilstand.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid (PK) | |
| `tenant_id` | text | Clerk org-ID |
| `client_id` | uuid (FK → clients, UNIQUE) | Én config per klient |
| `created_by` | text | Clerk user-ID som opprettet |
| `enabled` | boolean | Aktiv/inaktiv |
| `report_types` | jsonb | `["open_items"]` |
| `smart_match_enabled` | boolean | Kjør Smart Match automatisk |
| `smart_match_schedule` | text | Schedule-preset |
| `report_schedule` | text | Schedule-preset |
| `specific_dates` | jsonb | `["2026-06-30", "2026-12-31"]` |
| `preferred_time` | text | `"03:00"` (UTC) |
| `next_match_run` | timestamptz | Neste beregnede Smart Match |
| `next_report_run` | timestamptz | Neste beregnede rapport |
| `last_match_run` | timestamptz | Siste kjøring |
| `last_report_run` | timestamptz | Siste rapport |
| `last_match_count` | integer | Antall matcher sist |
| `locked_at` | timestamptz | Worker-lock |
| `locked_by` | text | Worker-ID som låser |

### `agent_job_logs`

Append-only kjøringshistorikk.

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid (PK) | |
| `config_id` | uuid (FK → agent_report_configs) | |
| `tenant_id` | text | |
| `client_id` | uuid | |
| `job_type` | text | `smart_match` / `report` / `both` |
| `status` | text | `success` / `failed` / `partial` |
| `match_count` | integer | Antall matcher funnet |
| `transaction_count` | integer | Antall transaksjoner matchet |
| `report_sent` | boolean | Om rapport ble sendt |
| `error_message` | text | Feilmelding (nullable) |
| `duration_ms` | integer | Kjøretid i millisekunder |

## API-endepunkter

### `GET /api/clients/[clientId]/agent-config`
Returnerer gjeldende agent-konfigurasjon for klienten. Returnerer defaults hvis ingen config eksisterer.

### `PUT /api/clients/[clientId]/agent-config`
Oppretter eller oppdaterer agent-konfigurasjon. Beregner automatisk `nextMatchRun` og `nextReportRun`.

### `GET /api/clients/[clientId]/agent-logs`
Returnerer de siste 20 kjøringsloggene for klienten.

## UI-komponent

`AgentReportSettings` (`src/components/matching/agent-report-settings.tsx`) er en Sheet-komponent som åpnes via "Agent"-knappen i matching-toolbaren.

Inneholder:
- Hoved-toggle for å aktivere/deaktivere
- Rapporttype-velger (checkboxes)
- Smart Match frekvens (select)
- Rapportfrekvens (select)
- Tidspunktvelger (time input)
- Spesifikke datoer (dato-input + liste)
- Kjøringshistorikk (siste 5 logger)

## Deployment

### Lokal utvikling

```bash
npm run worker:dev    # Kjører worker med hot-reload (tsx watch)
```

### Railway

Worker deployes som en separat service i Railway fra samme repo:

1. Opprett ny service i Railway Dashboard
2. Sett start-kommando: `npm run worker`
3. Legg til miljøvariabler (samme som web-appen + worker-spesifikke)

### Miljøvariabler

| Variabel | Default | Beskrivelse |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | — | For å hente bruker-e-post |
| `RESEND_API_KEY` | — | For e-postutsending |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base-URL for lenker i e-post |
| `WORKER_CONCURRENCY` | `3` | Maks samtidige jobber |
| `WORKER_POLL_INTERVAL_MS` | `30000` | Polling-intervall (ms) |
| `LOCK_TIMEOUT_MS` | `600000` | Stale lock timeout (ms) |

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `worker/index.ts` | Worker entry point, poll-loop, locking |
| `worker/job-runner.ts` | Jobb-logikk: Smart Match + PDF + e-post |
| `src/lib/agent-scheduler.ts` | Schedule-beregning og isDue-logikk |
| `src/components/matching/agent-report-settings.tsx` | UI-innstillinger |
| `src/app/api/clients/[clientId]/agent-config/route.ts` | Config API |
| `src/app/api/clients/[clientId]/agent-logs/route.ts` | Logs API |
