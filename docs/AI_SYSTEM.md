# Revizo AI — Chatbot og Kunnskapsbase

Revizo AI er en kontekstbevisst chatbot som hjelper brukere med produktstøtte, frister og datastatus. Den bruker Anthropic Claude som LLM, en flerlags kunnskapsbase, og tool calling for å hente live-data.

## Arkitektur

```
SmartPanel (UI)
    │
    └── useAiChat hook → POST /api/ai/chat
                              │
                              ├── 1. Autentisering (Clerk)
                              ├── 2. Rate limiting
                              ├── 3. Query-klassifisering (guardrails)
                              ├── 4. Kontekst-innsamling
                              │     ├── Brukerkontekst (org, rolle, klienter)
                              │     ├── Sidekontekst (URL → seksjon, klientId)
                              │     └── Onboarding-status
                              ├── 5. Kunnskapssøk
                              │     ├── Snippet triggers
                              │     ├── Full-tekst (PostgreSQL FTS)
                              │     ├── FAQ-matching
                              │     ├── Semantisk (embeddings)
                              │     └── Produktguider
                              ├── 6. Prompt-bygging
                              ├── 7. Anthropic API → Claude Sonnet 4
                              ├── 8. Tool execution loop (maks 5 runder)
                              ├── 9. Guardrail-validering av respons
                              └── 10. Lagre samtale i DB
```

## Modell og grenser

| Parameter | Verdi |
|-----------|-------|
| LLM | `claude-sonnet-4-20250514` |
| Embedding-modell | OpenAI `text-embedding-3-small` |
| Maks tokens per respons | 1024 |
| Maks tool-runder | 5 |
| Rate limit | Konfigurerbart per bruker |

## Guardrails

### Query-klassifisering

Alle innkommende meldinger klassifiseres før de sendes til Claude:

| Kategori | Tillatt | Eksempler |
|----------|---------|-----------|
| `product` | Ja | "Hvordan importerer jeg en fil?" |
| `deadline` | Ja | "Når er MVA-fristen?" |
| `client_data` | Ja | "Hvor mange umatchede poster har jeg?" |
| `tax_rule` | Ja (med disclaimer) | "Hva er satsen for MVA?" |
| `off_topic` | Nei | "Skriv et dikt", "Hvem er statsministeren?" |

Off-topic med konfidensgrad > 0.8 returnerer standardsvar uten å kalle Claude.

### Responsvalidering

Etter at Claude svarer, valideres teksten:

1. **Blokkerte mønstre**: Regnskapråd, kreativt innhold, konkurrent-omtale, sensitive data (personnummer, kontonummer) fjernes
2. **Påkrevde disclaimers**: Frist-svar legger til "Verifiser alltid gjeldende frister på skatteetaten.no". Skatteregler legger til kontakt-revisor disclaimer
3. **Lengdeadvarsel**: Responser > 2000 tegn flagges

## Tool Calling

Claude har tilgang til 4 verktøy for å hente live-data:

### `get_client_status`
Henter status for en spesifikk klient (antall transaksjoner, matcher, umatchede per sett).

**Input:** `{ clientId: string }`
**Sikkerhet:** Validerer at klienten tilhører brukerens org.

### `get_upcoming_deadlines`
Henter kommende norske regulatoriske frister.

**Input:** `{ count?: number }` (default 5)
**Kilde:** `regulatory_deadlines`-tabellen.

### `get_unmatched_summary`
Aggregerer umatchede transaksjoner på tvers av alle klienter i organisasjonen.

**Input:** ingen
**Returnerer:** Liste med klientnavn, antall umatchede per sett.

### `navigate_to`
Navigerer brukeren til en spesifikk side i appen.

**Input:** `{ path: string }`
**Implementasjon:** Returnerer path til frontend som trigger en custom `ai-navigate` event.

### Execution loop

```
1. Send melding til Claude med tool-definisjoner
2. Claude svarer med tekst og/eller tool_use-blokker
3. For hver tool_use: kjør executeAction() → resultat
4. Legg tool-resultater til samtalen
5. Send til Claude igjen (med tool-resultater)
6. Gjenta til Claude ikke ber om flere tools (maks 5 runder)
```

## Kunnskapssøk

Flerlagsstrategi kjøres sekvensielt:

### 1. Snippet triggers
Matcher `triggerPhrases` i `knowledge_snippets`-tabellen. Inkluderer alltid snippets med `alwaysInclude = true`.

### 2. Full-tekst søk (FTS)
PostgreSQL `websearch_to_tsquery('norwegian', ...)` mot `knowledge_articles.fts`-kolonnen.

### 3. FAQ-matching
FTS mot `knowledge_faq.question`.

### 4. Semantisk søk (fallback)
Brukes kun hvis < 3 resultater fra steg 1–3:
1. Generer embedding med OpenAI `text-embedding-3-small`
2. Kall PostgreSQL-funksjon `match_knowledge(embedding, threshold=0.7, limit=5)`
3. Returnerer artikler over similarity-terskel

### 5. Produktguider
Kun for "how to"-spørringer. FTS mot `product_guides` tittel/beskrivelse.

Resultater dedupliseres og begrenses til 5 (konfigurerbart).

## System Prompt

Bygges dynamisk med kontekst:

1. **Base-regler** — 7 faste regler:
   - Kun produktassistent (ikke regnskapsrådgiver)
   - Ingen juridisk/regnskapsrådgivning
   - Ingen fabrikasjon (innrøm manglende info)
   - Hold deg innenfor Revizo
   - Profesjonell og nøytral
   - Beskytt brukerdata (org-scoped)
   - Kildeangivelser

2. **Brukerkontekst** — Navn, org, rolle, antall klienter

3. **Sidekontekst** — Nåværende URL, seksjon, aktiv klient

4. **Modus** — `"support"` (normal) eller `"onboarding"` (ny bruker)

5. **Kunnskapsresultater** — Relevante artikler, snippets, FAQ

6. **Brukerminne** — Tidligere kontekst fra `ai_user_memory`

## Onboarding-integrasjon

Nye brukere (som ikke har fullført onboarding) får modus `"onboarding"`. System prompten inkluderer da ekstra veiledningsinstruksjoner.

**Onboarding-milepæler:**
1. Profil fullført
2. Første klient opprettet
3. Bank tilkoblet
4. Første matching kjørt
5. Team invitert
6. Varsler konfigurert

`getNextOnboardingStep()` returnerer neste ufullførte steg som hint til Claude.

## AI User Memory

Per-bruker, per-org minne lagret i `ai_user_memory`:

- `memoryType` — Type minne (f.eks. "preference", "context")
- `content` — Fritekst
- `confidence` — 0.00–1.00
- `lastRelevantAt` — Sist brukt
- `expiresAt` — Utløpsdato (nullable)

Hentes ved hver samtale og inkluderes i system prompten.

## Samtalelagring

Samtaler lagres i `ai_conversations`:

| Felt | Beskrivelse |
|------|-------------|
| `messages` | JSON-array med alle meldinger |
| `mode` | `support` / `onboarding` |
| `pageContext` | URL der samtalen startet |
| `toolsUsed` | Verktøy som ble brukt |
| `tokensUsed` | Token-forbruk |
| `rating` | Brukerrating (nullable) |
| `feedback` | Fritekst-feedback (nullable) |

## UI-komponent

**Smart Panel** (`src/components/smart-panel/smart-panel.tsx`):
- Kontekstuelt hjelpepanel som åpnes via høyreklikk eller knapp
- Draggable, pinbar
- Inneholder `AgentChatView` med full chat-grensesnitt
- Foreslåtte spørsmål
- Auto-scroll og fokushåndtering

**useAiChat hook** (`src/hooks/use-ai-chat.ts`):
- Kaller `/api/ai/chat` med meldinger, samtale-ID, sidekontekst
- Håndterer `ai-navigate` custom events for navigasjon
- Administrerer lokal meldingstilstand

## Databasetabeller

- **`knowledge_articles`** — Artikler med FTS-indeks
- **`knowledge_snippets`** — Raske fakta med trigger-fraser
- **`knowledge_faq`** — FAQ med spørsmålsvarianter
- **`product_guides`** — Steg-for-steg guider
- **`regulatory_deadlines`** — Norske regulatoriske frister
- **`ai_user_memory`** — Brukerminne per org
- **`ai_conversations`** — Samtalehistorikk

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `src/lib/ai/types.ts` | Typer og interfaces |
| `src/lib/ai/system-prompt.ts` | Prompt-bygging |
| `src/lib/ai/guardrails.ts` | Query-klassifisering, responsvalidering |
| `src/lib/ai/actions.ts` | Tool-definisjoner og execution |
| `src/lib/ai/knowledge-search.ts` | Flerlags kunnskapssøk |
| `src/lib/ai/embeddings.ts` | OpenAI embedding-generering |
| `src/lib/ai/context.ts` | Bruker- og sidekontekst |
| `src/lib/ai/onboarding.ts` | Onboarding-status og neste steg |
| `src/app/api/ai/chat/route.ts` | Chat API-endepunkt |
| `src/components/smart-panel/smart-panel.tsx` | UI-komponent |
| `src/hooks/use-ai-chat.ts` | React hook for chat |
