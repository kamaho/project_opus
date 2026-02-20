# Arkitektur — Account Control

## Oversikt

Account Control er en norsk SaaS-plattform for avstemming (reconciliation) av regnskapstransaksjoner. Plattformen lar regnskapsbyråer importere filer fra ulike kilder (hovedbok, bankutskrift) og matche transaksjoner mellom to sett.

```
┌──────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                │
│  React 19 · Tailwind 4 · shadcn/ui · TypeScript          │
├──────────────────────────────────────────────────────────┤
│                     API Routes (Next.js)                  │
│  /api/import · /api/clients · /api/companies              │
├─────────────────────┬────────────────────────────────────┤
│   Clerk (Auth)      │    Supabase                        │
│   - Brukere         │    - PostgreSQL (data)             │
│   - Organisasjoner  │    - Storage (filopplasting)       │
│   - SSO/OAuth       │    - Drizzle ORM (queries)         │
└─────────────────────┴────────────────────────────────────┘
```

## Teknologistakk

| Lag              | Teknologi                                | Rolle                                     |
|------------------|------------------------------------------|--------------------------------------------|
| Frontend         | Next.js 16 (App Router, Turbopack)       | SSR, routing, React Server Components      |
| UI               | shadcn/ui + Tailwind CSS 4               | Komponentbibliotek, styling                |
| Autentisering    | Clerk                                    | Brukere, organisasjoner, SSO               |
| Database         | Supabase PostgreSQL                      | Relasjonell datalagring                    |
| ORM              | Drizzle ORM                              | Type-safe queries, migrasjon               |
| Fillagring       | Supabase Storage                         | Importerte filer lagres i bucket "imports"  |
| Filparsing       | xlsx, papaparse, fast-xml-parser         | Excel, CSV, CAMT.053 XML-filer             |
| Validering       | Zod                                      | Runtime-validering av API-input            |
| Ikoner           | Lucide React                             | Ikonbibliotek                              |

## Mappestruktur

```
project_opus/
├── docs/                    # Prosjektdokumentasjon
├── scripts/                 # Verktøy (seed.ts)
├── public/                  # Statiske filer
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Innlogging (sign-in, sign-up)
│   │   ├── api/             # API-ruter (se docs/API.md)
│   │   │   ├── clients/     # Klient-CRUD + matching
│   │   │   ├── companies/   # Selskap-listing
│   │   │   └── import/      # Filimport
│   │   └── dashboard/       # Dashboard-sider
│   │       ├── accounts/    # Kontoadministrasjon
│   │       ├── clients/     # Klienter + import + matching
│   │       ├── companies/   # Selskaper
│   │       └── settings/    # Innstillinger
│   ├── components/
│   │   ├── import/          # Import-wizard, forhåndsvisning, dropzone
│   │   ├── layout/          # Header, sidebar, breadcrumb
│   │   ├── matching/        # Matching-visning, toolbar, paneler
│   │   └── ui/              # shadcn/ui-komponenter
│   ├── hooks/               # React-hooks
│   └── lib/
│       ├── db/              # Drizzle-skjema, tilkobling, migrasjoner
│       ├── import-scripts/  # Import-script logikk og detektorer
│       └── parsers/         # Fil-parsere (CSV, Excel, CAMT, Klink)
├── drizzle.config.ts        # Drizzle-konfigurasjon
├── next.config.ts           # Next.js-konfigurasjon
├── package.json
└── tsconfig.json
```

## Dataflyt: Filimport

```
1. Bruker drar fil inn i dropzone
       │
2. Klient detekterer filtype (Excel/CSV/CAMT/Klink)
       │
3. For Excel/CSV: Wizard åpnes
   ├── Steg 1: Vis alle rader — klikk for å velge overskriftsrad
   ├── Steg 2: Klikk på dato-kolonne
   ├── Steg 3: Klikk på beløp-kolonne (eller kredit+debit)
   ├── Steg 4: Velg ekstra kolonner (valgfritt, progressbar)
   └── Steg 5: Bekreft mapping og importer
       │
4. POST /api/import med fil + konfig
       │
5. Server:
   ├── Validerer med Zod
   ├── Sjekker autorisasjon (Clerk org → company → client)
   ├── Laster opp fil til Supabase Storage
   ├── Parser filen med riktig parser
   └── Setter inn transaksjoner i PostgreSQL via Drizzle
       │
6. Klient oppdaterer visningen (router.refresh)
```

## Autentiseringsmodell

- **Clerk** håndterer all autentisering
- Hver bruker tilhører en **organisasjon** (`orgId`)
- `orgId` lagres som `tenant_id` i databasen
- Alle API-ruter sjekker `auth()` for `userId` og `orgId`
- Multi-tenancy: data isoleres per organisasjon via `tenant_id`-sjekk

## Multitenancy

```
Clerk Organization (orgId)
    └── companies (tenant_id = orgId)
            └── accounts
            └── clients
                    ├── transactions (set 1 + set 2)
                    ├── imports
                    ├── matches
                    └── matching_rules
```

Alle data-spørringer filtrerer på `tenant_id` eller navigerer via `company → client`-relasjonen for å sikre dataisolering.
