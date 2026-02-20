import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL.");
}

// Singleton: én pool per prosess for å unngå MaxClientsInSessionMode (Supabase Session pooler)
const globalForDb = globalThis as unknown as { _drizzle: ReturnType<typeof drizzle> | undefined };
if (!globalForDb._drizzle) {
  const client = postgres(connectionString, { max: 1 });
  globalForDb._drizzle = drizzle(client, { schema });
}
export const db = globalForDb._drizzle;
export * from "./schema";
