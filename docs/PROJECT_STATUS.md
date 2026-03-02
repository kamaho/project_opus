# Revizo — Prosjektstatus

> **Sist oppdatert:** 2. mars 2026  
> **Oppdatert av:** kmh0751 + Claude (AI-agent)  
> Hold dette dokumentet oppdatert ved større endringer.

---

## Hva er Revizo?

SaaS-plattform for regnskapsbyråer. Lar regnskapsførere importere filer fra hovedbok og bank, matche transaksjoner automatisk (Smart Match) eller manuelt, og generere PDF/Excel-rapporter. Leder/partner overvåker status på mobil.

**Domene:** revizo.ai  
**Teknologistakk:** Next.js 16 · Supabase (Postgres + Storage) · Clerk · Drizzle ORM · Railway Worker · Resend · Sentry · Anthropic Claude

---

## Infrastruktur — nåværende tilstand

| Komponent | Status | Detaljer |
|---|---|---|
| **Vercel (web)** | ✅ Live | revizo.ai, automatisk deploy fra `main` |
| **Supabase Prod** | ✅ Synkronisert | `pejkokemdzsekboaebmy`, 37 tabeller, migrert 02.03.2026 |
| **Supabase Dev** | ✅ OK | `oafqbvtagjcdvhgxjghw` ("project opus"), lokal utvikling |
| **Railway Worker** | ✅ Kjører | Smart Match + rapportering i bakgrunnen |
| **GitHub Actions** | ✅ Satt opp | `migrate.yml` (auto db:migrate ved push) + `check-schema.yml` (PR-sjekk) |
| **DATABASE_MIGRATION_URL** | ✅ Satt | GitHub Secret, Session Pooler prod (port 5432) |
| **Sentry** | ✅ Aktiv | Klient + server feilsporing |
| **Resend** | ✅ Aktiv | E-postvarsler |

### Migreringsarbeidsflyt (fra 02.03.2026)

```
schema.ts endret → npm run db:generate → commit + push → GitHub Actions kjører db:migrate mot prod
```

**Ingen manuelle migreringer mot prod lenger.**

---

## Funksjoner — hva som er bygget

### Kjerne (ferdig)

| Funksjon | Status |
|---|---|
| Onboarding (opprett selskap + avstemming) | ✅ |
| Filimport — Excel, CSV, CAMT.053/XML | ✅ |
| Manuell matching (velg transaksjoner, sum = 0) | ✅ |
| Smart Match — automatisk matching via regler | ✅ |
| Matching-regler (motor + 50 standardregler) | ✅ |
| Rapporter — PDF og XLSX med åpne poster | ✅ |
| AI-chatbot (Claude, kunnskapsbase, FAQ) | ✅ |
| Notifikasjoner (varsler ved hendelser) | ✅ |
| Audit trail (hvem gjorde hva, når) | ✅ |
| Oppgavesystem (tasks, frister, tildeling) | ✅ |
| Kontakter (eksterne personer for dokumentforespørsler) | ✅ |
| Dokumentforespørsler (magic link til ekstern part) | ✅ |
| Kalender + norske frister | ✅ |
| Tripletex-integrasjon (synkronisering av transaksjoner) | ✅ |
| Klientgrupper | ✅ |
| Agent-system (bakgrunnsjobber, automatiske rapporter) | ✅ |
| Eksport (PDF, XLSX, CSV) | ✅ |
| Dashboard (agentur + klient) | ✅ |
| Tutorials (steg-for-steg-guider) | ✅ |
| Kontrollresultater (kundefordringer, leverandørgjeld) | ✅ |

### Sikkerhet og produksjonsmodenhet (ferdig)

| Punkt | Status |
|---|---|
| Multi-tenant isolasjon (alle ruter) | ✅ |
| Rate limiting | ✅ |
| RLS-policies (27 stk på 9 tabeller) | ✅ |
| Audit logging | ✅ |
| Filvalidering (størrelse, MIME, sanitering) | ✅ |
| Transaksjonssikkerhet (db.transaction()) | ✅ |
| Caching (unstable_cache med revalidering) | ✅ |
| Virtuell scrolling på store lister | ✅ |
| Sentry feilsporing | ✅ |
| 5-års dataretensjon (norsk regnskapslov) | ✅ |

---

## Kjente svakheter / teknisk gjeld

| Prioritet | Problem | Konsekvens | Fil/komponent |
|---|---|---|---|
| ✅ **Fikset** | Drizzle-journalen er reparert (2026-03-02) | Snapshot-kjeden er gyldig (0000→0001→0002→0003), hashes registrert i `__drizzle_migrations` (dev + prod) | `src/lib/db/migrations/meta/` |
| ✅ **Fikset** | `drizzle-kit check` brukt som blokkerende CI-sjekk (2026-03-02) | `check-schema.yml` bruker nå `drizzle-kit check` i stedet for dry-run generate | `.github/workflows/check-schema.yml` |
| ✅ **Fikset** | Catch-up-migrasjon for 15 manglende tabeller (2026-03-02) | `0004_catchup_missing_tables.sql` dekker alle tabeller som mangler fra journal (inkl. Tripletex, tasks, tutorials, calendar m.fl.) | `src/lib/db/migrations/` |
| ✅ **Fikset** | `NEXT_PUBLIC_ENV=production` satt i Vercel (2026-03-02) | Miljø-badgen vil aldri vises for sluttbrukere | Vercel env vars |
| ✅ **Fikset** | Matching-engine har nå transaksjonslimit (2026-03-02) | `TooManyTransactionsError` kastes ved >10 000 uavstemte transaksjoner per sett. API returnerer 400, worker skiper og fortsetter til rapport | `src/lib/matching/engine.ts` |
| ✅ **Fikset** | `DATABASE_URL` pekte på Session Pooler (port 5432) i prod (2026-03-02) | `MaxClientsInSessionMode`-feil i prod. Rettet til Transaction Pooler (port 6543). `max` redusert fra 10 → 1 for serverless-kompatibilitet | `src/lib/db/index.ts` + Vercel env |
| ✅ **Fikset** | Global feilside for API-krasj (2026-03-02) | `src/app/error.tsx` (root), `dashboard/error.tsx` (forbedret), `not-found.tsx` (404). Viser digest-kode, rapporterer til Sentry, tilbyr navigasjon | `src/app/error.tsx`, `src/app/not-found.tsx` |
| 🟢 **Lav** | 7 tabeller i dev eksisterer ikke i kodebasen (`saved_mappings`, `balance_checkpoints` m.fl.) | Ingen funksjonell konsekvens — disse brukes ikke | Supabase dev-prosjekt |
| 🟢 **Lav** | `PRODUCTION_READINESS_AUDIT.md` er fra 19.02.2026 og ikke oppdatert med Mars-fixes | Audit-dokumentet er foreldet | `docs/PRODUCTION_READINESS_AUDIT.md` |

---

## Veien videre — prioritert backlog

### ✅ Fullført (2026-03-02)

1. ~~Fiks Drizzle-journalen~~ — journal reparert, snapshots og `__drizzle_migrations` synkronisert i dev + prod
2. ~~`drizzle-kit check` som blokkerende CI~~ — `check-schema.yml` oppdatert
3. ~~Catch-up-migrasjon for 15 manglende tabeller~~ — `0004_catchup_missing_tables.sql` i journal
4. ~~`NEXT_PUBLIC_ENV=production` i Vercel~~ — satt manuelt

---

### 🟡 Viktig (neste sprint)

**~~Memoize matching-engine for store datasett~~ ✅ FERDIG (2026-03-02)**

`TooManyTransactionsError` kastes ved >10 000 uavstemte transaksjoner per sett. Count-sjekk kjøres FØR data lastes inn i minnet. API-routes returnerer `code: "TOO_MANY_TRANSACTIONS"` med 400. Worker skiper matching og fortsetter til rapport-generering.

**~~Forbedre onboarding-feilmeldinger~~ ✅ FERDIG (2026-03-02)**

Begge onboarding-wizards (`setup-wizard.tsx`, `step-configure-erp.tsx`) viser nå:
- `AlertCircle`-ikon i feilboks
- Steg-spesifikk kontekst i feilmeldingen ("Selskap X: ...", "Konto 1920: ...")
- Progress-tekst under innlasting ("Oppretter selskap 1 av 2...")
- Handlingshenvisning for 403-feil ("Velg organisasjon i headeren") og duplikat-feil

---

### 🟢 Ønskelig (fremtidig)

**Staging-miljø**

Sett opp et dedikert staging-miljø (eget Supabase-prosjekt + Vercel preview-branch) for å teste endringer før prod-deploy.

**Push-varsler (mobil)**

Produktfilosofien er "åpne appen, se grønt, lukk igjen". Push-varsler er det manglende leddet for mobil-opplevelsen.

**AI-agent med matcheforslag**

Bruke historiske matchedata til å foreslå matchingregler automatisk, i stedet for manuell konfigurasjon.

---

## Kritiske miljøvariabler — sjekkliste

### Vercel (Production)
| Variabel | Status |
|---|---|
| `DATABASE_URL` | ✅ Satt (Transaction Pooler, port 6543) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Satt |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Satt |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Satt |
| `CLERK_SECRET_KEY` | ✅ Satt |
| `RESEND_API_KEY` | ✅ Satt |
| `ANTHROPIC_API_KEY` | ✅ Satt |
| `CRON_SECRET` | ✅ Satt |
| `ENCRYPTION_KEY` | ✅ Satt |
| `NEXT_PUBLIC_ENV` | ✅ Satt til `production` |

### GitHub Secrets
| Secret | Status |
|---|---|
| `DATABASE_MIGRATION_URL` | ✅ Satt (Session Pooler prod, port 5432) |

---

## Dokumentasjonskart

| Dokument | Innhold |
|---|---|
| `docs/ARCHITECTURE.md` | Systemarkitektur, teknologistakk, mappestruktur |
| `docs/DATABASE.md` | Alle tabeller og relasjoner |
| `docs/DATABASE_DEV_PROD.md` | Dev vs prod Supabase-oppsett |
| `docs/SETUP.md` | Kom i gang, migrasjonsarbeidsflyt, GitHub Secrets |
| `docs/API.md` | Alle 75 API-endepunkter |
| `docs/SERVICES.md` | Alle eksterne tjenester og konfigurasjon |
| `docs/MATCHING_ENGINE.md` | Smart Match-motor |
| `docs/AGENT_SYSTEM.md` | Railway Worker, bakgrunnsjobber |
| `docs/IMPORT_SYSTEM.md` | Filimport, parsere, wizard |
| `docs/EXPORT_SYSTEM.md` | PDF/XLSX-eksport |
| `docs/AI_SYSTEM.md` | AI-chatbot og kunnskapsbase |
| `docs/NOTIFICATIONS.md` | Varslingssystem |
| `docs/PRODUCTION_READINESS_AUDIT.md` | Sikkerhets- og ytelsesaudit (Feb 2026) |
| `docs/DESIGN_SYSTEM.md` | Designsystem, farger, typografi, komponenter |
| `docs/endringer/` | Kronologisk endringslogg |
| `docs/incidents/` | Post-mortems for produksjonsfeil |
| `docs/migrations/` | SQL-migreringsskript kjørt mot prod |
