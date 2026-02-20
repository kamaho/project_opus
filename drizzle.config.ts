import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle-kit does not load .env.local; load it so DATABASE_URL is set for migrate/studio
config({ path: path.resolve(process.cwd(), ".env.local") });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
