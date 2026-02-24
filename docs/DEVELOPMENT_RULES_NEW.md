# Development Rules & Best Practices

> These rules are mandatory for all code in this project. They ensure the codebase is
> production-grade, secure, and follows established conventions. Every feature, component,
> and API route must comply. No exceptions without explicit justification.

---

## 1. Security — Non-Negotiable

### Authentication & Authorization
- **Every server action and API route must verify authentication** via Clerk before doing anything else
- **Every database query must be scoped to the user's tenant** (Clerk organization ID). Never trust tenant_id from the client — always derive it from the Clerk session server-side
- Never expose internal IDs (database UUIDs) in URLs without verifying the requesting user has access to that resource
- Use Clerk's `auth()` in server components and `getAuth()` in API routes — never skip this step

### Data Validation
- **Validate all input at API boundaries using Zod schemas** — never trust client data
- Validate file uploads: check file type, size limits, and sanitize filenames before processing
- Validate and sanitize all query parameters and path parameters
- Never interpolate user input directly into SQL — always use Drizzle's parameterized queries

### Environment & Secrets
- Never commit `.env.local` or any file containing secrets
- Never log secrets, tokens, or sensitive user data
- Never expose server-side environment variables to the client (no `NEXT_PUBLIC_` prefix on secrets)
- Use `NEXT_PUBLIC_` prefix only for values that are safe to expose in the browser

### Database Security
- Row Level Security (RLS) is enabled on all tables as a second defense layer
- Never use Supabase service role key on the client side
- Never bypass RLS unless explicitly required and documented
- Always use parameterized queries through Drizzle — never raw string concatenation

---

## 2. Error Handling

### General Rules
- **Never swallow errors silently** — always log or handle them meaningfully
- Use try/catch around all async operations (database queries, file parsing, API calls)
- Return meaningful error messages to the user — but never expose internal details (stack traces, SQL errors, file paths)
- Use proper HTTP status codes: 400 for bad input, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 500 for server errors

### API Routes
```typescript
// Every API route should follow this pattern:
export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const { orgId, userId } = await auth();
    if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Validate input
    const body = await req.json();
    const parsed = mySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    // 3. Business logic (always scoped to tenant)
    const result = await db.query.myTable.findMany({
      where: eq(myTable.tenantId, orgId),
    });

    // 4. Return response
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/myroute failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Client-Side
- Show user-friendly error messages — never raw error objects
- Use loading states for all async operations
- Handle network failures gracefully (retry logic or clear feedback)

---

## 3. TypeScript

- **Strict mode is on — keep it on**. Never use `// @ts-ignore` or `// @ts-expect-error` without a documented reason
- Never use `any` — use `unknown` and narrow types properly
- Define explicit return types on all exported functions
- Use Zod schemas for runtime validation and infer TypeScript types from them:
  ```typescript
  const ImportSchema = z.object({
    clientId: z.string().uuid(),
    setNumber: z.union([z.literal(1), z.literal(2)]),
  });
  type ImportInput = z.infer<typeof ImportSchema>;
  ```
- Use discriminated unions for state management (loading/success/error patterns)

---

## 4. Database & Drizzle

- **All queries go through `src/lib/db/`** — never write raw SQL or Drizzle queries in components or API routes directly
- Create dedicated query functions:
  ```typescript
  // src/lib/db/queries/clients.ts
  export async function getClientsByTenant(tenantId: string) { ... }
  export async function getClientById(clientId: string, tenantId: string) { ... }
  ```
- **Always include tenant_id in WHERE clauses** — even if RLS is enabled, defense in depth matters
- Use transactions for operations that modify multiple tables
- Add proper indexes for frequently queried columns (already defined in schema)
- Use `RETURNING` clauses to avoid extra round-trips after INSERT/UPDATE

---

## 5. Project Structure & Code Organization

### File Naming
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase` in code, `kebab-case` filename
- Database/schema: `snake_case`
- Types/interfaces: `PascalCase`

### Component Rules
- **Server components by default** — only add `"use client"` when the component needs interactivity (event handlers, hooks, browser APIs)
- Keep components focused — one primary responsibility per component
- Extract business logic into hooks or utility functions, not inline in components
- Co-locate related files: component + its types + its specific hooks in the same folder

### Import Order
```typescript
// 1. React/Next.js
import { useState } from "react";
import { redirect } from "next/navigation";

// 2. External libraries
import { z } from "zod";
import { eq } from "drizzle-orm";

// 3. Internal modules
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";

// 4. Components
import { Button } from "@/components/ui/button";
import { TransactionTable } from "@/components/matching/transaction-table";

// 5. Types
import type { Client } from "@/lib/db/schema";
```

---

## 6. API Design

### 6.1 Internal API (Next.js Routes)

- Use Next.js App Router conventions: `route.ts` files in `src/app/api/`
- Use proper HTTP methods: GET for reads, POST for creates, PATCH for updates, DELETE for deletes
- Always return JSON with consistent shape:
  ```typescript
  // Success
  { data: T }
  // Error
  { error: string }
  ```
- Validate Content-Type headers on POST/PATCH
- Implement rate limiting considerations for file upload endpoints

### 6.2 Public API (Open API for External Consumers)

Account Control exposes a public REST API so that customers, partners and third-party
developers can read and write data programmatically. The public API lives under
`/api/v1/` and follows the same security rules as the rest of the application — but
uses API key authentication instead of Clerk session cookies.

#### Architecture Principle: API-First

All business logic is implemented in shared service functions (`src/lib/`). Both the
internal UI (server actions / internal API routes) and the public API call the same
service layer. This guarantees that the public API and the UI always behave identically.

```
┌──────────────┐     ┌──────────────┐
│  Next.js UI  │     │  Public API  │
│  (internal)  │     │  /api/v1/*   │
└──────┬───────┘     └──────┬───────┘
       │                     │
       │  server actions     │  route handlers
       │                     │
       └────────┬────────────┘
                │
        ┌───────▼────────┐
        │  Service Layer  │   src/lib/{domain}/actions.ts
        │  (shared logic) │   src/lib/{domain}/queries.ts
        └───────┬────────┘
                │
        ┌───────▼────────┐
        │  Drizzle / DB   │   Always tenant-scoped
        └────────────────┘
```

**Rule:** Never put business logic directly in a public API route handler. The handler
authenticates, validates input, calls a service function, and returns the result.

#### Authentication

Public API uses **API keys** scoped to a Clerk organization (tenant).

```typescript
// src/lib/api/auth.ts
export async function authenticateApiKey(req: Request): Promise<{
  tenantId: string;
  keyId: string;
} | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ac_")) return null;

  const apiKey = header.slice(7); // strip "Bearer "
  const hashedKey = hashApiKey(apiKey);

  const record = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.hashedKey, hashedKey),
      eq(apiKeys.revoked, false),
    ),
  });

  if (!record) return null;

  // Update last-used timestamp (fire-and-forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id))
    .execute();

  return { tenantId: record.tenantId, keyId: record.id };
}
```

**API Key rules:**
- Keys are prefixed `ac_live_` (production) and `ac_test_` (sandbox) for easy identification
- Keys are stored **hashed** (SHA-256) — the plaintext is shown once at creation and never again
- Keys are scoped to a single Clerk organization (tenant)
- Keys can have granular permissions (scopes): `read:reports`, `write:reports`, `read:companies`, etc.
- Keys can be revoked instantly from the UI
- Every key has an optional expiry date

**API Key database schema:**
```typescript
// Added to src/lib/db/schema.ts
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull(),           // Clerk org ID
  name: text("name").notNull(),                     // Human-readable label
  hashedKey: text("hashed_key").notNull().unique(),  // SHA-256 of the key
  prefix: text("prefix").notNull(),                  // First 8 chars for identification (ac_live_x...)
  scopes: text("scopes").array().notNull(),          // ["read:reports", "write:companies", ...]
  createdBy: text("created_by").notNull(),           // Clerk user ID
  expiresAt: timestamp("expires_at"),                // Optional expiry
  lastUsedAt: timestamp("last_used_at"),
  revoked: boolean("revoked").default(false).notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### Route Structure

```
src/app/api/v1/
├── companies/
│   ├── route.ts                    GET (list), POST (create)
│   └── [companyId]/
│       └── route.ts                GET (detail), PATCH (update)
├── reports/
│   ├── route.ts                    GET (list across companies)
│   └── [reportId]/
│       ├── route.ts                GET (detail), PATCH (update status/conclusion)
│       ├── lines/
│       │   └── route.ts            GET (list lines), POST (add line)
│       └── approve/
│           └── route.ts            POST (approve report)
├── reconciliation/
│   ├── bank/
│   │   └── route.ts                POST (trigger bank reconciliation)
│   ├── mva/
│   │   └── route.ts                POST (trigger MVA reconciliation)
│   └── payroll/
│       └── route.ts                POST (trigger payroll reconciliation)
├── tasks/
│   ├── route.ts                    GET (list), POST (create)
│   └── [taskId]/
│       └── route.ts                GET, PATCH, DELETE
├── webhooks/
│   └── route.ts                    GET (list subscriptions), POST (create subscription)
└── keys/
    └── route.ts                    GET (list keys), POST (create key), DELETE (revoke)
```

#### Route Handler Pattern

Every public API route handler follows this exact pattern:

```typescript
// src/app/api/v1/reports/route.ts
import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { requireScope } from "@/lib/api/scopes";
import { rateLimitByKey } from "@/lib/api/rate-limit";
import { getReportsByTenant } from "@/lib/reports/queries";
import { listReportsSchema } from "@/lib/reports/schemas";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    // 1. Authenticate
    const apiAuth = await authenticateApiKey(req);
    if (!apiAuth) {
      return NextResponse.json(
        { error: { code: "unauthorized", message: "Invalid or missing API key" } },
        { status: 401 }
      );
    }

    // 2. Check scope
    if (!requireScope(apiAuth.keyId, "read:reports")) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "API key lacks scope: read:reports" } },
        { status: 403 }
      );
    }

    // 3. Rate limit
    const rl = await rateLimitByKey(apiAuth.keyId);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: { code: "rate_limited", message: "Too many requests" } },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    // 4. Validate query params
    const url = new URL(req.url);
    const parsed = listReportsSchema.safeParse({
      companyId: url.searchParams.get("company_id"),
      reportType: url.searchParams.get("report_type"),
      status: url.searchParams.get("status"),
      periodYear: url.searchParams.get("period_year"),
      page: url.searchParams.get("page"),
      pageSize: url.searchParams.get("page_size"),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_error", message: "Invalid parameters", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    // 5. Call shared service (tenant-scoped)
    const result = await getReportsByTenant(apiAuth.tenantId, parsed.data);

    // 6. Return paginated response
    return NextResponse.json({
      data: result.items,
      pagination: {
        page: result.page,
        page_size: result.pageSize,
        total_items: result.totalItems,
        total_pages: result.totalPages,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/reports failed:", error);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
```

#### Response Format

All public API responses use a consistent envelope:

```typescript
// Success — single resource
{
  "data": { "id": "...", "report_type": "bank", ... }
}

// Success — collection (always paginated)
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_items": 342,
    "total_pages": 7
  }
}

// Error — always includes code + message
{
  "error": {
    "code": "validation_error",        // Machine-readable
    "message": "Invalid parameters",   // Human-readable (English)
    "details": { ... }                 // Optional: field-level errors
  }
}
```

**Response conventions:**
- Field names in `snake_case` (not camelCase) — industry standard for REST APIs
- Dates in ISO 8601 format (`2026-02-24T12:00:00Z`)
- Monetary amounts as strings with 2 decimal places to avoid floating point issues: `"1234.50"`
- Null fields are included (not omitted) for predictable response shapes
- Collection endpoints are always paginated — default `page_size: 50`, max `page_size: 100`

#### Rate Limiting

```typescript
// src/lib/api/rate-limit.ts
// Uses a sliding window counter stored in Supabase (or Redis if available)

const RATE_LIMITS = {
  default: { requests: 100, windowSeconds: 60 },    // 100 req/min
  bulk:    { requests: 10,  windowSeconds: 60 },     // 10 req/min for heavy ops
  webhook: { requests: 5,   windowSeconds: 60 },     // 5 subscription changes/min
} as const;
```

- Rate limits are per API key, not per tenant (a tenant can have multiple keys)
- Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers on every response
- Return `429 Too Many Requests` with `Retry-After` header when exceeded

#### Webhooks

Customers can subscribe to events so they don't have to poll. Webhook payloads are
signed with HMAC-SHA256 using a per-subscription secret.

**Available events:**
```
report.created          — A new reconciliation report was generated
report.completed        — A report status changed to completed
report.approved         — A report was approved
report.difference_found — Auto-import detected a new unexplained difference
task.created            — A new task was created (manual or system-generated)
task.overdue            — A task passed its due date without completion
task.completed          — A task was marked as completed
```

**Webhook payload:**
```json
{
  "id": "evt_abc123",
  "type": "report.approved",
  "created_at": "2026-02-24T12:00:00Z",
  "data": {
    "report_id": "...",
    "report_type": "mva",
    "company_id": "...",
    "period": "2026-01/2026-02",
    "approved_by": "user_..."
  }
}
```

**Webhook delivery rules:**
- POST to the subscriber's URL with `Content-Type: application/json`
- Include `X-AccountControl-Signature` header: `sha256=HMAC(payload, secret)`
- Retry up to 5 times with exponential backoff (1s, 5s, 30s, 2min, 10min)
- Disable subscription after 10 consecutive failures, notify tenant admin

**Webhook database schema:**
```typescript
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),                   // HMAC signing secret
  events: text("events").array().notNull(),            // ["report.approved", "task.created"]
  active: boolean("active").default(true).notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull().references(() => webhookSubscriptions.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  deliveredAt: timestamp("delivered_at"),
  nextRetryAt: timestamp("next_retry_at"),
  attempts: integer("attempts").default(0).notNull(),
  status: text("status").notNull(),                    // pending | delivered | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

#### Versioning

- API is versioned via URL path: `/api/v1/`
- Breaking changes require a new version (`/api/v2/`)
- Non-breaking additions (new fields, new endpoints) are added to the current version
- Deprecation: old versions get a 12-month sunset period with `Sunset` and `Deprecation` headers

#### API Documentation

- OpenAPI 3.1 spec is auto-generated from Zod schemas and route definitions
- Spec file lives at `src/app/api/v1/openapi.json` (generated at build time)
- Interactive docs served at `/api/docs` (Swagger UI or Scalar)
- Every endpoint, parameter, and response schema must have a description

#### CORS

```typescript
// src/middleware.ts (or per-route)
const PUBLIC_API_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
```

- Public API routes (`/api/v1/*`) allow CORS from any origin — access is controlled via API keys
- Internal routes (`/api/*` outside `/v1/`) do NOT set CORS headers

#### File Structure for Public API

```
src/lib/api/
├── auth.ts              — API key authentication
├── scopes.ts            — Permission/scope checking
├── rate-limit.ts        — Rate limiting logic
├── response.ts          — Helper functions for consistent response formatting
├── webhook-sender.ts    — Webhook delivery with retry logic
├── openapi-gen.ts       — OpenAPI spec generation from Zod schemas
└── types.ts             — Public API-specific types
```

#### Public API Security Checklist

- [ ] API key validated and hashed key looked up (never plaintext comparison)
- [ ] Scope checked for the specific operation
- [ ] Rate limit checked before any DB query
- [ ] Tenant ID derived from the API key, never from request body/params
- [ ] Input validated with Zod (same schemas as internal API)
- [ ] Response uses `snake_case` field naming
- [ ] No internal IDs or error details leaked in error responses
- [ ] Pagination enforced on all collection endpoints
- [ ] Webhook payloads signed with HMAC-SHA256

---

## 7. UI & UX Standards

### Accessibility
- All interactive elements must be keyboard accessible
- Use semantic HTML (`button` for actions, `a` for navigation, proper heading hierarchy)
- Include `aria-label` on icon-only buttons
- Ensure sufficient color contrast (use shadcn/ui defaults — they handle this)

### Loading & Feedback
- **Every async action must show a loading state** — button spinners, skeleton loaders, or progress indicators
- Disable buttons during submission to prevent double-clicks
- Show success/error toasts after mutations
- Use optimistic updates where appropriate for better perceived performance

### Forms
- Validate on submit, show inline field errors
- Disable submit button when form is invalid or submitting
- Preserve form state on error — never clear the form on a failed submission

### Language
- UI text in Norwegian (bokmål)
- Code (variable names, comments, docs) in English
- Error messages shown to users in Norwegian
- Console/log messages in English

---

## 8. Performance

- Use React Server Components to minimize client-side JavaScript
- Lazy-load heavy components (file parsers, large tables) with `dynamic()` or `React.lazy()`
- Paginate large data sets — never load all transactions at once. Default page size: 50
- Use `useMemo` and `useCallback` only when there's a measurable performance issue — don't optimize prematurely
- Debounce search/filter inputs (300ms)
- Use Supabase Storage for file uploads, not database BLOBs

---

## 9. Git & Code Quality

### Commits
- Write clear, descriptive commit messages
- One logical change per commit — don't mix unrelated changes
- Never commit generated files, `node_modules`, `.env.local`, or `.next/`

### Code Review Readiness
- No commented-out code in production
- No `console.log` left in production code — use proper logging if needed
- No `TODO` without a linked issue or ticket
- Remove unused imports, variables, and functions
- Run `npm run build` before pushing — it must pass without errors

---

## 10. Testing Mindset

While we're moving fast for MVP, write code that IS testable:
- Pure functions for business logic (matching engine, parsers) — no side effects
- Dependency injection where possible (pass db client as parameter, not global import)
- Keep server actions thin — delegate to testable service functions
- When we add tests, they should be straightforward to write because the code is well-structured

---

## Quick Checklist Before Every Feature

- [ ] Auth check on every server action / API route?
- [ ] Tenant scoping on every database query?
- [ ] Input validation with Zod?
- [ ] Error handling with try/catch?
- [ ] Loading states in UI?
- [ ] No secrets exposed to client?
- [ ] No `any` types?
- [ ] Norwegian UI text, English code?
- [ ] Works with keyboard navigation?
- [ ] Build passes (`npm run build`)?

### Additional Checks for Public API Endpoints

- [ ] API key authentication (not Clerk session)?
- [ ] Scope/permission check?
- [ ] Rate limiting applied?
- [ ] Response uses `snake_case` and consistent envelope format?
- [ ] Pagination on collection endpoints?
- [ ] OpenAPI schema updated?
- [ ] CORS headers set?
- [ ] Webhook events emitted where relevant?

---

## Project documentation

- **Endringshistorikk:** Endringer underveis dokumenteres i `docs/endringer/` som .md-filer (én per tema/dato). Se `docs/endringer/README.md` for bruk.
