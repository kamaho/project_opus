import type { GuardrailResult, QueryClassification, QueryCategory } from "./types";

const BLOCKED_PATTERNS: RegExp[] = [
  /du (bør|skal|kan|må) (bokføre|føre|trekke fra|avskrive|aktivere)/i,
  /skattemessig (anbefal|foreslå|mener|tror)/i,
  /jeg anbefaler at du/i,
  /mitt råd er/i,

  /her er (et dikt|en historie|en vits|et eventyr)/i,
  /(skrive|lage|generere) (kode|program|script) for/i,
  /(accountflow|tripletex|visma|xledger|fiken|poweroffice) er (bedre|dårligere|billigere)/i,

  /personnummer/i,
  /bankkontonummer\s*[:=]\s*\d/i,
];

const REQUIRED_DISCLAIMERS: Record<string, string> = {
  deadline: "Verifiser alltid gjeldende frister på skatteetaten.no",
  tax_rule:
    "Dette er generell informasjon — kontakt revisor eller Skatteetaten for din situasjon",
};

export function validateResponse(
  response: string,
  queryType?: QueryCategory
): GuardrailResult {
  const warnings: string[] = [];
  let filtered = response;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(filtered)) {
      warnings.push(`Blokkert mønster: ${pattern.source}`);
      filtered = filtered.replace(
        pattern,
        "[Fjernet — utenfor Revizo sitt område]"
      );
    }
  }

  if (queryType === "deadline" && !filtered.includes("skatteetaten.no")) {
    filtered += `\n\n_${REQUIRED_DISCLAIMERS.deadline}_`;
  }
  if (
    queryType === "tax_rule" &&
    !filtered.includes("revisor") &&
    !filtered.includes("Skatteetaten")
  ) {
    filtered += `\n\n_${REQUIRED_DISCLAIMERS.tax_rule}_`;
  }

  if (response.length > 2000) {
    warnings.push("Respons over 2000 tegn — kan indikere off-topic");
  }

  return { safe: warnings.length === 0, filteredResponse: filtered, warnings };
}

export function classifyQuery(message: string): QueryClassification {
  const lower = message.toLowerCase();

  if (
    /smartmatch|account\s*control|avvik|avstemming|rapport|oppgave|sftp|klient|import|matching|innlesning|eksport/.test(
      lower
    )
  )
    return { onTopic: true, category: "product", confidence: 0.95 };

  if (
    /frist|termin|mva|a-melding|skattemelding|forskuddsskatt|årsregnskap/.test(
      lower
    )
  )
    return { onTopic: true, category: "deadline", confidence: 0.9 };

  if (
    /status|umatchet|transaksjoner|saldo|balanse/.test(lower) &&
    /klient|bedrift|firma|selskap/.test(lower)
  )
    return { onTopic: true, category: "client_data", confidence: 0.9 };

  if (
    /aga|arbeidsgiveravgift|feriepenger|skattetrekk|lønn|a-melding/.test(lower)
  )
    return { onTopic: true, category: "tax_rule", confidence: 0.85 };

  if (
    /skriv (et dikt|en sang|en historie|kode for)|oversett til|hva synes du om|fortell meg en vits/.test(
      lower
    )
  )
    return { onTopic: false, category: "off_topic", confidence: 0.95 };

  if (
    /politikk|religion|fotball|oppskrift|trening|film|musikk|spill/.test(lower)
  )
    return { onTopic: false, category: "off_topic", confidence: 0.85 };

  return { onTopic: true, category: "product", confidence: 0.5 };
}

export const OFF_TOPIC_RESPONSE =
  "Jeg er Revizo sin produktassistent og kan hjelpe deg med avstemming, frister, rapporter og alt annet i Revizo. Hva kan jeg hjelpe deg med?";
