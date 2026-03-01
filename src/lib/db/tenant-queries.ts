import { db } from "./index";
import { eq, and, type SQL } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";

type TableWithTenantId = PgTableWithColumns<
  TableConfig & { columns: { tenantId: unknown } }
>;

/**
 * Returnerer et objekt med tenant-scoped query-metoder.
 * Alle queries filtrerer automatisk på tenant_id.
 *
 * Bruk:
 *   const { tenantId } = await requireTenant();
 *   const scoped = tenantScope(tenantId);
 *   const rows = await scoped.findMany(companies);
 */
export function tenantScope(tenantId: string) {
  return {
    async findMany<T extends TableWithTenantId>(table: T, where?: SQL) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle's table generics require casting for dynamic column access
      const tenantFilter = eq((table as any).tenantId, tenantId);
      const fullFilter = where ? and(tenantFilter, where) : tenantFilter;
      return db.select().from(table).where(fullFilter);
    },

    async insertOne<T extends TableWithTenantId>(
      table: T,
      data: Record<string, unknown>
    ) {
      return db
        .insert(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic values require cast
        .values({ ...data, tenantId } as any)
        .returning();
    },

    async update<T extends TableWithTenantId>(
      table: T,
      data: Record<string, unknown>,
      where: SQL
    ) {
      return db
        .update(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic values require cast
        .set(data as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle table generic
        .where(and(eq((table as any).tenantId, tenantId), where))
        .returning();
    },

    async delete<T extends TableWithTenantId>(table: T, where: SQL) {
      return db
        .delete(table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle table generic
        .where(and(eq((table as any).tenantId, tenantId), where))
        .returning();
    },
  };
}
