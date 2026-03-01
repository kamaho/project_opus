# Sikkerhetsanalyse — Revizo

**Dato:** 2026-03-01  
**Scope:** Full kodebase, infrastruktur, tredjepartsintegrasjoner  
**Standarder:** GDPR, ISO 27001, SOC 2 Type II

---

## Sammendrag

Revizo har et solid fundament — Clerk for autentisering, `withTenant()` wrapper på alle API-ruter, og tenant-isolert datamodell. Men det er betydelige hull som må tettes før produksjonslansering, spesielt rundt kryptering av lagrede hemmeligheter, manglende sikkerhetsheadere, ufullstendig audit-logging, og GDPR-compliance.

### Risikonivåer

| Alvorlighet | Antall funn |
|-------------|-------------|
| **Kritisk** | 3 |
| **Høy** | 8 |
| **Medium** | 12 |
| **Lav** | 8 |

---

## 1. KRITISKE FUNN

### 1.1 Ekte API-nøkkel i `.env.example`

| | |
|---|---|
| **Fil** | `.env.example` linje 25 |
| **Problem** | `RESEND_API_KEY=re_VNdcYaH6_2A2ZFPoeAgFtkBx6cC5krkvg` ser ut som en ekte nøkkel, ikke en placeholder. |
| **Risiko** | Hvem som helst med tilgang til repo kan sende e-post på vegne av Revizo. |
| **Tiltak** | 1) Erstatt med `re_your_key_here`. 2) Roter nøkkelen umiddelbart i Resend-dashbordet. 3) Sjekk Resend-logger for uautorisert bruk. |
| **Standard** | ISO 27001 A.9.4.3, SOC 2 CC6.1 |

### 1.2 Tripletex API-tokens lagret i klartekst

| | |
|---|---|
| **Fil** | `src/lib/db/schema.ts` → `tripletexConnections`-tabell |
| **Problem** | `consumerToken` og `employeeToken` lagres i databasen uten kryptering. |
| **Risiko** | Ved database-kompromittering eksponeres alle kunders Tripletex-tilganger. Gir full tilgang til regnskapsdata. |
| **Tiltak** | Implementer applikasjonsnivå-kryptering (AES-256-GCM) med nøkkel fra KMS (f.eks. AWS KMS, Vercel). Krypter før insert, dekrypter ved lesing. |
| **Standard** | ISO 27001 A.10.1.1, SOC 2 CC6.1, GDPR Art. 32 |

### 1.3 Cron-endepunkt åpent uten `CRON_SECRET`

| | |
|---|---|
| **Fil** | `src/app/api/cron/tripletex-sync/route.ts` linje 18–22 |
| **Problem** | `if (cronSecret && ...)` — sjekken hoppes over helt hvis `CRON_SECRET` ikke er satt. Enhver uautentisert bruker kan trigge Tripletex-synkronisering. |
| **Risiko** | Uautorisert datatilgang, DoS, API-kvote-uttømming hos Tripletex. |
| **Tiltak** | Krev `CRON_SECRET`: `if (!cronSecret \|\| authHeader !== \`Bearer ${cronSecret}\`)`. Legg `/api/cron/(.*)` til public routes i middleware. |
| **Standard** | ISO 27001 A.9.4.1, SOC 2 CC6.1 |

---

## 2. HØYE FUNN

### 2.1 Ingen RBAC (Rollebasert tilgangskontroll)

| | |
|---|---|
| **Filer** | Alle API-ruter under `src/app/api/` |
| **Problem** | Clerk-organisasjonsroller (`org:admin`, `org:member`) vises i UI men håndheves ikke i API-ruter. Alle org-medlemmer kan utføre alle operasjoner. |
| **Risiko** | En vanlig bruker kan endre Tripletex-konfigurasjon, slette klienter, eksportere all data, osv. |
| **Tiltak** | Implementer RBAC-middleware som sjekker roller fra Clerk. Definer tilgangsnivåer: `viewer`, `member`, `admin`, `owner`. |
| **Standard** | ISO 27001 A.9.1.2, SOC 2 CC6.3 |

### 2.2 Manglende sikkerhetsheadere

| | |
|---|---|
| **Filer** | `next.config.ts`, `src/middleware.ts` |
| **Problem** | Ingen `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy` eller `Permissions-Policy`. |
| **Risiko** | XSS, clickjacking, MIME-sniffing angrep. |
| **Tiltak** | Legg til security headers i `next.config.ts` under `headers()`. |
| **Standard** | ISO 27001 A.13.1.1, SOC 2 CC6.6 |

### 2.3 Offentlig filopplasting uten begrensninger

| | |
|---|---|
| **Fil** | `src/app/api/document-requests/public/[token]/route.ts` |
| **Problem** | Ingen filstørrelsesbegrensning, ingen MIME-validering, ingen rate limiting. Filnavn brukes direkte i lagringssti (path traversal-risiko). |
| **Risiko** | DoS via store filer, lagring av skadelig innhold, path traversal. |
| **Tiltak** | 1) Begrens filstørrelse (f.eks. 25 MB). 2) Valider MIME-type. 3) Sanitiser filnavn. 4) Legg til rate limiting. |
| **Standard** | ISO 27001 A.13.2.1, SOC 2 CC6.1 |

### 2.4 Feilinformasjon lekker til klienter

| | |
|---|---|
| **Filer** | `auto-match/route.ts`, `matching-rules/seed/route.ts`, Tripletex-ruter |
| **Problem** | `details: String(err)` og `error: error.message` eksponerer interne feilmeldinger, potensielt inkludert DB-feil, stakk-spor og API-nøkler. |
| **Risiko** | Informasjonslekkasje som hjelper angripere. |
| **Tiltak** | Returner generiske feilmeldinger til klient. Logg detaljer server-side. |
| **Standard** | ISO 27001 A.12.4.1, SOC 2 CC7.2 |

### 2.5 De fleste API-ruter mangler rate limiting

| | |
|---|---|
| **Fil** | `src/lib/rate-limit.ts` |
| **Problem** | Kun `import`, `ai/chat` har rate limiting. 50+ ruter er ubegrenset. In-memory rate limiter fungerer ikke på serverless (per-instans). |
| **Risiko** | Brute force, DoS, API-misbruk. |
| **Tiltak** | 1) Implementer global rate limiting i middleware (f.eks. Upstash Rate Limit). 2) Legg til spesifikke limits for sensitive endepunkter. |
| **Standard** | ISO 27001 A.13.1.1, SOC 2 CC6.6 |

### 2.6 Vedlegg-opplasting uten validering

| | |
|---|---|
| **Fil** | `src/app/api/clients/[clientId]/transactions/[transactionId]/attachments/route.ts` |
| **Problem** | Ingen filstørrelsesbegrensning, ingen MIME-validering. Filnavn brukes direkte. |
| **Tiltak** | Legg til størrelsesgrense, MIME-sjekk, og filnavnsanering. |
| **Standard** | ISO 27001 A.13.2.1 |

### 2.7 Ufullstendig audit-logging

| | |
|---|---|
| **Filer** | Diverse API-ruter |
| **Problem** | Følgende sensitive operasjoner logges IKKE: klient opprettelse/sletting, Tripletex-tilkobling (lagring av credentials), kontakt CRUD, oppgave CRUD, gruppeoperasjoner, selskapsopprettelse, dashbord-konfigurasjon. |
| **Risiko** | Manglende sporbarhet for compliance og hendelseshåndtering. |
| **Tiltak** | Legg til audit-logging for alle sensitive operasjoner. |
| **Standard** | ISO 27001 A.12.4.1, SOC 2 CC7.2, GDPR Art. 5(2) |

### 2.8 Hardkodet admin-liste

| | |
|---|---|
| **Fil** | `src/lib/auth/is-system-admin.ts` |
| **Problem** | Admin-domener og e-poster er hardkodet i kildekoden, inkludert en personlig e-post (`h0lst@icloud.com`). |
| **Risiko** | Vanskelig å administrere, kodeendring kreves for å legge til/fjerne admins. |
| **Tiltak** | Flytt til miljøvariabler (`ADMIN_EMAILS`, `ADMIN_DOMAINS`) eller database-basert admin-register. |
| **Standard** | ISO 27001 A.9.2.5 |

---

## 3. MEDIUM FUNN

### 3.1 Sentry edge-konfigurasjon mangler PII-filtrering

| | |
|---|---|
| **Fil** | `sentry.edge.config.ts` |
| **Problem** | Ingen `beforeSend` for å fjerne `request.data`. Client og server-config har dette. |
| **Tiltak** | Legg til `beforeSend` som stripper sensitive felter. |

### 3.2 Full kontaktliste sendes til Anthropic

| | |
|---|---|
| **Filer** | `src/lib/ai/context.ts`, `src/lib/ai/system-prompt.ts` |
| **Problem** | Alle kontakter (navn, e-post, rolle, selskap) sendes til Anthropic ved hver AI-forespørsel. |
| **Risiko** | PII sendes til tredjepart uten minimering. |
| **Tiltak** | Minimer kontekst: send kun relevant kontaktinfo, pseudonymiser der mulig. |
| **Standard** | GDPR Art. 5(1)(c) — dataminimering |

### 3.3 AI-samtalehistorikk i klartekst

| | |
|---|---|
| **Tabell** | `aiConversations` |
| **Problem** | Full samtalehistorikk lagres i JSONB uten kryptering. Kan inneholde PII. |
| **Tiltak** | Vurder kryptering, automatisk sletting etter retensionsperiode, og tilgangskontroll. |
| **Standard** | GDPR Art. 5(1)(e), Art. 17 |

### 3.4 Flere API-ruter uten Zod-validering

| | |
|---|---|
| **Ruter** | `clients POST`, `clients/assign PATCH`, `companies POST`, `client-groups POST`, `clients/compare GET`, m.fl. |
| **Problem** | Brukerinput valideres manuelt eller ikke i det hele tatt. Mangel på typesjekk for UUID-er, enumverdier, osv. |
| **Tiltak** | Innfør Zod-skjemaer for alle ruter som aksepterer brukerinput. |

### 3.5 Database SSL ikke eksplisitt konfigurert

| | |
|---|---|
| **Fil** | `src/lib/db/index.ts`, `.env.example` |
| **Problem** | Ingen eksplisitt `sslmode=require` i `DATABASE_URL`. |
| **Tiltak** | Legg til `?sslmode=require` i alle produksjons-database-URLer. |
| **Standard** | ISO 27001 A.13.1.1 |

### 3.6 `CRON_SECRET` mangler fra `.env.example`

| | |
|---|---|
| **Problem** | Variabelen er ikke dokumentert, noe som øker risikoen for at den glemmes i nye miljøer. |
| **Tiltak** | Legg til `CRON_SECRET=your_cron_secret_here` i `.env.example`. |

### 3.7 Session replay ved feil fanger UI-state

| | |
|---|---|
| **Fil** | `sentry.client.config.ts` |
| **Problem** | `replaysOnErrorSampleRate: 1.0` tar opp full session replay. Kan fange skjemadata, personlige opplysninger i UI. |
| **Tiltak** | Konfigurer Sentry til å maskere sensitive elementer (`maskAllInputs: true`). |

### 3.8 Tripletex sesjonscache med tokens i nøkkel

| | |
|---|---|
| **Fil** | Tripletex-klient |
| **Problem** | Cache-nøkkel inkluderer rå tokens. Ved logging av cache-operasjoner kan tokens eksponeres. |
| **Tiltak** | Hash tokens i cache-nøkkel. |

### 3.9 Full feilobjekt logges

| | |
|---|---|
| **Fil** | `src/lib/auth/api-handler.ts:32` |
| **Problem** | `console.error("[api] Unhandled error:", error)` logger hele feilobjektet. Kan inneholde tokens, DB-detaljer, PII. |
| **Tiltak** | Logg kun `error.message` og `error.name`. |

### 3.10 Finansdata i e-poster

| | |
|---|---|
| **Fil** | `src/lib/resend.ts` |
| **Problem** | E-poster inneholder saldobeløp, antall transaksjoner, klientnavn, osv. |
| **Tiltak** | Verifiser at mottakere er autorisert. Vurder å begrense detaljnivå i e-poster. |

### 3.11 Sentry `extra`-felt inneholder identifikatorer

| | |
|---|---|
| **Filer** | Diverse ruter |
| **Problem** | `Sentry.captureException(err, { extra: { tenantId, clientId } })` sender identifikatorer. |
| **Tiltak** | Vurder om disse er nødvendige eller om de kan pseudonymiseres. |

### 3.12 Tutorial GET uten tenant-filter

| | |
|---|---|
| **Fil** | `src/app/api/tutorials/[tutorialId]/route.ts` |
| **Problem** | Enhver autentisert bruker kan lese enhver tutorial via ID. |
| **Tiltak** | Akseptabelt hvis tutorials er globale; dokumenter beslutningen. |

---

## 4. LAVE FUNN

| # | Funn | Fil | Tiltak |
|---|------|-----|--------|
| 4.1 | `tenantScope` eksportert men ubrukt | `tenant-queries.ts` | Bruk for konsistens eller fjern |
| 4.2 | `verifyCompanyOwnership` ubrukt | `verify-ownership.ts` | Bruk i company-ruter |
| 4.3 | `sql.raw()` med internt genererte ID-er | `matching/engine.ts:271` | Lav risiko, men refaktorer til parametriserte queries |
| 4.4 | Health-endepunkt eksponerer DB-status | `api/health/route.ts` | Vurder å begrense informasjon |
| 4.5 | Sidebar-cookie uten Secure/SameSite | `ui/sidebar.tsx` | Legg til attributter |
| 4.6 | `application/octet-stream` tillatt i import | `import/route.ts` | Vurder å fjerne fra tillatte typer |
| 4.7 | Ingen webhook signature-verifisering (planlagt) | — | Implementer Svix-verifisering ved lansering |
| 4.8 | Avhengigheter ikke regelmessig sikkerhetssjekket | `package.json` | Kjør `npm audit` i CI/CD |

---

## 5. GDPR-COMPLIANCE

### 5.1 Nåværende status

| Krav | Status | Gap |
|------|--------|-----|
| **Art. 5(1)(a) — Lovlighet** | Delvis | Ingen eksplisitt samtykkemekanisme i kode. Behandlingsgrunnlag (berettiget interesse vs. samtykke) ikke dokumentert. |
| **Art. 5(1)(b) — Formålsbegrensning** | Delvis | AI-data brukes til chat; formålet er klart. Men ingen formell personvernerklæring. |
| **Art. 5(1)(c) — Dataminimering** | Mangelfull | Full kontaktliste sendes til Anthropic. AI-kontekst inkluderer mer PII enn nødvendig. |
| **Art. 5(1)(d) — Riktighet** | OK | Data oppdateres av brukere selv. |
| **Art. 5(1)(e) — Lagringsbegrensning** | Mangelfull | Ingen automatisk sletting av AI-samtaler, minner, audit-logger. Ingen retensjonspolicy. |
| **Art. 5(2) — Ansvarliggjøring** | Mangelfull | Ingen dokumentert datavern-policy (privacy policy), behandlingsprotokoll, eller DPIA. |
| **Art. 6 — Behandlingsgrunnlag** | Mangelfull | Ikke identifisert i kode eller docs. |
| **Art. 13/14 — Informasjonsplikt** | Mangler | Ingen personvernerklæring i appen. |
| **Art. 15 — Innsyn** | Mangler | Ingen funksjon for brukere å se hvilke data som er lagret om dem. |
| **Art. 17 — Rett til sletting** | Mangler | Ingen "slett min konto/data"-funksjonalitet. |
| **Art. 20 — Dataportabilitet** | Mangler | Ingen eksport av brukerens egne data i maskinlesbart format. |
| **Art. 28 — Databehandleravtale** | Uvisst | Krever DPA med Anthropic, Resend, Sentry, Supabase, Vercel, Clerk. |
| **Art. 32 — Sikkerhet** | Delvis | Tokens i klartekst, manglende kryptering, ufullstendig logging. |
| **Art. 33/34 — Varslingsplikt** | Mangler | Ingen incident response-prosedyre. |
| **Art. 35 — DPIA** | Mangler | Ingen vurdering av personvernkonsekvenser for AI-behandling. |

### 5.2 Påkrevde tiltak

1. **Personvernerklæring** — Opprett og vis i appen (Art. 13/14)
2. **Behandlingsprotokoll** — Dokumenter alle behandlingsaktiviteter (Art. 30)
3. **Databehandleravtaler** — Signer DPA med alle tredjeparter (Art. 28)
4. **DPIA** — Gjennomfør for AI-chat og automatisk matching (Art. 35)
5. **Retensjonspolicy** — Definer og implementer automatisk sletting (Art. 5(1)(e))
6. **Rett til sletting** — Implementer "slett mine data"-funksjonalitet (Art. 17)
7. **Rett til innsyn** — Implementer datanedlasting for brukere (Art. 15/20)
8. **Samtykkehåndtering** — Implementer for AI-bruk og e-postvarsler (Art. 6/7)
9. **Incident response-plan** — Dokumenter prosedyre (Art. 33/34)

---

## 6. ISO 27001 GAP-ANALYSE

| Kontrollområde | Nåværende | Gap |
|----------------|-----------|-----|
| **A.5 — Informasjonssikkerhetspolitikk** | Ikke etablert | Trenger sikkerhetspolicy-dokument |
| **A.6 — Organisering** | Delvis (admin-roller) | Formell ansvar og roller mangler |
| **A.8 — Aktivaforvaltning** | Delvis | Trenger dataklassifisering og aktivaregister |
| **A.9 — Tilgangskontroll** | Delvis | Auth OK, men RBAC mangler |
| **A.10 — Kryptografi** | Mangelfull | Tokens i klartekst, manglende kryptering ved lagring |
| **A.12 — Driftssikkerhet** | Delvis | Audit-logging ufullstendig, ingen change management |
| **A.13 — Kommunikasjonssikkerhet** | Mangelfull | Manglende sikkerhetsheadere, SSL ikke eksplisitt |
| **A.14 — Systemutvikling** | Delvis | Ingen SAST/DAST i CI/CD, ingen code review-krav |
| **A.16 — Hendelseshåndtering** | Mangler | Ingen incident response-prosedyre |
| **A.17 — Kontinuitet** | Delvis | Database-backup via Supabase, men ingen dokumentert DR-plan |
| **A.18 — Samsvar** | Mangelfull | GDPR-hull, ingen compliance-overvåkning |

---

## 7. SOC 2 TYPE II GAP-ANALYSE

| Trust Service Criteria | Status | Primære gaps |
|------------------------|--------|--------------|
| **CC1 — Kontrollmiljø** | Mangelfull | Ingen formell sikkerhetspolicy, ansvarsfordeling, eller opplæring |
| **CC2 — Kommunikasjon** | Mangelfull | Ingen personvernerklæring, security disclosure-policy |
| **CC3 — Risikovurdering** | Mangler | Ingen formell risikovurdering gjennomført |
| **CC4 — Overvåkning** | Delvis | Sentry for feil, men ingen sikkerhetsspesifikk overvåkning |
| **CC5 — Kontrollaktiviteter** | Delvis | Auth og tenant-isolation på plass, men RBAC og input-validering ufullstendig |
| **CC6 — Logiske og fysiske tilgangskontroller** | Delvis | Clerk auth + tenant isolation, men tokens ukryptert, manglende headers |
| **CC7 — Systemdrift** | Delvis | Audit-logging ufullstendig, ingen incident response |
| **CC8 — Endringsstyring** | Delvis | Git-basert, men ingen formell change management-prosess |
| **CC9 — Risikominimering** | Mangelfull | Ingen formell tredjepartsrisikovurdering |

---

## 8. PRIORITERT TILTAKSLISTE

### Fase 1 — Kritisk (0–2 uker)

| # | Tiltak | Referanse |
|---|--------|-----------|
| 1 | Roter Resend API-nøkkel og erstatt med placeholder i `.env.example` | §1.1 |
| 2 | Fiks cron-auth: krev `CRON_SECRET`, legg til i public routes | §1.3 |
| 3 | Krypter Tripletex-tokens i database | §1.2 |
| 4 | Legg til sikkerhetsheadere (CSP, HSTS, X-Frame-Options, etc.) | §2.2 |
| 5 | Saner filnavnvalidering og størrelsesbegrensning på alle upload-endepunkter | §2.3, §2.6 |
| 6 | Fjern interne feildetaljer fra API-responser | §2.4 |

### Fase 2 — Høy prioritet (2–6 uker)

| # | Tiltak | Referanse |
|---|--------|-----------|
| 7 | Implementer RBAC med Clerk-organisasjonsroller | §2.1 |
| 8 | Implementer global rate limiting (Upstash) | §2.5 |
| 9 | Fullstendig audit-logging for alle sensitive operasjoner | §2.7 |
| 10 | Flytt admin-liste til miljøvariabler | §2.8 |
| 11 | Zod-validering på alle gjenstående API-ruter | §3.4 |
| 12 | Legg til `npm audit` i CI/CD pipeline | §4.8 |

### Fase 3 — GDPR/Compliance (4–12 uker)

| # | Tiltak | Referanse |
|---|--------|-----------|
| 13 | Opprett personvernerklæring og vis i app | §5 Art. 13/14 |
| 14 | Implementer "Slett mine data"-funksjonalitet | §5 Art. 17 |
| 15 | Implementer dataeksport for brukere | §5 Art. 15/20 |
| 16 | Opprett behandlingsprotokoll (Art. 30) | §5 |
| 17 | Signer DPA med alle tredjeparter | §5 Art. 28 |
| 18 | Gjennomfør DPIA for AI-behandling | §5 Art. 35 |
| 19 | Implementer retensjonspolicy og automatisk sletting | §5 Art. 5(1)(e) |
| 20 | Minimer PII sendt til Anthropic | §3.2 |
| 21 | Implementer samtykkehåndtering | §5 Art. 6/7 |

### Fase 4 — ISO/SOC forberedelse (3–6 måneder)

| # | Tiltak | Referanse |
|---|--------|-----------|
| 22 | Opprett informasjonssikkerhetspolicy | §6 A.5 |
| 23 | Definer roller og ansvar for sikkerhet | §6 A.6 |
| 24 | Gjennomfør formell risikovurdering | §7 CC3 |
| 25 | Implementer incident response-prosedyre | §6 A.16, §7 CC7 |
| 26 | Opprett dataklassifiseringsskjema | §6 A.8 |
| 27 | Etabler change management-prosess | §6 A.14, §7 CC8 |
| 28 | Sett opp sikkerhetsspesifikk overvåkning | §7 CC4 |
| 29 | Gjennomfør tredjepartsrisikovurdering | §7 CC9 |
| 30 | Opprett disaster recovery-plan | §6 A.17 |
| 31 | Implementer SAST/DAST i CI/CD | §6 A.14 |

---

## 9. DATABEHANDLERE OG UNDERDATABEHANDLERE

| Tjeneste | Type data | DPA nødvendig | Status |
|----------|-----------|---------------|--------|
| **Anthropic (Claude)** | Chat-meldinger, brukerkontekst, kontakter | Ja | Ikke signert |
| **Clerk** | Brukeridentitet, autentiseringsdata | Ja | Ikke bekreftet |
| **Supabase** | All applikasjonsdata (transaksjoner, klienter, etc.) | Ja | Ikke bekreftet |
| **Vercel** | Kildekode, miljøvariabler, logg | Ja | Ikke bekreftet |
| **Resend** | E-postadresser, meldingsinnhold | Ja | Ikke signert |
| **Sentry** | Feilinformasjon, session replays | Ja | Ikke bekreftet |
| **Tripletex** | Regnskapsdata, API-tokens | Ja | Ikke signert |

---

## 10. PII-OVERSIKT

| Kategori | Tabeller/Felt | Kryptering | Retensjon |
|----------|---------------|------------|-----------|
| Kontakt-PII | `contacts`: navn, e-post, telefon | Nei | Ubestemt |
| Finansdata | `transactions`: beløp, beskrivelser, referanser | Nei | Ubestemt |
| Bruker-ID | `userId`, `assignedUserId` (Clerk-ID-er) | N/A | Clerk-styrt |
| AI-data | `aiUserMemory`, `aiConversations` | Nei | Ubestemt |
| Revisjonsspor | `auditLogs.metadata` | Nei | Ubestemt |
| API-credentials | `tripletexConnections` | **Nei — KRITISK** | Ubestemt |

---

*Denne rapporten bør revideres kvartalsvis, eller ved større endringer i arkitektur eller tredjepartsintegrasjoner.*
