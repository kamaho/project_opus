# Matching Engine — Smart Match

Smart Match er kjernen i Revizo. Motoren matcher transaksjoner fra to sett (f.eks. hovedbok vs. bankutskrift) basert på konfigurerbare regler med prioritet og scoring.

## Arkitektur

```
engine.ts          → Offentlig API: previewAutoMatch(), runAutoMatch()
    │
    ├── Laster data fra DB (unmatched transactions + regler)
    │
    └── pipeline.ts    → Kjører regler i prioritetsrekkefølge
            │
            ├── indexer.ts   → Bygger hash-indekser (O(1) oppslag)
            ├── scorer.ts    → Beregner 0–100 konfidenspoeng
            └── rules/*.ts   → Regelhandlere (1:1, N:1, N:N)
                    │
                    └── selector.ts → Greedy ikke-overlappende utvelgelse
```

## Dataflyt

```
1. Bruker klikker "Smart Match" → POST /api/clients/[clientId]/auto-match
2. engine.ts: Hent umatchede transaksjoner + aktive regler fra DB
3. indexer.ts: Konverter til IndexedTransaction (beløp → øre, dato → epoch-dag)
4. indexer.ts: Bygg hash-indekser (byAmount, byDate, byAmountDate, byId)
5. pipeline.ts: Initialiser kontekst med umatchede pools (Map)
6. For hver regel (sortert etter prioritet, lavest = viktigst):
   a. Velg handler basert på regeltype (1:1, N:1, N:N) og isInternal
   b. Handler bruker indekser for å finne kandidater
   c. Filtrer etter dato, beløp, toleranse og feltvbetingelser
   d. scorer.ts: Beregn poeng for hver kandidat
   e. selector.ts: Velg best mulige ikke-overlappende matcher
   f. Fjern matchede transaksjoner fra umatchede pools
7. engine.ts: Skriv matcher til DB i én transaksjon
8. Returner stats + matchgrupper for UI-animasjon
```

## Kjernekonsepter

### Indekserte transaksjoner

Alle beløp konverteres til **øre** (heltall) for å unngå flyttallsfeil. Datoer konverteres til **epoch-dager** (heltall, dager siden 1970-01-01) for rask aritmetikk.

```typescript
interface IndexedTransaction {
  id: string;
  setNumber: 1 | 2;
  amountOre: number;          // Math.round(amount * 100)
  foreignAmountOre: number | null;
  date: number;                // Epoch-dag
  date2: number | null;
  reference: string | null;
  description: string | null;
  textCode: string | null;
  accountNumber: string | null;
  currency: string;
  dimensions: Record<string, string | null>;  // dim1–dim10
}
```

### Hash-indekser

Bygges i O(n) for raske oppslag:

| Indeks | Nøkkel | Verdi |
|--------|--------|-------|
| `byAmount` | `amountOre` | `Set<transactionId>` |
| `byDate` | `epoch-dag` | `Set<transactionId>` |
| `byAmountDate` | `"${amountOre}\|${epochDay}"` | `Set<transactionId>` |
| `byId` | `transactionId` | `IndexedTransaction` |

## Regeltyper

| Type | Beskrivelse | Eksempel |
|------|-------------|----------|
| `one_to_one` | 1 transaksjon fra sett 1 → 1 fra sett 2 | Banktransaksjon matcher bilag |
| `many_to_one` | N transaksjoner fra sett 1 → 1 fra sett 2 (eller omvendt) | Flere delposteringer matcher én betaling |
| `many_to_many` | N fra sett 1 → M fra sett 2 | Gruppe av fakturaer matcher gruppe av betalinger |

Hver regel kan også være **intern** (`isInternal: true`) — matcher transaksjoner innenfor samme sett.

## Feltbetingelser (conditions)

Regler kan ha ekstra betingelser i JSONB-formatet:

```typescript
interface FieldCondition {
  field: string;                    // f.eks. "reference", "description", "dim1"
  operator: "equals" | "contains" | "starts_with";
  compareField?: string;            // Sammenlign mot felt på motsatt side
  value?: string;                   // Eller sammenlign mot literal verdi
}
```

## Scoring (0–100)

Hvert matchkandidat scores for å prioritere kvalitet:

| Komponent | Vekt | Logikk |
|-----------|------|--------|
| **Beløp** | 40 | Eksakt = full poeng. Med toleranse: lineær nedtrapping |
| **Dato** | 30 | Samme dag = full. Med toleranse: lineær nedtrapping per dag |
| **Referanse** | 15 | Eksakt = 1.0, delvis (contains) = 0.5, ellers 0 |
| **Beskrivelse** | 10 | Samme logikk som referanse |
| **Antall** | 5 | 1:1 = full. Grupper: straff for store grupper |

For grupper (N:1, N:N) beregnes dato- og tekstpoeng som gjennomsnitt/best av parvise sammenligninger.

### Utvelgelse

Greedy-algoritme: sorterer kandidater etter score (synkende) og aksepterer den neste kandidaten som ikke overlapper med allerede valgte transaksjoner.

## Ytelsesgrenser

| Parameter | Verdi | Formål |
|-----------|-------|--------|
| `RULE_TIME_LIMIT_MS` | 5 000 ms | Advarsel hvis en regel tar for lang tid |
| `EXPENSIVE_RULE_POOL_LIMIT` | 5 000 | N:1/N:N-regler hoppes over ved store pools |

## Offentlig API

### `previewAutoMatch(clientId)`

Kjører hele pipelinen uten å skrive til databasen. Returnerer kun statistikk.

```typescript
interface AutoMatchStats {
  totalMatches: number;
  totalTransactions: number;
  byRule: { ruleId: string; ruleName: string; matchCount: number; transactionCount: number }[];
  durationMs: number;
}
```

### `runAutoMatch(clientId, userId)`

Kjører pipelinen og commiter alle matcher i én databasetransaksjon.

```typescript
interface AutoMatchResult extends AutoMatchStats {
  matchGroups: [string[], string[]][];  // [set1Ids, set2Ids] per match
}
```

DB-operasjoner:
1. Bulk insert i `matches`-tabellen (`matchType = 'auto'`)
2. Bulk oppdatering av `transactions` (`match_id`, `match_status = 'matched'`)

## Filreferanser

| Fil | Innhold |
|-----|---------|
| `src/lib/matching/engine.ts` | Offentlig API, datalasting, DB-commit |
| `src/lib/matching/pipeline.ts` | Regelkjøring, kontekst, handler-resolving |
| `src/lib/matching/indexer.ts` | Hash-indeksbygging, øre/epoch-konvertering |
| `src/lib/matching/scorer.ts` | Konfidensberegning (0–100) |
| `src/lib/matching/types.ts` | Alle typer og interfaces |
| `src/lib/matching/rules/` | Regelhandlere per type |

## Databasetabeller

- **`matches`** — Én rad per matchgruppe (auto/manual, differanse, tidspunkt)
- **`transactions`** — `match_id` og `match_status` oppdateres ved match
- **`matching_rules`** — Konfigurerbare regler per klient/tenant
