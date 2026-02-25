# Tjenester og konfigurasjon

## Oversikt over eksterne tjenester

| Tjeneste | Formål | Dashboard-URL |
|----------|--------|---------------|
| **Supabase** | PostgreSQL + Storage | https://supabase.com/dashboard |
| **Clerk** | Autentisering og organisasjoner | https://dashboard.clerk.com |
| **Vercel** | Hosting (Next.js web) | https://vercel.com/dashboard |
| **Railway** | Hosting (Worker bakgrunnsjobber) | https://railway.app/dashboard |
| **Resend** | Transaksjonelle e-poster | https://resend.com |
| **Anthropic** | AI-chatbot (Claude Sonnet 4) | https://console.anthropic.com |
| **OpenAI** | Embeddings for kunnskapssøk | https://platform.openai.com |
| **Sentry** | Feilsporing og observability | https://sentry.io |

---

## Supabase

### Hva vi bruker

1. **PostgreSQL-database** — all applikasjonsdata (selskaper, klienter, transaksjoner, matcher)
2. **Supabase Storage** — lagring av importerte filer (Excel, CSV, XML)
3. **Row Level Security (RLS)** — aktivert på alle public-tabeller

### Tilkobling

Vi bruker **ikke** Supabase sin JavaScript-klient for database-spørringer. Istedet bruker vi **Drizzle ORM** med en direkte PostgreSQL-tilkobling via `postgres`-driveren.

```
Applikasjonen → postgres (npm) → Supabase Session Pooler → PostgreSQL
```

Supabase JS-klienten brukes **kun** for Storage (filopplasting):

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const UPLOAD_BUCKET = "imports";
```

### Storage-struktur

Filer lagres i bucket `imports` med bane:
```
{orgId}/{clientId}/{setNumber}/{timestamp}-{filename}
```

### Row Level Security

RLS er aktivert på alle tabeller i `public`-skjemaet. Server-side kode (Drizzle) bruker `service_role`-nøkkelen som omgår RLS. PostgREST (Supabase REST API) er sikret av RLS-policyer.

### Miljøvariabler for Supabase

```env
DATABASE_URL=postgresql://postgres.xxx:password@host:port/postgres
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

- `DATABASE_URL`: Direkte PostgreSQL-tilkobling (Session pooler, port 5432)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase-prosjektets URL (brukes for Storage)
- `SUPABASE_SERVICE_ROLE_KEY`: Service-role nøkkel (full tilgang, kun server-side)

---

## Clerk (Autentisering)

### Hva vi bruker

1. **Brukerregistrering og innlogging** — e-post, OAuth, SSO
2. **Organisasjoner** — multi-tenancy (regnskapsbyråer)
3. **Middleware** — beskytter alle ruter unntatt sign-in/sign-up

### Konfigurasjon

Middleware definert i `src/middleware.ts`:
```typescript
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js|...)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Bruk i kode

- **Server (API-ruter)**: `const { userId, orgId } = await auth();`
- **Klient (komponenter)**: `useUser()`, `useOrganization()`, `<UserButton />`, `<OrganizationSwitcher />`
- **Layout**: `<ClerkProvider>` i `src/app/layout.tsx`

### Tenancy-mapping

`orgId` fra Clerk = `tenant_id` i databasen. Alle dataspørringer filtrerer på dette.

### Miljøvariabler for Clerk

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

## Drizzle ORM

### Hva vi bruker

- **Schema-definisjon** i TypeScript (`src/lib/db/schema.ts`)
- **Type-safe queries** med full autocompletion
- **Migrasjoner** via `drizzle-kit`

### Konfigurasjon

```typescript
// drizzle.config.ts
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
};
```

### Kommandoer

```bash
# Generer migrasjoner fra schema-endringer
npx drizzle-kit generate

# Kjør migrasjoner mot databasen
npx drizzle-kit migrate

# Åpne Drizzle Studio (DB-browser)
npx drizzle-kit studio
```

### Database-tilkobling

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
export const db = drizzle(client, { schema: { ...tables } });
```

`max: 1` fordi Supabase Session pooler håndterer connection pooling.

---

## Alle miljøvariabler

| Variabel | Type | Beskrivelse |
|----------|------|-------------|
| `DATABASE_URL` | Server | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase prosjekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Supabase service role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Clerk publishable key |
| `CLERK_SECRET_KEY` | Server | Clerk secret key |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Public | Innloggingsside-URL |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Public | Registreringsside-URL |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Public | Redirect etter innlogging |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Public | Redirect etter registrering |
| `SEED_TENANT_ID` | Server | Clerk org-ID for seed-script (valgfri) |
| `RESEND_API_KEY` | Server | Resend API-nøkkel for e-post |
| `RESEND_FROM_ADDRESS` | Server | Avsenderadresse for e-post |
| `NEXT_PUBLIC_APP_URL` | Public | Base-URL for appen (lenker i e-post) |
| `ANTHROPIC_API_KEY` | Server | Anthropic API-nøkkel (Claude) |
| `OPENAI_API_KEY` | Server | OpenAI API-nøkkel (embeddings) |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Sentry DSN for klient-side feilsporing |
| `SENTRY_DSN` | Server | Sentry DSN for server-side feilsporing |
| `SENTRY_ORG` | Server | Sentry organisasjon (for source maps) |
| `SENTRY_PROJECT` | Server | Sentry prosjektnavn |
| `SENTRY_AUTH_TOKEN` | Server | Sentry auth token (for source map upload) |
| `WORKER_CONCURRENCY` | Server | Maks samtidige worker-jobber (default 3) |
| `WORKER_POLL_INTERVAL_MS` | Server | Worker poll-intervall i ms (default 30000) |

**Server**-variabler er kun tilgjengelige på server-side. **Public**-variabler (`NEXT_PUBLIC_`) er tilgjengelige i klienten.

---

## Resend (E-post)

### Hva vi bruker

1. **Transaksjonelle e-poster** — varsler ved notat-mention, Smart Match, import
2. **Agent-rapporter** — automatisk genererte PDF-rapporter med nøkkeltall
3. **HTML-maler** — egenbyggede responsive e-postmaler med design tokens

### Konfigurasjon

```env
RESEND_API_KEY=re_...
RESEND_FROM_ADDRESS=Revizo <noreply@revizo.no>
```

### Bruk i kode

E-postfunksjoner i `src/lib/resend.ts`:
- `sendNoteMentionEmail()` — notat med @-mention
- `sendSmartMatchEmail()` — Smart Match fullført
- `sendImportCompletedEmail()` — import fullført
- `sendAgentReportEmail()` — automatisk rapport med PDF-vedlegg

Se [NOTIFICATIONS.md](NOTIFICATIONS.md) for detaljer.

---

## Anthropic (AI)

### Hva vi bruker

1. **Claude Sonnet 4** (`claude-sonnet-4-20250514`) — AI-chatbot for produktstøtte
2. **Tool calling** — Claude kan hente live-data via definerte verktøy

### Konfigurasjon

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Bruk i kode

- `src/app/api/ai/chat/route.ts` — API-endepunkt som kaller Anthropic
- `src/lib/ai/actions.ts` — Tool-definisjoner (get_client_status, get_upcoming_deadlines, etc.)
- Maks 1024 tokens per respons, maks 5 tool-runder

Se [AI_SYSTEM.md](AI_SYSTEM.md) for detaljer.

---

## OpenAI (Embeddings)

### Hva vi bruker

1. **text-embedding-3-small** — genererer embeddings for semantisk søk i kunnskapsbasen

### Konfigurasjon

```env
OPENAI_API_KEY=sk-...
```

### Bruk i kode

- `src/lib/ai/embeddings.ts` — `generateEmbedding()`, `generateEmbeddings()`
- Brukes som fallback i kunnskapssøk når FTS ikke gir nok resultater
- Input trunkeres til 8000 tegn

---

## Railway (Worker)

### Hva vi bruker

1. **Persistent Node.js-prosess** — kjører bakgrunnsjobber (Smart Match, PDF-rapporter, e-post)
2. **Automatisk deploy** — fra GitHub, separat service fra web-appen

### Oppsett

Railway bruker to services fra samme repo:
- **Web**: `npm start` (Next.js)
- **Worker**: `npm run worker` (Node.js)

### Miljøvariabler

Worker trenger samme variabler som web-appen, pluss:

```env
WORKER_CONCURRENCY=3
WORKER_POLL_INTERVAL_MS=30000
```

### Lokal utvikling

```bash
npm run worker:dev    # Kjører worker med hot-reload
```

Se [AGENT_SYSTEM.md](AGENT_SYSTEM.md) for detaljer om worker-arkitekturen.

---

## Sentry (Feilsporing)

### Hva vi bruker

1. **Klient-side feilsporing** — fanger JavaScript-feil i nettleseren
2. **Server-side feilsporing** — fanger API-feil og server-feil
3. **Edge-feilsporing** — fanger feil i edge runtime
4. **Session Replay** — opptak av brukerøkter ved feil (kun ved feil)

### Konfigurasjon

- `sentry.client.config.ts` — klient-side Sentry init
- `sentry.server.config.ts` — server-side Sentry init
- `sentry.edge.config.ts` — edge runtime Sentry init
- `src/instrumentation.ts` — Next.js instrumentation hook
- `src/app/global-error.tsx` — global error boundary med Sentry capture
- `next.config.ts` — `withSentryConfig` wrapper

### Sikkerhet

- `beforeSend` filtrerer bort `request.data` for å unngå logging av finansdata
- Traces sample rate er 10% for å holde kostnader nede
- Session replay kun ved feil (0% normal sampling)
