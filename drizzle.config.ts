import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle-kit does not load .env.local; load it so DATABASE_URL is set for migrate/studio.
// If DATABASE_URL is already set (e.g. by scripts/migrate-prod.ts), don't overwrite.
if (!process.env.DATABASE_URL) {
  config({ path: path.resolve(process.cwd(), ".env.local") });
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
