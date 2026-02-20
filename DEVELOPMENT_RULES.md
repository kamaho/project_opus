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
- Use proper CORS headers if API will be accessed externally

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

---

## Project documentation

- **Endringshistorikk:** Endringer underveis dokumenteres i `docs/endringer/` som .md-filer (én per tema/dato). Se `docs/endringer/README.md` for bruk.
