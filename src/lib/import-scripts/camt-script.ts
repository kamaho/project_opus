/**
 * Ferdige CAMT.053-importscript (IBAN/BBAN, alle poster vs sum-poster).
 * Se docs/import-scripts/02-camt053-import.md.
 */

export interface CamtScriptOptions {
  useBban: boolean;
  sumRecords: boolean;
}

export function getCamt053Script(opts: CamtScriptOptions): string {
  const { useBban, sumRecords } = opts;

  if (sumRecords) {
    return [
      "FILETYPE;CAMT",
      "BARENYE;Dato1;",
      "BARENYE;Belop;",
      "PARSEMODE;SUMRECORDS;",
      "SIGNSWITCH;Belop LIKE \'%%\'",
      "[Transer]",
      "Kontonr;AccountIdentification",
      "Valutakode;CurrencyCode",
      "Belop;TxAmt",
      "Valbelop;TxAmt",
      "Dato1;Dato1",
      "Dim1;Proprietary",
      "Dim2;Dim2",
      "Dim3;CodeOrProprietary",
      "Dim4;AcctSvcrRef",
      "Dim5;RmtInf",
      "Dim6;Ustrd",
      "Dim7;AddtlTxInf",
      "Ref;Text",
      "Tekst;Proprietary",
      "Tekstkode;AccountIdentification",
      "Fortegn;Fortegn",
      "CHECKDUPLICATES",
      "",
    ].join("\n");
  }

  const kontonrLine = useBban
    ? "Kontonr;AccountIdentification"
    : "Kontonr;Iban";
  return [
    "FILETYPE;CAMT",
    "BARENYE;Dato1;",
    "BARENYE;Belop;",
    "BARENYE;Dim2;",
    "PARSEMODE;ALLRECORDSWITHOUTREMITTANCE;",
    "SIGNSWITCH;Belop LIKE \'%%\'",
    "[Transer]",
    kontonrLine,
    "Dato1;Dato1",
    "Belop;Belop",
    "Valbelop;Belop",
    "MotBelop;MotBelop",
    "Valutakode;CurrencyCode",
    "Ref;Ref",
    "Dim1;Dim1",
    "Dim2;Dim2;Fallback=\"TOM\"",
    "Dim3;Text",
    "Dim4;RmtInf",
    "Dim5;AcctSvcrRef",
    "Dim6;AddtlTxInf",
    "Dim7;CodeOrProprietary",
    "Tekst;Ustrd",
    "Tekstkode;AccountIdentification",
    "Fortegn;Fortegn",
    "",
  ].join("\n");
}
