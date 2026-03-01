import path from "node:path";
import fs from "node:fs";
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
  const migrationPath = path.resolve(
    process.cwd(),
    "src/lib/db/migrations/0014_add_document_requests.sql"
  );
  const migration = fs.readFileSync(migrationPath, "utf-8");

  console.log("Running migration 0014_add_document_requests...");
  await sql.unsafe(migration);
  console.log("Migration completed successfully.");
  await sql.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
