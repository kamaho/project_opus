# 2026-03-04 — Systematisk kodegjennomgang

**Type:** Sikkerhet, kodekvalitet, ytelse, DX
**Utført av:** Claude (AI-agent) + kmh0751
**Metode:** Parallelle subagenter analyserte kodebasen innenfor 5 prioriterte områder
**Status:** Fullført — alle 10 tiltak implementert og verifisert

---

## Sammendrag

En systematisk gjennomgang av hele kodebasen avdekket 10 konkrete funn fordelt på:

| Alvorlighet | Antall | Beskrivelse |
|-------------|--------|-------------|
| **Kritisk** | 5 | Tverr-tenant cache-lekkasje, tenant-eskalering, uautentisert checkout-data, migrasjonsjournal ute av sync, manglende input-validering |
| **Viktig** | 5 | Sekvensielle DB-queries, manglende indeks, test-infrastruktur, error-swallowing, tutorials tenant-filter |

I tillegg ble 15 pre-eksisterende TypeScript-feil fikset som bonus.

**Verifisering:** `tsc --noEmit` passerer uten feil. 107/107 unit-tester består.

---

## Kritiske fikser

### C4: Tverr-tenant cache-lekkasje i DashboardDataProvider

| | |
|---|---|
| **Fil** | `src/components/dashboard/dashboard-data-provider.tsx` |
| **Problem** | Modul-nivå cache brukte kun `companyId` som nøkkel — ikke `tenantId`. Hvis to tenants hadde samme `companyId`, ville tenant B se tenant A sine dashboarddata. |
| **Fiks** | Lagt til `tenantId` som required prop og i cache-nøkkel. Oppdatert `overview-layout.tsx` til å sende `tenantId` videre. |

```typescript
// FØR — kun companyId i cache-sjekk:
const hasFresh = cache && cache.companyId === companyId && ...

// ETTER — tenantId + companyId:
const hasFresh = cache && cache.tenantId === tenantId && cache.companyId === companyId && ...
```

### C1+I1: Visma authorize tenant-eskalering

| | |
|---|---|
| **Filer** | `src/app/api/auth/visma-nxt/authorize/route.ts`, `src/app/api/integrations/visma-nxt/status/route.ts`, `src/app/api/integrations/visma-nxt/disconnect/route.ts`, `src/app/api/calendar/ics/route.ts` |
| **Problem** | Visma authorize-ruten tok `tenantId` fra query-param, noe som lot en bruker overstyre sin egen `orgId`. Alle 4 ruter brukte `auth()` direkte i stedet for `withTenant`. |
| **Fiks** | Fjernet query-param-override. Migrert alle 4 ruter til `withTenant`-wrapperen som henter `tenantId` fra Clerk-sesjonen. |

### C2+C3: Checkout/session datalekkasje + onboarding subscription-verifisering

| | |
|---|---|
| **Filer** | `src/app/api/checkout/session/route.ts`, `src/app/api/onboarding/complete/route.ts`, `src/app/(marketing)/checkout/success/page.tsx` |
| **Problem (C2)** | `GET /api/checkout/session` returnerte `stripeCustomerId` og `stripeSubscriptionId` uten autentisering. Enhver med en session-ID kunne hente sensitive Stripe-IDer. |
| **Problem (C3)** | `POST /api/onboarding/complete` tok `stripeSubscriptionId` og `stripeCustomerId` direkte fra request body uten verifisering. En tenant kunne knytte seg til en annens abonnement. |
| **Fiks** | Checkout/session returnerer nå kun visuell info (plan, pris). Onboarding/complete henter subscription-data direkte fra Stripe via `sessionId` og verifiserer at `customer_details.email` matcher Clerk-brukerens e-post. |

### A1: Migrasjonsjournal ute av sync

| | |
|---|---|
| **Filer** | `src/lib/db/migrations/meta/_journal.json`, 22 SQL-filer |
| **Problem** | Journalen hadde 15 entries, men 38 SQL-filer fantes i mappen. 22 orphan-migrasjoner og 1 manglende entry (0021). Ved `drizzle-kit migrate` i prod kunne orphans bli forsøkt re-applisert. |
| **Fiks** | Lagt til 0021 i journalen (nå 16 entries). Arkivert 22 orphan-filer til `_archived/`-mappe med README. 16 aktive SQL-filer matcher 16 journal-entries. |

### C5: Manglende Zod-validering på API-ruter

| | |
|---|---|
| **Filer** | `api/companies`, `api/client-groups`, `api/client-groups/[groupId]`, `api/tutorials`, `api/tutorials/[tutorialId]`, `api/webhooks/subscriptions`, `api/deadlines/[id]` |
| **Problem** | 7 muterende API-ruter aksepterte brukerinput via `as`-casts uten typevalidering. Ingen lengdebegrensning, ingen UUID-validering, ingen enum-sjekk. |
| **Fiks** | Zod-skjemaer opprettet og brukt med `.safeParse()` for alle ruter. Feilmeldinger returneres til klient med 400-status. |

---

## Viktige fikser

### I0: Tutorials tenant-filter

| | |
|---|---|
| **Fil** | `src/app/api/tutorials/[tutorialId]/route.ts` |
| **Problem** | GET/PATCH/DELETE brukte kun `tutorialId` uten tenant-filter. |
| **Beslutning** | Tutorials-tabellen har ingen `tenantId`-kolonne — de er globale og opprettes kun av system-admins. Tilgangskontroll skjer via `isSystemAdmin()`-sjekk for PATCH/DELETE. Lav praktisk risiko. Zod-validering lagt til. |

### P1+P2: Sekvensielle DB-queries

| | |
|---|---|
| **Filer** | `src/lib/tripletex/sync.ts`, `src/app/api/dashboard/agency/stats/route.ts` |
| **Problem (P1)** | `sync.ts` hadde en `for`-løkke med N sekvensielle `db.update()`-kall for å oppdatere `accountSyncSettings` — én query per konto. |
| **Problem (P2)** | `stats/route.ts` kjørte to DB-queries sekvensielt (`clientCount` → `stats`). |
| **Fiks** | P1: Erstattet løkken med én enkelt `inArray()`-bulk-update. P2: Parallellisert med `Promise.all()`. |

### P3: Manglende indeks på `parser_configs.tenant_id`

| | |
|---|---|
| **Fil** | `src/lib/db/migrations/0026_add_parser_configs_tenant_index.sql` |
| **Problem** | `parser_configs`-tabellen manglet indeks på `tenant_id`, som brukes i alle tenant-filtrerte queries. |
| **Fiks** | Ny migrasjon: `CREATE INDEX IF NOT EXISTS idx_parser_configs_tenant ON parser_configs (tenant_id);`. Lagt til i journal som entry 16. |

### D1+D2+D3: Test-infrastruktur og DX

| | |
|---|---|
| **Fil** | `package.json`, `.github/workflows/ci.yml` |
| **Endringer** | |

- `"test": "vitest run"` og `"test:watch": "vitest"` lagt til i scripts
- `"typecheck": "tsc --noEmit"` lagt til
- `"lint": "eslint"` → `"lint": "eslint ."` (ESLint 9 flat config trenger eksplisitt path)
- `pg` fjernet fra dependencies (ubrukt — kun `postgres` brukes)
- `@types/pdfmake` flyttet fra dependencies til devDependencies
- CI oppdatert med `npm test`-steg

### I4: Error-swallowing (`.catch(() => {})`)

| | |
|---|---|
| **Filer** | 5 komponenter |
| **Problem** | 7 steder i kodebasen svelget feil stille med `.catch(() => {})`. Nettverksfeil, auth-feil og server-feil ble aldri logget. |
| **Fiks** | Erstattet med `console.error("[kontekst] melding:", err)` i `tripletex-tab`, `tripletex-config-dialog`, `deadline-detail-client`, `contact-picker-dialog`, og `app-breadcrumb`. |

---

## Bonus: TypeScript-feil fikset

15 pre-eksisterende TypeScript-feil ble fikset som del av arbeidet:

| Fil | Problem |
|-----|---------|
| `src/lib/ai/actions.ts` | Brukte gamle kolonnenavn fra `regulatoryDeadlines` (`title`, `frequency`, `legalReference`, `legalUrl`, `deadlineRule`, `validTo`) |
| `src/lib/db/index.ts` | `statement_timeout: "30000"` (string) — skal være `number` |
| `src/lib/deadlines/queries.ts` | 3 interfaces manglet `[key: string]: unknown` index-signatur for `db.execute<T>()` |
| `src/lib/tripletex/sync.ts` | `balanceMap.get(acct.tripletexAccountId)` fikk `null`-verdi — la til null-sjekk |
| `src/lib/visma-nxt/__tests__/mappers.test.ts` | Test brukte `organizationNo`/`isActive` som ikke finnes i `VnxtCompany` |
| `src/app/dashboard/kalender/page.tsx` | Brukte gamle kolonnenavn (`title`, `obligation`, `frequency`, `deadlineRule`, `periodStartMonth`, `periodEndMonth`) |
| `src/app/dashboard/kalender/calendar-client.tsx` | `Deadline`-interface hadde `periodStartMonth`/`periodEndMonth` som required |
| `scripts/seed-knowledge.ts` | Kategori `"annual_accounts"` finnes ikke i schema — endret til `"reporting"` |
| `src/components/dashboard/dashboard-data-provider.tsx` | `safeFetch` returnerte `unknown` — fikset med generisk `<T>` |

---

## Ekstra audit: Webhooks og CSRF

Etter brukerforespørsel ble to tilleggstemaer undersøkt:

**Webhook signaturverifisering:** Alle tre webhook-ruter (`/api/webhooks/stripe`, `/api/webhooks/tripletex`, `/api/webhooks/visma-nxt`) implementerer robust signaturverifisering. Stripe bruker `stripe.webhooks.constructEvent()`, Tripletex bruker HMAC-SHA256, Visma NXT bruker sin egen signatur-sjekk. Alle bevarer raw body korrekt. Ingen funn.

**CSRF-beskyttelse på Server Actions:** Kodebasen bruker ingen Server Actions — alle mutasjoner går via standard Next.js API Routes med `fetch()`. CSRF-beskyttelse ivaretas av Clerks `SameSite`-session-cookies og `form-action 'self'` i Content Security Policy.

---

## Filer endret/opprettet

| Fil | Operasjon | Beskrivelse |
|-----|-----------|-------------|
| `src/components/dashboard/dashboard-data-provider.tsx` | Endret | tenantId i cache-nøkkel |
| `src/components/dashboard/layouts/overview-layout.tsx` | Endret | Sender tenantId til provider |
| `src/app/api/auth/visma-nxt/authorize/route.ts` | Endret | Migrert til withTenant |
| `src/app/api/integrations/visma-nxt/status/route.ts` | Endret | Migrert til withTenant |
| `src/app/api/integrations/visma-nxt/disconnect/route.ts` | Endret | Migrert til withTenant |
| `src/app/api/calendar/ics/route.ts` | Endret | Migrert til withTenant |
| `src/app/api/checkout/session/route.ts` | Endret | Fjernet sensitive IDs fra respons |
| `src/app/api/onboarding/complete/route.ts` | Endret | Server-side Stripe-verifisering |
| `src/app/(marketing)/checkout/success/page.tsx` | Endret | Fjernet sensitive IDs fra localStorage |
| `src/lib/db/migrations/meta/_journal.json` | Endret | Lagt til 0021 + 0026, reindeksert |
| `src/lib/db/migrations/_archived/` | Ny | 22 orphan-migrasjoner + README |
| `src/app/api/companies/route.ts` | Endret | Zod-validering |
| `src/app/api/client-groups/route.ts` | Endret | Zod-validering |
| `src/app/api/client-groups/[groupId]/route.ts` | Endret | Zod-validering |
| `src/app/api/tutorials/route.ts` | Endret | Zod-validering |
| `src/app/api/tutorials/[tutorialId]/route.ts` | Endret | Zod-validering |
| `src/app/api/webhooks/subscriptions/route.ts` | Endret | Zod-validering |
| `src/app/api/deadlines/[id]/route.ts` | Endret | Zod-validering + status-enum |
| `src/lib/tripletex/sync.ts` | Endret | Bulk-update med inArray() |
| `src/app/api/dashboard/agency/stats/route.ts` | Endret | Promise.all() parallellisering |
| `src/lib/db/migrations/0026_add_parser_configs_tenant_index.sql` | Ny | Tenant-indeks på parser_configs |
| `package.json` | Endret | test/typecheck scripts, fjernet pg |
| `.github/workflows/ci.yml` | Endret | Unit test-steg lagt til |
| `src/components/settings/tripletex-tab.tsx` | Endret | Error-logging |
| `src/components/settings/tripletex-config-dialog.tsx` | Endret | Error-logging |
| `src/app/dashboard/frister/[id]/deadline-detail-client.tsx` | Endret | Error-logging |
| `src/components/reports/contact-picker-dialog.tsx` | Endret | Error-logging |
| `src/components/layout/app-breadcrumb.tsx` | Endret | Error-logging |
| `src/lib/ai/actions.ts` | Endret | TS-fiks: nye kolonnenavn |
| `src/lib/db/index.ts` | Endret | TS-fiks: statement_timeout type |
| `src/lib/deadlines/queries.ts` | Endret | TS-fiks: index-signaturer |
| `src/lib/visma-nxt/__tests__/mappers.test.ts` | Endret | TS-fiks: VnxtCompany-type |
| `src/app/dashboard/kalender/page.tsx` | Endret | TS-fiks: nye kolonnenavn |
| `src/app/dashboard/kalender/calendar-client.tsx` | Endret | TS-fiks: optional fields |
| `scripts/seed-knowledge.ts` | Endret | TS-fiks: ugyldig kategori |

---

## Gjenstående fra sikkerhetsauditen

Følgende funn fra `docs/SECURITY_AUDIT.md` er **ikke** adressert i denne gjennomgangen (ligger i andre faser):

- Tripletex-tokens i klartekst (§1.2) — krever KMS-integrasjon
- RBAC-håndhevelse (§2.1) — krever policy-definisjon
- Sikkerhetsheadere (§2.2) — CSP, HSTS, X-Frame-Options
- Rate limiting (§2.5) — krever Upstash eller tilsvarende
- Filopplasting-validering (§2.3, §2.6) — størrelsesbegrensning, MIME-sjekk
- Alle GDPR-tiltak (§5) — personvernerklæring, rett til sletting, DPA-er
