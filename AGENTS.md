# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Account Control is a Norwegian SaaS reconciliation platform for accounting firms. It is a **single Next.js 16 app** (App Router, Turbopack) using TypeScript, Tailwind CSS 4, shadcn/ui, Clerk (auth/orgs), Supabase (Postgres + Storage), and Drizzle ORM.

### Required secrets (env vars in `.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth (public) |
| `CLERK_SECRET_KEY` | Clerk auth (server) |
| `DATABASE_URL` | Supabase PostgreSQL connection (Session Pooler) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Storage URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

Without valid Clerk keys the middleware returns 500 on **every** request (including public routes like `/api/health`), because Clerk validates the publishable key format before route matching.

### Running the app

Standard commands are in `README.md` and `package.json` scripts. Key commands:

- `npm run dev` — starts dev server on port 3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)
- `npm run db:migrate` — Drizzle migrations (requires `DATABASE_URL`)
- `npm run seed` — seed demo data

### Known caveats

- **Pre-existing TypeScript error**: `npm run build` fails at the TypeScript check step with a type error in `src/app/api/clients/[clientId]/matching/route.ts` (`"import.permanently_deleted"` not assignable to `AuditAction`). The Turbopack compilation itself succeeds.
- **Pre-existing ESLint issues**: `npm run lint` exits with code 1 due to 7 errors and 27 warnings already in the codebase.
- **Sentry deprecation warnings**: `disableLogger` and `automaticVercelMonitors` emit deprecation warnings on every dev/build run. These are harmless.
- **Middleware deprecation**: Next.js 16 warns about the `middleware` file convention being deprecated in favor of `proxy`. This is non-blocking.
- **No `.env.example` in repo**: Despite README referencing `cp .env.example .env.local`, the file does not exist. Create `.env.local` manually with the required variables above.
- **UI language is Norwegian (bokmål)**, code/variables/commits are in English.
