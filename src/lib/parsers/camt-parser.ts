import { XMLParser } from "fast-xml-parser";
import type { ParsedTransaction, ParseResult } from "./types";

/**
 * Nordea/BXD-leverandør sender ofte CAMT.053 pakket i en wrapper: ApplicationResponse (bxd.fi)
 * med den faktiske CAMT.053-XML base64-kodet i <Content>. Vi pakker ut og returnerer inner XML.
 */
function unwrapCamtContent(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<")) return raw;
  if (/xmlns=["']?[^"']*camt\.053/i.test(trimmed.slice(0, 1500))) return raw;

  const parser = new XMLParser({
    ignoreDeclaration: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  let doc: unknown;
  try {
    doc = parser.parse(raw);
  } catch {
    return raw;
  }

  const root = doc as Record<string, unknown>;
  let o: Record<string, unknown> = root;
  if (root["ApplicationResponse"] != null) o = root["ApplicationResponse"] as Record<string, unknown>;
  else if (root["Document"] != null) o = root["Document"] as Record<string, unknown>;
  else {
    for (const k of Object.keys(root)) {
      if (k.replace(/^[^:]+:/, "") === "ApplicationResponse" && root[k] != null && typeof root[k] === "object") {
        o = root[k] as Record<string, unknown>;
        break;
      }
    }
  }
  let b64Raw: string | undefined;
  if (typeof o["Content"] === "string") b64Raw = o["Content"];
  else if (o["Content"] != null && typeof o["Content"] === "object" && "#text" in (o["Content"] as object))
    b64Raw = (o["Content"] as Record<string, unknown>)["#text"] as string;
  else {
    for (const k of Object.keys(o)) {
      if (k.replace(/^[^:]+:/, "") === "Content") {
        const v = o[k];
        if (typeof v === "string") b64Raw = v;
        else if (v != null && typeof v === "object" && "#text" in (v as object))
          b64Raw = (v as Record<string, unknown>)["#text"] as string;
        break;
      }
    }
  }
  const b64 = typeof b64Raw === "string" ? b64Raw.replace(/\s/g, "") : "";
  if (b64) {
    try {
      const decoded =
        typeof Buffer !== "undefined"
          ? Buffer.from(b64, "base64").toString("utf-8")
          : new TextDecoder().decode(
              Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
            );
      if (
        decoded.includes("camt.053") ||
        (decoded.includes("Document") && decoded.includes("BkToCstmrStmt"))
      ) {
        return decoded;
      }
    } catch {
      /* ignore */
    }
  }
  return raw;
}

/**
 * Sjekk at filen er CAMT.053 og ikke CAMT.054. Vi støtter ikke CAMT.054.
 */
function assertCamt053(xmlContent: string): string | null {
  const head = xmlContent.slice(0, 2000);
  if (/xmlns=["']?[^"']*camt\.054[^"']*["']?/i.test(head)) {
    return "Filen er CAMT.054. Vi støtter kun CAMT.053. Be banken om kun å sende CAMT.053.";
  }
  if (!/xmlns=["']?[^"']*camt\.053\.001\.02["']?/i.test(head) && !/camt\.053/i.test(head)) {
    return "Filen ser ikke ut til å være CAMT.053 (bankuttalelse). Sjekk at xmlns er urn:iso:std:iso:20022:tech:xsd:camt.053.001.02";
  }
  return null;
}

/**
 * Hent første tekstverdi for en sti av tag-navn (lokal navn, vilkårlig namespace).
 */
function findInObj(obj: unknown, ...localNames: string[]): string | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const local = key.replace(/^[^:]+:/, "");
    if (localNames.includes(local)) {
      const val = o[key];
      if (typeof val === "string") return val;
      if (typeof val === "number") return String(val);
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        const nested = findInObj(val, "Dt", "DtTm", "Amt", "Cd", "Prtry", "Id");
        if (nested !== undefined) return nested;
      }
    }
  }
  return undefined;
}

/**
 * Hent objekt med angitt lokal tag (for å lese attributter).
 */
function findObjByLocalName(obj: unknown, localName: string): Record<string, unknown> | undefined {
  if (obj == null || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const local = key.replace(/^[^:]+:/, "");
    if (local === localName) {
      const val = o[key];
      if (typeof val === "object" && val !== null && !Array.isArray(val)) return val as Record<string, unknown>;
    }
  }
  return undefined;
}

function getAmountRaw(ntry: Record<string, unknown>): { amount: string; ccy?: string } {
  const amtObj = findObjByLocalName(ntry, "Amt");
  if (amtObj) {
    const amount = amtObj["#text"] != null ? String(amtObj["#text"]) : findInObj(ntry, "Amt");
    const ccy = typeof amtObj["@_Ccy"] === "string" ? amtObj["@_Ccy"] : undefined;
    return { amount: amount ?? "0", ccy };
  }
  const amount = findInObj(ntry, "Amt");
  return { amount: amount ?? "0" };
}

function getDate(ntry: Record<string, unknown>): string {
  const bookgDt = findObjByLocalName(ntry, "BookgDt");
  if (bookgDt) {
    const dt = findInObj(bookgDt, "Dt", "DtTm");
    if (dt) return dt.slice(0, 10);
  }
  const valDt = findObjByLocalName(ntry, "ValDt");
  if (valDt) {
    const dt = findInObj(valDt, "Dt");
    if (dt) return dt.slice(0, 10);
  }
  return "";
}

function getCdtDbtInd(ntry: Record<string, unknown>): "CRDT" | "DBIT" | null {
  const ind = findInObj(ntry, "CdtDbtInd");
  if (ind === "CRDT" || ind === "DBIT") return ind;
  return null;
}

/** RmtInf/Ustrd (ustrukturert remittance) – brukes som Tekst/description. Sjekker både Ntry-nivå og NtryDtls/TxDtls. */
function getUstrd(ntry: Record<string, unknown>): string {
  const rmtInf = findObjByLocalName(ntry, "RmtInf");
  if (rmtInf) {
    const ustrd = rmtInf["Ustrd"];
    if (typeof ustrd === "string") return ustrd;
    const fromRmt = findInObj(rmtInf, "Ustrd", "Strd");
    if (fromRmt) return fromRmt;
  }
  const ntryDtls = findObjByLocalName(ntry, "NtryDtls");
  if (ntryDtls) {
    const txDtls = Array.isArray(ntryDtls["TxDtls"]) ? ntryDtls["TxDtls"][0] : ntryDtls["TxDtls"];
    if (txDtls && typeof txDtls === "object") {
      const rmt = findObjByLocalName(txDtls as Record<string, unknown>, "RmtInf");
      if (rmt) return findInObj(rmt, "Ustrd", "Strd") ?? "";
    }
  }
  return "";
}

/** Refs/EndToEndId eller AcctSvcrRef som referanse. */
function getRef(ntry: Record<string, unknown>): string {
  const ntryRef = findInObj(ntry, "NtryRef");
  if (ntryRef) return ntryRef;
  const acctSvcrRef = findInObj(ntry, "AcctSvcrRef");
  if (acctSvcrRef) return acctSvcrRef;
  const ntryDtls = findObjByLocalName(ntry, "NtryDtls");
  if (ntryDtls) {
    const txDtls = Array.isArray(ntryDtls["TxDtls"]) ? ntryDtls["TxDtls"][0] : ntryDtls["TxDtls"];
    if (txDtls && typeof txDtls === "object") {
      const refs = (txDtls as Record<string, unknown>)["Refs"];
      if (refs && typeof refs === "object") {
        const endToEndId = findInObj(refs, "EndToEndId", "InstrId", "TxId");
        if (endToEndId) return endToEndId;
      }
    }
  }
  const rmtInf = findObjByLocalName(ntry, "RmtInf");
  if (rmtInf) return findInObj(rmtInf, "Ustrd", "Strd") ?? "";
  return "";
}

function getAddtlNtryInf(ntry: Record<string, unknown>): string {
  return findInObj(ntry, "AddtlNtryInf") ?? "";
}

function getAcctSvcrRef(ntry: Record<string, unknown>): string {
  return findInObj(ntry, "AcctSvcrRef") ?? "";
}

/** Hent AddtlTxInf fra NtryDtls/TxDtls. */
function getAddtlTxInf(ntry: Record<string, unknown>): string {
  const ntryDtls = findObjByLocalName(ntry, "NtryDtls");
  if (!ntryDtls) return "";
  const txDtls = Array.isArray(ntryDtls["TxDtls"]) ? ntryDtls["TxDtls"][0] : ntryDtls["TxDtls"];
  if (txDtls && typeof txDtls === "object") return findInObj(txDtls as Record<string, unknown>, "AddtlTxInf") ?? "";
  return "";
}

/** Kontonummer fra Stmt: Acct/Id/IBAN eller Acct/Id/Othr/Id (BBAN/AccountIdentification). */
function getAccountFromStmt(stmt: Record<string, unknown>): string | undefined {
  const acct = findObjByLocalName(stmt, "Acct");
  if (!acct) return undefined;
  const id = findObjByLocalName(acct, "Id");
  if (!id) return undefined;
  const iban = findInObj(id, "IBAN");
  if (iban) return iban;
  const othr = findObjByLocalName(id, "Othr");
  if (othr) return findInObj(othr, "Id") ?? undefined;
  return undefined;
}

/** Valuta fra første Bal eller første Ntry/Amt i Stmt. */
function getCurrencyFromStmt(stmt: Record<string, unknown>): string | undefined {
  const balArr = stmt["Bal"];
  const bals = Array.isArray(balArr) ? balArr : balArr ? [balArr] : [];
  for (const b of bals) {
    if (b && typeof b === "object") {
      const amtObj = findObjByLocalName(b, "Amt");
      if (amtObj && typeof amtObj["@_Ccy"] === "string") return amtObj["@_Ccy"];
    }
  }
  const ntryArr = stmt["Ntry"];
  const ntrys = Array.isArray(ntryArr) ? ntryArr : ntryArr ? [ntryArr] : [];
  for (const n of ntrys) {
    if (n && typeof n === "object") {
      const { ccy } = getAmountRaw(n as Record<string, unknown>);
      if (ccy) return ccy;
    }
  }
  return undefined;
}

interface StmtContext {
  accountNumber?: string;
  currency?: string;
  entries: Record<string, unknown>[];
}

/** Samle alle Stmt med tilhørende Ntry og kontekst (konto, valuta). */
function collectStmts(obj: unknown, out: StmtContext[]): void {
  if (obj == null || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const local = key.replace(/^[^:]+:/, "");
    if (local === "Stmt") {
      const val = o[key];
      const stmt = Array.isArray(val) ? val[0] : val;
      if (stmt && typeof stmt === "object") {
        const stmtObj = stmt as Record<string, unknown>;
        const entries: Record<string, unknown>[] = [];
        const ntryVal = stmtObj["Ntry"];
        if (ntryVal && typeof ntryVal === "object" && !Array.isArray(ntryVal)) entries.push(ntryVal as Record<string, unknown>);
        else if (Array.isArray(ntryVal)) ntryVal.forEach((v) => { if (v && typeof v === "object") entries.push(v as Record<string, unknown>); });
        out.push({
          accountNumber: getAccountFromStmt(stmtObj),
          currency: getCurrencyFromStmt(stmtObj),
          entries,
        });
      }
      if (Array.isArray(val) && val.length > 1) {
        val.slice(1).forEach((stmt) => {
          if (stmt && typeof stmt === "object") {
            const stmtObj = stmt as Record<string, unknown>;
            const entries: Record<string, unknown>[] = [];
            const ntryVal = stmtObj["Ntry"];
            if (ntryVal && typeof ntryVal === "object" && !Array.isArray(ntryVal)) entries.push(ntryVal as Record<string, unknown>);
            else if (Array.isArray(ntryVal)) ntryVal.forEach((v) => { if (v && typeof v === "object") entries.push(v as Record<string, unknown>); });
            out.push({
              accountNumber: getAccountFromStmt(stmtObj),
              currency: getCurrencyFromStmt(stmtObj),
              entries,
            });
          }
        });
      }
    } else if (local === "BkToCstmrStmt" || local === "Document") {
      const val = o[key];
      if (Array.isArray(val)) val.forEach((v) => collectStmts(v, out));
      else collectStmts(val, out);
    }
  }
}

export function parseCamt(xmlContent: string): ParseResult {
  const errors: string[] = [];
  const xml = unwrapCamtContent(xmlContent);
  const reject054 = assertCamt053(xml);
  if (reject054) {
    return { transactions: [], errors: [reject054] };
  }

  const parser = new XMLParser({
    ignoreDeclaration: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: true,
  });

  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid XML");
    return { transactions: [], errors };
  }

  const stmts: StmtContext[] = [];
  collectStmts(doc, stmts);

  const transactions: ParsedTransaction[] = [];
  let idx = 0;
  for (const { accountNumber, currency, entries } of stmts) {
    for (const ntry of entries) {
      idx += 1;
      const { amount: amountStr, ccy } = getAmountRaw(ntry);
      const cdtDbt = getCdtDbtInd(ntry);
      const sign: "+" | "-" = cdtDbt === "DBIT" ? "-" : "+";
      const date1 = getDate(ntry);
      if (!date1) errors.push(`Post ${idx}: mangler dato`);

      const ustrd = getUstrd(ntry);
      const ref = getRef(ntry);
      const addtlNtryInf = getAddtlNtryInf(ntry);
      const acctSvcrRef = getAcctSvcrRef(ntry);
      const addtlTxInf = getAddtlTxInf(ntry);

      transactions.push({
        amount: amountStr,
        date1: date1 ? date1.slice(0, 10) : "1970-01-01",
        sign,
        accountNumber: accountNumber ?? undefined,
        currency: ccy ?? currency ?? "NOK",
        reference: ref || undefined,
        description: ustrd || addtlNtryInf || acctSvcrRef || undefined,
        dim4: acctSvcrRef || undefined,
        dim6: addtlTxInf || undefined,
      });
    }
  }

  return { transactions, errors };
}
