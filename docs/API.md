# API-referanse

Alle API-ruter ligger under `src/app/api/` og bruker Next.js Route Handlers. Alle ruter krever autentisering via Clerk med mindre annet er oppgitt.

## Autentisering

Alle endepunkter kjører `await auth()` fra `@clerk/nextjs/server` og krever:
- `userId` — innlogget bruker
- `orgId` — aktiv organisasjon

Returnerer `401 Unauthorized` hvis bruker ikke er innlogget, eller `403 Forbidden` hvis bruker ikke har tilgang til ressursen.

---

## Endepunkter

### GET /api/companies

Lister selskaper for organisasjonen.

**Respons:**
```json
[
  { "id": "uuid", "name": "Selskap AS" }
]
```

---

### GET /api/clients

Lister klienter (avstemmingsenheter).

**Query-parametere:**
| Param       | Type   | Beskrivelse                          |
|-------------|--------|--------------------------------------|
| `companyId` | uuid   | Filtrer på selskap (valgfri)         |

**Respons:**
```json
[
  { "id": "uuid", "name": "Klient 1", "companyId": "uuid" }
]
```

---

### GET /api/clients/[clientId]

Henter grunnleggende klientinfo (brukes til breadcrumbs).

**Respons:**
```json
{ "id": "uuid", "name": "Klient 1", "companyId": "uuid" }
```

---

### DELETE /api/clients/[clientId]/matching

Sletter alle importerte transaksjoner for ett sett.

**Query-parametere:**
| Param       | Type   | Beskrivelse          |
|-------------|--------|----------------------|
| `setNumber` | 1 \| 2 | Hvilket sett å slette |

**Respons:**
```json
{ "ok": true }
```

---

### POST /api/import

Importerer en fil med transaksjoner.

**Content-Type:** `multipart/form-data`

**FormData-felter:**

| Felt          | Type    | Påkrevd | Beskrivelse                                    |
|---------------|---------|---------|------------------------------------------------|
| `file`        | File    | Ja      | Filen som skal importeres                      |
| `clientId`    | string  | Ja      | UUID til klienten                              |
| `setNumber`   | "1"\|"2"| Ja      | Sett 1 (hovedbok) eller sett 2 (bank)          |
| `parserType`  | string  | Ja      | "csv", "excel", "camt", eller "klink"          |
| `csvConfig`   | JSON    | Betinget| Påkrevd for CSV. Se CsvParserConfig.            |
| `excelConfig` | JSON    | Betinget| Påkrevd for Excel. Se ExcelParserConfig.        |
| `klinkSpec`   | string  | Betinget| Påkrevd for Klink. Spec-tekst.                  |

**CsvParserConfig (JSON):**
```json
{
  "delimiter": ";",
  "decimalSeparator": ",",
  "hasHeader": true,
  "columns": { "date1": 0, "amount": 3, "reference": 1 },
  "dataStartRow": 0
}
```

**ExcelParserConfig (JSON):**
```json
{
  "dataStartRow": 1,
  "columns": { "date1": 0, "amount": 2 },
  "dateFormats": { "date1": "DD.MM.YYYY" }
}
```

**Suksess-respons (200):**
```json
{
  "importId": "uuid",
  "recordCount": 142,
  "errors": [],
  "warning": "Filen ble ikke lagret i cloud, men transaksjonene er importert."
}
```

**Feil-responser:**
- `400` — Validering feilet / manglende kolonnemapping / fil uten transaksjoner
- `401` — Ikke autentisert
- `403` — Ikke tilgang til klienten
- `404` — Klient finnes ikke
- `500` — Uventet serverfeil

**Import-flyt på serveren:**
1. Validerer input med Zod-schema
2. Verifiserer at bruker har tilgang til klienten via org → company → client
3. For Excel: sjekker at date1 + amount (eller credit+debit) er mappet
4. Laster opp filen til Supabase Storage (`imports`-bucket)
5. Parser filen med riktig parser
6. Oppretter import-rad i `imports`-tabellen
7. Setter inn transaksjoner i `transactions`-tabellen
8. Oppdaterer import-status til "completed"

---

## Validering

Alle API-ruter bruker **Zod** for input-validering. Valideringsskjemaer er definert i starten av hver route-fil. Ved valideringsfeil returneres:

```json
{
  "error": "Validering feilet",
  "details": "clientId: Invalid uuid",
  "errors": ["clientId: Invalid uuid"]
}
```
