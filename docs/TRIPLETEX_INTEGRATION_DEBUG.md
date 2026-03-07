# Tripletex Integration — Complete Architecture & Current Bug

## 1. System Overview

Revizo is a multi-tenant reconciliation SaaS for Norwegian accounting firms. It connects to accounting systems (Tripletex, Visma NXT) and automatically imports account lists, balances, and transactions for reconciliation.

**Stack:** Next.js 16 (Turbopack), React 19, Drizzle ORM, Supabase (Postgres), Clerk (auth), Railway (worker).

**Tenant model:** `tenantId` = Clerk organization ID (e.g., `org_xxx`). Every data access is scoped to tenant.

---

## 2. Database Schema (Relevant Tables)

### `companies`
```sql
id              UUID PK
tenant_id       TEXT NOT NULL          -- Clerk org ID
name            TEXT NOT NULL
tripletex_company_id  BIGINT           -- Tripletex company ID (nullable)
visma_nxt_company_no  BIGINT           -- Visma company number (nullable)
-- indexes: idx_companies_tenant(tenant_id)
```

### `accounts`
Each account has a `(companyId, accountNumber, accountType)` unique constraint.
```sql
id              UUID PK
company_id      UUID NOT NULL FK→companies(id) CASCADE
account_number  TEXT NOT NULL
name            TEXT NOT NULL
account_type    TEXT NOT NULL  -- enum: ledger, bank, accounts_receivable, etc.
tripletex_account_id  BIGINT
-- UNIQUE INDEX: idx_accounts_company_account_number(company_id, account_number, account_type)
```

### `account_sync_settings`
Master catalog of all accounts from the integration. Created by `syncAccountList()`. Tracks sync level and links to client when activated.
```sql
id              UUID PK
tenant_id       TEXT NOT NULL
company_id      UUID NOT NULL FK→companies(id) CASCADE
account_number  TEXT NOT NULL
account_name    TEXT NOT NULL
tripletex_account_id  BIGINT
account_type    TEXT NOT NULL DEFAULT 'ledger'  -- enum: ledger, bank
sync_level      TEXT NOT NULL DEFAULT 'balance_only'  -- enum: balance_only, transactions
balance_in      NUMERIC(18,2)   -- IB (opening balance)
balance_out     NUMERIC(18,2)   -- UB (closing balance)
balance_year    INTEGER
client_id       UUID FK→clients(id) SET NULL   -- NULL until activated
activated_at    TIMESTAMPTZ
activated_by    TEXT
-- UNIQUE INDEX: idx_account_sync_unique(tenant_id, company_id, account_number)
```

### `clients`
A "client" is a reconciliation unit = Set 1 (ledger) + Set 2 (bank counter-account). **No tenant_id column** — tenant scoping is via `company_id → companies.tenant_id`.
```sql
id                      UUID PK
company_id              UUID NOT NULL FK→companies(id) CASCADE
name                    TEXT NOT NULL  -- e.g., "1920 Bankinnskudd DNB"
set1_account_id         UUID NOT NULL FK→accounts(id)
set2_account_id         UUID NOT NULL FK→accounts(id)
opening_balance_set1    NUMERIC(18,2) DEFAULT '0'
opening_balance_set2    NUMERIC(18,2) DEFAULT '0'
opening_balance_date    DATE
status                  TEXT DEFAULT 'active'  -- enum: active, archived
-- INDEX: idx_clients_company(company_id)
```

### `tripletex_sync_configs`
Per-client sync configuration. Created by `bulk-activate` when `syncLevel = 'transactions'`.
```sql
id              UUID PK
client_id       UUID NOT NULL FK→clients(id) CASCADE  -- UNIQUE
tenant_id       TEXT NOT NULL
tripletex_company_id  BIGINT NOT NULL
set1_tripletex_account_id   BIGINT       -- primary account for ledger postings
set1_tripletex_account_ids  JSONB        -- array of account IDs
set2_tripletex_account_id   BIGINT       -- bank account for bank transactions
set2_tripletex_account_ids  JSONB
date_from       DATE NOT NULL
last_sync_at    TIMESTAMPTZ
last_sync_posting_id  BIGINT             -- cursor for incremental sync
last_sync_bank_tx_id  BIGINT
sync_interval_minutes INTEGER DEFAULT 15
sync_status     TEXT DEFAULT 'pending'   -- enum: pending, syncing, completed, failed
sync_error      TEXT
is_active       BOOLEAN DEFAULT true
-- UNIQUE INDEX: idx_tripletex_sync_client(client_id)
```

### `transactions`
Individual postings/bank transactions. `externalId` is used for deduplication.
```sql
id              UUID PK
client_id       UUID NOT NULL FK→clients(id) CASCADE
set_number      INTEGER NOT NULL  -- 1 = ledger, 2 = bank
amount          NUMERIC(18,2) NOT NULL
date1           DATE NOT NULL
description     TEXT
bilag           TEXT              -- voucher number
external_id     TEXT              -- Tripletex posting/bankTx ID for dedup
match_status    TEXT DEFAULT 'unmatched'  -- enum: unmatched, matched, correction
source_type     TEXT DEFAULT 'file'       -- 'file' or 'tripletex'
```

### `webhook_inbox`
Queue table for async processing by Railway worker.
```sql
id              UUID PK
tenant_id       TEXT NOT NULL
source          TEXT  -- 'tripletex'
event_type      TEXT  -- e.g., 'sync.bulk.activated', 'sync.balances.requested'
external_id     TEXT  -- for dedup
payload         JSONB
status          TEXT DEFAULT 'pending'
attempts        INTEGER DEFAULT 0
process_after   TIMESTAMPTZ DEFAULT now()
```

---

## 3. Onboarding Flow (Integration Path)

Steps: Welcome → Team → Choose Path → Select ERP → Configure ERP → **Select Accounts** → Connect Bank

### Step: Configure ERP (Tripletex)
1. User enters Tripletex consumer token + employee token
2. `POST /api/tripletex/connect` — stores credentials in `tripletex_connections`, fetches companies
3. User selects companies to import
4. `POST /api/companies` — creates company row with `tripletex_company_id`
5. `POST /api/tripletex/sync-balances` — runs **inline**:
   - Phase 1: `syncAccountList(tripletexCompanyId, companyId, tenantId)` — fetches all Tripletex accounts, bulk upserts into `account_sync_settings` (with `client_id = NULL`, `sync_level = 'balance_only'`) AND into `accounts` table
   - Phase 2: `syncBalancesForAccounts(companyId, tenantId)` — fetches `/balanceSheet` from Tripletex, updates `balance_in`/`balance_out` on `account_sync_settings`

### Step: Select Accounts (NEW — just added)
1. `GET /api/onboarding/accounts` — returns all `account_sync_settings` where `client_id IS NULL` for the tenant's companies
2. User selects which accounts should get transactions (others get balances only)
3. On "Import" click, for each company group:
   - `POST /api/companies/{companyId}/accounts/bulk-activate` with `{ accountNumbers, syncLevel: "transactions", dateFrom }`
4. After all bulk-activate calls complete, advances to next step

### Step: Connect Bank → Completes onboarding
- `POST /api/onboarding/complete` — marks onboarding as complete
- Redirects to `/dashboard`

---

## 4. The `bulk-activate` Endpoint

**`POST /api/companies/[companyId]/accounts/bulk-activate`**

This is the critical endpoint that creates clients from account_sync_settings. Full flow:

### Input
```json
{
  "accountNumbers": ["1920", "1000", "2400"],
  "dateFrom": "2026-01-01",
  "syncLevel": "transactions"
}
```

### Logic
1. **Fetch settings:** Query `account_sync_settings` WHERE `(companyId, tenantId, accountNumber IN (...))` — uses the settings created by `syncAccountList`
2. **Classify:** For each setting:
   - `alreadyActive`: has `clientId` AND sync level already matches → skip
   - `toUpgrade`: has `clientId` but `balance_only` → upgrade to `transactions`
   - `toCreate`: no `clientId` → create new client
3. **Bulk CREATE (transaction):**
   - Insert M1 accounts: `(companyId, accountNumber, "ledger" or "bank")` — `ON CONFLICT DO UPDATE` on `(companyId, accountNumber, accountType)`. Returns `{id, accountNumber}`.
   - Insert M2 accounts (counter-type): same accountNumber, opposite accountType
   - Insert clients: `set1_account_id = m1[accountNumber]`, `set2_account_id = m2[accountNumber]`
   - Insert `tripletex_sync_configs` (if `syncLevel = "transactions"`)
   - Update `account_sync_settings` — set `client_id`, `sync_level`, `activated_at`
4. **Insert matching rules** (non-fatal, outside transaction)
5. **Queue webhook events:**
   ```
   webhook_inbox: sync.bulk.activated  → triggers transaction import
   webhook_inbox: sync.balances.requested → triggers balance refresh
   ```
6. **Cache invalidation:** `revalidateTag("clients")`, `revalidateTag("companies")`

### Response
```json
{
  "results": [
    { "accountNumber": "1920", "status": "activated", "clientId": "xxx" },
    { "accountNumber": "1000", "status": "error", "error": "..." }
  ]
}
```
Always returns 200 — errors are per-account in the `results` array.

---

## 5. Sync Pipeline (Worker)

Railway worker runs three poll loops:

### 5.1 Webhook Processor (`worker/webhook-processor.ts`)
- Polls `webhook_inbox` every 5 seconds
- Claims pending events using `FOR UPDATE SKIP LOCKED`
- Groups events by `(tenantId, source, eventPrefix)`
- Routes to handlers:
  - `sync.balances.requested` → `syncBalancesForAccounts(companyId, tenantId)`
  - `sync.bulk.activated` → `syncBulkTransactionsForConfigs(configIds)` with 10min timeout
  - `sync.account.activated` → `syncTransactionsForAccount(configId)` per config

### 5.2 Tripletex Sync Poller (`worker/tripletex-sync-poller.ts`)
- Polls every 10 seconds
- Claims due `tripletex_sync_configs` where `last_sync_at + sync_interval_minutes < now()`
- Phase 1: `runAccountSyncPerCompany()` — deduplicates `syncCompany` + `syncAccountList` per unique Tripletex company
- Phase 2: `runFullSync(configId, { skipAccountSync: true })` per config with 5min timeout and concurrency 5

### 5.3 Sync Functions (`src/lib/tripletex/sync.ts`)

**`syncAccountList(tripletexCompanyId, companyId, tenantId)`**
- Fetches `/ledger/account` from Tripletex (all accounts)
- Bulk upserts into `account_sync_settings` (ON CONFLICT on `(tenantId, companyId, accountNumber)`)
- Bulk upserts into `accounts` (ON CONFLICT on `(companyId, accountNumber, accountType)`)
- Note: creates settings with `sync_level = 'balance_only'` and `client_id = NULL`

**`syncBalancesForAccounts(companyId, tenantId)`**
- Fetches `/balanceSheet` from Tripletex
- Updates `balance_in`/`balance_out` on `account_sync_settings` via bulk UPDATE

**`syncTransactionsForAccount(configId)`**
- Reads `tripletex_sync_configs` for the config
- Fetches `/ledger/posting` (Set 1) and `/bank/statement/transaction` (Set 2) from Tripletex
- Inserts into `transactions` table with dedup on `externalId`
- Updates `syncStatus` to `completed`

**`syncBulkTransactionsForConfigs(configIds)`**
- Concurrent worker pool (concurrency 5)
- Calls `syncTransactionsForAccount(configId)` for each config

---

## 6. Clients Page Data Fetching

**`src/app/dashboard/clients/clients-data.ts`**

```typescript
const fetchClientsPageData = unstable_cache(
  fetchClientsPageDataInner,
  ["clients-page-data"],
  { revalidate: 30, tags: ["clients", "companies"] }
);
```

The inner function runs:
```sql
SELECT clients.*, companies.name, accounts.account_number, 
       tripletex_sync_configs.*, visma_nxt_sync_configs.*
FROM clients
INNER JOIN companies ON clients.company_id = companies.id
INNER JOIN accounts ON clients.set1_account_id = accounts.id
LEFT JOIN tripletex_sync_configs ON tripletex_sync_configs.client_id = clients.id
LEFT JOIN visma_nxt_sync_configs ON visma_nxt_sync_configs.client_id = clients.id
WHERE companies.tenant_id = :orgId
ORDER BY accounts.account_number ASC
```

**Critical:** Uses `INNER JOIN accounts` — if `set1_account_id` points to a non-existent account, the client is invisible.

Also fetches `account_sync_settings` (for the Kontoplan/import view) in parallel.

If `clientIds.length === 0 && rawAcctRows.length === 0` → returns `{ type: "empty" }` (shows "Ingen klienter ennå").

**Caching:** `unstable_cache` with 30s TTL and tags `["clients", "companies"]`. Cache is invalidated via `revalidateTag("clients")` in `bulk-activate`.

---

## 7. The Bug

### Symptom
After completing onboarding (including the Select Accounts step where user selects accounts and triggers `bulk-activate`), the Clients page shows **"0 klienter totalt"** / "Ingen klienter".

### What Works
- `syncAccountList` runs correctly: 537 accounts synced to `account_sync_settings` and `accounts`
- `syncBalancesForAccounts` runs correctly: balances populated
- `/api/onboarding/accounts` returns the accounts correctly
- `POST /api/companies/{id}/accounts/bulk-activate` returns 200
- The `revalidateTag("clients")` call was added to `bulk-activate`

### What We Verified via Direct DB Query (Supabase MCP)
- `SELECT count(*) FROM clients WHERE company_id = '1d02f313...'` → **3 clients exist** (for a previous test user)
- `SELECT count(*) FROM clients c JOIN companies co ON c.company_id = co.id WHERE co.tenant_id = 'org_3Ad10ympO4PVjFsBlg4GZndVAQS'` → **3**
- The INNER JOIN query (same as clients-data.ts) also returns 3
- Database role is `postgres` (bypasses RLS)

### What the App Shows
- `[clients-data] Query results: 0 clients, 537 acctSyncRows, 0 groups` (logged from `fetchClientsPageDataInner`)
- After a code change forced recompilation of `clients-data.ts`, it suddenly showed 3 clients
- This strongly suggests `unstable_cache` served stale data despite `revalidateTag`

### The Pattern
1. User arrives at `/dashboard` after onboarding → dashboard loads
2. User navigates to `/dashboard/clients` → **first time clients-data runs**, but cache returns stale "0 clients"
3. Even after 30+ seconds (TTL), the cache seems stuck
4. Only a code change (which changes the file hash / module identity) forces fresh data

### Hypotheses
1. **`unstable_cache` in Next.js 16 + Turbopack doesn't properly honor `revalidate` TTL** — the cache key includes module identity or metadata that persists across the TTL window
2. **`revalidateTag` is called from an API route handler but doesn't propagate to the server-component cache** — Next.js docs suggest `revalidateTag` only works from Server Actions or Route Handlers, but the behavior suggests it's not effective in Turbopack dev mode
3. **Race condition:** The first load of `/dashboard` (overview page) somehow creates a stale cache entry that `fetchClientsPageData` then serves — even though the dashboard overview and clients page are separate routes, `unstable_cache` is a global cache keyed by function + args
4. **The cache entry is created BEFORE `bulk-activate` completes** — during onboarding, the app might pre-fetch the clients page (via router prefetch or parallel navigation), creating a cache entry with 0 clients. `revalidateTag` is then called, but the stale-while-revalidate pattern serves the stale entry on the next request
5. **Production may have the same issue** but masked by other factors (e.g., user waits longer, or Vercel's cache behaves differently from Turbopack's)

### Applied Fixes (2026-03-07)

**Fix 1: Removed `unstable_cache`** from `clients-data.ts`. The inner function is now called directly — no caching layer. Queries are already fast enough (parallel execution + indexes from earlier optimization rounds).

**Fix 2: Balances already copied** — `bulk-activate` already uses `s.balanceIn ?? "0"` when creating clients (was verified to be correct).

**Fix 3: Synchronous transaction import** — Replaced the `webhook_inbox` queue (`sync.bulk.activated` event) with a direct call to `syncBulkTransactionsForConfigs(allConfigIds)` inside `bulk-activate`, with a 2-minute timeout. If it fails/times out, the periodic sync poller picks it up.

**Fix 4: Inline balance sync** — Added `syncBalancesForAccounts(companyId, tenantId)` call BEFORE the settings query in `bulk-activate`, ensuring `balance_in`/`balance_out` are fresh when clients are created.

**Fix 5: Updated UX** — Progress text in onboarding and Kontoplan import now says "Oppretter klienter og henter transaksjoner fra Tripletex..." and success toast says "importert med saldo og transaksjoner" (not "hentes i bakgrunnen").

**Fix 6 (post-deploy):** Run cleanup SQL:
```sql
UPDATE webhook_inbox SET status = 'completed'
WHERE event_type = 'sync.bulk.activated' AND status IN ('pending', 'failed');
```

---

## 8. File Paths

| File | Purpose |
|------|---------|
| `src/lib/db/schema.ts` | All Drizzle table definitions |
| `src/lib/db/index.ts` | Database connection (postgres-js + Drizzle) |
| `src/lib/tripletex/sync.ts` | All sync functions (syncAccountList, syncBalancesForAccounts, syncTransactionsForAccount, etc.) |
| `src/lib/tripletex/pagination.ts` | `fetchAllPages` helper for Tripletex API |
| `src/lib/tripletex/mappers.ts` | Maps Tripletex API responses to Revizo models |
| `src/app/api/companies/[companyId]/accounts/bulk-activate/route.ts` | The critical bulk-activate endpoint |
| `src/app/api/tripletex/sync-balances/route.ts` | Phase 1+2 inline sync (accounts + balances) |
| `src/app/api/onboarding/accounts/route.ts` | Returns unimported accounts for onboarding step |
| `src/app/api/onboarding/complete/route.ts` | Marks onboarding as complete |
| `src/app/onboarding/page.tsx` | Onboarding page with step orchestration |
| `src/components/onboarding/step-select-accounts.tsx` | Account selection UI during onboarding |
| `src/app/dashboard/clients/clients-data.ts` | Clients page data fetching with unstable_cache |
| `src/app/dashboard/clients/page.tsx` | Clients page server component |
| `src/app/dashboard/clients/company-accounts-view.tsx` | Kontoplan import UI |
| `worker/index.ts` | Railway worker entry point |
| `worker/webhook-processor.ts` | Webhook inbox processor |
| `worker/tripletex-sync-poller.ts` | Periodic Tripletex sync poller |

---

## 9. Quick Diagnostic Queries

```sql
-- Check if clients exist for a tenant
SELECT c.id, c.name, c.company_id 
FROM clients c 
JOIN companies co ON c.company_id = co.id 
WHERE co.tenant_id = 'org_xxx';

-- Check account_sync_settings state
SELECT account_number, account_name, sync_level, client_id, balance_in, balance_out 
FROM account_sync_settings 
WHERE tenant_id = 'org_xxx' AND client_id IS NOT NULL 
ORDER BY account_number;

-- Check if the INNER JOIN would work
SELECT c.id, c.name, a.account_number, a.account_type 
FROM clients c 
JOIN accounts a ON c.set1_account_id = a.id 
WHERE c.company_id = 'xxx';

-- Check tripletex_sync_configs
SELECT id, client_id, sync_status, sync_error, is_active, last_sync_at 
FROM tripletex_sync_configs 
WHERE tenant_id = 'org_xxx';

-- Check webhook_inbox for pending events
SELECT id, event_type, status, attempts, created_at 
FROM webhook_inbox 
WHERE tenant_id = 'org_xxx' 
ORDER BY created_at DESC LIMIT 20;
```
