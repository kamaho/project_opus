# Oppsettguide

Denne guiden hjelper nye utviklere og AI-agenter å komme i gang med prosjektet.

## Forutsetninger

- **Node.js** 20+ (anbefalt: bruk `nvm`)
- **npm** (følger med Node.js)
- Tilgang til **Clerk**, **Supabase** og **Vercel** dashboards

## 1. Klone og installer

```bash
git clone <repo-url>
cd project_opus
npm install
```

## 2. Miljøvariabler

Kopier `.env.example` til `.env.local` og fyll inn verdier:

```bash
cp .env.example .env.local
```

**Viktig:** Bruk **separat database** for lokal utvikling og for produksjon. Aldri kjør migrasjoner eller testdata mot prod-DB fra din maskin.

| Miljø | Hva du gjør |
|-------|--------------|
| **Lokal** | Opprett et eget Supabase-prosjekt (f.eks. "Revizo dev") eller kjør Postgres lokalt. Sett `DATABASE_URL` i `.env.local` til denne. |
| **Produksjon** | Vercel → Environment Variables (Production) har `DATABASE_URL` som peker på prod-Supabase. Ikke bruk denne URL-en i `.env.local`. |

**Full steg-for-steg (ny prod-DB, beholde project opus som lokal):** Se **docs/DATABASE_DEV_PROD.md**.

Nødvendige variabler:

| Variabel                              | Hvor finner du den                           |
|---------------------------------------|----------------------------------------------|
| `DATABASE_URL`                        | Supabase → Settings → Database → **Transaction pooler** (port 6543). Brukes av app-serveren. |
| `DATABASE_MIGRATION_URL`              | Supabase → Settings → Database → **Direct URL** (port 5432). Brukes av `db:migrate` og GitHub Actions. |
| `NEXT_PUBLIC_SUPABASE_URL`            | Supabase → Settings → API → Project URL      |
| `SUPABASE_SERVICE_ROLE_KEY`           | Supabase → Settings → API → service_role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | Clerk → API Keys → Publishable key           |
| `CLERK_SECRET_KEY`                    | Clerk → API Keys → Secret key                |
| `NEXT_PUBLIC_ENV`                     | Sett til `development` lokalt og på staging. La stå tom (eller `production`) i Vercel prod. Viser miljø-badge i headeren. |

De øvrige `NEXT_PUBLIC_CLERK_*` variablene er URL-stier og trenger vanligvis ikke endres.

### GitHub Secrets (produksjon)

For at GitHub Actions-pipelinen skal fungere må disse hemmeligheter være satt i **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Verdi |
|---|---|
| `DATABASE_MIGRATION_URL` | Supabase prod Direct URL (port 5432) |

## 3. Database-migrasjoner

### Automatisk pipeline (prod)

Migrasjoner kjøres **automatisk via GitHub Actions** når du pusher til `main`:

1. `.github/workflows/migrate.yml` kjøres ved push til `main` (hvis migrations-filer er endret)
2. Actions bruker `DATABASE_MIGRATION_URL` fra GitHub Secrets (Direct URL, port 5432)
3. Vercel deployer etter at migreringen er ferdig

Du trenger **aldri** å kjøre `db:migrate` manuelt mot prod.

### Lokalt (dev)

Kjør migrasjoner mot dev-databasen:

```bash
npm run db:migrate
```

For å se databasen i en GUI:

```bash
npm run db:studio
```

### Ny schema-endring (riktig arbeidsflyt)

```
1. Rediger src/lib/db/schema.ts
2. npm run db:generate    ← genererer SQL-migrasjonsfil
3. git add src/lib/db/
4. git commit + push → main
5. GitHub Actions kjører db:migrate mot prod automatisk
```

> **Aldri** rediger migrasjonsfiler manuelt eller kjør `db:migrate` mot prod fra din maskin.

### To DATABASE_URL-er

| Variabel | Tilkobling | Brukes til |
|---|---|---|
| `DATABASE_URL` | Transaction Pooler (port **6543**) | App-serveren (alle API-ruter) |
| `DATABASE_MIGRATION_URL` | Direct URL (port **5432**) | `db:migrate` og `db:studio` |

Supabase → Settings → Database → **Connection string** — velg riktig pooler-type. Migrasjoner krever direkte tilkobling (ikke PgBouncer) fordi Drizzle bruker `SET search_path`.

## 4. Seed-data (valgfritt)

Seed testdata inn i databasen:

```bash
# Sett Clerk org-ID hvis du vil knytte til en spesifikk organisasjon
export SEED_TENANT_ID=org_xxxxx

npx tsx scripts/seed.ts
```

## 5. Start utviklingsserver

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000).

## Nyttige kommandoer

```bash
npm run dev          # Start utviklingsserver (Turbopack)
npm run build        # Bygg for produksjon
npm run lint         # Kjør ESLint

npx drizzle-kit generate  # Generer migrasjoner fra schema-endringer
npx drizzle-kit migrate   # Kjør migrasjoner
npx drizzle-kit studio    # Åpne DB-browser

npx tsx scripts/seed.ts   # Kjør seed-script
```

## Prosjektstruktur — hurtigreferanse

```
src/app/api/import/route.ts     ← Filimport-endepunkt
src/lib/parsers/                ← Alle fil-parsere
src/lib/db/schema.ts            ← Database-skjema (Drizzle)
src/components/import/          ← Import-wizard og forhåndsvisning
src/components/matching/        ← Matching-visning
docs/                           ← Prosjektdokumentasjon
```

Se [ARCHITECTURE.md](./ARCHITECTURE.md) for full oversikt.

## For AI-agenter

Når du jobber med dette prosjektet:

1. **Les docs/ først** — start med `ARCHITECTURE.md` for å forstå systemet
2. **Database**: skjemaet er i `src/lib/db/schema.ts` — all data bruker UUID og `tenant_id`
3. **Autentisering**: alle API-ruter krever Clerk auth. Bruk `await auth()` for `userId`/`orgId`
4. **Import-systemet**: se `IMPORT_SYSTEM.md` for detaljer om parsere og wizard
5. **Stil**: se `DESIGN.md` for designprinsipper. Bruk shadcn/ui + Tailwind
6. **Testing**: prosjektet bruker Next.js 16 med Turbopack. Kjør `npm run build` for å verifisere

### Vanlige fallgruver

- **Supabase-tilkobling**: vi bruker `postgres` npm-pakken direkte med Drizzle, IKKE Supabase JS-klienten for database. Supabase JS brukes kun for Storage.
- **`max: 1` connection**: Supabase Session pooler håndterer pooling — ikke øk dette.
- **RLS**: Row Level Security er aktivert. Server-side kode (med service_role) omgår RLS.
- **Datoformat**: Excel/CSV-parseren detekterer datoformat automatisk. Ikke hardkod "DD.MM.YYYY".
- **Multitenancy**: `tenant_id` = Clerk `orgId`. Alle data SKAL filtreres på dette.
- **Filimport**: wizard-resultatet bygger parser-config som sendes som JSON til API.

## Dokumentasjonsindeks

| Fil                        | Innhold                                    |
|----------------------------|--------------------------------------------|
| `docs/ARCHITECTURE.md`     | Systemarkitektur og dataflyt               |
| `docs/SERVICES.md`         | Tjenester (Supabase, Clerk, Drizzle)       |
| `docs/API.md`              | API-endepunkter og request/response        |
| `docs/DATABASE.md`         | Databaseskjema med alle tabeller           |
| `docs/IMPORT_SYSTEM.md`    | Import-wizard, parsere og filtyper         |
| `docs/DESIGN.md`           | Designprinsipper og UI-retningslinjer      |
| `docs/SETUP.md`            | Denne filen — oppsettguide                 |
