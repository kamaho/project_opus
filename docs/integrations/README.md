# Integrasjoner — Revizo

Denne mappen inneholder dedikert dokumentasjon for hver eksterne integrasjon Revizo bruker.
Formålet er at alle ansatte skal kunne lese seg opp, forstå hvordan en integrasjon fungerer,
og vite hvordan de kan feilsøke den hvis noe går galt.

## Oversikt

| Integrasjon | Formål | Kritisk? | Dokumentasjon |
|---|---|---|---|
| **Clerk** | Autentisering og brukerstyring | Ja | [clerk.md](./clerk.md) |
| **Supabase** | Database (PostgreSQL) og fillagring | Ja | [supabase.md](./supabase.md) |
| **Anthropic (Claude)** | AI-chatbot og verktøykalling | Nei (degradert opplevelse) | [anthropic.md](./anthropic.md) |
| **OpenAI** | Embeddings for semantisk søk | Nei (degradert opplevelse) | [openai.md](./openai.md) |
| **Resend** | Transaksjonelle e-poster | Nei (degradert opplevelse) | [resend.md](./resend.md) |
| **Sentry** | Feilovervåking og observability | Nei (mister innsikt) | [sentry.md](./sentry.md) |
| **Tripletex** | Synk av regnskapsdata | Nei (manuell import) | [tripletex.md](./tripletex.md) |

## Kritikalitet

- **Ja** — Applikasjonen fungerer ikke uten denne integrasjonen.
- **Nei (degradert opplevelse)** — Applikasjonen kjører, men funksjonalitet mangler.
- **Nei (manuell import)** — Bruker kan gjøre jobben manuelt uten integrasjonen.

## Miljøvariabler

Alle integrasjoner konfigureres via miljøvariabler. Se `.env.example` for komplett liste.
Hver integrasjonsdokument lister sine spesifikke variabler.

## Konvensjoner

- Kode og variabler: Engelsk
- Dokumentasjon og feilmeldinger mot bruker: Norsk (bokmål)
- Alle integrasjoner har graceful degradation — manglende API-nøkler logger en advarsel
  men krasjer ikke applikasjonen (unntatt `DATABASE_URL` og Clerk som er kritiske).
