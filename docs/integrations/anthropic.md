# Anthropic (Claude) — AI-chatbot

## Oversikt

Revizo bruker Anthropic sitt Claude-modell som AI-assistent. Assistenten heter «Revizo AI»
og hjelper brukere med regnskapsrelaterte spørsmål, kjøring av Smart Match, og generering
av rapporter — alt via en chat-grensesnitt i appen.

Integrasjonen bruker Claude sin **tool calling**-funksjonalitet, som lar AI-en utføre
handlinger i systemet (f.eks. kjøre Smart Match, sende rapporter på e-post).

## Arkitektur

```
Bruker (chat UI) → POST /api/ai/chat → Claude API (tool calling)
                                            ↓
                                    Utfører handlinger via tools
                                    (Smart Match, DB-queries, e-post)
                                            ↓
                                    Svar tilbake til bruker
```

### Flyten i detalj

1. Bruker sender melding via chat-panelet
2. Server henter kontekst: brukerinfo, side-kontekst, knowledge base, bruker-minner
3. System prompt bygges med all kontekst
4. Meldingen sendes til Claude med tools tilgjengelig
5. Claude kan kalle tools (opptil 5 runder med tool calling)
6. Svar med eventuelle actions returneres til frontend
7. Samtalen lagres i `ai_conversations`-tabellen

### Guardrails

- **Off-topic filter**: Meldinger som ikke er relevante for regnskap/Revizo avvises
- **Response validation**: Svar sjekkes for innhold som bryter med retningslinjer
- **Rate limiting**: Maks antall forespørsler per bruker per tidsvindu

## Filer i kodebasen

| Fil | Beskrivelse |
|---|---|
| `src/app/api/ai/chat/route.ts` | API-endepunkt for chat (POST) |
| `src/lib/ai/system-prompt.ts` | Bygger system prompt med kontekst |
| `src/lib/ai/context.ts` | Henter bruker- og side-kontekst |
| `src/lib/ai/actions.ts` | Tool-definisjoner og handlingsutførelse |
| `src/lib/ai/guardrails.ts` | Off-topic filtrering og respons-validering |
| `src/lib/ai/knowledge-search.ts` | Søk i kunnskapsbase (FTS + embeddings) |
| `src/lib/ai/types.ts` | TypeScript-typer for chat-forespørsler |
| `src/hooks/use-ai-chat.ts` | Frontend-hook for chat-funksjonalitet |

## Miljøvariabler

| Variabel | Beskrivelse | Påkrevd |
|---|---|---|
| `ANTHROPIC_API_KEY` | API-nøkkel for Anthropic | Ja (for AI-chat) |

## Modell

| Parameter | Verdi |
|---|---|
| Modell | `claude-sonnet-4-20250514` |
| Max tokens | 1024 |
| Max tool-runder | 5 |

## Tool Calling

Claude har tilgang til følgende verktøy (definert i `src/lib/ai/actions.ts`):

| Tool | Beskrivelse |
|---|---|
| `run_smart_match` | Kjører Smart Match for en klient |
| `send_report_email` | Sender rapport på e-post |
| (andre tools) | Se `TOOL_DEFINITIONS` i `actions.ts` for komplett liste |

Når Claude bruker et tool, logger vi verktøyet og lagrer det i `ai_conversations.toolsUsed`.

## Knowledge Base

AI-en har tilgang til en kunnskapsbase via semantisk søk:

1. **Full-text search (FTS)** — PostgreSQL tsvector-søk
2. **Embedding-søk** — Via OpenAI embeddings (se [openai.md](./openai.md))

Kunnskapsbasen seedes via `scripts/seed-knowledge.ts` og inneholder informasjon om
regnskapsprosesser, Revizo-funksjonalitet, og vanlige spørsmål.

## Bruker-minner

Systemet husker tidligere interaksjoner og preferanser per bruker. Disse hentes fra
`getUserMemories()` og inkluderes i system prompt.

## Samtalelagring

Alle samtaler lagres i `ai_conversations`-tabellen med:
- Fullstendig meldingshistorikk
- Modus (support / onboarding)
- Verktøy brukt
- Token-forbruk
- Side-kontekst

## Feilsøking

### AI svarer ikke / timeout

1. Sjekk at `ANTHROPIC_API_KEY` er satt og gyldig
2. Sjekk Anthropic status-side: https://status.anthropic.com
3. Se server-logger for `[AI Chat] Error:`
4. Sjekk rate limiting — bruker kan ha nådd grensen

### AI gir irrelevante svar

1. Sjekk at system prompt bygges korrekt (`buildSystemPrompt`)
2. Sjekk at knowledge base er seeded (`scripts/seed-knowledge.ts`)
3. Sjekk at kontekst hentes riktig (brukerinfo, side-kontekst)

### Tool calling feiler

1. Se logger for feil i `executeAction()`
2. Sjekk at brukeren har rettigheter til handlingen (orgId/userId)
3. Sjekk at klienten/dataen som refereres eksisterer

### «For mange forespørsler» (429)

Rate limiting er aktiv. Brukeren må vente før neste forespørsel.
Konfigurert via `RATE_LIMITS.aiChat` i `src/lib/rate-limit.ts`.

### Høye kostnader

1. Sjekk token-forbruk i `ai_conversations.tokensUsed`
2. Se om tool calling-loops oppstår (maks 5 runder som sikkerhet)
3. Vurder å justere `max_tokens` eller modellvalg

## Anthropic Console

URL: https://console.anthropic.com

Her kan du:
- Se API-forbruk og kostnader
- Administrere API-nøkler
- Se rate limits og kvoter
- Overvåke forespørsler

## Viktig å vite

- AI-chat er **ikke kritisk** — appen fungerer fullt uten, men mister chatbot-funksjonalitet
- Token-forbruk logges per samtale for kostnadsovervåking
- Off-topic guardrails hindrer misbruk (f.eks. kodegenerering, oppskrifter, etc.)
- Claude har **ikke** direkte tilgang til databasen — alt går via definerte tools
- System prompt inneholder brukerens navn, organisasjon, og kontekst fra siden de er på
