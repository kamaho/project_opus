import type { FieldCondition, IndexedTransaction } from "../types";

/**
 * Resolve a field value from an IndexedTransaction by name.
 */
function resolveField(tx: IndexedTransaction, field: string): string | null {
  switch (field) {
    case "reference":
      return tx.reference;
    case "description":
      return tx.description;
    case "textCode":
    case "text_code":
      return tx.textCode;
    case "accountNumber":
    case "account_number":
      return tx.accountNumber;
    case "currency":
      return tx.currency;
    default:
      if (field.startsWith("dim")) return tx.dimensions[field] ?? null;
      return null;
  }
}

/**
 * Check one condition against a pair of transactions.
 * - If `compareField` is set, compare the field value on `a` against `compareField` on `b`.
 * - If `value` is set, compare the field value on `a` against the literal.
 */
function checkCondition(
  cond: FieldCondition,
  a: IndexedTransaction,
  b: IndexedTransaction
): boolean {
  const aVal = resolveField(a, cond.field);
  const target = cond.compareField ? resolveField(b, cond.compareField) : cond.value ?? null;

  if (aVal == null || target == null) return false;

  const aLower = aVal.toLowerCase();
  const tLower = target.toLowerCase();

  switch (cond.operator) {
    case "equals":
      return aLower === tLower;
    case "contains":
      return aLower.includes(tLower);
    case "starts_with":
      return aLower.startsWith(tLower);
    default:
      return false;
  }
}

/**
 * Check all conditions. Returns true if ALL conditions are satisfied
 * for the pair (a, b) — i.e. AND logic.
 */
export function allConditionsMatch(
  conditions: FieldCondition[],
  a: IndexedTransaction,
  b: IndexedTransaction
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => checkCondition(c, a, b));
}
