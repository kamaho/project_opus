import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL.");
}

const globalForDb = globalThis as unknown as { _drizzle: ReturnType<typeof drizzle> | undefined };
if (!globalForDb._drizzle) {
  const client = postgres(connectionString, {
    max: 10,
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
