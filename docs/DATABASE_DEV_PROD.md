# Database: lokal (dev) vs produksjon

**Situasjon:** «project opus» i Supabase brukes i dag og inneholder demo-data. Den skal være **lokal/dev-databasen**. Produksjon (revizo.ai) skal bruke en **ny, tom** Supabase-instans.

---

## Oversikt

| Database        | Bruk           | Hvor konfigureres                          |
|-----------------|----------------|--------------------------------------------|
| **project opus**| Lokal utvikling| `.env.local` (DATABASE_URL, Supabase-keys) |
| **Ny prod-DB**  | Produksjon     | Vercel → Environment Variables (Production)|

---

## Steg 1: Behold «project opus» som lokal database

- **project opus** forblir som den er. Den brukes kun lokalt.
- I **`.env.local`** skal du ha:
  - `DATABASE_URL` = Connection string fra **project opus** (Supabase → project opus → Settings → Database → Connection string, **Session pooler**).
  - `NEXT_PUBLIC_SUPABASE_URL` = Project URL fra **project opus** (Settings → API).
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key fra **project opus** (Settings → API).
- Du kjører migrasjoner og seed lokalt mot denne: `npx drizzle-kit migrate`, `npx tsx scripts/seed.ts`.

---

## Steg 2: Opprett ny Supabase-prosjekt for produksjon

1. Gå til [Supabase Dashboard](https://supabase.com/dashboard) → **Projects**.
2. Klikk **«+ New project»**.
3. Fyll inn:
   - **Name:** f.eks. `Revizo prod` eller `project opus prod`.
   - **Database Password:** Lag og lagre et sikkert passord (brukes i connection string).
   - **Region:** Samme som «project opus» (f.eks. `eu-west-1`) er lurt for konsistens.
4. Klikk **Create new project** og vent til prosjektet er klart (noen minutter).

---

## Steg 3: Hent ut credentials fra det nye prod-prosjektet

I det **nye** prosjektet (Revizo prod):

1. **Settings** → **Database**
   - Under **Connection string** velg **URI**.
   - Velg **Session pooler** (port 5432), ikke Direct connection.
   - Kopier connection string og erstatt `[YOUR-PASSWORD]` med database-passordet du satte i steg 2.
   - Dette er **DATABASE_URL** for prod.

2. **Settings** → **API**
   - **Project URL** → dette er **NEXT_PUBLIC_SUPABASE_URL** for prod.
   - **Project API keys** → **service_role** (secret) → dette er **SUPABASE_SERVICE_ROLE_KEY** for prod.

---

## Steg 4: Kjør migrasjoner mot prod-databasen (én gang)

Du skal kjøre migrasjonene én gang mot den **nye** databasen, uten å putte prod-URL i `.env.local`.

**Alternativ A – bruk skriptet (anbefalt)**

1. Opprett fil **`.env.prod.migrate`** i prosjektroten (filen er gitignored) med én linje:
   ```
   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@...pooler.supabase.com:5432/postgres
   ```
   Kopier connection string fra **Revizo Prod** → Settings → Database → **Session pooler** (port 5432), og erstatt `[YOUR-PASSWORD]` med database-passordet.

2. Kjør:
   ```bash
   npm run db:migrate:prod
   ```
   (eller `npx tsx scripts/migrate-prod.ts`)

3. Slett `.env.prod.migrate` etterpå. Aldri committ den.

**Alternativ B – én linje i terminalen**

```bash
# Erstatt med den faktiske connection string fra steg 3 (Session pooler, port 5432)
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" npx drizzle-kit migrate
```

**Alternativ B – midlertidig i .env**

- Lag en kopi f.eks. `.env.prod.migrate` med kun `DATABASE_URL=...` (prod).
- Last den inn: `env $(cat .env.prod.migrate | xargs) npx drizzle-kit migrate`.
- Slett filen etterpå og legg den **aldri** i repo.

---

## Steg 5: Sett prod-credentials i Vercel

1. Gå til **Vercel** → ditt prosjekt (revizo) → **Settings** → **Environment Variables**.
2. For **Production** (og gjerne Preview), sett eller oppdater:

| Variabel | Verdi |
|----------|--------|
| `DATABASE_URL` | Connection string fra **Revizo prod** (Session pooler, steg 3). |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL fra **Revizo prod**. |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key fra **Revizo prod**. |

3. **Lagre.** Ved neste deploy vil produksjon bruke den nye databasen.

---

## Steg 6: Storage-bøtte i prod (hvis dere bruker Supabase Storage)

Hvis appen bruker Supabase Storage (f.eks. for import-filer):

1. I **Revizo prod**-prosjektet: **Storage** → opprett en bøtte med samme navn og policy som i «project opus» (f.eks. `imports`).
2. RLS/policies må evt. settes likt som i dev. Sjekk **project opus** → Storage → bøtte → Policies og gjør det samme i prod.

---

## Sjekkliste

- [ ] **project opus** brukes kun i `.env.local` (lokal dev).
- [ ] Nytt Supabase-prosjekt opprettet (f.eks. «Revizo prod»).
- [ ] Migrasjoner kjørt én gang mot prod (steg 4).
- [ ] Vercel Production har `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` fra **Revizo prod**.
- [ ] Redeploy fra Vercel. Test innlogging og grunnflyt på revizo.ai – data skal nå komme fra prod-DB (tom til du oppretter noe der).

---

*Etter dette har du lokal DB (project opus med demo-data) og prod-DB (Revizo prod, tom og fersk).*
