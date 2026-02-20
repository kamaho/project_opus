# Development Rules — Compliance Check

Sist sjekket mot `DEVELOPMENT_RULES.md` i prosjektrot. Dette er status og anbefalte tiltak.

---

## 1. Security — Non-Negotiable

| Regel | Status | Merknad |
|-------|--------|---------|
| Auth på alle API-ruter | OK | Alle ruter bruker `auth()` og returnerer 401 ved manglende orgId/userId. |
| Tenant-scoping på alle DB-spørringer | OK | API-ruter verifiserer at klient/selskap tilhører orgId. Sider bruker orgId fra auth før data hentes. |
| Validering med Zod på API-grenser | OK | Import bruker bodySchema; clients/companies bruker query/param. |
| Ingen brukerinput i rå SQL | OK | Kun Drizzle/parameterized. |
| RLS på alle tabeller | Sjekk DB | Reglene forutsetter RLS. Migrasjon-snapshot viser `isRLSEnabled: false` — verifiser at RLS og policies er satt i databasen. |

**Anbefaling:** Bekreft at RLS er aktivert og at policies bruker tenant (Clerk org) i Supabase/Postgres.

---

## 2. Error Handling

| Regel | Status | Merknad |
|-------|--------|---------|
| Try/catch rundt async i API | Delvis | Import har try/catch rundt DB-delen; ikke rundt hele handler (f.eks. file.text()). |
| Meningsfulle feilkoder (400/401/403/404/500) | OK | Brukes konsekvent. |
| Eksponerer ikke interne detaljer | Retting | Import returnerer i catch `details: message` (err.message) til klient — bør logge og returnere generisk melding. |

**Retting utført:** Import route catch returnerer nå generisk melding til klient og logger feilen (se under).

---

## 3. TypeScript

| Regel | Status | Merknad |
|-------|--------|---------|
| Ingen `any` | OK | Ingen treff i src. |
| Zod for validering + type inference | OK | Brukes i import. |

---

## 4. Database & Drizzle

| Regel | Status | Merknad |
|-------|--------|---------|
| Alle spørringer via `src/lib/db/` | Ikke fulgt | Spørringer ligger i API-ruter og i dashboard-sider (db.select/insert direkte). Reglene anbefaler dedikerte query-funksjoner i f.eks. `src/lib/db/queries/`. |
| Tenant_id i WHERE | OK | API-ruter sjekker company/client mot orgId. Sider henter kun data for innlogget org. |

**Anbefaling:** Gradvis flytte lesing/skriving til f.eks. `src/lib/db/queries/clients.ts`, `transactions.ts`, osv., og la API/sider kalle disse. Gjerne start med les (GET/clients, matching page).

---

## 5. Project Structure & Code Organization

| Regel | Status | Merknad |
|-------|--------|---------|
| Filnavn kebab-case | OK | Komponenter og filer følger. |
| Server components som standard | OK | Sider er server components; client kun der det trengs. |

---

## 6. API Design

| Regel | Status | Merknad |
|-------|--------|---------|
| Konsistent JSON-form | Delvis | Suksess: noen returnerer `{ data }`, andre `{ importId, recordCount }` eller array direkte. Reglene anbefaler `{ data: T }` for suksess. |
| GET for les, POST/DELETE for endring | OK | Brukes riktig. |

**Anbefaling:** Ved ny arbeid standardisere suksess-svar til `{ data: T }` der det passer.

---

## 7. UI & UX Standards

| Regel | Status | Merknad |
|-------|--------|---------|
| Norsk UI-tekst | OK | Brukt i appen. |
| Loading states på async | OK | Import-knapp, eject, osv. har loading/disabled. |
| Tastaturnavigasjon | OK | shadcn/ui-komponenter støtter det. |

---

## 8. Performance

| Regel | Status | Merknad |
|-------|--------|---------|
| Paginering av store datasett | Ikke fulgt | Matching-siden henter alle transaksjoner for en klient uten grense. Reglene: «Default page size: 50». |
| Supabase Storage for filer | OK | Import bruker Storage. |

**Anbefaling:** Innfør paginering (eller minst `LIMIT`) på transaksjonslisten for matching (f.eks. 50–100 per mengde).

---

## 9. Git & Code Quality

| Regel | Status | Merknad |
|-------|--------|---------|
| Ingen console.log i prod | OK | Ingen treff. |
| Unused imports fjernet | OK | — |

---

## 10. Testing Mindset

| Regel | Status | Merknad |
|-------|--------|---------|
| Ren logikk i parsere | OK | CSV/CAMT-parsere er pure. |

---

## Oppsummering

- **Styrker:** Auth og tenant-scoping, Zod-validering, Drizzle (ingen rå SQL), norsk UI, loading states, ingen `any`, bruk av Storage for filer.
- **Retting utført:** Import route eksponerer ikke lenger feildetaljer ved 500 (generisk melding + logging).
- **Anbefalte neste skritt:**
  1. Verifiser/få på plass RLS og policies i databasen.
  2. Flytt DB-spørringer til `src/lib/db/queries/` og kall derfra.
  3. Paginer transaksjoner på matching-siden (f.eks. 50 per side).
  4. (Valgfritt) Standardiser API suksess-svar til `{ data: T }`.
