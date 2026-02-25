# API-referanse

Alle API-ruter ligger under `src/app/api/` og bruker Next.js Route Handlers. Alle ruter krever autentisering via Clerk med mindre annet er oppgitt.

## Autentisering

Alle endepunkter kjører `await auth()` fra `@clerk/nextjs/server` og krever:
- `userId` — innlogget bruker
- `orgId` — aktiv organisasjon

Returnerer `401 Unauthorized` hvis bruker ikke er innlogget, eller `403 Forbidden` hvis bruker ikke har tilgang til ressursen.

---

## Selskaper og klienter

### GET /api/companies

Lister selskaper for organisasjonen.

**Respons:** `[{ "id": "uuid", "name": "Selskap AS" }]`

---

### GET /api/clients

Lister klienter (avstemmingsenheter).

| Param | Type | Beskrivelse |
|-------|------|-------------|
| `companyId` | uuid | Filtrer på selskap (valgfri) |

**Respons:** `[{ "id": "uuid", "name": "Klient 1", "companyId": "uuid" }]`

---

### GET /api/clients/[clientId]

Henter grunnleggende klientinfo.

**Respons:** `{ "id": "uuid", "name": "Klient 1", "companyId": "uuid" }`

---

### PATCH /api/clients/[clientId]

Oppdaterer klientinfo (f.eks. gi nytt navn til en konto).

---

### PATCH /api/clients/[clientId]/balance

Oppdaterer inngående balanse for en klient.

**Body:**
```json
{
  "openingBalanceSet1": "1000.00",
  "openingBalanceSet2": "1000.00",
  "openingBalanceDate": "2026-01-01"
}
```

---

## Filimport

### POST /api/import

Importerer en fil med transaksjoner.

**Content-Type:** `multipart/form-data`

| Felt | Type | Påkrevd | Beskrivelse |
|------|------|---------|-------------|
| `file` | File | Ja | Filen som skal importeres |
| `clientId` | string | Ja | UUID til klienten |
| `setNumber` | "1" \| "2" | Ja | Sett 1 (hovedbok) eller sett 2 (bank) |
| `parserType` | string | Ja | "csv", "excel", "camt", eller "klink" |
| `csvConfig` | JSON | Betinget | Påkrevd for CSV |
| `excelConfig` | JSON | Betinget | Påkrevd for Excel |
| `klinkSpec` | string | Betinget | Påkrevd for Klink |

**Suksess (200):**
```json
{ "importId": "uuid", "recordCount": 142, "errors": [] }
```

Se [IMPORT_SYSTEM.md](IMPORT_SYSTEM.md) for detaljer om filtyper og wizard-flyt.

---

### GET /api/clients/[clientId]/imports

Lister alle importer for en klient, inkludert soft-deleted med gjenværende dager.

---

## Transaksjoner

### POST /api/clients/[clientId]/transactions

Oppretter en manuell transaksjon (åpningspost).

**Body:**
```json
{
  "setNumber": 1,
  "amount": "500.00",
  "date1": "2026-01-15",
  "description": "Manuell post",
  "reference": "REF-001"
}
```

---

### PATCH /api/clients/[clientId]/transactions/[transactionId]

Oppdaterer en manuell transaksjon (kun tillatt for transaksjoner uten `importId`).

---

### DELETE /api/clients/[clientId]/transactions/[transactionId]

Sletter en manuell transaksjon.

---

### PATCH /api/clients/[clientId]/transactions/[transactionId]/note

Oppdaterer eller fjerner et notat på en transaksjon. Støtter @-mentions av brukere som trigger varsler.

**Body:**
```json
{
  "notat": "Sjekk med @BrukerNavn",
  "notatAuthor": "user_clerk_id",
  "mentionedUserId": "mentioned_clerk_id"
}
```

---

### PATCH /api/clients/[clientId]/transactions/bulk-note

Oppdaterer notater på flere transaksjoner samtidig.

---

## Vedlegg

### GET /api/clients/[clientId]/transactions/[transactionId]/attachments

Lister vedlegg for en transaksjon.

---

### POST /api/clients/[clientId]/transactions/[transactionId]/attachments

Laster opp filer som vedlegg til en transaksjon.

**Content-Type:** `multipart/form-data`

---

### DELETE /api/clients/.../attachments/[attachmentId]

Sletter et vedlegg.

---

### GET /api/clients/.../attachments/[attachmentId]/download

Genererer en signert nedlastings-URL for et vedlegg.

---

## Matching

### POST /api/clients/[clientId]/auto-match

Kjører Smart Match-pipelinen.

| Param | Type | Beskrivelse |
|-------|------|-------------|
| `mode` | "preview" \| "commit" | Preview (kun stats) eller commit (skriv matcher til DB) |

**Preview-respons:**
```json
{
  "totalMatches": 42,
  "totalTransactions": 96,
  "byRule": [{ "ruleId": "uuid", "ruleName": "1:1 beløp+dato", "matchCount": 30, "transactionCount": 60 }],
  "durationMs": 234
}
```

Se [MATCHING_ENGINE.md](MATCHING_ENGINE.md) for detaljer om matching-pipelinen.

---

### POST /api/clients/[clientId]/matching

Oppretter en manuell match fra valgte transaksjoner.

**Body:**
```json
{
  "set1Ids": ["uuid1", "uuid2"],
  "set2Ids": ["uuid3"]
}
```

---

### DELETE /api/clients/[clientId]/matching

Opphever matcher.

| Param | Type | Beskrivelse |
|-------|------|-------------|
| `matchId` | uuid | Opphev enkeltmatch |
| `all` | "true" | Opphev alle matcher for klienten |
| `transactionId` | uuid | Fjern transaksjon fra match |

---

### GET /api/clients/[clientId]/matching-rules

Lister matching-regler for klienten, sortert etter prioritet.

---

### POST /api/clients/[clientId]/matching-rules

Oppretter en ny matching-regel.

---

### PATCH /api/clients/[clientId]/matching-rules?ruleId=uuid

Oppdaterer en matching-regel.

---

### DELETE /api/clients/[clientId]/matching-rules?ruleId=uuid

Sletter en matching-regel.

---

### POST /api/clients/[clientId]/matching-rules/seed

Genererer standard regelsettet (10 regler) for en klient.

---

## Eksport

### POST /api/export

Genererer PDF- eller XLSX-rapport.

**Body:**
```json
{
  "module": "matching",
  "format": "pdf",
  "matchingParams": {
    "clientId": "uuid",
    "reportType": "open",
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31"
  }
}
```

Se [EXPORT_SYSTEM.md](EXPORT_SYSTEM.md) for detaljer.

---

## Varsler

### GET /api/notifications

Lister varsler for innlogget bruker.

| Param | Type | Beskrivelse |
|-------|------|-------------|
| `unread` | "true" | Kun uleste |
| `limit` | number | Maks antall (default 50, max 100) |

---

### PATCH /api/notifications/[id]

Markerer et varsel som lest.

---

### POST /api/notifications/read-all

Markerer alle uleste varsler som lest.

---

## AI

### POST /api/ai/chat

Sender melding til Revizo AI-chatbot.

**Body:**
```json
{
  "messages": [{ "role": "user", "content": "Hva er MVA-fristen?" }],
  "conversationId": "uuid (valgfri)",
  "pageContext": "/dashboard/clients/uuid"
}
```

**Respons:**
```json
{
  "content": "MVA-fristen for...",
  "conversationId": "uuid"
}
```

Se [AI_SYSTEM.md](AI_SYSTEM.md) for detaljer om guardrails, tool calling og kunnskapssøk.

---

## Revizo Agent

### GET /api/clients/[clientId]/agent-config

Returnerer gjeldende agent-konfigurasjon for klienten. Returnerer defaults hvis ingen config eksisterer.

---

### PUT /api/clients/[clientId]/agent-config

Oppretter eller oppdaterer agent-konfigurasjon. Beregner automatisk `nextMatchRun` og `nextReportRun`.

**Body:**
```json
{
  "enabled": true,
  "reportTypes": ["open_items"],
  "smartMatchEnabled": true,
  "smartMatchSchedule": "weekly_mon",
  "reportSchedule": "monthly_1",
  "specificDates": ["2026-06-30"],
  "preferredTime": "03:00"
}
```

---

### GET /api/clients/[clientId]/agent-logs

Returnerer de siste 20 kjøringsloggene for klienten.

---

## Helse

### GET /api/health

Helsesjekk som verifiserer databasetilkobling. Ingen autentisering påkrevd.

---

## Validering

Alle API-ruter bruker **Zod** for input-validering. Ved valideringsfeil returneres:

```json
{
  "error": "Validering feilet",
  "details": "clientId: Invalid uuid",
  "errors": ["clientId: Invalid uuid"]
}
```
