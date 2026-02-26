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

Under **Vercel → revizo → Settings → Environment Variables** legger du inn variablene under. Velg **Production** (og gjerne Preview).  
**Viktig:** For produksjon (revizo.ai) bruker du **Revizo Prod**-Supabase. Ikke project opus (den er for lokal `.env.local`).

### Hvor skal hva stå?

| I Vercel (Key) | Verdi / hvor du henter det |
|----------------|----------------------------|
| **Supabase (Revizo Prod)** | |
| `DATABASE_URL` | **Revizo Prod** → Settings → **Database** → Connection string → **Session pooler** (port 5432). Erstatt `[YOUR-PASSWORD]` med DB-passord. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Revizo Prod** → Settings → **API** → **Project URL**. Eksempel: `https://pejkokemdzsekboaebmy.supabase.co`. Dette er «project URL» fra Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Revizo Prod** → Settings → **API** → **Project API keys** → **service_role** (hemmelig nøkkel, ikke anon). |
| **Clerk (Revizo.ai production)** | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → **Revizo.ai**-appen → Production → API Keys → `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk → **Revizo.ai** → Production → API Keys → `sk_live_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` |
| **App** | |
| `NEXT_PUBLIC_APP_URL` | `https://revizo.ai` (produksjons-URL). |
| **Resend** | |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_ADDRESS` | `Revizo <noreply@revizo.ai>` (etter at revizo.ai er verifisert i Resend) |
| **Sentry, Anthropic, Worker** | Som du allerede har; endres ikke ved Supabase-bytte. |

**Kort svar:** Supabase **Project URL** fra Revizo Prod → Settings → API settes som **`NEXT_PUBLIC_SUPABASE_URL`** i Vercel (f.eks. `https://pejkokemdzsekboaebmy.supabase.co`).

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
