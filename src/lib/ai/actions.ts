import type Anthropic from "@anthropic-ai/sdk";
import { getClientSummary, getUnmatchedSummary, getOrgContacts } from "./context";
import { db } from "@/lib/db";
import { regulatoryDeadlines } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { validateClientTenant } from "@/lib/db/tenant";
import { runAutoMatch } from "@/lib/matching/engine";
import { logAudit } from "@/lib/audit";
import { notifySmartMatchCompleted } from "@/lib/notifications";
import { buildMatchingViewModel } from "@/lib/export/templates/matching/matching-viewmodel";
import { renderMatchingPdf } from "@/lib/export/templates/matching/matching-pdf";
import { sendAgentReportEmail } from "@/lib/resend";
import { clerkClient } from "@clerk/nextjs/server";

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
  {
    name: "run_smart_match",
    description:
      "Kjør Smart Match (automatisk avstemming) for en klient. " +
      "Matcher transaksjoner i mengde 1 og mengde 2 automatisk basert på beløp, dato og regler. " +
      "Bruk denne NÅR brukeren ber om å kjøre matching, avstemming, eller Smart Match. " +
      "Brukeren må være på matchingsiden for den aktuelle klienten.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "UUID for klienten/avstemmingsenheten som skal matches",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "send_report_email",
    description:
      "Generer en PDF-rapport med åpne poster og send den til en mottaker på e-post. " +
      "Bruk denne når brukeren bekrefter at de ønsker å sende rapporten på e-post, " +
      "typisk etter at Smart Match er kjørt. Hvis brukeren oppgir en e-postadresse, " +
      "send til den adressen. Ellers sendes til brukerens egen e-post.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_id: {
          type: "string",
          description: "UUID for klienten/avstemmingsenheten",
        },
        recipient_email: {
          type: "string",
          description:
            "E-postadresse til mottaker. Hvis ikke oppgitt, sendes til brukerens egen e-post. " +
            "Bruk lookup_contact først for å finne e-post basert på navn eller rolle.",
        },
        match_count: {
          type: "number",
          description: "Antall nye matcher fra siste Smart Match (valgfri, for e-postoppsummering)",
        },
        transaction_count: {
          type: "number",
          description: "Antall transaksjoner matchet fra siste Smart Match (valgfri)",
        },
      },
      required: ["client_id"],
    },
  },
  {
    name: "lookup_contact",
    description:
      "Slå opp en kontaktperson fra organisasjonens kontaktliste basert på navn eller rolle. " +
      "Bruk denne når brukeren refererer til en person ved navn (f.eks. 'Kari') eller rolle (f.eks. 'revisor') " +
      "for å finne e-postadressen deres. Returnerer treff fra kontaktlisten.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Navn, rolle eller e-post å søke etter (f.eks. 'revisor', 'Kari Nordmann', 'kari@firma.no')",
        },
      },
      required: ["query"],
    },
  },
];

export async function executeAction(
  toolName: string,
  input: Record<string, unknown>,
  orgId: string,
  userId?: string
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

    case "run_smart_match": {
      const clientId = input.client_id as string;
      if (!clientId) return { error: "Mangler client_id" };
      if (!userId) return { error: "Mangler bruker-kontekst" };

      const clientRow = await validateClientTenant(clientId, orgId);
      if (!clientRow) return { error: "Fant ikke klient eller tilgang mangler" };

      try {
        const result = await runAutoMatch(clientId, userId);

        if (result.totalMatches > 0) {
          await logAudit({
            tenantId: orgId,
            userId,
            action: "match.created",
            entityType: "match",
            metadata: {
              type: "auto-ai",
              matchCount: result.totalMatches,
              transactionCount: result.totalTransactions,
            },
          });

          notifySmartMatchCompleted({
            tenantId: orgId,
            userId,
            clientId,
            clientName: clientRow.name,
            matchCount: result.totalMatches,
            transactionCount: result.totalTransactions,
            periodFrom: result.periodFrom,
            periodTo: result.periodTo,
            remainingOpen: result.remainingOpen,
            totalItems: result.totalItems,
          }).catch((e) => console.error("[ai smart-match] notification failed:", e));
        }

        const pct =
          result.totalItems > 0
            ? Math.round(
                ((result.totalItems - result.remainingOpen) / result.totalItems) * 100
              )
            : 0;

        return {
          success: true,
          klient: clientRow.name,
          antall_matchinger: result.totalMatches,
          antall_transaksjoner_matchet: result.totalTransactions,
          prosent_avstemt: pct,
          gjenstaende_poster: result.remainingOpen,
          totalt_poster: result.totalItems,
          periode_fra: result.periodFrom ?? null,
          periode_til: result.periodTo ?? null,
          varighet_ms: result.durationMs,
          _matchGroups: result.matchGroups,
        };
      } catch (err) {
        console.error("[ai smart-match] Failed:", err);
        return { error: "Smart Match feilet. Prøv igjen." };
      }
    }

    case "send_report_email": {
      const clientId = input.client_id as string;
      if (!clientId) return { error: "Mangler client_id" };
      if (!userId) return { error: "Mangler bruker-kontekst" };

      const clientRow = await validateClientTenant(clientId, orgId);
      if (!clientRow) return { error: "Fant ikke klient eller tilgang mangler" };

      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        const userEmail = user.emailAddresses[0]?.emailAddress;
        const fullName = user.fullName ?? user.firstName ?? "bruker";

        const recipientEmail = (input.recipient_email as string) || userEmail;
        if (!recipientEmail) {
          return { error: "Kunne ikke finne e-postadresse. Oppgi en mottakeradresse eller sjekk kontoen din." };
        }

        const recipientName = recipientEmail === userEmail ? fullName : recipientEmail.split("@")[0];

        const vm = await buildMatchingViewModel(
          { clientId, reportType: "open" },
          { tenantId: orgId, userId, userEmail: userEmail ?? recipientEmail }
        );

        const pdfBuffer = await renderMatchingPdf(vm);
        const reportDate = new Date().toISOString().slice(0, 10);

        await sendAgentReportEmail({
          toEmail: recipientEmail,
          userName: recipientName,
          clientName: clientRow.name,
          matchCount: (input.match_count as number) ?? 0,
          transactionCount: (input.transaction_count as number) ?? 0,
          openItemsSet1: vm.antallSet1 ?? 0,
          openItemsSet2: vm.antallSet2 ?? 0,
          totalSet1: vm.totalSet1 ?? 0,
          totalSet2: vm.totalSet2 ?? 0,
          link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/clients/${clientId}/matching`,
          pdfBuffer,
          reportDate,
        });

        return {
          success: true,
          sendt_til: recipientEmail,
          klient: clientRow.name,
          rapport_innhold: "Åpne poster med saldo og differanse",
        };
      } catch (err) {
        console.error("[ai send-report] Failed:", err);
        return { error: "Klarte ikke å generere eller sende rapporten. Prøv igjen." };
      }
    }

    case "lookup_contact": {
      const query = ((input.query as string) ?? "").toLowerCase().trim();
      if (!query) return { error: "Mangler søkeord" };

      const allContacts = await getOrgContacts(orgId);
      const matches = allContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.role && c.role.toLowerCase().includes(query)) ||
          c.email.toLowerCase().includes(query) ||
          (c.company && c.company.toLowerCase().includes(query))
      );

      if (matches.length === 0) {
        return {
          treff: 0,
          melding: `Fant ingen kontakt som matcher "${query}". Be brukeren oppgi e-postadressen direkte, eller legg til kontakten under Innstillinger → Kontaktliste.`,
        };
      }

      return {
        treff: matches.length,
        kontakter: matches.map((c) => ({
          navn: c.name,
          epost: c.email,
          rolle: c.role,
          selskap: c.company,
        })),
      };
    }

    default:
      return { error: `Ukjent verktøy: ${toolName}` };
  }
}
