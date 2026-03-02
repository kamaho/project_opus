/**
 * Kjør migrasjoner mot PRODUKSJONS-databasen (Revizo Prod).
 * Bruk: Legg prod connection string i .env.prod.migrate (én linje: DATABASE_URL=postgresql://...)
 *       Deretter: npx tsx scripts/migrate-prod.ts
 * .env.prod.migrate er ignorert av git. Slett filen etterpå.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "node:child_process";

const envPath = resolve(process.cwd(), ".env.prod.migrate");
config({ path: envPath });

const prodUrl = process.env.DATABASE_URL;
if (!prodUrl || !prodUrl.includes("postgresql")) {
  console.error("Mangler DATABASE_URL i .env.prod.migrate");
  console.error("");
  console.error("1. Opprett fil .env.prod.migrate i prosjektroten med én linje:");
  console.error("   DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@...pooler.supabase.com:5432/postgres");
  console.error("   (Kopier fra Supabase Revizo Prod → Settings → Database → Connection string, Session pooler)");
  console.error("2. Kjør: npx tsx scripts/migrate-prod.ts");
  console.error("3. Slett .env.prod.migrate etterpå (aldri committ).");
  process.exit(1);
}

console.log("Kjører migrasjoner mot prod-DB …");
execSync("npx drizzle-kit migrate", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: prodUrl },
});
console.log("Ferdig. Husk å slette .env.prod.migrate.");
