# Account Control — Technical Project Brief

> This document defines the tech stack, project structure, database schema, and implementation
> plan for the new reconciliation platform. Use together with DOMAIN_SPEC.md for full context.

---

## 1. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **Next.js 15 (App Router)** | Full-stack React framework |
| Language | **TypeScript** (strict mode) | Type safety everywhere |
| Database | **Supabase (PostgreSQL)** | Database, storage, realtime |
| Auth | **Clerk** | Authentication, user management, organization/tenant support |
| ORM | **Drizzle ORM** | Type-safe database queries, migrations |
| UI | **shadcn/ui + Tailwind CSS 4** | Component library + styling |
| State | **Zustand** or React Server Components where possible | Minimal client state |
| File handling | **Papa Parse** (CSV), **SheetJS** (Excel), custom XML parser (CAMT) | File parsing |
| Hosting | **Vercel** | Frontend + API routes |
| Monorepo | **Turborepo** (optional, start simple) | If needed later |

### Key decisions
- **Clerk over Supabase Auth**: Clerk provides built-in organization/tenant support which maps perfectly to our multi-tenant model. Each accounting firm = one Clerk Organization.
- **Drizzle over Prisma**: Lighter, faster, better SQL control. Important for complex matching queries.
- **Supabase as database only**: We use Supabase for Postgres + Storage (file uploads). Auth is handled by Clerk.
- **App Router**: Server components by default, client components only when needed for interactivity.

---

## 2. Project Structure

```
account-control/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth pages (sign-in, sign-up)
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   ├── (dashboard)/              # Authenticated app shell
│   │   │   ├── layout.tsx            # Sidebar, header, tenant context
│   │   │   ├── page.tsx              # Dashboard home
│   │   │   ├── clients/              # Client (reconciliation unit) management
│   │   │   │   ├── page.tsx          # Client list
│   │   │   │   └── [clientId]/
│   │   │   │       ├── page.tsx      # Client overview
│   │   │   │       ├── import/       # File import
│   │   │   │       ├── matching/     # Auto + manual matching
│   │   │   │       └── history/      # Reconciliation history
│   │   │   ├── companies/            # Company management
│   │   │   ├── accounts/             # Account management
│   │   │   └── settings/             # Tenant settings, parser configs
│   │   ├── api/                      # API routes
│   │   │   ├── webhooks/
│   │   │   │   └── clerk/route.ts    # Clerk webhook for user sync
│   │   │   ├── import/route.ts       # File upload + parsing
│   │   │   ├── matching/
│   │   │   │   ├── auto/route.ts     # Run automatic matching
│   │   │   │   └── manual/route.ts   # Manual match/unmatch
│   │   │   └── transactions/route.ts # Transaction CRUD
│   │   ├── layout.tsx                # Root layout (ClerkProvider)
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── matching/                 # Matching-specific components
│   │   │   ├── transaction-table.tsx # Transaction list with selection
│   │   │   ├── match-preview.tsx     # Preview of selected match
│   │   │   └── rule-status.tsx       # Show which rule matched
│   │   ├── import/                   # Import-specific components
│   │   │   ├── file-dropzone.tsx     # Drag & drop file upload
│   │   │   └── import-preview.tsx    # Preview parsed data before confirm
│   │   └── layout/                   # Shell components
│   │       ├── sidebar.tsx
│   │       └── header.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle client
│   │   │   ├── schema.ts             # Database schema
│   │   │   └── migrations/           # Drizzle migrations
│   │   ├── parsers/
│   │   │   ├── index.ts              # Parser registry
│   │   │   ├── csv-parser.ts         # Generic CSV parser
│   │   │   ├── camt-parser.ts        # CAMT.053 / ISO20022 XML parser
│   │   │   ├── excel-parser.ts       # Excel parser
│   │   │   └── types.ts              # Shared parser types
│   │   ├── matching/
│   │   │   ├── engine.ts             # Main matching engine (runs rule pipeline)
│   │   │   ├── rules/
│   │   │   │   ├── one-to-one.ts     # 1:1 matching logic
│   │   │   │   ├── many-to-one.ts    # Many:1 matching logic
│   │   │   │   ├── many-to-many.ts   # Many:Many matching logic
│   │   │   │   └── internal.ts       # Internal (within same set) matching
│   │   │   └── types.ts              # Matching types
│   │   ├── supabase.ts               # Supabase client
│   │   ├── clerk.ts                  # Clerk helpers
│   │   └── utils.ts                  # Shared utilities
│   └── middleware.ts                 # Clerk auth middleware
├── docs/
│   └── DOMAIN_SPEC.md                # Domain specification (from earlier)
├── drizzle.config.ts                 # Drizzle configuration
├── .env.local                        # Environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 3. Database Schema

### Core tables

```sql
-- Companies within a tenant (Clerk org = tenant)
-- tenant_id comes from Clerk organization ID
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,              -- Clerk organization ID
  name TEXT NOT NULL,
  org_number TEXT,                       -- Norwegian org number
  parent_company_id UUID REFERENCES companies(id),  -- For group/konsern structure
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accounts to be reconciled
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,          -- Kontonummer
  name TEXT NOT NULL,                    -- Kontonavn
  account_type TEXT NOT NULL CHECK (account_type IN ('ledger', 'bank')),
  currency TEXT DEFAULT 'NOK',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- A reconciliation unit pairing two sets
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  set1_account_id UUID NOT NULL REFERENCES accounts(id),  -- Mengde 1 (typically ledger)
  set2_account_id UUID NOT NULL REFERENCES accounts(id),  -- Mengde 2 (typically bank)
  opening_balance_set1 NUMERIC(18,2) DEFAULT 0,
  opening_balance_set2 NUMERIC(18,2) DEFAULT 0,
  opening_balance_date DATE,
  allow_tolerance BOOLEAN DEFAULT false,
  tolerance_amount NUMERIC(18,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual transactions within a set
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number IN (1, 2)),  -- Which set (mengde)
  import_id UUID REFERENCES imports(id),    -- Which import batch
  account_number TEXT,
  amount NUMERIC(18,2) NOT NULL,             -- Beløp (local currency)
  foreign_amount NUMERIC(18,2),              -- Valbeløp (foreign currency)
  currency TEXT DEFAULT 'NOK',
  date1 DATE NOT NULL,                       -- Primary date
  reference TEXT,                             -- Ref
  description TEXT,                           -- Tekst
  text_code TEXT,                             -- Tekstkode
  dim1 TEXT,                                  -- Dimension fields (flexible metadata)
  dim2 TEXT,
  dim3 TEXT,
  dim4 TEXT,
  dim5 TEXT,
  dim6 TEXT,
  dim7 TEXT,
  sign TEXT CHECK (sign IN ('+', '-')),
  match_id UUID REFERENCES matches(id),       -- NULL = unmatched
  match_status TEXT DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'correction')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- File import batches
CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number IN (1, 2)),
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,                   -- Path in Supabase Storage
  parser_config_id UUID REFERENCES parser_configs(id),
  record_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  imported_by TEXT,                           -- Clerk user ID
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Parser configurations
CREATE TABLE parser_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,                        -- e.g., "CAMT.053", "Generell CSV"
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'excel', 'camt', 'xml', 'fixed')),
  config JSONB NOT NULL,                     -- Parser configuration as JSON
  is_system BOOLEAN DEFAULT false,           -- System-provided vs custom
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Matches (groups of matched transactions)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES matching_rules(id), -- NULL = manual match
  match_type TEXT NOT NULL CHECK (match_type IN ('auto', 'manual')),
  difference NUMERIC(18,2) DEFAULT 0,         -- Non-zero if matched with tolerance
  matched_at TIMESTAMPTZ DEFAULT now(),
  matched_by TEXT                              -- Clerk user ID (for manual matches)
);

-- Matching rules configuration
CREATE TABLE matching_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),       -- NULL = tenant-level default
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('one_to_one', 'many_to_one', 'many_to_many')),
  is_internal BOOLEAN DEFAULT false,           -- Match within same set
  date_must_match BOOLEAN DEFAULT true,
  date_tolerance_days INTEGER DEFAULT 0,
  compare_currency TEXT DEFAULT 'local' CHECK (compare_currency IN ('local', 'foreign')),
  allow_tolerance BOOLEAN DEFAULT false,
  tolerance_amount NUMERIC(18,2) DEFAULT 0,
  conditions JSONB DEFAULT '[]',               -- Additional field matching conditions
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_transactions_client_set ON transactions(client_id, set_number);
CREATE INDEX idx_transactions_unmatched ON transactions(client_id, set_number, match_status) WHERE match_status = 'unmatched';
CREATE INDEX idx_transactions_amount ON transactions(client_id, amount);
CREATE INDEX idx_transactions_date ON transactions(client_id, date1);
CREATE INDEX idx_companies_tenant ON companies(tenant_id);
CREATE INDEX idx_matching_rules_client ON matching_rules(client_id, priority);
CREATE INDEX idx_matching_rules_tenant ON matching_rules(tenant_id, priority);

-- Row Level Security (multi-tenant isolation)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE parser_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies will use Clerk organization ID passed via Supabase JWT
-- Implementation: Clerk session token → custom Supabase JWT with org_id claim
```

### Drizzle schema (TypeScript)

The SQL above should be implemented as a Drizzle schema in `src/lib/db/schema.ts`. Use Drizzle's `pgTable` definitions. This gives you type-safe queries and automatic migration generation.

---

## 4. MVP Implementation Plan

### Goal
Demonstrate one complete end-to-end flow to leadership:
**Upload files → Automatic matching → Review results → Manual matching → Reconciled**

### Phase 1: Foundation (Day 1-2)

#### 1.1 Project setup
```bash
npx create-next-app@latest account-control --typescript --tailwind --eslint --app --src-dir
cd account-control
npm install drizzle-orm postgres
npm install -D drizzle-kit
npx shadcn@latest init
npm install @clerk/nextjs
```

#### 1.2 Configure services
- Set up Supabase project (database + storage bucket for files)
- Set up Clerk application with Organizations enabled
- Configure environment variables:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

#### 1.3 Database schema
- Implement Drizzle schema from section 3
- Run initial migration
- Seed with one test company, one client, and default matching rules

### Phase 2: File Import (Day 3-5)

#### 2.1 Build CSV parser
Start with generic CSV parser that handles:
- Configurable delimiter (`;`, `,`, `\t`)
- Configurable decimal format (`.` or `,`)
- Header row detection
- Field mapping (column index or header name → internal field)
- Sign handling
- Duplicate detection

#### 2.2 Build CAMT.053 parser
- Parse ISO 20022 XML structure
- Map CAMT fields to internal transaction fields
- Handle namespaces

#### 2.3 File upload UI
- Drag & drop file zone
- Parser selection (auto-detect where possible)
- Preview of parsed transactions before confirming import
- Store original file in Supabase Storage
- Insert parsed transactions into database

### Phase 3: Automatic Matching (Day 6-8)

#### 3.1 Matching engine core
```typescript
// Pseudocode for matching engine
async function runMatchingPipeline(clientId: string): Promise<MatchingResult> {
  const rules = await getActiveRules(clientId); // sorted by priority
  let unmatchedSet1 = await getUnmatchedTransactions(clientId, 1);
  let unmatchedSet2 = await getUnmatchedTransactions(clientId, 2);

  const results: MatchResult[] = [];

  for (const rule of rules) {
    const matches = await applyRule(rule, unmatchedSet1, unmatchedSet2);
    results.push(...matches);

    // Remove matched transactions from unmatched pools
    unmatchedSet1 = unmatchedSet1.filter(t => !matches.some(m => m.set1Ids.includes(t.id)));
    unmatchedSet2 = unmatchedSet2.filter(t => !matches.some(m => m.set2Ids.includes(t.id)));
  }

  return { matches: results, unmatchedSet1, unmatchedSet2 };
}
```

#### 3.2 Rule implementations
Start with these (covers most common scenarios):
1. **1:1 with date match** — exact amount match, same date
2. **1:1 without date match** — exact amount match, any date
3. **Many:1 with date match** — sum of multiple transactions matches one
4. **Many:1 without date match** — same, without date constraint

#### 3.3 Matching results UI
- Summary: X matched, Y unmatched per set
- List of auto-matches with rule that created them
- Ability to undo/review auto-matches

### Phase 4: Manual Matching (Day 9-11)

#### 4.1 Transaction matching UI
This is the core user-facing screen. Two-panel layout:
- **Left panel**: Unmatched transactions from Set 1 (ledger)
- **Right panel**: Unmatched transactions from Set 2 (bank)
- **Selection**: User selects one or more transactions from each side
- **Running total**: Show sum of selected on each side + difference
- **Match button**: Active when difference = 0 (or within tolerance)
- **Sorting/filtering**: By date, amount, description

#### 4.2 Match operations
- **Match**: Create match group, mark transactions as matched
- **Unmatch**: Reverse a previous match (auto or manual)
- **Match with difference**: If tolerance is enabled, create match + correction post

### Phase 5: Polish for Demo (Day 12-14)

#### 5.1 Dashboard
- Overview per client: total transactions, matched %, unmatched count
- Quick status indicators (green/yellow/red)

#### 5.2 Reconciliation summary
- Per client: Set 1 balance, Set 2 balance, matched total, unmatched total, difference
- Export/print capability (nice-to-have)

#### 5.3 Demo data
- Prepare realistic test data set with ~100 transactions
- Mix of easy matches (1:1) and tricky ones (many:1, near-misses)
- Show that automatic matching catches 70-80% and manual handles the rest

---

## 5. Technical Guidelines for AI-Assisted Development

### Cursor context setup
1. Add `DOMAIN_SPEC.md` and this file to the project root or `docs/` folder
2. Reference them in `.cursorrules` or Cursor settings as context files
3. When prompting Cursor for a feature, reference the specific section in these docs

### Code conventions
- **Server components by default** — only add "use client" when needed for interactivity
- **Server actions** for mutations (form submissions, matching operations)
- **API routes** only for webhooks and file uploads
- **Drizzle queries in lib/db/** — never raw SQL in components
- **Zod for validation** — validate all inputs at API boundaries
- **Error handling** — use Result types or try/catch with proper error messages

### Naming conventions
- Files: kebab-case (`transaction-table.tsx`)
- Components: PascalCase (`TransactionTable`)
- Database: snake_case (`match_status`)
- Types: PascalCase (`MatchingRule`)
- Use Norwegian terms in UI, English in code

### Multi-tenant security
- **Every database query must be scoped to tenant_id**
- Clerk organization ID = tenant_id
- Use middleware to extract and validate org context
- Supabase RLS as second layer of defense
- Never trust client-provided tenant_id — always derive from Clerk session

---

## 6. Environment Setup Checklist

- [ ] Create Next.js project with TypeScript + Tailwind
- [ ] Install and configure Clerk (with Organizations)
- [ ] Create Supabase project
- [ ] Set up Drizzle ORM with Supabase connection
- [ ] Run initial database migration
- [ ] Install shadcn/ui and initialize components
- [ ] Create basic layout (sidebar + header)
- [ ] Verify auth flow works (sign in → dashboard)
- [ ] Create storage bucket in Supabase for file uploads
- [ ] Seed database with test company + client + default rules
