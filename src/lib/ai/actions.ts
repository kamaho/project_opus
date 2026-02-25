import type Anthropic from "@anthropic-ai/sdk";
import { getClientSummary, getUnmatchedSummary } from "./context";
import { db } from "@/lib/db";
import { regulatoryDeadlines } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_client_status",
    description:
      "Hent status for en spesifikk klient/avstemmingsenhet: antall transaksjoner, umatchede poster, og matchinger. Bruk denne når brukeren spør om status på en klient.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "UUID for klienten/avstemmingsenheten",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "get_upcoming_deadlines",
    description:
      "Hent kommende norske regnskapsfrister. Returnerer frister sortert etter dato.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_ahead: {
          type: "number",
          description: "Antall dager fremover å se (default 30)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_unmatched_summary",
    description:
      "Hent oversikt over umatchede transaksjoner for alle klienter i organisasjonen. Viser hvilke klienter som har flest umatchede poster.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "navigate_to",
    description:
      "Naviger brukeren til en spesifikk side i Revizo. Returner URL-en som brukeren skal navigeres til.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Relativ URL-sti, f.eks. /dashboard/clients eller /dashboard/clients/[id]/matching",
        },
        description: {
          type: "string",
          description: "Kort beskrivelse av hvor brukeren navigeres",
        },
      },
      required: ["path"],
    },
  },
];

export async function executeAction(
  toolName: string,
  input: Record<string, unknown>,
  orgId: string
): Promise<unknown> {
  switch (toolName) {
    case "get_client_status": {
      const clientId = input.client_id as string;
      if (!clientId) return { error: "Mangler client_id" };
      const summary = await getClientSummary(clientId, orgId);
      if (!summary) return { error: "Fant ikke klient eller tilgang mangler" };
      return {
        klient: summary.name,
        totalt_transaksjoner: summary.totalTransactions,
        umatchede_mengde1: summary.unmatchedSet1,
        umatchede_mengde2: summary.unmatchedSet2,
        antall_matchinger: summary.matchCount,
      };
    }

    case "get_upcoming_deadlines": {
      const daysAhead = (input.days_ahead as number) ?? 30;
      const deadlines = await db
        .select({
          obligation: regulatoryDeadlines.obligation,
          title: regulatoryDeadlines.title,
          description: regulatoryDeadlines.description,
          frequency: regulatoryDeadlines.frequency,
          legalReference: regulatoryDeadlines.legalReference,
          legalUrl: regulatoryDeadlines.legalUrl,
          deadlineRule: regulatoryDeadlines.deadlineRule,
        })
        .from(regulatoryDeadlines)
        .where(
          sql`(${regulatoryDeadlines.validTo} IS NULL OR ${regulatoryDeadlines.validTo} >= CURRENT_DATE)`
        )
        .limit(20);

      return {
        frister: deadlines.map((d) => ({
          type: d.obligation,
          tittel: d.title,
          beskrivelse: d.description,
          frekvens: d.frequency,
          lovhenvisning: d.legalReference,
          url: d.legalUrl,
          regel: d.deadlineRule,
        })),
        merknad: `Viser ${deadlines.length} aktive frister. Verifiser alltid gjeldende frister på skatteetaten.no`,
      };
    }

    case "get_unmatched_summary": {
      const summary = await getUnmatchedSummary(orgId);
      return {
        klienter: summary.map((s) => ({
          klient: s.clientName,
          klient_id: s.clientId,
          umatchede: s.unmatched,
        })),
        totalt_umatchede: summary.reduce((acc, s) => acc + s.unmatched, 0),
      };
    }

    case "navigate_to": {
      return {
        navigated: true,
        path: input.path,
        description: input.description ?? "Navigert",
      };
    }

    default:
      return { error: `Ukjent verktøy: ${toolName}` };
  }
}
