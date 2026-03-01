/**
 * One-off: add color and icon columns to client_groups.
 * Run: npx tsx scripts/run-migration-0010.ts
 */
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_MIGRATION_URL / DATABASE_URL is not set");
  process.exit(1);
}

async function run() {
  const sql = postgres(url!, { max: 1 });
  await sql.unsafe(`
    ALTER TABLE client_groups ADD COLUMN IF NOT EXISTS color text;
    ALTER TABLE client_groups ADD COLUMN IF NOT EXISTS icon text;
  `);
  console.log("Migrations applied: client_groups.color, client_groups.icon");
  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
