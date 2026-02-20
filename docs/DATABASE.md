# Databaseskjema

Databaseskjemaet er definert i `src/lib/db/schema.ts` med Drizzle ORM. Alle tabeller bruker UUID som primærnøkkel.

## ER-diagram

```
companies ──1:N──> accounts
    │                  │
    └──1:N──> clients ─┤ (set1_account_id, set2_account_id)
                 │
          ┌──────┼──────────────┐
          │      │              │
       imports  transactions  matches
                 │              │
                 └──── N:1 ─────┘ (match_id)

matching_rules ──N:1──> clients (eller tenant-globale)
parser_configs (per tenant)
```

## Tabeller

### companies

Selskaper tilhører en Clerk-organisasjon via `tenant_id`.

| Kolonne            | Type                  | Nullable | Beskrivelse                    |
|--------------------|-----------------------|----------|--------------------------------|
| `id`               | uuid (PK)             | Nei      | Auto-generert UUID             |
| `tenant_id`        | text                  | Nei      | Clerk organisasjons-ID         |
| `name`             | text                  | Nei      | Selskapsnavn                   |
| `org_number`       | text                  | Ja       | Organisasjonsnummer            |
| `parent_company_id`| uuid (FK → companies) | Ja       | Hierarki/konsern               |
| `created_at`       | timestamptz           | Nei      | Opprettet (default now())      |
| `updated_at`       | timestamptz           | Nei      | Sist endret                    |

**Indekser:** `idx_companies_tenant` on (`tenant_id`)

---

### accounts

Kontoer (hovedbok eller bank) tilknyttet et selskap.

| Kolonne         | Type                  | Nullable | Beskrivelse                         |
|-----------------|-----------------------|----------|-------------------------------------|
| `id`            | uuid (PK)             | Nei      | Auto-generert UUID                  |
| `company_id`    | uuid (FK → companies) | Nei      | Selskapet kontoen tilhører          |
| `account_number`| text                  | Nei      | Kontonummer                         |
| `name`          | text                  | Nei      | Kontonavn                           |
| `account_type`  | text (enum)           | Nei      | "ledger" eller "bank"               |
| `currency`      | text                  | Nei      | Valuta (default "NOK")              |
| `created_at`    | timestamptz           | Nei      | Opprettet                           |

---

### clients

En avstemmingsenhet kobler to kontoer (sett 1 = hovedbok, sett 2 = bank).

| Kolonne                | Type                  | Nullable | Beskrivelse                          |
|------------------------|-----------------------|----------|--------------------------------------|
| `id`                   | uuid (PK)             | Nei      | Auto-generert UUID                   |
| `company_id`           | uuid (FK → companies) | Nei      | Selskapet                            |
| `name`                 | text                  | Nei      | Navn på avstemming                   |
| `set1_account_id`      | uuid (FK → accounts)  | Nei      | Konto for sett 1 (hovedbok)         |
| `set2_account_id`      | uuid (FK → accounts)  | Nei      | Konto for sett 2 (bank)             |
| `opening_balance_set1` | numeric(18,2)         | Nei      | Inngående balanse sett 1            |
| `opening_balance_set2` | numeric(18,2)         | Nei      | Inngående balanse sett 2            |
| `opening_balance_date` | date                  | Ja       | Dato for inngående balanse           |
| `allow_tolerance`      | boolean               | Nei      | Tillat avvik ved matching            |
| `tolerance_amount`     | numeric(18,2)         | Nei      | Maks avvik                           |
| `status`               | text (enum)           | Nei      | "active" eller "archived"            |
| `created_at`           | timestamptz           | Nei      | Opprettet                            |
| `updated_at`           | timestamptz           | Nei      | Sist endret                          |

---

### transactions

Importerte transaksjoner for et sett.

| Kolonne         | Type                  | Nullable | Beskrivelse                          |
|-----------------|-----------------------|----------|--------------------------------------|
| `id`            | uuid (PK)             | Nei      | Auto-generert UUID                   |
| `client_id`     | uuid (FK → clients)   | Nei      | Tilhørende klient                    |
| `set_number`    | integer               | Nei      | 1 (hovedbok) eller 2 (bank)         |
| `import_id`     | uuid (FK → imports)   | Ja       | Hvilken import raden kom fra         |
| `account_number`| text                  | Ja       | Kontonummer fra filen                |
| `amount`        | numeric(18,2)         | Nei      | Beløp                                |
| `foreign_amount`| numeric(18,2)         | Ja       | Valutabeløp                          |
| `currency`      | text                  | Nei      | Valuta (default "NOK")              |
| `date1`         | date                  | Nei      | Hoveddato                            |
| `reference`     | text                  | Ja       | Referanse                            |
| `description`   | text                  | Ja       | Beskrivelse/tekst                    |
| `text_code`     | text                  | Ja       | Tekstkode                            |
| `dim1`–`dim10`  | text                  | Ja       | Dimensjonsfelter                     |
| `sign`          | text (enum)           | Ja       | "+" eller "-"                        |
| `match_id`      | uuid (FK → matches)   | Ja       | Koblet match (null = umatched)       |
| `match_status`  | text (enum)           | Nei      | "unmatched", "matched", "correction" |
| `created_at`    | timestamptz           | Nei      | Opprettet                            |

**Indekser:**
- `idx_transactions_client_set` on (`client_id`, `set_number`)
- `idx_transactions_unmatched` on (`client_id`, `set_number`, `match_status`)
- `idx_transactions_amount` on (`client_id`, `amount`)
- `idx_transactions_date` on (`client_id`, `date1`)

---

### imports

Registrering av hver filimport.

| Kolonne           | Type                      | Nullable | Beskrivelse                     |
|-------------------|---------------------------|----------|---------------------------------|
| `id`              | uuid (PK)                 | Nei      | Auto-generert UUID              |
| `client_id`       | uuid (FK → clients)       | Nei      | Klienten importen tilhører      |
| `set_number`      | integer                   | Nei      | 1 eller 2                       |
| `filename`        | text                      | Nei      | Opprinnelig filnavn             |
| `file_path`       | text                      | Nei      | Sti i Supabase Storage          |
| `parser_config_id`| uuid (FK → parser_configs)| Ja       | Eventuell parser-konfig brukt   |
| `record_count`    | integer                   | Nei      | Antall importerte transaksjoner |
| `status`          | text (enum)               | Nei      | pending/processing/completed/failed |
| `error_message`   | text                      | Ja       | Feilmelding ved feil            |
| `imported_by`     | text                      | Ja       | Clerk user ID                   |
| `created_at`      | timestamptz               | Nei      | Opprettet                       |

---

### matches

En match kobler transaksjoner fra sett 1 og sett 2 sammen.

| Kolonne      | Type                        | Nullable | Beskrivelse                    |
|--------------|-----------------------------|----------|--------------------------------|
| `id`         | uuid (PK)                   | Nei      | Auto-generert UUID             |
| `client_id`  | uuid (FK → clients)         | Nei      | Klienten                       |
| `rule_id`    | uuid (FK → matching_rules)  | Ja       | Regelen som matchet            |
| `match_type` | text (enum)                 | Nei      | "auto" eller "manual"          |
| `difference` | numeric(18,2)               | Nei      | Differanse mellom sett         |
| `matched_at` | timestamptz                 | Nei      | Tidspunkt for match            |
| `matched_by` | text                        | Ja       | Clerk user ID                  |

---

### matching_rules

Regler for automatisk matching. Kan være klient-spesifikke eller tenant-globale.

| Kolonne             | Type                  | Nullable | Beskrivelse                          |
|---------------------|-----------------------|----------|--------------------------------------|
| `id`                | uuid (PK)             | Nei      | Auto-generert UUID                   |
| `client_id`         | uuid (FK → clients)   | Ja       | Klient (null = global for tenant)    |
| `tenant_id`         | text                  | Nei      | Organisasjons-ID                     |
| `name`              | text                  | Nei      | Regelnavn                            |
| `priority`          | integer               | Nei      | Lavere = kjøres først                |
| `is_active`         | boolean               | Nei      | Aktiv/inaktiv                        |
| `rule_type`         | text (enum)           | Nei      | one_to_one/many_to_one/many_to_many  |
| `is_internal`       | boolean               | Nei      | Intern systemregel                   |
| `date_must_match`   | boolean               | Nei      | Krev datolikhet                      |
| `date_tolerance_days`| integer              | Nei      | Dager avvik tillatt                  |
| `compare_currency`  | text (enum)           | Nei      | "local" eller "foreign"             |
| `allow_tolerance`   | boolean               | Nei      | Tillat beløpsavvik                   |
| `tolerance_amount`  | numeric(18,2)         | Nei      | Maks beløpsavvik                     |
| `conditions`        | jsonb                 | Nei      | Ekstra betingelser (JSON-array)      |
| `created_at`        | timestamptz           | Nei      | Opprettet                            |

---

### parser_configs

Lagrede parser-konfigurasjoner per tenant.

| Kolonne      | Type      | Nullable | Beskrivelse                             |
|--------------|-----------|----------|-----------------------------------------|
| `id`         | uuid (PK) | Nei      | Auto-generert UUID                      |
| `tenant_id`  | text      | Nei      | Organisasjons-ID                        |
| `name`       | text      | Nei      | Konfigurasjonsnavn                      |
| `file_type`  | text (enum)| Nei     | csv/excel/camt/xml/fixed                |
| `config`     | jsonb     | Nei      | Parser-konfigurasjon (JSON)             |
| `is_system`  | boolean   | Nei      | Systemkonfig (kan ikke slettes)         |
| `created_at` | timestamptz| Nei     | Opprettet                               |

### audit_logs

Append-only tabell for revisjonslogging. Beskyttet av trigger mot UPDATE/DELETE.

| Kolonne      | Type          | Nullable | Beskrivelse                          |
|--------------|---------------|----------|--------------------------------------|
| `id`         | uuid (PK)     | Nei      | Auto-generert UUID                   |
| `tenant_id`  | text          | Nei      | Organisasjons-ID                     |
| `user_id`    | text          | Nei      | Clerk user ID                        |
| `action`     | varchar(100)  | Nei      | Hendelse (f.eks. "import.created")   |
| `entity_type`| varchar(50)   | Nei      | Type enhet (f.eks. "import")         |
| `entity_id`  | text          | Ja       | ID til relatert enhet                |
| `metadata`   | jsonb         | Ja       | Ekstra kontekst                      |
| `created_at` | timestamptz   | Nei      | Tidspunkt                            |

---

## Sikkerhet

### Row Level Security (RLS)

Alle tabeller har RLS aktivert med tre typer policyer:

1. **`service_role_full_access`** — Appen bruker service role som omgår RLS
2. **`tenant_isolation`** — Autentiserte brukere kan kun se data i egen tenant
3. **`deny_anon`** — Anonym tilgang blokkert

Tenant-isolasjon bruker `(select current_setting('app.tenant_id', true))` for effektiv per-query evaluering.

### Retensjonspolicy (Bokforingsloven)

Finansielle data beskyttes av en 5-års retensjonspolicy:

1. **Soft-delete (0-14 dager):** Bruker kan gjenopprette
2. **Arkivering (14 dager+):** Filer slettes fra Storage, men DB-data beholdes
3. **Permanent sletting (5 år+):** Data kan fjernes

En trigger (`trg_enforce_retention_*`) på `imports` og `transactions` forhindrer sletting av poster nyere enn 5 år.

```
[Aktiv] → soft-delete → [Slettet 0-14d] → arkiver → [Arkivert 14d-5y] → slett → [Permanent borte]
```

Automatisk opprydding kjøres daglig kl. 03:00 via `pg_cron` → Edge Function → `cleanup_expired_imports()`.

---

## Migrasjoner

Migrasjoner ligger i `src/lib/db/migrations/`. Kjør med:

```bash
npx drizzle-kit generate  # Generer fra schema-endringer
npx drizzle-kit migrate   # Kjør mot databasen
```
