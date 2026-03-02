# 2026-03-02 — Prod-hardening, schema-audit og best practice-pipeline

**Type:** Kritisk bugfix + infrastruktur  
**Utført av:** Claude (AI-agent) + kmh0751  
**Status:** Fullført

---

## Sammendrag

En brukerrapportert onboarding-feil avdekket at produksjonsdatabasen var **dramatisk utdatert** sammenlignet med kodebasen. Ingen migreringspipeline eksisterte. Denne arbeidsøkten fikset rotårsaken, kjørte en full prod-migrering, og satte opp automatisering som hindrer at det skjer igjen.

---

## Del 1 — Onboarding-feil: `POST /api/clients` → 500

### Symptom
Brukere fikk "Internal server error" på siste steg i onboarding (Oppsummering → Opprett alt).

Vercel-logg:
```
POST 500  www.revizo.ai  /api/clients
[api] Unhandled error: column "tripletex_account_id" of relation "accounts" does not exist
```

### Rotårsak
Drizzle ORM's `.insert().returning()` uten spesifiserte kolonner genererer `RETURNING *`-ekvivalent basert på `schema.ts`. Kolonnen `tripletex_account_id` var lagt til i `schema.ts` og kjørt som migrasjon i **dev**, men aldri mot **prod**. Postgres kastet feil fordi kolonnen ikke finnes i prod-tabellen.

Det samme mønsteret hadde allerede blitt fikset for `POST /api/companies` (commit `746882a`), men `api/clients` ble ikke oppdatert på samme tid.

### Undersøkelse hindret av feil MCP-tilkobling
Supabase MCP i Cursor var koblet til **dev-prosjektet** (Project Opus), ikke prod. Alle DB-spørringer via MCP bekreftet at `tripletex_account_id` eksisterte — men kun fordi den er i dev. Forvirringen ble løst da Vercel-loggen ble lagt frem.

### Fiks — `src/app/api/clients/route.ts`

| Endring | Begrunnelse |
|---|---|
| Drizzle `.insert().returning()` → raw SQL med eksplisitte kolonner | Drizzle inkluderer aldri ukjente/ikke-migrerte kolonner i RETURNING |
| Alle tre INSERT-operasjoner pakket i `db.transaction()` | Atomisitet — ingen foreldreløse `accounts`-rader hvis `clients`-INSERT feiler |
| `try/catch` med klassifiserte feilmeldinger | Constraint → 400, RLS-feil → 403, annet → 500 med norsk melding |

```typescript
// FØR (krasjer hvis kolonne mangler i prod):
const [account1] = await db.insert(accounts).values({...}).returning();

// ETTER (eksplisitt SQL, kun kolonner som eksisterer):
const acct1Rows = await tx.execute<{ id: string }>(
  sql`INSERT INTO accounts (company_id, account_number, name, account_type)
      VALUES (${companyId}, ${...}, ${...}, ${...})
      RETURNING id`
);
```

### Bi-feil funnet i `step-configure-erp.tsx`
- Manglende `credentials: "include"` på fetch-kall til `/api/companies` og `/api/clients`
- Dobbel `.json()`-lesing av response-body (Response-body er engangsstrøm)

Begge ble rettet i samme omgang.

---

## Del 2 — Full prod-skjema-audit og migrering

### Funn
Prod-databasen (`pejkokemdzsekboaebmy`) hadde **0 Supabase-migreringer registrert** og var satt opp manuelt. Sammenligning mot dev avdekket:

| | Prod | Dev |
|---|---|---|
| Antall tabeller | 21 | 44 |
| Manglende tabeller | 23 | — |
| Manglende kolonner | 5 | — |

**Manglende tabeller i prod** (alle opprettet av skriptet):
`contacts`, `tasks`, `client_groups`, `client_group_members`, `reports`, `tripletex_connections`, `tripletex_sync_configs`, `tutorials`, `tutorial_steps`, `tutorial_audiences`, `tutorial_completions`, `dashboard_configs`, `calendar_events`, `control_results`, `document_requests`, `document_request_files`

**Manglende kolonner i prod** (alle lagt til):

| Tabell | Kolonne | Type |
|---|---|---|
| `accounts` | `tripletex_account_id` | integer |
| `clients` | `assigned_user_id` | text |
| `companies` | `tripletex_company_id` | integer |
| `transactions` | `source_type` | text (default 'file') |
| `transactions` | `external_id` | text |

### Migreringsscript
Fullstendig idempotent SQL-script kjørt direkte mot prod:
→ `docs/migrations/prod_migration_2026_03_02.sql`

**Resultat:** Prod har nå 37 tabeller og er i sync med kodebasen.

> De 7 tabellene som fortsatt kun er i dev (`saved_mappings`, `balance_checkpoints`, `accrual_entries`, `intercompany_sets`, `client_funds_accounts`, `client_report_types`, `report_snapshots`) er ikke referert i appkoden og kan ignoreres.

---

## Del 3 — Best practice-pipeline

### 3.1 GitHub Actions — automatisk migrering

**Ny fil:** `.github/workflows/migrate.yml`

- Trigger: push til `main` når `src/lib/db/migrations/**` eller `src/lib/db/schema.ts` endres
- Kjører `npm run db:migrate` med `DATABASE_MIGRATION_URL` fra GitHub Secrets
- Støtter manuell trigger (`workflow_dispatch`)

**Ny fil:** `.github/workflows/check-schema.yml`

- Trigger: pull request mot `main` som berører schema/migrations
- Kjører `drizzle-kit generate` (dry-run, ingen DB nødvendig)
- Feiler PR-en med klar feilmelding hvis `schema.ts` har endringer uten tilhørende migrasjonsfil

### 3.2 `vercel.json`
Lagt til med `buildCommand` og Vercel Cron-konfigurasjon for `/api/cron/tripletex-sync` (hvert 30. minutt).

### 3.3 GitHub Secret
`DATABASE_MIGRATION_URL` lagt til i **GitHub → Settings → Secrets and variables → Actions → Repository secrets**.

Verdien er Session Pooler-URL fra Supabase Revizo Prod (port 5432, IPv4-kompatibel). Direct Connection (port 5432 direkte) ble **ikke** brukt fordi GitHub Actions kjører på IPv4 og den er ikke kompatibel.

### 3.4 Arbeidsflyt fra nå av

```
1. Rediger src/lib/db/schema.ts
2. npm run db:generate         ← genererer SQL-migrasjonsfil
3. git add src/lib/db/
4. git commit + push → main
5. GitHub Actions kjører db:migrate mot prod automatisk
```

**Aldri** kjør `db:migrate` mot prod manuelt eller rediger migrasjonsfiler direkte.

---

## Del 4 — Schema-drift hardening

Etter audit av alle 75 API-ruter ble to ruter identifisert som sårbare:

| Rute | Problem |
|---|---|
| `api/clients/[clientId]/transactions` POST | Drizzle `.returning()` uten try/catch |
| `api/clients/[clientId]/matches` POST + DELETE (3 varianter) | Drizzle `.returning()` uten try/catch |

**Fiks:** try/catch lagt til med identisk mønster som `api/clients`:
- Constraint/duplikat → 400
- RLS-feil (pg code `42501`) → 403
- Fallback → 500 med loggbar melding

---

## Del 5 — Database-ytelse: manglende indekser

### Identifiserte hull

| Tabell | Manglende indeks | Konsekvens |
|---|---|---|
| `clients` | `company_id` | Full scan på alle tenant-scoped klientqueries |
| `matches` | `client_id` | Full scan ved matching-engine og stats-endepunkter |
| `accounts` | `company_id` | Full scan i cache-layer (`getCachedCompanies`) |

### Løsning
Indeksene ble lagt til i `schema.ts` via Drizzle `index()` og generert som migrasjon:

**Ny fil:** `src/lib/db/migrations/0005_add_missing_fk_indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS "idx_accounts_company" ON "accounts" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "idx_clients_company" ON "clients" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "idx_matches_client" ON "matches" USING btree ("client_id");
```

Indeksene er bekreftet opprettet i dev. Prod får dem ved neste `db:migrate` via GitHub Actions.

**Journalen ble også reparert:** `0002_snapshot.json` hadde en kollisjon (pekte på `0000` som parent istedenfor `0001`). `prevId` ble rettet slik at Drizzle-journalen er konsistent.

---

## Del 6 — Developer experience

### Miljø-badge i headeren
`src/components/layout/header.tsx` viser nå en liten `DEV`/`STAGING`-badge i neon-grønt øverst i headeren når `NEXT_PUBLIC_ENV` er satt til noe annet enn `production`. Ingen badge vises i prod.

```tsx
{isNonProd && (
  <span className="... text-[oklch(0.72_0.2_142)] ring-1 ring-[oklch(0.72_0.2_142)/40]">
    {envLabel}
  </span>
)}
```

### `docs/SETUP.md` oppdatert
- Full migreringsarbeidsflyt dokumentert
- Forklaring av `DATABASE_URL` (Transaction Pooler, port 6543) vs `DATABASE_MIGRATION_URL` (Session Pooler, port 5432)
- GitHub Secrets-instruksjoner
- `NEXT_PUBLIC_ENV`-variabelen dokumentert

### `.env.example` oppdatert
- `DATABASE_MIGRATION_URL` var allerede til stede
- `NEXT_PUBLIC_ENV=development` lagt til med forklaring

---

## Prod-MCP-konfigurasjon

For å koble Cursor AI direkte til prod-databasen ble `~/.cursor/mcp.json` oppdatert med et nytt MCP-entry for `supabase [Revizo Prod]` (prosjekt `pejkokemdzsekboaebmy`).

Fremover kan AI-agenter kjøre SQL direkte mot prod for feilsøking og audit.

---

## Filer endret/opprettet denne arbeidsøkten

| Fil | Operasjon | Beskrivelse |
|---|---|---|
| `src/app/api/clients/route.ts` | Endret | Raw SQL + transaksjon + try/catch |
| `src/components/onboarding/step-configure-erp.tsx` | Endret | credentials + dobbel-json-fix |
| `src/app/api/clients/[clientId]/transactions/route.ts` | Endret | try/catch på INSERT |
| `src/app/api/clients/[clientId]/matches/route.ts` | Endret | try/catch på alle 4 db.transaction() |
| `src/lib/db/schema.ts` | Endret | index() lagt til på accounts, clients, matches |
| `src/lib/db/migrations/0005_add_missing_fk_indexes.sql` | Ny | 3 manglende FK-indekser |
| `src/lib/db/migrations/meta/0002_snapshot.json` | Endret | prevId-kollisjon reparert |
| `src/components/layout/header.tsx` | Endret | Miljø-badge for DEV/STAGING |
| `.github/workflows/migrate.yml` | Ny | Automatisk db:migrate ved push til main |
| `.github/workflows/check-schema.yml` | Ny | PR-sjekk for schema-drift |
| `vercel.json` | Ny | buildCommand + Cron-konfig |
| `.env.example` | Endret | NEXT_PUBLIC_ENV lagt til |
| `docs/SETUP.md` | Endret | Full migreringsarbeidsflyt dokumentert |
| `docs/migrations/prod_migration_2026_03_02.sql` | Ny | Komplett prod-migrering |
| `docs/incidents/2026-03-02-onboarding-500.md` | Ny | Post-mortem for onboarding-feilen |
| `~/.cursor/mcp.json` | Endret | Prod-MCP lagt til |

---

## Kjente gjenstående punkter

- [ ] Indeksene fra `0005_add_missing_fk_indexes.sql` kjøres automatisk mot prod ved neste push til `main` (via GitHub Actions). Ingen manuell handling nødvendig.
- [ ] `NEXT_PUBLIC_ENV=production` bør settes eksplisitt i Vercel Production-miljøet for å sikre at badgen aldri vises der.
- [ ] Vurder å legge til `DATABASE_MIGRATION_URL` som Vercel-miljøvariabel for eventuelle fremtidige deploy-hooks.
