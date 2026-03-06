/**
 * Header-signature utilities for parser config recognition.
 *
 * Exact match: SHA-256 of normalized, sorted column headers.
 * Fuzzy fallback: Jaccard similarity on header sets (threshold 0.85).
 */

const BANK_KEYWORDS = [
  "dnb", "nordea", "sparebank", "handelsbanken", "danske bank",
  "sbanken", "bnbank", "cultura", "storebrand", "klp",
];

const SOURCE_KEYWORDS = [
  "tripletex", "visma", "poweroffice", "fiken", "xledger",
  "uni economy", "24sevenoffice", "duett",
];

/** Normalize a header string for comparison: lowercase, trim, collapse whitespace. */
function normalize(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Compute a normalized, sorted header set from raw header values. */
export function headerSet(headers: string[]): string[] {
  return headers
    .map(normalize)
    .filter((h) => h.length > 0)
    .sort();
}

/** SHA-256 hex digest (works in both Node.js and browser via Web Crypto). */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const buf = await globalThis.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

/** Compute the header signature (SHA-256 of normalized sorted CSV of headers). */
export async function computeSignature(headers: string[]): Promise<string> {
  const set = headerSet(headers);
  return sha256(set.join(","));
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B| on normalized header sets. */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const x of setA) {
    if (setB.has(x)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export const FUZZY_THRESHOLD = 0.85;

/**
 * Auto-generate a descriptive config name from headers and file metadata.
 * Pattern: "[Source] - [type] ([fileType], [N] kolonner)"
 */
export function autoConfigName(
  headers: string[],
  fileType: "csv" | "excel",
  fileName?: string
): string {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const allText = lowerHeaders.join(" ") + " " + (fileName ?? "").toLowerCase();

  let source = "";
  for (const kw of BANK_KEYWORDS) {
    if (allText.includes(kw)) {
      source = kw.charAt(0).toUpperCase() + kw.slice(1);
      break;
    }
  }
  if (!source) {
    for (const kw of SOURCE_KEYWORDS) {
      if (allText.includes(kw)) {
        source = kw.charAt(0).toUpperCase() + kw.slice(1);
        break;
      }
    }
  }

  const typePart = fileType === "csv" ? "CSV" : "Excel";
  const colCount = headers.filter((h) => h.trim().length > 0).length;
  const prefix = source || "Ukjent kilde";

  return `${prefix} (${typePart}, ${colCount} kolonner)`;
}
