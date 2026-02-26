# Abonnements- og tjenesteoppgraderinger (Revizo)

Dette dokumentet brukes når dere har funding og skal velge plan: prioritering, utgifter, credentials og konkrete planvalg.

---

## 1. Prioritering (rekkefølge å oppgradere)

| # | Tjeneste | Hvorfor |
|---|----------|--------|
| 1 | **Clerk** (Production) | Uten prod-instans fungerer ikke innlogging/e-post pålitelig for ekte brukere. |
| 2 | **Vercel Pro** | Hobby har strenge grenser; Pro fjerner dem og gir team-tilgang. |
| 3 | **Supabase Pro** | Free pauser DB ved inaktivitet; Pro gir 8 GB, backups, ingen pause. |
| 4 | **Resend Pro** | 100 e-post/dag sprenges raskt ved rapporter og flere kunder. |
| 5 | **Railway** (betalt) | Worker for Agent rapport må ikke pause. |
| 6 | **Domene (revizo.ai)** | Profesjonelt inntrykk og e-post fra eget domene. |
| 7 | **Sentry Team** | Kan vente; Developer (gratis) holder til dere har mer trafikk. |
| 8 | **Anthropic** | Behold pay-as-you-go; sett budsjettgrense. |
| 9 | **OpenAI** | Kun når RAG/embeddings aktiveres. |

---

## 2. Utgiftsoversikt og budsjett

### Faste kostnader per måned (anbefalt oppstart)

| Tjeneste | Plan | USD/mnd |
|----------|------|---------|
| Vercel | Pro | 20 |
| Supabase | Pro | 25 |
| Clerk | Pro | 25 |
| Resend | Pro | 20 |
| Railway | Hobby (betalt) eller Pro | 5–20 |
| Sentry | Developer (gratis) eller Team | 0 eller 26 |
| **Sum faste** | | **~95–136** |

### Variable kostnader

| Tjeneste | Estimat |
|----------|---------|
| Anthropic (Claude) | ca. $50–200/mnd; sett budsjettgrense (f.eks. $300). |
| Clerk (over 10k MAU) | $0.02/MAU. |
| OpenAI (ved RAG) | ca. $5–20/mnd. |

### Total (typisk)

| Scenario | USD/mnd |
|----------|---------|
| **Minimum** (Vercel, Supabase, Clerk, Resend, Railway Hobby, resten gratis) | ~100 + AI |
| **Anbefalt** (+ Railway Pro, Sentry Team) | ~140 + AI |
| **Med AI** (~$150 Anthropic) | ~290 |

**Domene:** revizo.ai (kjøpt, 279 €/år).

---

## 3. Credentials etter planvalg

Oppdater disse i **Vercel → Settings → Environment Variables** (Production) etter oppgradering:

| Variabel | Når / hva |
|----------|-----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Bytt til `pk_live_...` fra Clerk production-instans. |
| `CLERK_SECRET_KEY` | Bytt til `sk_live_...` fra Clerk production-instans. |
| `NEXT_PUBLIC_APP_URL` | Sett til `https://revizo.ai` (produksjon). |
| `RESEND_FROM_ADDRESS` | Verifiser revizo.ai i Resend, bruk f.eks. `noreply@revizo.ai`. |
| Øvrige (Supabase, Resend API, Anthropic, Sentry) | Uendret ved kun planoppgradering. |

**Sikkerhet:** Ikke committ live-nøkler; kun i Vercel (og .env.local lokalt ved behov).

### Hvor domene (revizo.ai) må settes

| Sted | Hva å gjøre |
|------|--------------|
| **Vercel** | Domains: revizo.ai og www.revizo.ai. GoDaddy DNS: **Kun én** A-record for `@`, Verdi **76.76.21.21** (eller Vercel anbefaler `216.150.1.1`). CNAME `www` → `cname.vercel-dns.com` (eller prosjektspesifikk). Hvis du fortsatt ser «Launching Soon»: sjekk at det ikke finnes andre A-records for `@`, og at GoDaddy «Domain Forwarding» / «Website» er skrudd av for revizo.ai. Verifiser med `dig revizo.ai +short` – skal kun vise Vercel-IP. Env: `NEXT_PUBLIC_APP_URL` = `https://revizo.ai` (Production). |
| **Clerk** | Production-instans med revizo.ai; CNAME-poster i GoDaddy (clerk, accounts, clkmail, DKIM) → Verify configuration. |
| **Resend** | Domene revizo.ai er **Verified** (DKIM + SPF i GoDaddy). Siste steg: i Vercel → Environment Variables (Production) sett `RESEND_FROM_ADDRESS` = `Revizo <noreply@revizo.ai>`. |

Ingen andre tjenester (Supabase, Railway, Sentry, Anthropic) krever domene-oppdatering for revizo.ai.

---

## 4. Konkrete planvalg (best passer Revizo)

| Tjeneste | Anbefalt valg | Merknad |
|----------|----------------|---------|
| Vercel | **Pro** | Nødvendig for produksjon. |
| Supabase | **Pro** | Minste anbefalte for prod. |
| Clerk | **Pro** + production-instans | Bruk production, ikke dev. |
| Resend | **Pro** | 50k e-post dekker behov. |
| Railway | **Hobby $5** til å starte | Oppgrader til Pro ved behov. |
| Sentry | **Developer (gratis)** til å starte | Team når dere er flere. |
| Anthropic | **Pay-as-you-go + budsjettgrense** | F.eks. $200–300/mnd i Console. |
| OpenAI | **Ikke aktivere ennå** | Ved RAG/embeddings. |
| Domene | **revizo.ai** | Kjøpt (279 €/år). Knytt til Vercel, Clerk, Resend. |

---

## 5. Oversikt: Tjenester og roller (referanse)

| # | Tjeneste | Rolle i Revizo | Nåværende plan | Anbefalt oppgradering | Estimat kostnad/mnd |
|---|----------|----------------|----------------|------------------------|----------------------|
| 1 | **Vercel** | Hosting, deploy, serverless | Hobby (gratis) | **Pro** | $20/bruker |
| 2 | **Supabase** | PostgreSQL + Storage | Free | **Pro** | $25 |
| 3 | **Clerk** | Auth, organisasjoner | Free (dev-instans) | **Pro** (production) | $25 + $0.02/MAU over 10k |
| 4 | **Anthropic (Claude)** | Revizo AI-assistent | Pay-as-you-go | Behold + budsjettgrense | ~$50–200 avhengig av bruk |
| 5 | **Resend** | E-postvarsler, rapporter | Free (100 e-post/dag) | **Pro** | $20 (50k e-post/mnd) |
| 6 | **Sentry** | Feilovervåking | Developer (gratis) | **Team** | $26/mnd |
| 7 | **Railway** | Bakgrunnsjobber (Agent rapport) | Trial/Hobby | **Pro** / Hobby betalt | $5–20/mnd
| 8 | **OpenAI** | Embeddings (RAG/søk) | Ikke aktivt ennå | Pay-as-you-go | ~$5–20 |
| 9 | **GitHub** | Versjonskontroll | Free/Pro | Behold nåværende | $0–4 |

---

## 6. Detaljer per tjeneste (lenker og beskrivelse)

### Vercel
- **Nå:** Hobby (gratis) — begrensninger på bandbredde, serverless execution time.
- **Oppgradering:** Pro ($20/bruker/mnd).
- **Lenke:** [vercel.com/pricing](https://vercel.com/pricing).

### Supabase
- **Nå:** Free — database kan pauses etter inaktivitet, begrenset storage.
- **Oppgradering:** Pro ($25/mnd) — 8 GB database, 100 GB storage, daglige backups.
- **Lenke:** [supabase.com/dashboard](https://supabase.com/dashboard) → Project Settings → Billing.

### Clerk
- **Nå:** Free (development-instans) — testnøkler, begrensninger på e-post.
- **Oppgradering:** Pro — production-instans, egen domene, høyere MAU-grenser.
- **Lenke:** [dashboard.clerk.com](https://dashboard.clerk.com) → Billing.
- **Status:** Production-instans opprettet med **revizo.ai** som domene. Alle 5 CNAME-poster er lagt inn i GoDaddy. Neste: Clerk → Configure → Domains → **Verify configuration** (vent 5–15 min på DNS-spredning hvis noen viser «Unverified»). Deretter utstedes SSL.
  | Subdomene (Host) | Type | Verdi (Target) |
  |------------------|------|----------------|
  | `clerk.revizo.ai` | CNAME | `frontend-api.clerk.services` |
  | `accounts.revizo.ai` | CNAME | `accounts.clerk.services` |
  | `clkmail.revizo.ai` | CNAME | `mail.0u91231zfxh0.clerk.services` |
  | `clk._domainkey.revizo.ai` | CNAME | `dkim1.0u91231zfxh0.clerk.services` |
  | `clk2._domainkey.revizo.ai` | CNAME | `dkim2.0u91231zfxh0.clerk.services` |
  *(Sist to verdier kan avvike per Clerk-instans; sjekk Configure → Domains for eksakte targets.)*
- **GoDaddy:** DNS → «Legg til nye oppføringer» → Type CNAME. **Navn** = kun subdomene (ingen mellomrom før eller etter, f.eks. `clk._domainkey`); **Verdi** = target (ev. med avsluttende punktum). TTL 1 time. Deretter «Verify configuration» i Clerk.
- Valgfritt: «Setup social connection credentials» hvis dere bruker Google/GitHub etc.

### Anthropic (Claude)
- **Nå:** Pay-as-you-go via API.
- **Anbefaling:** Behold; sett budsjettgrense i Anthropic-dashboardet for å unngå uventede kostnader.
- **Lenke:** [console.anthropic.com](https://console.anthropic.com).

### Resend
- **Nå:** Free — 100 e-post/dag.
- **Oppgradering:** Pro ($20/mnd) — 50 000 e-post/mnd.
- **Lenke:** [resend.com](https://resend.com) → Billing.
- **Domene revizo.ai:** Resend → Domains → Add domain `revizo.ai`. Legg inn i GoDaddy (DNS-oppføringer):
  - **DKIM:** Type TXT, Navn `resend._domainkey`, Verdi = den lange strengen Resend viser (kopier helt, ingen mellomrom).
  - **SPF (Enable Sending):** 1) MX: Type MX, Navn `send`, Verdi = feedback-smtp-… (fra Resend), Priority 10. 2) TXT: Type TXT, Navn `send`, Verdi = `v=spf1 include:… ~all` (fra Resend). «Enable Receiving» kan stå av. Klikk **I've added the records** i Resend når postene er lagt inn; vent noen minutter på verifisering. Deretter Vercel (Production): `RESEND_FROM_ADDRESS` = `Revizo <noreply@revizo.ai>`.

### Sentry
- **Nå:** Developer (gratis) — begrenset events.
- **Oppgradering:** Team ($26/mnd) — flere events, team-funksjoner.
- **Lenke:** [sentry.io](https://sentry.io) → Settings → Billing.

### Railway
- **Nå:** Trial/Hobby — worker for Agent rapport (nattjobber).
- **Oppgradering:** Pro ($5 + bruk) — stabil uptime, ingen pause.
- **Lenke:** [railway.app](https://railway.app) → Project → Settings → Billing.

### OpenAI
- **Nå:** Ikke konfigurert (OPENAI_API_KEY tom i .env).
- **Fremtid:** Aktiver ved RAG/embeddings; pay-as-you-go.
- **Lenke:** [platform.openai.com](https://platform.openai.com).

*Priser per feb 2026; sjekk hver leverandørs nettside for oppdaterte priser.*

---

## 7. Sjekkliste for oppgradering

- [x] **Clerk:** Production-instans, Pro ($24/mnd)
- [x] **Vercel:** Pro
- [x] **Supabase:** Pro
- [x] **Resend:** Pro
- [x] **Railway:** Pro
- [ ] **Sentry:** Behold gratis; oppgrader til Team ved behov
- [x] **Anthropic:** Betalt / budsjett satt
- [x] **Domene:** revizo.ai kjøpt (279 €/år) → knytt til Vercel, Clerk, Resend
- [x] **Resend domene:** revizo.ai Verified i Resend. Husk: `RESEND_FROM_ADDRESS` = `Revizo <noreply@revizo.ai>` i Vercel (Production).

---

**Tilgang og betalingsmur:** Se **docs/PAYWALL_AND_ACCESS.md** for kort sikt (Clerk Allowlist, invite-only sign-up) og lang sikt (Stripe / betalingstjeneste).

---

*Sist oppdatert: februar 2026*
