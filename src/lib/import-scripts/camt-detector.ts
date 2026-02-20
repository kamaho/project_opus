/**
 * Gjenkjenner CAMT.053 vs CAMT.054 fra XML-filhodet og avgjør BBAN vs IBAN.
 * Se docs/import-scripts/02-camt053-import.md.
 */

const HEADER_SIZE = 12_000;

export interface CamtDetectionResult {
  type: "camt053" | "camt054";
  /** Ved true: bruk BBAN (AccountIdentification) for Kontonr; ellers IBAN */
  useBban: boolean;
  /** Filen inneholder "Camt053 Extended details starts"-kommentar */
  isExtended: boolean;
}

/**
 * Returnerer resultat hvis filen er CAMT.053 eller CAMT.054; ellers null.
 * Vi støtter ikke CAMT.054.
 */
export async function detectCamt(
  file: File
): Promise<CamtDetectionResult | null> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const likelyXml =
    ext === "xml" ||
    ext === "dat" ||
    file.type === "application/xml" ||
    file.type === "text/xml";

  const blob = file.slice(0, HEADER_SIZE);
  const text = await blob.text();

  const has054 = /xmlns=["']?[^"']*camt\.054[^"']*["']?/i.test(text);
  const has053 = /xmlns=["']?[^"']*camt\.053\.001\.02["']?/i.test(text);

  if (has054) {
    return { type: "camt054", useBban: false, isExtended: false };
  }
  if (has053) {
    const isExtended = /Camt053\s+Extended\s+details\s+starts/i.test(text);
    const useBban = /<Cd>\s*BBAN\s*<\/Cd>/i.test(text);
    return { type: "camt053", useBban, isExtended };
  }

  if (likelyXml && (text.includes("camt.053") || text.includes("camt.054"))) {
    if (text.includes("camt.054")) {
      return { type: "camt054", useBban: false, isExtended: false };
    }
    const isExtended = /Camt053\s+Extended\s+details\s+starts/i.test(text);
    const useBban = /<Cd>\s*BBAN\s*<\/Cd>/i.test(text);
    return { type: "camt053", useBban, isExtended };
  }

  return null;
}
