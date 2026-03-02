import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL.");
}

// Serverless: max:1 prevents exhausting PgBouncer pool_size in Transaction mode.
// DATABASE_URL must use the Transaction Pooler (port 6543), NOT the Session Pooler (port 5432).
// prepare:false is required for PgBouncer compatibility.
const globalForDb = globalThis as unknown as { _drizzle: ReturnType<typeof drizzle> | undefined };
if (!globalForDb._drizzle) {
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  globalForDb._drizzle = drizzle(client, { schema });
}
export const db = globalForDb._drizzle;
export * from "./schema";
export { tenantScope } from "./tenant-queries";
export { verifyCompanyOwnership, verifyClientOwnership } from "./verify-ownership";
