# Databaseskjema

Databaseskjemaet er definert i `src/lib/db/schema.ts` med Drizzle ORM. Alle tabeller bruker UUID som primærnøkkel.

## ER-diagram

```
companies ──1:N──> accounts
    │                  │
    └──1:N──> clients ─┤ (set1_account_id, set2_account_id)
                 │
          ┌──────┼──────────────┬───────────────────┐
          │      │              │                    │
       imports  transactions  matches          agent_report_configs
          │      │              │                    │
          │      ├──── N:1 ─────┘              agent_job_logs
          │      │
          │      └── transaction_attachments
          │
matching_rules ──N:1──> clients (eller tenant-globale)
parser_configs (per tenant)
notifications (per tenant + bruker)
knowledge_articles → knowledge_snippets
knowledge_faq
product_guides
regulatory_deadlines
ai_conversations (per bruker + org)
ai_user_memory (per bruker + org)
user_onboarding (per bruker)
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
| `file_hash`       | text                      | Ja       | SHA-hash for duplikatdeteksjon  |
| `file_size`       | integer                   | Ja       | Filstørrelse i bytes            |
| `status`          | text (enum)               | Nei      | pending/processing/completed/failed/duplicate |
| `error_message`   | text                      | Ja       | Feilmelding ved feil            |
| `imported_by`     | text                      | Ja       | Clerk user ID                   |
| `deleted_at`      | timestamptz               | Ja       | Soft-delete tidspunkt           |
| `archived_at`     | timestamptz               | Ja       | Arkiverings-tidspunkt           |
| `created_at`      | timestamptz               | Nei      | Opprettet                       |

**Indekser:** `idx_imports_client_set`, `idx_imports_client_deleted`, `idx_imports_file_hash`

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

### transaction_attachments

Vedlegg per transaksjon, lagret i Supabase Storage.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `transaction_id` | uuid (FK → transactions) | Nei | Tilhørende transaksjon |
| `client_id` | uuid (FK → clients) | Nei | Tilhørende klient |
| `filename` | text | Nei | Originalt filnavn |
| `file_path` | text | Nei | Sti i Supabase Storage |
| `file_size` | integer | Ja | Størrelse i bytes |
| `content_type` | text | Ja | MIME-type |
| `uploaded_by` | text | Nei | Clerk user ID |
| `created_at` | timestamptz | Nei | |

---

### notifications

In-app varsler per bruker. Se [NOTIFICATIONS.md](NOTIFICATIONS.md).

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `tenant_id` | text | Nei | Org-ID |
| `user_id` | text | Nei | Mottaker |
| `from_user_id` | text | Ja | Avsender |
| `type` | text (enum) | Nei | note_mention/match_completed/import_completed/assignment/deadline_reminder/system |
| `title` | text | Nei | |
| `body` | text | Ja | |
| `link` | text | Ja | Lenke til relevant side |
| `read` | boolean | Nei | Default false |
| `entity_type` | text | Ja | Relatert entitetstype |
| `entity_id` | text | Ja | Relatert entitets-ID |
| `group_key` | text | Ja | Grupperingsnøkkel |
| `created_at` | timestamptz | Nei | |

---

### knowledge_articles

AI-kunnskapsbase artikler. Se [AI_SYSTEM.md](AI_SYSTEM.md).

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `category` | text | Nei | Artikkelhoved-kategori |
| `subcategory` | text | Ja | |
| `title` | text | Nei | |
| `slug` | text (UNIQUE) | Nei | URL-slug |
| `content` | text | Nei | Innhold (markdown) |
| `summary` | text | Ja | |
| `keywords` | text[] | Ja | |
| `applies_to` | text[] | Ja | |
| `valid_from` | date | Ja | |
| `valid_to` | date | Ja | |
| `source` | text | Ja | Kildenavn |
| `source_url` | text | Ja | Kilde-URL |
| `confidence` | numeric(3,2) | Nei | 0.00–1.00 |
| `version` | integer | Nei | Default 1 |
| `status` | text (enum) | Nei | published/draft/archived |

---

### knowledge_snippets

Raske fakta med trigger-fraser for AI-chatbot.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `article_id` | uuid (FK → knowledge_articles) | Ja | |
| `fact` | text | Nei | Fakta-tekst |
| `context` | text | Ja | |
| `trigger_phrases` | text[] | Ja | Fraser som trigger snippet |
| `priority` | integer | Nei | |
| `always_include` | boolean | Nei | Alltid inkluder i kontekst |
| `valid_from` | date | Ja | |
| `valid_to` | date | Ja | |

---

### knowledge_faq

FAQ for AI-chatbot.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `question` | text | Nei | Hovedspørsmål |
| `question_variants` | text[] | Ja | Alternative formuleringer |
| `answer` | text | Nei | Svar |
| `answer_action` | text | Ja | Handlings-ID |
| `category` | text | Ja | |
| `feature` | text | Ja | |
| `priority` | integer | Nei | |
| `times_matched` | integer | Nei | Treff-teller |
| `status` | text (enum) | Nei | published/draft/archived |

---

### product_guides

Steg-for-steg guider for AI-chatbot.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `feature` | text | Nei | Funksjonalitet |
| `title` | text | Nei | |
| `slug` | text (UNIQUE) | Nei | |
| `description` | text | Ja | |
| `prerequisites` | text[] | Ja | |
| `steps` | jsonb | Nei | Steg-array |
| `difficulty` | text (enum) | Nei | beginner/intermediate/advanced |
| `estimated_time_minutes` | integer | Ja | |
| `roles` | text[] | Ja | |
| `keywords` | text[] | Ja | |
| `status` | text (enum) | Nei | published/draft/archived |

---

### regulatory_deadlines

Norske regulatoriske frister.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `obligation` | text | Nei | Pliktnavn |
| `title` | text | Nei | |
| `description` | text | Ja | |
| `frequency` | text (enum) | Nei | monthly/bimonthly/quarterly/yearly |
| `period_start_month` | integer | Ja | |
| `period_end_month` | integer | Ja | |
| `deadline_rule` | jsonb | Nei | Fristregel |
| `exceptions` | jsonb | Ja | |
| `applies_to_entity` | text[] | Ja | |
| `applies_to_role` | text[] | Ja | |
| `legal_reference` | text | Ja | Lovhenvisning |
| `legal_url` | text | Ja | |

---

### ai_user_memory

Per-bruker AI-minne per organisasjon.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `user_id` | text | Nei | |
| `organization_id` | text | Nei | |
| `memory_type` | text | Nei | Minnetype |
| `content` | text | Nei | Fritekst |
| `confidence` | numeric(3,2) | Nei | 0.00–1.00 |
| `last_relevant_at` | timestamptz | Nei | |
| `expires_at` | timestamptz | Ja | |
| `created_at` | timestamptz | Nei | |

---

### ai_conversations

AI-samtalehistorikk.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `user_id` | text | Nei | |
| `organization_id` | text | Nei | |
| `messages` | jsonb | Nei | JSON-array med meldinger |
| `mode` | text (enum) | Nei | support/onboarding |
| `page_context` | text | Ja | URL der samtalen startet |
| `tools_used` | text[] | Ja | Verktøy brukt |
| `tokens_used` | integer | Nei | Token-forbruk |
| `rating` | integer | Ja | Brukerrating |
| `feedback` | text | Ja | |
| `resolved` | boolean | Ja | |
| `escalated` | boolean | Nei | |
| `duration_seconds` | integer | Ja | |
| `created_at` | timestamptz | Nei | |

---

### user_onboarding

Onboarding-status per bruker.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `user_id` | text (UNIQUE) | Nei | |
| `organization_id` | text | Nei | |
| `profile_completed` | boolean | Nei | |
| `first_client_created` | boolean | Nei | |
| `bank_connected` | boolean | Nei | |
| `first_match_run` | boolean | Nei | |
| `team_invited` | boolean | Nei | |
| `notifications_configured` | boolean | Nei | |
| `completed_at` | timestamptz | Ja | |
| `created_at` | timestamptz | Nei | |

---

### agent_report_configs

Konfigurasjon for automatisk Smart Match og rapportering per klient. Se [AGENT_SYSTEM.md](AGENT_SYSTEM.md).

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `tenant_id` | text | Nei | |
| `client_id` | uuid (FK → clients, UNIQUE) | Nei | Én config per klient |
| `created_by` | text | Nei | |
| `enabled` | boolean | Nei | |
| `report_types` | jsonb | Nei | `["open_items"]` |
| `smart_match_enabled` | boolean | Nei | |
| `smart_match_schedule` | text | Ja | Schedule-preset |
| `report_schedule` | text | Ja | Schedule-preset |
| `specific_dates` | jsonb | Ja | ISO-datoer |
| `preferred_time` | text | Ja | UTC tidspunkt |
| `next_match_run` | timestamptz | Ja | |
| `next_report_run` | timestamptz | Ja | |
| `last_match_run` | timestamptz | Ja | |
| `last_report_run` | timestamptz | Ja | |
| `last_match_count` | integer | Ja | |
| `locked_at` | timestamptz | Ja | Worker-lock |
| `locked_by` | text | Ja | Worker-ID |

---

### agent_job_logs

Kjøringshistorikk for Revizo Agent.

| Kolonne | Type | Nullable | Beskrivelse |
|---------|------|----------|-------------|
| `id` | uuid (PK) | Nei | |
| `config_id` | uuid (FK → agent_report_configs) | Nei | |
| `tenant_id` | text | Nei | |
| `client_id` | uuid | Nei | |
| `job_type` | text (enum) | Nei | smart_match/report/both |
| `status` | text (enum) | Nei | success/failed/partial |
| `match_count` | integer | Ja | |
| `transaction_count` | integer | Ja | |
| `report_sent` | boolean | Nei | |
| `error_message` | text | Ja | |
| `duration_ms` | integer | Ja | |
| `created_at` | timestamptz | Nei | |

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
