# Revizo — Full prosjektkontekst for AI-agenter og utviklere

> **Formål:** Denne filen gir full kontekst om prosjektet slik at en annen AI-agent eller utvikler kan jobbe **parallelt** uten å miste tråden. Bruk den som briefing når du deler arbeid på tvers av agenter eller team. Oppdater denne filen når store endringer skjer (nye systemer, ny mappestruktur, nye krav).

---

## 1. Hva er Revizo?

**Revizo** er en norsk SaaS-plattform for **avstemming (reconciliation)** av regnskapstransaksjoner. Målgruppe: regnskapsbyråer og revisorer.

- **Kjerne:** Importere transaksjoner fra to kilder (typisk hovedbok + bank), matche dem manuelt eller automatisk (Smart Match), rapportere og eksportere.
- **Utvidelser:** AI-chatbot (Claude), varsler (in-app + e-post), agent for automatisk matching og PDF-rapporter, Tripletex-integrasjon for synk av regnskapsdata.
- **Visjon (domain spec):** Én samlet app med avstemming, balanseavstemming, oppgaveflyt, årsrapport og public API. Modulært med feature-toggles per tenant.

**Viktig:** Kode og variabler på engelsk; **UI-tekst og brukervendt dokumentasjon på norsk (bokmål)**.

---

## 2. Teknologistakk

| Område | Teknologi |
|--------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui |
| Auth | Clerk (brukere, organisasjoner, SSO) |
| Database | Supabase PostgreSQL, Drizzle ORM (ikke Supabase JS for DB) |
| Fillagring | Supabase Storage (buckets: `imports`, `attachments`) |
| AI | Anthropic Claude Sonnet 4 (chat), OpenAI text-embedding-3-small (embeddings) |
| E-post | Resend |
| Eksport | pdfmake, xlsx |
| Feilsporing | Sentry |
| Validering | Zod |
| Bakgrunnsjobber | Railway Worker (Node.js) — Smart Match, rapporter, e-post |
| Dokumentasjon (kunde + internt) | Docusaurus i `docs-site/` |

---

## 3. Mappestruktur (detaljert)

```
project_opus/
├── .cursor/rules/           # Cursor-regler (design.mdc, documentation.mdc) — alwaysApply
├── docs/                     # INTERN prosjektdokumentasjon (kilde til sannheten)
│   ├── PROJECT_CONTEXT_FOR_AGENTS.md   # Denne filen
│   ├── ARCHITECTURE.md       # Arkitektur og dataflyt
│   ├── DOMAIN_SPEC_NEW.md    # Domene, forretningsregler, brukertyper
│   ├── DESIGN_SYSTEM.md      # Farger, typografi, komponenter — ALLE UI-endringer må følge
│   ├── DEVELOPMENT_RULES_NEW.md  # Sikkerhet, feilhåndtering, DB, API, §11 Dokumentasjon
│   ├── DOCUSAURUS_STRATEGY.md    # Strategi for docs-site (internt vs eksternt)
│   ├── DATABASE.md           # Schema, tabeller, RLS
│   ├── API.md                # API-referanse (alle ruter)
│   ├── SERVICES.md           # Eksterne tjenester, miljøvariabler
│   ├── MATCHING_ENGINE.md    # Smart Match-motor
│   ├── AI_SYSTEM.md          # AI-chatbot, kunnskapsbase
│   ├── AGENT_SYSTEM.md       # Railway Worker, agent-jobs
│   ├── NOTIFICATIONS.md      # Varsler (in-app + e-post)
│   ├── EXPORT_SYSTEM.md      # PDF/XLSX-eksport
│   ├── IMPORT_SYSTEM.md      # Import (Excel, CSV, CAMT, Klink)
│   ├── SETUP.md / VERCEL_SETUP.md
│   ├── integrations/         # Per-integrasjon: feilsøking, miljøvariabler
│   │   ├── README.md
│   │   ├── clerk.md, supabase.md, anthropic.md, openai.md, resend.md, sentry.md, tripletex.md
│   ├── import-scripts/       # Import-script-format, CAMT
│   ├── endringer/            # Endringshistorikk (én .md per tema/dato)
│   └── qol/                  # Små UX-forbedringer
│
├── docs-site/                # Docusaurus — KUNDE- og INTERNT-dokumentasjon
│   ├── docs/                 # Innhold (kom-i-gang, guider, utviklere, faq, endringslogg, internt)
│   ├── docusaurus.config.ts  # DOCS_PUBLIC_ONLY=true → ekskluderer docs/internt/
│   ├── sidebars.ts
│   └── README.md             # build:public vs build (internt)
│
├── worker/                   # Railway Worker
│   ├── index.ts              # Poll-loop, jobb-claiming, locking
│   └── job-runner.ts         # Smart Match + rapport + e-post
│
├── scripts/                  # seed.ts, seed-knowledge.ts
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/           # sign-in, sign-up
│   │   ├── api/              # Alle API-ruter (se docs/API.md)
│   │   │   ├── ai/           # Chat
│   │   │   ├── clients/      # CRUD, matching, auto-match, agent, transaksjoner, attachments
│   │   │   ├── companies/
│   │   │   ├── cron/         # f.eks. tripletex-sync
│   │   │   ├── export/
│   │   │   ├── import/
│   │   │   ├── notifications/
│   │   │   └── tripletex/
│   │   └── dashboard/       # Sider: clients, companies, settings, matching, import, oppgaver, etc.
│   ├── components/           # layout, matching, smart-panel, import, export, ui (shadcn)
│   ├── hooks/
│   └── lib/
│       ├── ai/               # system-prompt, context, actions, guardrails, knowledge-search, embeddings
│       ├── db/               # schema.ts, index.ts (Drizzle), migrations
│       ├── export/           # service, templates, registry
│       ├── matching/         # engine, pipeline, scorer
│       ├── parsers/          # CSV, Excel, CAMT, Klink
│       ├── tripletex/       # sync, mappers, pagination, types
│       ├── supabase.ts       # Storage-klient
│       ├── resend.ts
│       └── notifications.ts
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 4. Konvensjoner som ALLTID gjelder

### 4.1 Sikkerhet og autentisering

- **Alle** server actions og API-ruter må kalle `auth()` (Clerk) og sjekke `userId` + `orgId` før noe annet.
- **Alle** database-spørringer må være scopet til **tenant** (`tenant_id` = Clerk `orgId`). Aldri bruk `tenant_id` fra klienten — hent fra session.
- Valider **all** input på API-grensen med **Zod**. Aldri stole på klientdata.
- Ingen secrets i klienten (ingen `NEXT_PUBLIC_` på hemmeligheter).
- Se `docs/DEVELOPMENT_RULES_NEW.md` §1–2 for full liste.

### 4.2 Multi-tenancy (datamodell)

```
Clerk Organization (orgId) = tenant_id i DB
  └── companies (tenant_id)
        └── accounts
        └── clients
              ├── transactions (set 1 + set 2)
              ├── imports, matches, matching_rules
              ├── agent_report_configs, agent_job_logs
              └── transaction_attachments
  └── notifications (tenant_id)
  └── ai_conversations, ai_user_memory (organization_id)
```

Ved ny funksjonalitet: alltid filtrer på `tenant_id` eller naviger via company → client.

### 4.3 Språk

- **Kode, variabler, commits, logger:** Engelsk.
- **UI-tekst, brukermeldinger, kundedokumentasjon:** Norsk (bokmål).

### 4.4 UI og design

- **Alle** UI-endringer må følge `docs/DESIGN_SYSTEM.md` og `.cursor/rules/design.mdc`.
- Font: Geist. Radius: 8px. Primærknapper: nesten svart. Brand-accent (neon grønn): kun for identitet/status, ikke for primærknapper eller brødtekst.
- Komponenter: shadcn/ui (New York). Ikoner: Lucide React.

---

## 5. Dokumentasjon — jobb parallelt

**Krav:** Dokumentasjon skal **alltid** jobbes parallelt med funksjonalitet (internt og eksternt). Se `docs/DEVELOPMENT_RULES_NEW.md` §11 og `.cursor/rules/documentation.mdc`.

- **Ny funksjon / endring** → Oppdater eller legg til dokumentasjon i samme arbeid (samme PR/task).
- **Internt:** `docs/` og `docs/integrations/`. Ved Docusaurus: hold `docs-site/docs/internt/` i sync.
- **Eksternt (kunder):** `docs-site/docs/` (Kom i gang, Guider, FAQ, Utviklere).
- **Ny integrasjon** → Egen fil i `docs/integrations/` (oversikt, miljøvariabler, feilsøking) + oppdater `docs/integrations/README.md`.

---

## 6. Hovedsystemer og hvor de dokumenteres

| System | Hoveddokumentasjon | Nøkkelfiler i kode |
|--------|--------------------|---------------------|
| Smart Match | `docs/MATCHING_ENGINE.md` | `src/lib/matching/engine.ts`, API under `api/clients/[clientId]/auto-match` |
| AI-chatbot | `docs/AI_SYSTEM.md` | `src/app/api/ai/chat/route.ts`, `src/lib/ai/` |
| Revizo Agent | `docs/AGENT_SYSTEM.md` | `worker/index.ts`, `worker/job-runner.ts`, `api/clients/[clientId]/assign` |
| Varsler | `docs/NOTIFICATIONS.md` | `src/lib/notifications.ts`, `src/lib/resend.ts` |
| Eksport | `docs/EXPORT_SYSTEM.md` | `src/lib/export/`, `api/export` |
| Import | `docs/IMPORT_SYSTEM.md` | `src/lib/parsers/`, `api/import`, `src/components/import/` |
| Tripletex | `docs/integrations/tripletex.md` | `src/lib/tripletex/`, `api/tripletex/`, `api/cron/tripletex-sync` |
| Database | `docs/DATABASE.md` | `src/lib/db/schema.ts`, `src/lib/db/index.ts` |
| API | `docs/API.md` | `src/app/api/*` |

---

## 7. Integrasjoner (eksterne tjenester)

| Integrasjon | Formål | Kritisk? | Dokumentasjon |
|-------------|--------|----------|---------------|
| Clerk | Auth, organisasjoner | Ja | `docs/integrations/clerk.md` |
| Supabase | PostgreSQL + Storage | Ja | `docs/integrations/supabase.md` |
| Anthropic | AI-chat (Claude) | Nei | `docs/integrations/anthropic.md` |
| OpenAI | Embeddings | Nei | `docs/integrations/openai.md` |
| Resend | E-post | Nei | `docs/integrations/resend.md` |
| Sentry | Feilsporing | Nei | `docs/integrations/sentry.md` |
| Tripletex | Regnskaps-synk | Nei | `docs/integrations/tripletex.md` |

Ved **ny integrasjon:** legg til egen `.md` i `docs/integrations/` med oversikt, miljøvariabler, feilsøking og lenker til dashboard. Oppdater `docs/integrations/README.md`.

---

## 8. API-mønster (kort)

- **Auth:** `const { userId, orgId } = await auth(); if (!userId || !orgId) return 401/403.`
- **Tenant:** Hent ressurs (f.eks. client) og verifiser at den tilhører `orgId` (via company eller client.tenant).
- **Input:** `const body = await req.json(); const parsed = mySchema.safeParse(body); if (!parsed.success) return 400.`
- **Svar:** Bruk riktig statuskode; ikke lek intern informasjon (stack traces, SQL).

Alle ruter er under `src/app/api/`. Detaljert liste: `docs/API.md`.

---

## 9. Database (kort)

- **ORM:** Drizzle. Schema: `src/lib/db/schema.ts`. Tilkobling: `src/lib/db/index.ts` (singleton, `max: 1` for Supabase Session Pooler).
- **Migrasjoner:** `src/lib/db/migrations/`. Kommandoer: `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`.
- **RLS:** Aktivert på Supabase; appen bruker service role / direkte Postgres, tenant-isolering sikres i applaget.

---

## 10. Kommandoer

| Kommando | Beskrivelse |
|----------|-------------|
| `npm run dev` | Next.js dev-server (port **3001**; Docusaurus bruker 3000) |
| `npm run build` | Next.js produksjonsbuild |
| `npm run db:generate` | Drizzle: generer migrasjon |
| `npm run db:migrate` | Drizzle: kjør migrasjoner |
| `npm run db:studio` | Drizzle Studio (DB-GUI) |
| `npm run seed` | Seed script |
| `npm run seed:knowledge` | Seed AI-kunnskapsbase |
| `npm run worker` | Kjør Railway Worker |
| `npm run worker:dev` | Worker med watch |
| `cd docs-site && npm run build:public` | Docusaurus offentlig build (uten internt) |
| `cd docs-site && npm run build` | Docusaurus full build (med internt) |
| `cd docs-site && npm start` | Docusaurus dev-server |

---

## 11. Miljøvariabler (oversikt)

Kreves for full funksjon (se `.env.example` og `docs/SERVICES.md` / `docs/integrations/*.md`):

- **Clerk:** `NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`
- **Database/Storage:** `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **AI:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- **E-post:** `RESEND_API_KEY`, `RESEND_FROM_ADDRESS`
- **Feilsporing:** `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- **Tripletex:** `TRIPLETEX_API_BASE_URL`, `TRIPLETEX_CONSUMER_TOKEN`, `TRIPLETEX_EMPLOYEE_TOKEN`
- **App:** `NEXT_PUBLIC_APP_URL` (for lenker i e-post m.m.)

---

## 12. Koordinering ved parallelt arbeid

- **Les denne filen først** for å forstå domene, stack og konvensjoner.
- **Velg område:** Unngå å endre samme filer/domener samtidig uten avtale (f.eks. én agent på matching, én på docs-site).
- **Dokumentasjon:** Ved endringer i kode/funksjonalitet, oppdater relevante `docs/`- og evt. `docs-site/`-filer i samme omgang (se §5).
- **Konflikter:** Ved tvil om tenant-scoping, auth eller validering, sjekk `docs/DEVELOPMENT_RULES_NEW.md` og `docs/API.md`.
- **Design:** Ved UI-endringer, sjekk `docs/DESIGN_SYSTEM.md` og `.cursor/rules/design.mdc`.

---

## 13. Komplett liste over dokumentasjonsfiler (referanse)

| Fil | Innhold |
|-----|---------|
| `docs/PROJECT_CONTEXT_FOR_AGENTS.md` | Denne filen — full kontekst for agenter |
| `docs/ARCHITECTURE.md` | Arkitektur, dataflyt, mappestruktur |
| `docs/DOMAIN_SPEC_NEW.md` | Domene, forretningsregler, brukertyper |
| `docs/DESIGN_SYSTEM.md` | Design, farger, typografi, komponenter |
| `docs/DEVELOPMENT_RULES_NEW.md` | Sikkerhet, feilhåndtering, DB, API, §11 Dokumentasjon |
| `docs/DOCUSAURUS_STRATEGY.md` | Strategi for kunde- vs internt-dokumentasjon |
| `docs/DATABASE.md` | Schema, tabeller, RLS |
| `docs/API.md` | API-referanse |
| `docs/SERVICES.md` | Tjenester, miljøvariabler |
| `docs/MATCHING_ENGINE.md` | Smart Match |
| `docs/AI_SYSTEM.md` | AI-chatbot |
| `docs/AGENT_SYSTEM.md` | Revizo Agent (worker) |
| `docs/NOTIFICATIONS.md` | Varsler |
| `docs/EXPORT_SYSTEM.md` | Eksport |
| `docs/IMPORT_SYSTEM.md` | Import |
| `docs/SETUP.md` / `docs/VERCEL_SETUP.md` | Oppsett, deploy |
| `docs/integrations/README.md` | Oversikt integrasjoner |
| `docs/integrations/*.md` | Per integrasjon (clerk, supabase, …) |
| `docs-site/README.md` | Docusaurus: build:public vs build |
| `.cursor/rules/design.mdc` | Design — alwaysApply |
| `.cursor/rules/documentation.mdc` | Dokumentasjon parallelt — alwaysApply |

---

*Sist oppdatert: i tråd med nåværende repo. Ved store endringer (nytt system, ny integrasjon, endret mappestruktur), oppdater denne filen slik at andre agenter og utviklere fortsatt har korrekt kontekst.*
