# Betalingsmur og tilgangskontroll (Revizo)

Dette dokumentet beskriver hva dere gjør **inntil** betalingsmuren er på plass, og hvilken **betalingstjeneste** som passer for Revizo senere.

---

## 1. Nåværende situasjon

- Hvem som helst kan gå til `/sign-up`, opprette konto i Clerk og komme inn i appen.
- Det finnes ingen betalingsmur eller abonnementssjekk i koden ennå.

---

## 2. Kortsiktig (frem til betalingsmur er på plass)

To lag anbefales: **Clerk Allowlist** (på tvers av alle) og **valgfri** «Request access»-side når sign-up er stengt.

### 2.1 Clerk Allowlist (anbefalt, første steg)

Begrens hvem som i det hele tatt kan registrere seg:

1. Gå til **Clerk Dashboard** → Production-instans → **User & Authentication** → **Restrictions**.
2. Aktiver **Allowlist**.
3. Legg til tillatte e-postadresser eller domener (f.eks. `@revizo.ai`, eller konkrete e-poster til dere og beta-brukere).
4. Lagre. Nye brukere utenfor listen får avvist registrering.

**Merk:** Eksisterende brukere som allerede er i Clerk blir værende; Allowlist styrer kun **nye** sign-ups. Fjern uønskede brukere manuelt under Users om nødvendig.

### 2.2 Valgfri: Steng sign-up og vis «Request access»

Hvis dere vil skjule sign-up helt og vise en enkel «Be om tilgang»-side:

1. I **Vercel** (Production): Sett miljøvariabel  
   `NEXT_PUBLIC_SIGNUP_MODE=invite-only`  
   (Verdier: `open` = vanlig sign-up, `invite-only` = redirect til request-access-siden.)
2. Da redirecter `/sign-up` til `/request-access`, som viser kort forklaring og evt. lenke til kontakt.
3. Bruk **Clerk Allowlist** i tillegg, så kun innvidere kan opprette konto (f.eks. via invitasjonslenke eller tillatt domene).

Kombinasjonen **Clerk Allowlist + SIGNUP_MODE=invite-only** gir både synlig stengt sign-up og at kun tillatte e-poster kan registrere seg.

### 2.3 App-nivå: kun tillatte brukere får tilgang (invite-only)

Clerk Allowlist stopper bare **nye** registreringer. Eksisterende brukere kan fortsatt logge inn og komme inn. For å stenge ute alle unntatt en fast liste:

1. I **Vercel** (Production): Sett **`ALLOWED_CLERK_USER_IDS`** til en kommaseparert liste over Clerk user IDs som skal ha tilgang, f.eks. `user_2abc...,user_2def...`.
2. Hent user ID fra **Clerk Dashboard** → **Users** → klikk på brukeren → **User ID** (starter med `user_`).
3. Når `NEXT_PUBLIC_SIGNUP_MODE=invite-only` og `ALLOWED_CLERK_USER_IDS` er satt, vil alle andre (inkl. eksisterende brukere som ikke står på listen) bli redirectet til `/request-access` når de prøver å gå til dashboard eller API. De ser da «Du er innlogget, men har ikke tilgang» og kan logge ut.

---

## 3. Langsiktig: Betalingsløsning

Når dere skal ta betalt og legge inn reell betalingsmur, er dette anbefalingen.

### 3.1 Anbefalt: Stripe

- **Hvorfor:** Standard for SaaS, god dokumentasjon, webhooks for abonnement (opprettet, endret, kansellert, betaling feilet). Dere styrer priser, planer og fakturering selv. Fungerer godt med Clerk (Clerk userId/orgId knyttes til Stripe Customer og Subscription).
- **Hva dere får:** Abonnementer (mnd/år), prisforsider, Customer Portal (bruker bytter plan selv), webhooks som oppdaterer egen DB (f.eks. `subscription.status === 'active'` før tilgang til appen).
- **Kostnad:** Transaksjonsgebyr + evt. Stripe Billing for mer avansert fakturering. MVA må håndteres selv (VAT på tvers av land) eller via Stripe Tax.
- **Integrasjon:** Backend (Next.js API routes) oppretter Stripe Checkout Session eller Customer Portal; etter betaling kommer webhook → oppdater `subscriptions` (eller tilsvarende) i DB; middleware eller layout sjekker aktiv abonnement før tilgang til `/dashboard` (unntatt sign-in/sign-up/request-access).

### 3.2 Alternativer

| Tjeneste | Fordeler | Ulemper |
|----------|----------|--------|
| **Paddle** | Merchant of record (MVA/VAT håndteres av Paddle i mange land), enklere for små team | Mindre fleksibel enn Stripe, mindre «eier»-følelse over priser og fakturaer |
| **Lemon Squeezy** | Også MoR, enkel oppsett, god for digitale produkter | Nyere, mindre ekosystem enn Stripe |
| **Stripe + Stripe Tax** | Full kontroll + Stripe beregner og rapporterer MVA | Mer oppsett enn ren Stripe |

**Anbefaling:** Start med **Stripe** (og evt. Stripe Tax for MVA). Bygg modell: «Ingen tilgang til dashboard uten aktiv Stripe-abonnement»; bruk webhooks for å holde `subscription.status` i sync. Vurder Paddle/Lemon Squeezy hvis dere vil at noen andre skal være merchant of record og ta mesteparten av MVA-håndteringen.

---

## 4. Teknisk skisse for betalingsmur (senere)

- **DB:** Tabell f.eks. `subscriptions` med `userId`/`orgId`, `stripeCustomerId`, `stripeSubscriptionId`, `status`, `currentPeriodEnd`.
- **Webhook:** `POST /api/webhooks/stripe` (eller tilsvarende) som mottar `customer.subscription.updated` / `created` / `deleted` og oppdaterer DB.
- **Tilgangssjekk:** I dashboard layout eller middleware: hent brukerens abonnement; hvis `status !== 'active'`, redirect til `/pricing` eller `/subscribe` (Stripe Checkout).
- **Priser:** Definert i Stripe Dashboard (Products & Prices); lenke fra appen til Stripe Checkout med `price_id`.

Dette kan utdypes i egen arkitekturdokument eller plan når dere starter implementasjon.

---

## 5. Sjekkliste

- [ ] **Kortsiktig:** Clerk Allowlist aktivert (Production), tillatte e-poster/domener satt.
- [ ] **Valgfritt:** `NEXT_PUBLIC_SIGNUP_MODE=invite-only` i Vercel (Production); brukere som går til `/sign-up` ser request-access.
- [ ] **Kun tillatte brukere inn:** Sett `ALLOWED_CLERK_USER_IDS` i Vercel (Production) til kommaseparert liste over Clerk user IDs som skal ha tilgang. Da får alle andre redirect til `/request-access` selv om de er innlogget.
- [ ] **Senere:** Beslutning tatt om betalingsleverandør (Stripe anbefalt).
- [ ] **Senere:** Stripe-produkter og -priser opprettet; webhook og DB-modell for abonnement; tilgangssjekk i appen.

---

*Sist oppdatert: februar 2026*
