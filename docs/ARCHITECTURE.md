# Arkitektur — Revizo

## Oversikt

Revizo er en norsk SaaS-plattform for avstemming (reconciliation) av regnskapstransaksjoner. Plattformen lar regnskapsbyråer importere filer fra ulike kilder (hovedbok, bankutskrift) og matche transaksjoner mellom to sett — manuelt eller automatisk via Smart Match-motoren. I tillegg har Revizo en AI-chatbot, et varslingssystem, eksportfunksjonalitet, og et agent-system for automatisert bakgrunnsbehandling.

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                         │
│  React 19 · Tailwind 4 · shadcn/ui · TypeScript                │
│                                                                  │
│  Matching · Smart Panel (AI) · Eksport · Varsler · Innstillinger │
├──────────────────────────────────────────────────────────────────┤
│                    API Routes (Next.js)                          │
│  /api/import · /api/clients · /api/ai · /api/export              │
│  /api/notifications · /api/companies                             │
├───────────┬───────────┬──────────────────────────────────────────┤
│  Clerk    │  Supabase │  Eksterne tjenester                      │
│  - Auth   │  - PgSQL  │  - Resend (e-post)                       │
│  - Orgs   │  - Storage│  - Anthropic Claude (AI)                 │
│  - SSO    │  - Drizzle│  - OpenAI (embeddings)                   │
├───────────┴───────────┴──────────────────────────────────────────┤
│              Railway Worker (Node.js)                             │
│  Bakgrunnsjobber: Smart Match · PDF-rapporter · E-post           │
└──────────────────────────────────────────────────────────────────┘
```

## Teknologistakk

| Lag | Teknologi | Rolle |
|-----|-----------|-------|
| Frontend | Next.js 16 (App Router, Turbopack) | SSR, routing, React Server Components |
| UI | shadcn/ui + Tailwind CSS 4 | Komponentbibliotek, styling |
| Autentisering | Clerk | Brukere, organisasjoner, SSO |
| Database | Supabase PostgreSQL | Relasjonell datalagring |
| ORM | Drizzle ORM | Type-safe queries, migrasjon |
| Fillagring | Supabase Storage | Importerte filer i bucket "imports" |
| Filparsing | xlsx, papaparse, fast-xml-parser | Excel, CSV, CAMT.053 XML-filer |
| AI (LLM) | Anthropic Claude Sonnet 4 | Chatbot, kunnskapssøk |
| AI (Embeddings) | OpenAI text-embedding-3-small | Semantisk søk i kunnskapsbase |
| E-post | Resend | Varsler, rapporter, notifikasjoner |
| Eksport | pdfmake, xlsx | PDF- og XLSX-rapporter |
| Feilsporing | Sentry | Klient- og server-side feilrapportering |
| Validering | Zod | Runtime-validering av API-input |
| Ikoner | Lucide React | Ikonbibliotek |
| Bakgrunnsjobber | Railway Worker (Node.js) | Automatisk Smart Match og rapportering |

## Mappestruktur

```
project_opus/
├── docs/                        # Prosjektdokumentasjon
│   ├── ARCHITECTURE.md          # Denne filen
│   ├── MATCHING_ENGINE.md       # Smart Match-motor
│   ├── AI_SYSTEM.md             # AI-chatbot og kunnskapsbase
│   ├── AGENT_SYSTEM.md          # Automatisert matching og rapportering
│   ├── NOTIFICATIONS.md         # Varslingssystem
│   ├── EXPORT_SYSTEM.md         # PDF/XLSX-eksport
│   ├── DATABASE.md              # Databaseskjema
│   ├── API.md                   # API-referanse
│   ├── SERVICES.md              # Eksterne tjenester og konfig
│   ├── IMPORT_SYSTEM.md         # Import-system
│   ├── DESIGN_SYSTEM.md         # Designsystem
│   └── ...
├── worker/                      # Railway Worker (bakgrunnsjobber)
│   ├── index.ts                 # Entry point, poll-loop, locking
│   └── job-runner.ts            # Jobb-logikk (match + rapport + e-post)
├── scripts/                     # Verktøy (seed.ts, seed-knowledge.ts)
├── public/                      # Statiske filer
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (auth)/              # Innlogging (sign-in, sign-up)
│   │   ├── api/                 # API-ruter (se docs/API.md)
│   │   │   ├── ai/              # AI-chat
│   │   │   ├── clients/         # Klient-CRUD, matching, agent, transaksjoner
│   │   │   ├── companies/       # Selskap-listing
│   │   │   ├── export/          # PDF/XLSX-eksport
│   │   │   ├── import/          # Filimport
│   │   │   └── notifications/   # Varsler
│   │   └── dashboard/           # Dashboard-sider
│   │       ├── accounts/        # Kontoadministrasjon
│   │       ├── clients/         # Klienter + import + matching
│   │       ├── companies/       # Selskaper
│   │       └── settings/        # Innstillinger
│   ├── components/
│   │   ├── export/              # Eksport-modal og rapport-knapp
│   │   ├── import/              # Import-wizard, forhåndsvisning, dropzone
│   │   ├── layout/              # Header, sidebar, breadcrumb, notification-bell
│   │   ├── matching/            # Matching-visning, toolbar, paneler, agent-settings
│   │   ├── smart-panel/         # AI-chatbot UI
│   │   └── ui/                  # shadcn/ui-komponenter
│   ├── hooks/                   # React-hooks (useAiChat, useUiPreferences, etc.)
│   └── lib/
│       ├── ai/                  # AI-system (prompt, guardrails, actions, knowledge)
│       ├── db/                  # Drizzle-skjema, tilkobling, tenant-validering
│       ├── export/              # Eksport-service, templates, registry
│       ├── import-scripts/      # Import-script logikk og detektorer
│       ├── matching/            # Smart Match-motor (engine, pipeline, scorer)
│       └── parsers/             # Fil-parsere (CSV, Excel, CAMT, Klink)
├── drizzle.config.ts            # Drizzle-konfigurasjon
├── next.config.ts               # Next.js-konfigurasjon
├── package.json
└── tsconfig.json
```

## Hovedsystemer

| System | Dokumentasjon | Beskrivelse |
|--------|---------------|-------------|
| **Smart Match** | [MATCHING_ENGINE.md](MATCHING_ENGINE.md) | Regelbasert matching med pipeline, scoring og indeksering |
| **AI-chatbot** | [AI_SYSTEM.md](AI_SYSTEM.md) | Claude-drevet chatbot med kunnskapsbase og tool calling |
| **Revizo Agent** | [AGENT_SYSTEM.md](AGENT_SYSTEM.md) | Automatisert Smart Match og PDF-rapportering via Railway Worker |
| **Varsler** | [NOTIFICATIONS.md](NOTIFICATIONS.md) | In-app og e-postvarsler via Resend |
| **Eksport** | [EXPORT_SYSTEM.md](EXPORT_SYSTEM.md) | PDF/XLSX-rapporter med template-mønster |
| **Import** | [IMPORT_SYSTEM.md](IMPORT_SYSTEM.md) | Filimport (Excel, CSV, CAMT, Klink) med wizard |
| **Database** | [DATABASE.md](DATABASE.md) | Databaseskjema og sikkerhet |
| **API** | [API.md](API.md) | API-referanse for alle endepunkter |
| **Tjenester** | [SERVICES.md](SERVICES.md) | Eksterne tjenester og miljøvariabler |
| **Design** | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Designsystem med farger, typografi og komponenter |

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
                    ├── matching_rules
                    ├── agent_report_configs
                    └── agent_job_logs
    └── notifications (tenant_id = orgId)
    └── ai_conversations (organization_id = orgId)
    └── ai_user_memory (organization_id = orgId)
```

Alle data-spørringer filtrerer på `tenant_id` eller navigerer via `company → client`-relasjonen for å sikre dataisolering.
