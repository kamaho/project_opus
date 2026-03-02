/**
 * One-time migration: encrypts existing plaintext Tripletex tokens.
 *
 * Usage:
 *   npx tsx scripts/encrypt-tripletex-tokens.ts
 *
 * Prerequisites:
 *   - ENCRYPTION_KEY must be set in environment
 *   - DATABASE_URL must be set in environment
 *
 * Safe to run multiple times — skips already-encrypted values.
 */

import "dotenv/config";
import { db } from "../src/lib/db";
import { tripletexConnections } from "../src/lib/db/schema";
import { encrypt, isEncrypted } from "../src/lib/crypto";
import { eq } from "drizzle-orm";

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error("ERROR: ENCRYPTION_KEY not set. Generate with: openssl rand -hex 32");
    process.exit(1);
  }

  const connections = await db
    .select({
      id: tripletexConnections.id,
      tenantId: tripletexConnections.tenantId,
      consumerToken: tripletexConnections.consumerToken,
      employeeToken: tripletexConnections.employeeToken,
    })
    .from(tripletexConnections);

  console.log(`Found ${connections.length} Tripletex connection(s)`);

  let encrypted = 0;
  let skipped = 0;

  for (const conn of connections) {
    const consumerAlreadyEncrypted = isEncrypted(conn.consumerToken);
    const employeeAlreadyEncrypted = isEncrypted(conn.employeeToken);

    if (consumerAlreadyEncrypted && employeeAlreadyEncrypted) {
      console.log(`  [skip] ${conn.tenantId} — already encrypted`);
      skipped++;
      continue;
    }

    const encryptedConsumer = consumerAlreadyEncrypted
      ? conn.consumerToken
      : encrypt(conn.consumerToken);
    const encryptedEmployee = employeeAlreadyEncrypted
      ? conn.employeeToken
      : encrypt(conn.employeeToken);

    await db
      .update(tripletexConnections)
      .set({
        consumerToken: encryptedConsumer,
        employeeToken: encryptedEmployee,
        updatedAt: new Date(),
      })
      .where(eq(tripletexConnections.id, conn.id));

    console.log(`  [encrypted] ${conn.tenantId}`);
    encrypted++;
  }

  console.log(`\nDone: ${encrypted} encrypted, ${skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
