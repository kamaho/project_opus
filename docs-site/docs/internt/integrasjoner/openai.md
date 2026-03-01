---
title: OpenAI — Embeddings
sidebar_position: 5
---


## Oversikt

OpenAI brukes **kun** for å generere embeddings (vektorrepresentasjoner av tekst) som
brukes i AI-assistentens kunnskapsbase. Vi bruker **ikke** OpenAI for chat eller
tekstgenerering — det håndteres av Anthropic (Claude).

Embeddings muliggjør semantisk søk: i stedet for eksakt nøkkelordmatch, kan systemet
finne innhold som er *meningsrelatert* til brukerens spørsmål.

## Arkitektur

```
Bruker stiller spørsmål i chat
        ↓
Spørsmålet konverteres til embedding (OpenAI)
        ↓
Embedding sammenlignes med kunnskapsbase-vektorer (pgvector)
        ↓
Mest relevante artikler inkluderes i system prompt
        ↓
Claude genererer svar basert på konteksten
```

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/lib/ai/embeddings.ts` | Generering av embeddings (singel og batch) |
| `src/lib/ai/knowledge-search.ts` | Søk i kunnskapsbase med embeddings |
| `scripts/seed-knowledge.ts` | Seeder kunnskapsbasen med embeddings |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|---|---|---|
| `OPENAI_API_KEY` | API-nøkkel for OpenAI | Ja (for kunnskapssøk) |

## Modell

| Parameter | Verdi |
|---|---|
| Modell | `text-embedding-3-small` |
| Max input | 8000 tegn (trunkeres automatisk) |
| Dimensjoner | 1536 (standard for text-embedding-3-small) |

## Nøkkelfunksjoner

### Generer embedding for én tekst

```typescript
import { generateEmbedding } from "@/lib/ai/embeddings";

const vector = await generateEmbedding("Hvordan fungerer mva-avstemming?");
// Returnerer number[] med 1536 dimensjoner
```

### Generer embeddings for flere tekster (batch)

```typescript
import { generateEmbeddings } from "@/lib/ai/embeddings";

const vectors = await generateEmbeddings([
  "Tekst 1",
  "Tekst 2",
  "Tekst 3",
]);
// Returnerer number[][] — én vektor per tekst, sortert etter input-rekkefølge
```

### Lazy initialisering

OpenAI-klienten opprettes først ved første bruk (lazy). Hvis `OPENAI_API_KEY` mangler,
kastes en feil ved første kall — ikke ved oppstart.

## Kunnskapsbase

Kunnskapsbasen lagres i PostgreSQL med `pgvector`-utvidelsen for vektorsøk.

### Seeding

```bash
npx tsx scripts/seed-knowledge.ts
```

Dette scriptet:
1. Leser kunnskapsartikler
2. Genererer embeddings via OpenAI
3. Lagrer artiklene med embeddings i databasen

### Søk

Når en bruker stiller et spørsmål i chatten:
1. Spørsmålet konverteres til en embedding
2. pgvector finner de nærmeste vektorene (cosine similarity)
3. De mest relevante artiklene inkluderes som kontekst til Claude

## Feilsøking

### Kunnskapssøk returnerer irrelevante resultater

1. Sjekk at kunnskapsbasen er seeded: `scripts/seed-knowledge.ts`
2. Sjekk at `pgvector`-utvidelsen er aktivert i Supabase
3. Prøv å re-seede kunnskapsbasen (nye embeddings)

### «OPENAI_API_KEY is not set»

1. Sjekk at miljøvariabelen `OPENAI_API_KEY` er satt
2. Sjekk at nøkkelen er gyldig på https://platform.openai.com/api-keys
3. Merk: Feilen oppstår kun ved første kall, ikke ved oppstart

### Trege søk

1. Sjekk at pgvector-indekser er opprettet (se `DATABASE.md`)
2. Sjekk at embeddings-tabellen ikke er urimelig stor
3. OpenAI API kan ha latency — sjekk https://status.openai.com

### Høye kostnader

- `text-embedding-3-small` er en av de billigste modellene
- Batch-kall er mer effektive enn individuelle kall
- Embeddings genereres kun ved seeding og per spørsmål (ikke per samtale-melding)

## OpenAI Dashboard

URL: https://platform.openai.com

Her kan du:
- Se API-forbruk og kostnader
- Administrere API-nøkler
- Se rate limits

## Viktig å vite

- OpenAI brukes **kun** for embeddings — **ikke** for chat/tekstgenerering
- Hvis OpenAI er nede, fungerer chatten fortsatt — bare uten kunnskapsbasert kontekst
- Tekst trunkeres til 8000 tegn før embedding-generering
- Embedding-dimensjonene er 1536 — dette må matche pgvector-kolonnen i databasen
