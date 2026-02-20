# Account Control

Avstemmingsplattform for regnskapsfirmaer (MVP). Se `DOMAIN_SPEC.md` og `PROJECT_BRIEF.md` for domene og teknisk plan.

## Oppsett

### 1. Miljøvariabler

Kopier eksempel-miljø og fyll inn nøkler:

```bash
cp .env.example .env.local
```

- **Clerk**: Opprett app på [dashboard.clerk.com](https://dashboard.clerk.com). Aktiver **Organizations**. Legg inn `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` og `CLERK_SECRET_KEY`.
- **Supabase**: Opprett prosjekt på [supabase.com](https://supabase.com). Legg inn `DATABASE_URL` (Connection string — bruk **Session pooler** for IPv4). For filimport: `NEXT_PUBLIC_SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY`, og opprett en Storage-bøtte med navn **imports**.

### 2. Database og migrering

Når `DATABASE_URL` er satt i `.env.local`:

```bash
npm run db:migrate
```

(Migreringer ligger i `src/lib/db/migrations/`.)

### 3. Seed (demo-data)

For å få én bedrift, én klient (to kontoer) og 10 standard avstemmingsregler, kjør:

```bash
npm run seed
```

For at klienten skal vises under din organisasjon i appen, sett Clerk-organisasjonens ID før seed:

```bash
SEED_TENANT_ID=org_xxxxx npm run seed
```

(Finner organisasjons-ID i Clerk Dashboard under Organizations.)

### 4. Kjøre appen

```bash
npm run dev
```

Åpne [http://localhost:3000](http://localhost:3000). Du videresendes til innlogging; etter innlogging kommer du til dashboard.

## Scripts

| Script | Beskrivelse |
|--------|-------------|
| `npm run dev` | Start utviklingsserver |
| `npm run build` | Bygg for produksjon |
| `npm run db:generate` | Generer ny Drizzle-migrering fra schema |
| `npm run db:migrate` | Kjør migreringer mot DATABASE_URL |
| `npm run db:studio` | Åpne Drizzle Studio (krever DATABASE_URL) |
| `npm run seed` | Seed demo-data (selskap, klient, 10 regler) |

## Import og script-kunnskap

Kunnskap om hvordan vi leser filer (CSV, CAMT.053), tolker kolonner og lager innlesningsscript er tatt inn fra **script_builder**-prosjektet:

- **Dokumentasjon:** `docs/import-scripts/` (tegne-separert format, CAMT.053)
- **Kode:** `src/lib/import-scripts/` (detektorer, script-generering, auto-forslag til kolonnemapping)

Ved CSV-import brukes automatisk gjenkjenning av skilletegn og kolonne-mapping (dato, beløp, tekst, referanse).

## Tech stack

- Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui
- Clerk (auth + organizations)
- Supabase (PostgreSQL + Storage)
- Drizzle ORM
