# Supabase — Database og fillagring

## Oversikt

Supabase brukes for to ting i Revizo:

1. **PostgreSQL-database** — via Supabase sin managed PostgreSQL-instans
2. **Fillagring (Storage)** — for importerte filer og vedlegg

Databasetilkoblingen går **ikke** via Supabase JS-klienten, men direkte via PostgreSQL
med Drizzle ORM. Supabase JS-klienten brukes **kun** for Storage-operasjoner.

## Arkitektur

```
┌──────────────────────────────────────────────────┐
│ Revizo (Next.js)                                 │
│                                                  │
│  Database-queries       Fillagring               │
│  ┌──────────────┐      ┌──────────────────┐      │
│  │ Drizzle ORM  │      │ Supabase JS SDK  │      │
│  │ + postgres   │      │ (service role)   │      │
│  └──────┬───────┘      └────────┬─────────┘      │
└─────────┼───────────────────────┼────────────────┘
          │                       │
          ▼                       ▼
   Supabase PostgreSQL      Supabase Storage
   (Session Pooler)         (S3-kompatibel)
```

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/lib/db/index.ts` | Database-tilkobling (Drizzle + postgres driver) |
| `src/lib/db/schema.ts` | Komplett database-schema (Drizzle) |
| `src/lib/supabase.ts` | Supabase JS-klient for Storage |
| `src/lib/db/migrations/` | SQL-migrasjonsfiler |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase Session Pooler) | Ja |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase prosjekt-URL (for Storage) | Ja (for fillagring) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role nøkkel (bypasser RLS) | Ja (for fillagring) |

### Om DATABASE_URL

Connection string-formatet er:
```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Vi bruker **Session Pooler** (port 5432), ikke Transaction Pooler, fordi Drizzle
trenger sesjonsbaserte tilkoblinger for prepared statements.

## Database (Drizzle ORM)

### Tilkobling

Database-tilkoblingen er en **singleton** — én pool per prosess. Dette forhindrer
`MaxClientsInSessionMode`-feilen som oppstår hvis man lager for mange tilkoblinger.

```typescript
// Importér db fra:
import { db } from "@/lib/db";

// Bruk i queries:
const rows = await db.select().from(clients).where(eq(clients.tenantId, orgId));
```

### Schema

Komplett schema er definert i `src/lib/db/schema.ts` med Drizzle-definisjoner.
Se `docs/DATABASE.md` for full ER-diagram og tabelloversikt.

### Migrasjoner

Migrasjoner ligger i `src/lib/db/migrations/` og kjøres via Drizzle Kit:

```bash
# Generer migrasjon basert på schema-endring:
npx drizzle-kit generate

# Kjør migrasjoner:
npx drizzle-kit push
```

### RLS (Row Level Security)

Alle tabeller har RLS aktivert i Supabase. Siden vi bruker `SUPABASE_SERVICE_ROLE_KEY`
for Storage og direkte PostgreSQL-tilkobling for queries, bypasser vi RLS i praksis.
Tenant-isolering sikres i applikasjonskoden via `tenant_id`-filtrering.

## Fillagring (Supabase Storage)

### Buckets

| Bucket | Formål | Filtyper |
|---|---|---|
| `imports` | Importerte filer fra brukere | Excel (.xlsx), CSV, XML (CAMT.053) |
| `attachments` | Vedlegg på transaksjoner | PDF, bilder, etc. |

### Operasjoner

```typescript
import { supabase, UPLOAD_BUCKET, ATTACHMENTS_BUCKET } from "@/lib/supabase";

// Last opp fil:
const { data, error } = await supabase.storage
  .from(UPLOAD_BUCKET)
  .upload(filePath, fileBuffer, { contentType: "application/octet-stream" });

// Last ned fil:
const { data, error } = await supabase.storage
  .from(UPLOAD_BUCKET)
  .download(filePath);

// Slett fil:
const { error } = await supabase.storage
  .from(UPLOAD_BUCKET)
  .remove([filePath]);
```

### Graceful degradation

Hvis `NEXT_PUBLIC_SUPABASE_URL` eller `SUPABASE_SERVICE_ROLE_KEY` mangler, settes
`supabase`-klienten til `null`. Koden sjekker `if (!supabase) return` og logger
en advarsel. Fillagring vil ikke fungere, men resten av appen kjører.

## Feilsøking

### «MaxClientsInSessionMode» / tilkoblingsfeil

1. Sjekk at `DATABASE_URL` bruker **Session Pooler** (port 5432)
2. Sjekk at Drizzle-singleton'en ikke reinstansieres (hot reload i dev kan forårsake dette)
3. Se Supabase Dashboard → Database → Connections for aktive tilkoblinger
4. Max connections for Session Pooler avhenger av Supabase-plan

### Database-queries returnerer tom data

1. Sjekk at `tenant_id`-filter er med i queryen
2. Sjekk at brukeren er i riktig organisasjon (Clerk `orgId`)
3. Verifiser data direkte i Supabase Dashboard → Table Editor

### Fillagring feiler

1. Sjekk at `NEXT_PUBLIC_SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` er satt
2. Sjekk at bucket'en eksisterer i Supabase Dashboard → Storage
3. Sjekk filstørrelsesbegrensning (Supabase default: 50 MB)
4. Se Supabase Dashboard → Logs → Storage for detaljerte feilmeldinger

### Migrasjonsfeil

1. Sjekk at `DATABASE_URL` har riktige rettigheter (service role)
2. Kjør `npx drizzle-kit push` for å synce schema
3. Sjekk `supabase_migrations`-tabellen for status

## Supabase Dashboard

URL: https://supabase.com/dashboard

Her kan du:
- Se og redigere data (Table Editor)
- Kjøre SQL-queries direkte (SQL Editor)
- Administrere Storage-buckets
- Se tilkoblinger og ytelse
- Konfigurere RLS-policies
- Se logger for alle tjenester

## Viktig å vite

- **Database** er kritisk — uten `DATABASE_URL` starter ikke appen
- **Storage** er viktig men ikke kritisk — appen kjører, men fil-operasjoner feiler
- Vi bruker **ikke** Supabase Auth — det håndteres av Clerk
- Vi bruker **ikke** Supabase Realtime
- Drizzle ORM er type-safe og genererer SQL — sjekk `schema.ts` for datamodellen
- **Aldri** bruk Supabase JS-klienten for database-queries — bruk `db` fra Drizzle
- Backup: Supabase tar daglige backups automatisk (plan-avhengig)
