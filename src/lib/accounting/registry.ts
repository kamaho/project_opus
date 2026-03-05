import type { AccountingSystemAdapter } from "./types";

export interface SystemCredentials {
  systemId: string;
  tenantId: string;
  [key: string]: unknown;
}

export interface SupportedSystem {
  id: string;
  name: string;
  status: "available" | "coming_soon";
  description: string;
}

type AdapterFactory = (creds: SystemCredentials) => Promise<AccountingSystemAdapter>;

const adapterFactories: Record<string, AdapterFactory> = {
  tripletex: (creds) =>
    import("./adapters/tripletex").then((m) => m.createTripletexAdapter(creds)),
  visma_nxt: (creds) =>
    import("./adapters/visma-nxt").then((m) => m.createVismaNxtAdapter(creds)),
  demo: (creds) =>
    import("./adapters/demo").then((m) => m.createDemoAdapter(creds)),
};

export async function getAdapter(
  creds: SystemCredentials
): Promise<AccountingSystemAdapter> {
  const factory = adapterFactories[creds.systemId];
  if (!factory) {
    throw new Error(`Ukjent regnskapssystem: ${creds.systemId}`);
  }
  return factory(creds);
}

export function getSupportedSystems(): SupportedSystem[] {
  return [
    {
      id: "tripletex",
      name: "Tripletex",
      status: "available",
      description: "Full integrasjon med lønn, MVA, reskontro og feriepenger",
    },
    {
      id: "visma_nxt",
      name: "Visma Business NXT",
      status: "available",
      description: "GraphQL-integrasjon med MVA, reskontro og hovedbok",
    },
    {
      id: "poweroffice",
      name: "PowerOffice Go",
      status: "coming_soon",
      description: "Kommer snart",
    },
    {
      id: "xledger",
      name: "Xledger",
      status: "coming_soon",
      description: "Kommer snart",
    },
    {
      id: "finago",
      name: "Finago",
      status: "coming_soon",
      description: "Kommer snart",
    },
    {
      id: "business_central",
      name: "Business Central",
      status: "coming_soon",
      description: "Kommer snart",
    },
    {
      id: "unimicro",
      name: "Uni Micro",
      status: "coming_soon",
      description: "Kommer snart",
    },
  ];
}
