# Docusaurus-strategi: Intern og kundedokumentasjon

Denne strategien bygger på prosjektplanen for dokumentasjonsplattform (Docusaurus 3.x, Vercel, sluttbrukere + utviklere) og tilpasser den til Revizo med **én Docusaurus** for både **internt** (ansatte) og **ut mot kunder** (sluttbrukere og utviklere).

---

## 1. Hvorfor én plattform for begge?

| Fordel | Beskrivelse |
|--------|-------------|
| **Én teknisk stack** | Markdown, samme redigeringsflyt, samme deploy-pipeline |
| **Gjenbruk** | Noe innhold (f.eks. integrasjonsoversikt) kan lenkes fra begge målgrupper |
| **Søk på tvers** | Valgfritt: brukere kan søke i alt, eller søk scopet per seksjon |
| **Versjonering** | Docusaurus støtter docs-versioner — nyttig for både produkt- og API-versjoner |
| **Tema og design** | Revizo-visuell identitet én gang; samme komponenter |

**Adskillelse** skjer ved **navigasjon** (ulike sidebar-kategorier) og eventuelt **tilgang** (internt bak auth eller eget subdomene).

---

## 2. To målgrupper, én side

### 2.1 Forslag til struktur

```
revizo-docs/                    # Ett Docusaurus-prosjekt (eget repo eller under /docs-site)
├── docusaurus.config.js
├── sidebars.js                 # To hovedgrener: "For brukere" + "For utviklere" + "Internt"
├── static/img/...
│
├── docs/
│   ├── intro.md                # Velkommen til Revizo-dokumentasjon
│   │
│   ├── kom-i-gang/             # 🟢 Sluttbrukere (kunder)
│   │   ├── _category_.json
│   │   ├── opprett-konto.md
│   │   ├── forste-oppsett.md
│   │   ├── navigere-dashbordet.md
│   │   └── inviter-teammedlemmer.md
│   │
│   ├── guider/                 # 🟢 Oppgavebaserte guider (kunder)
│   │   ├── administrasjon/
│   │   ├── datahandtering/
│   │   │   ├── importere-data.md
│   │   │   ├── eksportere-rapporter.md
│   │   │   └── ...
│   │   ├── avstemming/
│   │   │   ├── smart-match.md
│   │   │   ├── manuell-kobling.md
│   │   │   └── ...
│   │   └── integrasjoner/      # Brukervendte integrasjonsguider
│   │       ├── oversikt.md
│   │       ├── tripletex.md    # "Slik kobler du Tripletex" (forenklet)
│   │       └── ...
│   │
│   ├── utviklere/              # 🔵 API og integrasjoner (eksterne utviklere)
│   │   ├── oversikt.md
│   │   ├── autentisering.md
│   │   ├── api-referanse/
│   │   │   ├── openapi.md      # Eller autogenerert fra OpenAPI
│   │   │   ├── feilkoder.md
│   │   │   └── webhooks.md
│   │   └── eksempler/
│   │
│   ├── faq/                    # 🟡 FAQ (kunder)
│   │   ├── generelt.md
│   │   ├── sikkerhet.md
│   │   └── feilsoking.md
│   │
│   ├── endringslogg/           # 📋 Hva er nytt (kunder + internt)
│   │   └── 2026-q1.md
│   │
│   └── internt/                # 🔒 Kun ansatte (se tilgang under)
│       ├── _category_.json     # label: "Internt"
│       ├── oversikt.md
│       ├── integrasjoner/      # Detaljert teknisk dokumentasjon
│       │   ├── README.md       # Samme innhold som docs/integrations/README.md
│       │   ├── clerk.md
│       │   ├── supabase.md
│       │   ├── anthropic.md
│       │   ├── openai.md
│       │   ├── resend.md
│       │   ├── sentry.md
│       │   └── tripletex.md
│       ├── arkitektur/
│       │   ├── oversikt.md     # Tilsvarer ARCHITECTURE.md
│       │   ├── database.md      # DATABASE.md
│       │   └── api-internt.md  # API.md
│       ├── systemer/
│       │   ├── matching-engine.md
│       │   ├── ai-system.md
│       │   ├── agent-system.md
│       │   ├── import-system.md
│       │   ├── export-system.md
│       │   ├── notifications.md
│       │   ├── design-system.md
│       │   └── utviklingsregler.md
│   └── drifts/
│       ├── setup.md            # SETUP.md
│       ├── vercel-setup.md
│       └── feilsoking-produksjon.md
```

### 2.2 Hva går hvor?

| Innhold | Målgruppe | Plassering i Docusaurus |
|---------|-----------|--------------------------|
| Kom i gang, guider, FAQ, endringslogg | Kunder (sluttbrukere) | `docs/kom-i-gang/`, `docs/guider/`, `docs/faq/`, `docs/endringslogg/` |
| API-referanse, autentisering, webhooks | Eksterne utviklere | `docs/utviklere/` |
| Integrasjoner (detaljert, feilsøking, miljøvariabler) | Ansatte | `docs/internt/integrasjoner/` |
| Arkitektur, database, systemer, design, driftsetup | Ansatte | `docs/internt/arkitektur/`, `docs/internt/systemer/`, `docs/internt/drifts/` |

Kunde-guider for integrasjoner (f.eks. «Slik kobler du Tripletex») bør være **korte, oppgavebaserte** og peke på support ved feil. Den tekniske feilsøkingsdokumentasjonen forblir under **Internt**.

---

## 3. Tilgang på internt innhold

Docusaurus har ikke innebygd brukerstyring. For å skjerme `docs/internt/` har du tre realistiske valg:

### Alternativ A: To deployer fra samme repo (anbefalt)

| Deploy | URL | Innhold | Beskyttelse |
|--------|-----|---------|--------------|
| **Offentlig** | `docs.revizo.no` | Alt unntatt `docs/internt/` | Ingen |
| **Internt** | `internt.revizo.no` eller `docs.revizo.no/internt` | Hele docs inkl. `internt/` | Vercel Password Protection eller Cloudflare Access |

**Teknisk:**  
- I Docusaurus kan du bruke **multi-instance** eller **plugin** som ekskluderer `internt/` fra build for den offentlige deployen.  
- Enklere variant: **to mapper** — f.eks. `docs/` (kun offentlig) i ett repo og `docs-internal/` i samme repo, der den interne builden inkluderer begge. Eller én `docs/` med et build-script som sletter `docs/internt` før build for public.  
- **Vercel:** To prosjekter; samme repo, ulik `root directory` eller miljøvariabel som styrer hvilke filer som inkluderes.

### Alternativ B: Ett deploy, internt bak login

- Bygg én Docusaurus med alt innhold.
- Sett hele docs-siden bak **Vercel Password Protection** (ett passord for alle) eller **Clerk** (egen auth-side som videresender til Docusaurus med token).
- Enklest er ett felles passord for ansatte (Vercel eller Cloudflare Access).

### Alternativ C: Kun offentlig Docusaurus; internt i repo som nå

- Kundedokumentasjon: Docusaurus på `docs.revizo.no`.
- Internt: behold nåværende Markdown i **project_opus/docs/** (inkl. `docs/integrations/`) og les dem i GitHub / Cursor / Confluence.
- Ingen tekniske tiltak for å skjerme «internt» i Docusaurus — det er rett og slett ikke der.

**Anbefaling:** Alternativ A med to deployer gir tydelig adskillelse, god søk internt, og enkel tilgangskontroll (passord eller Cloudflare) på den interne deployen.

---

## 4. Kildemateriale: mapping fra dagens docs

Eksisterende filer i `project_opus/docs/` kan flyttes eller kopieres slik:

| Nåværende fil | Docusaurus (internt) |
|---------------|----------------------|
| `integrations/*.md` | `docs/internt/integrasjoner/` (1:1) |
| `ARCHITECTURE.md` | `docs/internt/arkitektur/oversikt.md` |
| `DATABASE.md` | `docs/internt/arkitektur/database.md` |
| `API.md` | `docs/internt/arkitektur/api-internt.md` |
| `MATCHING_ENGINE.md` | `docs/internt/systemer/matching-engine.md` |
| `AI_SYSTEM.md` | `docs/internt/systemer/ai-system.md` |
| `AGENT_SYSTEM.md` | `docs/internt/systemer/agent-system.md` |
| `IMPORT_SYSTEM.md` | `docs/internt/systemer/import-system.md` |
| `EXPORT_SYSTEM.md` | `docs/internt/systemer/export-system.md` |
| `NOTIFICATIONS.md` | `docs/internt/systemer/notifications.md` |
| `DESIGN_SYSTEM.md` | `docs/internt/systemer/design-system.md` |
| `DEVELOPMENT_RULES_NEW.md` | `docs/internt/systemer/utviklingsregler.md` |
| `SETUP.md` | `docs/internt/drifts/setup.md` |
| `VERCEL_SETUP.md` | `docs/internt/drifts/vercel-setup.md` |
| `SERVICES.md` | Kan slås sammen med `docs/internt/integrasjoner/README.md` eller beholdes som «Tjenester» under drifts |

Dette gjør at dere får **én** Docusaurus med både kunde- og internt innhold, mens dagens repo kan forbli kilde til sannheten for internt innhold til dere kopierer/synkroniserer det inn i Docusaurus-repoet.

---

## 5. Faser tilpasset Revizo

| Fase | Fokus | Tidsestimat |
|------|--------|-------------|
| **1. Oppsett** | Docusaurus 3.x, tema (Revizo-logo/farger), repo, CI/CD (Vercel), mappestruktur som over | Uke 1–2 |
| **2. Internt innhold** | Flytt/ kopier `docs/` og `docs/integrations/` inn i Docusaurus under `docs/internt/`. Sett opp sidebar og eventuelt to deployer (offentlig vs internt). | Uke 2–3 |
| **3. Kjerne for kunder** | Kom i gang, 5–10 guider (import, avstemming, Smart Match, Tripletex-kobling brukervendt), FAQ. Skjermbilder + eventuelt Loom. | Uke 3–6 |
| **4. Utviklere** | API-referanse (OpenAPI), autentisering, webhooks, eksempler. «Prøv det»-utforsker hvis ønskelig. | Uke 5–7 |
| **5. Lansering og vedlikehold** | Algolia DocSearch, «Var denne siden nyttig?», versjonering, brukertest, lansering. Løpende: oppdater ved release, revider skjermbilder. | Uke 8+ |

---

## 6. Praktiske valg

- **Hosting:** Vercel (som i planen) — to prosjekter hvis du kjører A (offentlig + internt).
- **Søk:** Algolia DocSearch — gratis for offentlige docs; for internt kan du bruke Algolia med egen indeks eller Docusaurus sin enkle lokale søk.
- **Versjonering:** Docusaurus docs versioning for produktversjoner og/eller API-versjoner.
- **Repo:** Enten **eget repo** `revizo-docs` (enklest for ikke-utviklere å redigere) eller **under monorepo** `project_opus/docs-site` med CI som bygger og deployer.

---

## 7. Kort oppsummering

- **Én Docusaurus** for både intern og kundedokumentasjon.
- **Navigasjon:** Kom i gang + guider + FAQ + endringslogg (kunder), Utviklere (API), Internt (integrasjoner, arkitektur, systemer, drifts).
- **Tilgang:** To deployer (offentlig vs internt) med passord eller Cloudflare på den interne, eller hele siden bak auth.
- **Eksisterende docs** i `project_opus/docs/` mappes inn under `docs/internt/` slik at ansatte får samme leseopplevelse og søk, og kundene får en tydelig, brukervendt docs-side.

Vil du at jeg skal skissere konkret `sidebars.js` og `docusaurus.config.js` (inkl. hvordan å ekskludere `internt/` for public build), eller sette opp selve Docusaurus-prosjektet under `docs-site/` i repoet?
