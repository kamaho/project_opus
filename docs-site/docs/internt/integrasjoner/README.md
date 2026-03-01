---
title: Integrasjoner — oversikt
sidebar_position: 1
---

# Integrasjoner — Revizo

Denne seksjonen inneholder dedikert dokumentasjon for hver eksterne integrasjon Revizo bruker.
Formålet er at alle ansatte skal kunne lese seg opp, forstå hvordan en integrasjon fungerer,
og vite hvordan de kan feilsøke den hvis noe går galt.

## Oversikt

| Integrasjon | Formål | Kritisk? | Dokumentasjon |
|---|---|---|---|
| **Clerk** | Autentisering og brukerstyring | Ja | [Clerk](/docs/internt/integrasjoner/clerk) |
| **Supabase** | Database (PostgreSQL) og fillagring | Ja | [Supabase](/docs/internt/integrasjoner/supabase) |
| **Anthropic (Claude)** | AI-chatbot og verktøykalling | Nei (degradert opplevelse) | [Anthropic](/docs/internt/integrasjoner/anthropic) |
| **OpenAI** | Embeddings for semantisk søk | Nei (degradert opplevelse) | [OpenAI](/docs/internt/integrasjoner/openai) |
| **Resend** | Transaksjonelle e-poster | Nei (degradert opplevelse) | [Resend](/docs/internt/integrasjoner/resend) |
| **Sentry** | Feilovervåking og observability | Nei (mister innsikt) | [Sentry](/docs/internt/integrasjoner/sentry) |
| **Tripletex** | Synk av regnskapsdata | Nei (manuell import) | [Tripletex](/docs/internt/integrasjoner/tripletex) |

## Kritikalitet

- **Ja** — Applikasjonen fungerer ikke uten denne integrasjonen.
- **Nei (degradert opplevelse)** — Applikasjonen kjører, men funksjonalitet mangler.
- **Nei (manuell import)** — Bruker kan gjøre jobben manuelt uten integrasjonen.

## Miljøvariabler

Alle integrasjoner konfigureres via miljøvariabler. Se `.env.example` i project_opus for komplett liste.
Hver integrasjonsdokument lister sine spesifikke variabler.

## Konvensjoner

- Kode og variabler: Engelsk
- Dokumentasjon og feilmeldinger mot bruker: Norsk (bokmål)
- Alle integrasjoner har graceful degradation — manglende API-nøkler logger en advarsel
  men krasjer ikke applikasjonen (unntatt `DATABASE_URL` og Clerk som er kritiske).
