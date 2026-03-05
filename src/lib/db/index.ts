import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL.");
}

// prepare:false is required for PgBouncer (Transaction Pooler, port 6543) compatibility.
// In production (serverless), max:1 prevents exhausting pool_size.
// In dev, we allow more connections so Promise.all queries actually run in parallel.
const isDev = process.env.NODE_ENV === "development";
const globalForDb = globalThis as unknown as { _drizzle: ReturnType<typeof drizzle> | undefined };
if (!globalForDb._drizzle) {
  const client = postgres(connectionString, {
    max: isDev ? 6 : 1,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    connection: {
      statement_timeout: 30_000,
    },
  });
  globalForDb._drizzle = drizzle(client, { schema });
}
export const db = globalForDb._drizzle;
export * from "./schema";
export { tenantScope } from "./tenant-queries";
export { verifyCompanyOwnership, verifyClientOwnership } from "./verify-ownership";
