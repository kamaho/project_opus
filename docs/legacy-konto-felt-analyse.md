# Analyse: Gammel app «konto»-tabell vs. project_opus accounts

Feltlisten fra den gamle appen (`bagges_accmaster_konto`) og anbefaling for hva som er nyttig i prod.

---

## Felt i gammel tabell (23 kolonner)

| Gammelt felt | Eksempelverdi | Anbefaling | Kommentar |
|--------------|---------------|------------|-----------|
| **Id** | 1, 2, … | ❌ Dropp | Erstattes av vår egen PK (uuid). |
| **Kontonr** | 1000, 1920, … | ✅ Behold | Tilsvarer `account_number` – hovedboksnummer / kontonummer. |
| **Kontotype** | null | ⚪ Valgfritt | Kun nyttig hvis dere bruker kontotype (f.eks. aktiv/passiv, kategorier). Kan mappes til `accountType` eller eget felt. |
| **ClientID** | 1, 2, … | ❌ Dropp som kolonne | I gammel app: 1 rad per konto per klient. Hos oss: **clients** har `set1AccountId` / `set2AccountId` som peker til **accounts**. Relasjonen ligger på client, ikke på konto. |
| **Dato** | null | ❌ Dropp | Ser ut som kontekst-dato fra gammel app, ikke nødvendig på konto. |
| **Periode** | null | ❌ Dropp | Periode hører til rapporter/avstemming, ikke til kontodefinisjon. |
| **Saldo** | 0, 25561, -100000 | ⚪ Beregnes | Saldo bør **beregnes** fra transaksjoner (eller åpningsbalanse + bevegelser), ikke lagres som eget felt på konto. Unntak: cached saldo for ytelse – da kan det være eget felt/aggregering. |
| **Valutakode** | NOK | ✅ Behold | Tilsvarer `currency` – allerede i vår schema. |
| **KlientNavn** | null | ❌ Dropp | Denormalisert – navn hentes fra **clients** når man trenger det. |
| **kontonrmengde** | 1 | ❌ Dropp | «Mengde 1 vs 2» er modellert via **clients**: set1AccountId vs set2AccountId. Ikke eget felt på konto. |
| **Erptransid** | 0 | ❌ Dropp | Spesifikk for gammel app (transaksjonsreferanse). |
| **IsImported** | false | ❌ Dropp | Import-status hører til import-batch, ikke til kontodefinisjon. |
| **ImportedAccountId** | 22421, … | ⚪ Ved migrering | Kan brukes som **ekstern id** ved migrering (f.eks. `externalId` eller i en migrerings-tabell). Ikke nødvendig i daglig bruk. |
| **Movement** | true/false | ❌ Dropp | «Har bevegelse» kan beregnes fra transaksjoner. |
| **IsActive** | true | ✅ Nyttig | Tilsvarer aktiv/arkivert. Vi har `status` på **clients**; kan legge til `isActive` eller `status` på **accounts** hvis dere vil skjule/arkivere enkeltkontoner. |
| **AccountTypeID** | 1 | ✅ Behold | Tilsvarer **ledger** vs **bank** – vi har allerede `account_type` (ledger | bank). 1 = typisk hovedbok, 2 = bank. |
| **LastUpdate** | 2025-01-01 … | ✅ Nyttig | Tilsvarer `updated_at` – kan legge til på accounts for sporbarhet. |
| **CustomSQLQueryID** | null | ❌ Dropp | Spesifikk for gammel app (egendefinert SQL). |
| **StartupIB** | 0, 25561, 1451805.30 | ⚪ På client, ikke konto | **Åpningsbalanse** – hos oss ligger åpningsbalanse på **clients**: `openingBalanceSet1`, `openingBalanceSet2`, `openingBalanceDate`. Ikke direkte på konto. |
| **ImportedBankAccountId** | null | ❌ Dropp | Spesifikk for gammel import. |
| **BalanceUpdateRequired** | false | ❌ Dropp | Implementasjonsdetalje fra gammel app. |
| **BalanceCurrency** | 0.0000 | ❌ Dropp | Valuta er én per konto (`currency`). |
| **StartupIBCurrency** | 0.0000, 3460.96 | ❌ Dropp | Åpningsbalanse i annen valuta – kan evt. modelleres som eget felt ved multi-valuta senere. |

---

## Vår nåværende `accounts`-tabell (project_opus)

```ts
accounts: {
  id, companyId, accountNumber, name, accountType, currency, createdAt
}
```

- **account_number** = Kontonr (f.eks. 1920).
- **name** = Kontonavn (f.eks. «Operasjonskonto»).
- **account_type** = ledger | bank (tilsvarer AccountTypeID 1 / 2).
- **currency** = Valutakode (NOK).

---

## Anbefaling: Felt å beholde / legge til

| Beholde / legge til | Hvor | Formål |
|---------------------|------|--------|
| **Kontonr** | `account_number` | Allerede i schema. |
| **Valutakode** | `currency` | Allerede i schema. |
| **AccountTypeID → ledger/bank** | `account_type` | Allerede i schema. |
| **IsActive** | `accounts.status` eller `accounts.is_active` | Arkivere/skjule enkeltkontoner uten å slette. |
| **LastUpdate** | `accounts.updated_at` | Sporbarhet (når konto sist ble endret). |
| **ImportedAccountId** | Kun ved migrering (f.eks. `external_id` eller migrerings-tabell) | Koble gamle konto-IDer til nye ved overføring. |

**Saldo og åpningsbalanse** bør ikke lagres på konto-raden i prod: saldo beregnes fra transaksjoner (+ evt. åpningsbalanse som ligger på **clients** for set1/set2).

---

## Kort oppsummering

- **Behold i prod-modell**: Kontonr (`account_number`), Valutakode (`currency`), AccountType (ledger/bank), og eventuelt **IsActive** + **LastUpdate** på `accounts`.
- **Dropp**: Id (bruk vår PK), ClientID/Dato/Periode/KlientNavn/kontonrmengde, Erptransid, IsImported, Movement, CustomSQLQueryID, ImportedBankAccountId, BalanceUpdateRequired, BalanceCurrency, StartupIBCurrency. Saldo og StartupIB ikke som egne felt på konto – saldo beregnes, åpningsbalanse på clients.

Vil du at jeg foreslår en konkret migrasjon (DDL) for å legge til `status`/`is_active` og `updated_at` på `accounts` i project_opus?
