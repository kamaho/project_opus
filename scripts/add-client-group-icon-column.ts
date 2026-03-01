/**
 * Add icon column to client_groups (if missing).
 * Run: npx tsx scripts/add-client-group-icon-column.ts
 * Uses DATABASE_URL from .env.local.
 */
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Set it in .env.local.");
  process.exit(1);
}

async function run() {
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(
      "ALTER TABLE client_groups ADD COLUMN IF NOT EXISTS icon text;"
    );
    console.log("OK: client_groups.icon column is present.");
  } finally {
    await sql.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
