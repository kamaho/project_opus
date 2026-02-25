# Vercel-oppsett for Revizo

## 1. Importer prosjektet

1. Gå til [vercel.com/new](https://vercel.com/new).
2. Klikk **«Continue with GitHub»** under «Import Git Repository».
3. Godkjenn tilgang til GitHub hvis du blir bedt om det.
4. Finn **project_opus** (eller `kamaho/project_opus`) og klikk **Import**.

## 2. Konfigurer prosjektet

- **Framework Preset:** Next.js (oppdages automatisk).
- **Root Directory:** La stå tom (prosjektet er i roten).
- **Build Command:** `next build` (standard).
- **Output Directory:** La stå som standard.

Klikk **Deploy** ikke ennå – legg inn miljøvariabler først.

## 3. Miljøvariabler

Under **Environment Variables** i Vercel legger du inn disse. Kopier verdiene fra `.env.local` (ikke lim inn hemmelige verdier her i docs). Merk alle som **Production** (og gjerne **Preview**).

| Variabel | Hva du legger inn |
|----------|-------------------|
| **Clerk** | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Samme som lokalt (pk_test_... eller pk_live_...) |
| `CLERK_SECRET_KEY` | Samme som lokalt (sk_test_... eller sk_live_...) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |
| **Supabase** | |
| `DATABASE_URL` | **Connection Pooler**-URL fra Supabase (Session mode, port 5432) – ikke direkte Postgres-URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key fra Supabase Dashboard |
| **App-URL** | |
| `NEXT_PUBLIC_APP_URL` | Vercel-URL etter første deploy, f.eks. `https://project-opus-xxxx.vercel.app` (kan settes til placeholder først, oppdater og redeploy etterpå) |
| **Resend (e-post)** | |
| `RESEND_API_KEY` | API-nøkkel fra Resend |
| `RESEND_FROM_ADDRESS` | F.eks. `Revizo <noreply@accountcontrol.no>` |
| **Sentry** | |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN fra Sentry-prosjektet |
| `SENTRY_DSN` | Samme DSN |
| `SENTRY_ORG` | Org-slug i Sentry |
| `SENTRY_PROJECT` | Prosjektnavn, f.eks. `account-control` |
| `SENTRY_AUTH_TOKEN` | Auth token (for source maps ved build) |
| **AI (Revizo-assistent)** | |
| `ANTHROPIC_API_KEY` | API-nøkkel fra Anthropic |
| `OPENAI_API_KEY` | API-nøkkel fra OpenAI |
| **Worker (valgfritt på Vercel)** | |
| `WORKER_CONCURRENCY` | F.eks. `3` |
| `WORKER_POLL_INTERVAL_MS` | F.eks. `30000` |

**Viktig:**  
- `NEXT_PUBLIC_APP_URL` må peke på din faktiske Vercel-URL (oppdater etter første deploy og redeploy).  
- Bruk **Connection Pooler** for `DATABASE_URL` (Supabase → Project Settings → Database → Connection string → «Connection pooling»).

## 4. Første deploy

Klikk **Deploy**. Vent til build er ferdig. Noter deg URL-en (f.eks. `https://project-opus-xxxx.vercel.app`).

## 5. Etter deploy

1. **Clerk**  
   Gå til [Clerk Dashboard](https://dashboard.clerk.com) → din app → **Domains**.  
   Legg til Vercel-domene (f.eks. `project-opus-xxxx.vercel.app` og eventuelt eget domene).  
   Sørg for at **NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL** er satt til `/onboarding` i Vercel, slik at nye brukere sendes til onboarding i stedet for rett til dashboard.

2. **NEXT_PUBLIC_APP_URL**  
   I Vercel → Project → **Settings** → **Environment Variables**: oppdater `NEXT_PUBLIC_APP_URL` til den faktiske Vercel-URL-en, redeploy.

3. **Supabase**  
   Hvis du bruker Supabase: i Dashboard → **Settings** → **API** bruk **Connection pooling** (Transaction eller Session) for `DATABASE_URL` i Vercel, ikke direkte Postgres-URL uten pooling.

4. **Eget domene (valgfritt)**  
   Vercel → Project → **Settings** → **Domains**: legg til domene og følg DNS-instruksjonene.

## 6. Ny deploy ved push

Når repo er koblet til Vercel, deployes vanligvis automatisk ved push til `main` (production) og ved push til andre brancher (preview-URL-er). Du kan endre dette under **Settings** → **Git**.
