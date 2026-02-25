import { config } from "dotenv";
config({ path: ".env.local" });
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  knowledgeArticles,
  knowledgeSnippets,
  knowledgeFaq,
  productGuides,
  regulatoryDeadlines,
} from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

// ---------------------------------------------------------------------------
// Knowledge Articles
// ---------------------------------------------------------------------------
const articles = [
  {
    category: "frister",
    subcategory: "mva",
    title: "MVA-frister og terminer i Norge",
    slug: "mva-frister-norge",
    content: `Merverdiavgift (MVA) rapporteres til Skatteetaten via skattemeldingen for merverdiavgift.

Ordinære frister (6 terminer):
- 1. termin (jan-feb): Frist 10. april
- 2. termin (mar-apr): Frist 10. juni
- 3. termin (mai-jun): Frist 31. august
- 4. termin (jul-aug): Frist 10. oktober
- 5. termin (sep-okt): Frist 10. desember
- 6. termin (nov-des): Frist 10. februar (påfølgende år)

Årlig rapportering gjelder for virksomheter med omsetning under 1 million kr.
Frist for årstermin: 10. mars.

Faller fristen på helg eller helligdag, forskyves den til nærmeste virkedag.`,
    summary:
      "Oversikt over MVA-terminer og innleveringsfrister for skattemeldingen for merverdiavgift i Norge.",
    keywords: ["mva", "merverdiavgift", "skattemelding", "termin", "frist"],
    source: "Skatteetaten",
    sourceUrl: "https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/",
  },
  {
    category: "frister",
    subcategory: "a-melding",
    title: "A-melding – månedlig rapportering",
    slug: "a-melding-frister",
    content: `A-meldingen rapporterer lønn, arbeidsgiveravgift og forskuddstrekk til Skatteetaten, NAV og SSB.

Frist: 5. i hver måned for foregående måned.
Eksempel: A-melding for januar skal leveres innen 5. februar.

Faller fristen på helg/helligdag, forskyves til nærmeste virkedag.

Alle arbeidsgivere som har ansatte eller utbetaler lønn plikter å levere a-melding.`,
    summary: "A-meldingen leveres månedlig innen den 5. i påfølgende måned.",
    keywords: ["a-melding", "lønn", "arbeidsgiveravgift", "forskuddstrekk"],
    source: "Skatteetaten",
    sourceUrl: "https://www.skatteetaten.no/bedrift-og-organisasjon/arbeidsgiver/a-meldingen/",
  },
  {
    category: "frister",
    subcategory: "skattemelding",
    title: "Skattemelding for selskap",
    slug: "skattemelding-selskap",
    content: `Skattemelding for aksjeselskaper og andre næringsdrivende leveres elektronisk til Skatteetaten.

Frist: 31. mai for selskaper med regnskapsår som følger kalenderåret.
Utsatt frist ved bruk av regnskapsfører/revisor: Normalt ingen automatisk utsettelse, men det kan søkes om utsettelse.

Skattemeldingen inkluderer:
- Næringsoppgave (RF-1167)
- Aksjonærregisteroppgave (RF-1086)
- Avskrivningsskjema
- Eventuelle vedlegg`,
    summary: "Skattemelding for selskap leveres innen 31. mai hvert år.",
    keywords: ["skattemelding", "selskap", "aksjeselskap", "næringsoppgave"],
    source: "Skatteetaten",
    sourceUrl: "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/skattemelding/",
  },
  {
    category: "frister",
    subcategory: "årsregnskap",
    title: "Årsregnskap til Brønnøysundregistrene",
    slug: "aarsregnskap-bronnoysund",
    content: `Regnskapspliktige foretak skal sende inn årsregnskap til Regnskapsregisteret i Brønnøysund.

Frist: 31. juli for foretak med regnskapsår som følger kalenderåret.

Årsregnskapet skal inneholde:
- Resultatregnskap
- Balanse
- Noter
- Årsberetning (for større foretak)
- Revisjonsberetning (for revisjonspliktige)

Forsinkelsesgebyr: Kr 1 060 per uke, maks 53 000 kr.`,
    summary:
      "Årsregnskap sendes til Brønnøysundregistrene innen 31. juli. Forsinkelsesgebyr ved for sen innlevering.",
    keywords: ["årsregnskap", "brønnøysund", "regnskapsregisteret", "frist"],
    source: "Brønnøysundregistrene",
    sourceUrl: "https://www.brreg.no/bedrift/regnskap/",
  },
  {
    category: "frister",
    subcategory: "forskuddsskatt",
    title: "Forskuddsskatt for selskaper",
    slug: "forskuddsskatt-selskap",
    content: `Aksjeselskaper betaler forskuddsskatt i to terminer:

- 1. termin: 15. februar
- 2. termin: 15. april

Forskuddsskatten beregnes basert på forventet overskudd for inneværende år.

Selskapet kan søke om endring av forskuddsskatten hvis det forventes vesentlig høyere eller lavere overskudd enn grunnlaget.`,
    summary: "Forskuddsskatt for selskaper betales i to terminer: 15. februar og 15. april.",
    keywords: ["forskuddsskatt", "selskap", "termin", "skatt"],
    source: "Skatteetaten",
    sourceUrl: "https://www.skatteetaten.no/bedrift-og-organisasjon/skatt/forskuddsskatt/",
  },
  {
    category: "produkt",
    subcategory: "smartmatch",
    title: "SmartMatch – Automatisk avstemming",
    slug: "smartmatch-oversikt",
    content: `SmartMatch er Revizos motor for automatisk matching av transaksjoner mellom to mengder (f.eks. reskontro mot bank).

Funksjoner:
- Regelbasert matching med konfigurerbare regler
- Støtter 1-til-1, mange-til-1, og mange-til-mange matching
- Datotoleranse og beløpstoleranse
- Prioritetsbasert regelkjøring
- Intern matching (poster innenfor samme mengde)

Oppsett:
1. Gå til klienten → Matchingregler
2. Opprett regler med ønskede betingelser
3. Sett prioritet (lavere tall = kjøres først)
4. Kjør SmartMatch fra klientoversikten

SmartMatch kjører reglene i prioritetsrekkefølge og matcher poster som oppfyller alle betingelser i regelen.`,
    summary:
      "SmartMatch er Revizos automatiske matchingmotor med regelbasert matching, toleranser og flere matchtyper.",
    keywords: ["smartmatch", "matching", "avstemming", "regler", "automatisk"],
    source: "Revizo",
  },
  {
    category: "produkt",
    subcategory: "import",
    title: "Importere transaksjoner",
    slug: "importere-transaksjoner",
    content: `Revizo støtter import av transaksjoner fra flere filformater:

Støttede formater:
- CSV (kommaseparert, semikolonseparert, tabseparert)
- Excel (.xlsx, .xls)
- CAMT.053 (ISO 20022 bankformat)
- XML

Importprosessen:
1. Gå til klienten → Import
2. Velg mengde (Mengde 1 eller Mengde 2)
3. Last opp fil
4. Revizo detekterer filformat automatisk
5. Kartlegg kolonner til felter (Revizo foreslår automatisk)
6. Bekreft og importer

Duplikatsjekk:
Revizo sjekker automatisk om filen allerede er importert basert på filhash. Du får advarsel ved duplikat.`,
    summary:
      "Guide for import av transaksjoner. Støtter CSV, Excel, CAMT.053 og XML med automatisk formatdeteksjon.",
    keywords: ["import", "csv", "excel", "camt", "transaksjoner", "innlesning"],
    source: "Revizo",
  },
];

// ---------------------------------------------------------------------------
// Knowledge Snippets
// ---------------------------------------------------------------------------
const snippets = [
  {
    fact: "MVA-fristen for 1. termin (jan-feb) er 10. april.",
    context: "Norsk merverdiavgift",
    triggerPhrases: ["mva", "merverdiavgift", "mva-frist", "1. termin"],
    priority: 10,
  },
  {
    fact: "A-meldingen skal leveres innen 5. i hver måned for foregående måned.",
    context: "Arbeidsgiverrapportering",
    triggerPhrases: ["a-melding", "a-meldingen", "lønnsrapportering"],
    priority: 10,
  },
  {
    fact: "Årsregnskap skal sendes til Brønnøysund innen 31. juli. Forsinkelsesgebyr: 1 060 kr/uke.",
    context: "Årsregnskap og frister",
    triggerPhrases: ["årsregnskap", "brønnøysund", "årsoppgjør"],
    priority: 10,
  },
  {
    fact: "Skattemelding for selskap leveres innen 31. mai.",
    context: "Skattemelding",
    triggerPhrases: ["skattemelding", "selvangivelse", "næringsoppgave"],
    priority: 10,
  },
  {
    fact: "SmartMatch kjøres fra klientoversikten og bruker regelbasert matching.",
    context: "Revizo produkt",
    triggerPhrases: ["smartmatch", "automatisk matching", "kjør matching"],
    priority: 5,
  },
];

// ---------------------------------------------------------------------------
// Product Guides
// ---------------------------------------------------------------------------
type GuideDifficulty = "beginner" | "intermediate" | "advanced";
const guides: Array<{
  feature: string;
  title: string;
  slug: string;
  description: string;
  prerequisites: string[];
  steps: Array<{ title: string; description: string }>;
  difficulty: GuideDifficulty;
  estimatedTimeMinutes: number;
  keywords: string[];
}> = [
  {
    feature: "onboarding",
    title: "Kom i gang med Revizo",
    slug: "kom-i-gang",
    description:
      "Steg-for-steg guide for å sette opp Revizo for din organisasjon.",
    prerequisites: [],
    steps: [
      { title: "Opprett selskap", description: "Gå til Selskaper og legg til ditt første selskap med organisasjonsnummer." },
      { title: "Legg til kontoer", description: "Opprett kontoer (reskontro og bank) under selskapet." },
      { title: "Opprett klient", description: "Gå til Klienter og opprett en avstemmingsenhet som kobler to kontoer." },
      { title: "Importer transaksjoner", description: "Last opp filer med transaksjoner for begge mengder." },
      { title: "Sett opp matchingregler", description: "Konfigurer regler for automatisk matching." },
      { title: "Kjør SmartMatch", description: "Kjør automatisk matching og gjennomgå resultater." },
    ],
    difficulty: "beginner",
    estimatedTimeMinutes: 15,
    keywords: ["kom i gang", "onboarding", "oppsett", "første gang"],
  },
  {
    feature: "smartmatch",
    title: "Sette opp SmartMatch-regler",
    slug: "smartmatch-regler-guide",
    description:
      "Lær hvordan du oppretter og konfigurerer matchingregler for SmartMatch.",
    prerequisites: ["Minst én klient opprettet", "Transaksjoner importert"],
    steps: [
      { title: "Gå til matchingregler", description: "Naviger til klienten → Matchingregler." },
      { title: "Opprett ny regel", description: "Klikk 'Ny regel' og gi den et beskrivende navn." },
      { title: "Velg regeltype", description: "Velg mellom 1-til-1, mange-til-1, eller mange-til-mange." },
      { title: "Legg til betingelser", description: "Definer hvilke felt som skal sammenlignes (beløp, dato, referanse)." },
      { title: "Sett toleranser", description: "Konfigurer dato- og beløpstoleranse om nødvendig." },
      { title: "Sett prioritet", description: "Lavere tall = kjøres først. Strenge regler bør ha lav prioritet." },
    ],
    difficulty: "intermediate",
    estimatedTimeMinutes: 10,
    keywords: ["smartmatch", "matchingregler", "regler", "oppsett"],
  },
  {
    feature: "import",
    title: "Importere banktransaksjoner fra CAMT-fil",
    slug: "import-camt-guide",
    description:
      "Slik importerer du banktransaksjoner fra en CAMT.053-fil (ISO 20022).",
    prerequisites: ["Klient opprettet med bankkonto"],
    steps: [
      { title: "Last ned CAMT-fil", description: "Hent CAMT.053-filen fra nettbanken." },
      { title: "Gå til import", description: "Naviger til klienten → Import → Mengde 2 (bank)." },
      { title: "Last opp fil", description: "Dra filen til opplastingsfeltet eller klikk for å velge." },
      { title: "Bekreft format", description: "Revizo detekterer CAMT-format automatisk." },
      { title: "Importer", description: "Klikk 'Importer' for å laste inn transaksjonene." },
    ],
    difficulty: "beginner",
    estimatedTimeMinutes: 5,
    keywords: ["import", "camt", "bank", "camt053", "iso20022"],
  },
  {
    feature: "export",
    title: "Eksportere avstemmingsrapport",
    slug: "eksport-rapport-guide",
    description:
      "Slik genererer og eksporterer du en avstemmingsrapport for en klient.",
    prerequisites: ["Matching gjennomført"],
    steps: [
      { title: "Gå til klienten", description: "Naviger til den aktuelle klienten." },
      { title: "Åpne eksport", description: "Klikk på eksport-ikonet i verktøylinjen." },
      { title: "Velg rapporttype", description: "Velg mellom avstemmingsrapport, umatchede poster, eller fullstendig rapport." },
      { title: "Velg format", description: "Velg Excel (.xlsx) eller PDF." },
      { title: "Last ned", description: "Klikk 'Eksporter' for å laste ned rapporten." },
    ],
    difficulty: "beginner",
    estimatedTimeMinutes: 3,
    keywords: ["eksport", "rapport", "pdf", "excel", "avstemming"],
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
const faqs = [
  {
    question: "Hvordan importerer jeg transaksjoner?",
    questionVariants: [
      "Hvordan laster jeg opp filer?",
      "Kan jeg importere Excel?",
      "Støtter dere CSV-import?",
    ],
    answer:
      "Gå til klienten → Import, velg mengde (1 eller 2), og last opp filen. Revizo støtter CSV, Excel, CAMT.053 og XML. Formatet detekteres automatisk.",
    category: "produkt",
    feature: "import",
    priority: 10,
  },
  {
    question: "Hvordan kjører jeg SmartMatch?",
    questionVariants: [
      "Hvordan matcher jeg poster?",
      "Hvor finner jeg automatisk matching?",
      "Kjør matching",
    ],
    answer:
      "Gå til klienten og klikk 'Kjør SmartMatch' i verktøylinjen. SmartMatch bruker matchingreglene du har satt opp og matcher poster automatisk basert på betingelsene.",
    category: "produkt",
    feature: "smartmatch",
    priority: 10,
  },
  {
    question: "Hva er forskjellen mellom Mengde 1 og Mengde 2?",
    questionVariants: [
      "Hva er mengde 1?",
      "Hva er set 1 og set 2?",
      "Hvilken mengde er reskontro?",
    ],
    answer:
      "Mengde 1 er typisk reskontro/hovedbok og Mengde 2 er typisk bank/kontoutdrag. Du velger selv hvilken konto som tilhører hvilken mengde når du oppretter en klient.",
    category: "produkt",
    feature: "matching",
    priority: 8,
  },
  {
    question: "Hvordan oppretter jeg en ny klient?",
    questionVariants: [
      "Ny avstemmingsenhet",
      "Legg til klient",
      "Opprett klient",
    ],
    answer:
      "Gå til Klienter-siden og klikk 'Ny klient'. Velg selskap, gi klienten et navn, og velg hvilke kontoer som skal kobles som Mengde 1 og Mengde 2.",
    category: "produkt",
    feature: "klienter",
    priority: 8,
  },
  {
    question: "Hva betyr 'umatchet' status?",
    questionVariants: [
      "Hvorfor er poster umatchet?",
      "Hva gjør jeg med umatchede poster?",
      "Umatchede transaksjoner",
    ],
    answer:
      "Umatchet betyr at en transaksjon ikke har blitt koblet til en motpost i den andre mengden. Kjør SmartMatch for automatisk matching, eller match manuelt ved å velge poster og klikke 'Match'.",
    category: "produkt",
    feature: "matching",
    priority: 7,
  },
  {
    question: "Når er MVA-fristen?",
    questionVariants: [
      "Frist for merverdiavgift",
      "MVA-termin",
      "Når skal jeg levere MVA?",
    ],
    answer:
      "MVA rapporteres i 6 terminer. Fristene er: 10. april (T1), 10. juni (T2), 31. august (T3), 10. oktober (T4), 10. desember (T5), 10. februar (T6). Årstermin: 10. mars. Verifiser alltid gjeldende frister på skatteetaten.no.",
    category: "frister",
    feature: "mva",
    priority: 10,
  },
  {
    question: "Når er fristen for a-meldingen?",
    questionVariants: [
      "Frist a-melding",
      "Når leveres a-meldingen?",
      "Lønnsrapportering frist",
    ],
    answer:
      "A-meldingen skal leveres innen 5. i hver måned for foregående måned. Eksempel: A-melding for januar leveres innen 5. februar. Verifiser alltid gjeldende frister på skatteetaten.no.",
    category: "frister",
    feature: "a-melding",
    priority: 10,
  },
  {
    question: "Hvordan legger jeg til et notat på en transaksjon?",
    questionVariants: [
      "Legge til kommentar",
      "Notere på en post",
      "Skrive notat",
    ],
    answer:
      "Klikk på transaksjonen i tabellen for å åpne detaljpanelet. Skriv notatet i notatfeltet og trykk Enter. Du kan også @-nevne kollegaer for å varsle dem.",
    category: "produkt",
    feature: "notater",
    priority: 5,
  },
  {
    question: "Hvordan sletter jeg en import?",
    questionVariants: [
      "Fjerne importert fil",
      "Angre import",
      "Slett importerte transaksjoner",
    ],
    answer:
      "Gå til klienten → Oversikt over importer. Finn importen du vil slette og klikk sletteknappen. Alle transaksjoner fra den importen vil bli fjernet. Merk: matchinger som inkluderer disse transaksjonene vil også bli påvirket.",
    category: "produkt",
    feature: "import",
    priority: 5,
  },
  {
    question: "Kan jeg eksportere til Excel?",
    questionVariants: [
      "Last ned rapport",
      "Eksporter data",
      "Hent ut data som Excel",
    ],
    answer:
      "Ja! Gå til klienten og klikk eksport-ikonet. Du kan eksportere avstemmingsrapporter, umatchede poster, og fullstendige rapporter i Excel (.xlsx) eller PDF-format.",
    category: "produkt",
    feature: "eksport",
    priority: 5,
  },
  {
    question: "Hva er matchingregler?",
    questionVariants: [
      "Matchingregler forklart",
      "Regelbasert matching",
      "Hvordan fungerer regler?",
    ],
    answer:
      "Matchingregler definerer betingelsene for automatisk matching. Du kan spesifisere hvilke felt som skal sammenlignes (beløp, dato, referanse osv.), toleranser for dato og beløp, og regeltype (1-til-1, mange-til-1, mange-til-mange). Regler kjøres i prioritetsrekkefølge.",
    category: "produkt",
    feature: "smartmatch",
    priority: 7,
  },
  {
    question: "Hva er datotoleranse?",
    questionVariants: [
      "Toleranse for dato",
      "Datoavvik i matching",
      "Dager toleranse",
    ],
    answer:
      "Datotoleranse lar SmartMatch matche poster selv om datoene ikke er identiske. F.eks. med 3 dagers toleranse kan en post datert 1. mars matches med en post datert 3. mars. Settes i matchingregelens innstillinger.",
    category: "produkt",
    feature: "smartmatch",
    priority: 5,
  },
  {
    question: "Når er fristen for årsregnskapet?",
    questionVariants: [
      "Frist årsregnskap",
      "Når leveres regnskapet til Brønnøysund?",
      "Årsregnskap frist",
    ],
    answer:
      "Årsregnskapet skal sendes til Regnskapsregisteret i Brønnøysund innen 31. juli for foretak med kalenderår som regnskapsår. Forsinkelsesgebyr er kr 1 060 per uke, maks 53 000 kr. Verifiser alltid gjeldende frister på skatteetaten.no.",
    category: "frister",
    feature: "årsregnskap",
    priority: 10,
  },
  {
    question: "Hvordan inviterer jeg kollegaer?",
    questionVariants: [
      "Legg til bruker",
      "Inviter teammedlem",
      "Dele tilgang",
    ],
    answer:
      "Gå til organisasjonsinnstillingene (klikk på organisasjonsnavnet i sidemenyen) og velg 'Inviter medlemmer'. Skriv inn e-postadressen og velg rolle. Brukeren får en invitasjon på e-post.",
    category: "produkt",
    feature: "organisasjon",
    priority: 5,
  },
  {
    question: "Hva er forskuddsskatt for selskaper?",
    questionVariants: [
      "Forskuddsskatt frist",
      "Når betales forskuddsskatt?",
      "Selskapsskatt terminer",
    ],
    answer:
      "Aksjeselskaper betaler forskuddsskatt i to terminer: 15. februar og 15. april. Beløpet baseres på forventet overskudd. Du kan søke om endring hvis forventet resultat avviker vesentlig. Verifiser alltid gjeldende frister på skatteetaten.no.",
    category: "frister",
    feature: "forskuddsskatt",
    priority: 8,
  },
];

// ---------------------------------------------------------------------------
// Regulatory Deadlines
// ---------------------------------------------------------------------------
const deadlines = [
  {
    obligation: "mva_termin",
    title: "MVA-skattemelding",
    description: "Innlevering av skattemelding for merverdiavgift",
    frequency: "bimonthly" as const,
    periodStartMonth: 1,
    periodEndMonth: 2,
    deadlineRule: { relative_to: "period_end", months_after: 2, day: 10 },
    appliesToEntity: ["as", "enk", "ans"],
    legalReference: "Skatteforvaltningsloven § 8-3",
    legalUrl: "https://lovdata.no/lov/2016-05-27-14/§8-3",
  },
  {
    obligation: "a_melding",
    title: "A-melding",
    description: "Månedlig rapportering av lønn, arbeidsgiveravgift og skattetrekk",
    frequency: "monthly" as const,
    periodStartMonth: 1,
    periodEndMonth: 1,
    deadlineRule: { relative_to: "period_end", months_after: 1, day: 5 },
    appliesToEntity: ["arbeidsgiver"],
    legalReference: "A-opplysningsloven § 4",
    legalUrl: "https://lovdata.no/lov/2012-06-22-43/§4",
  },
  {
    obligation: "skattemelding_selskap",
    title: "Skattemelding for selskap",
    description: "Årlig skattemelding for aksjeselskap og andre næringsdrivende",
    frequency: "yearly" as const,
    periodStartMonth: 1,
    periodEndMonth: 12,
    deadlineRule: { month: 5, day: 31 },
    appliesToEntity: ["as"],
    legalReference: "Skatteforvaltningsloven § 8-2",
    legalUrl: "https://lovdata.no/lov/2016-05-27-14/§8-2",
  },
  {
    obligation: "aarsregnskap",
    title: "Årsregnskap til Brønnøysund",
    description: "Innsending av årsregnskap til Regnskapsregisteret",
    frequency: "yearly" as const,
    periodStartMonth: 1,
    periodEndMonth: 12,
    deadlineRule: { month: 7, day: 31 },
    appliesToEntity: ["regnskapspliktig"],
    legalReference: "Regnskapsloven § 8-2",
    legalUrl: "https://lovdata.no/lov/1998-07-17-56/§8-2",
  },
  {
    obligation: "forskuddsskatt_selskap",
    title: "Forskuddsskatt 1. termin",
    description: "Forskuddsskatt for aksjeselskaper, 1. termin",
    frequency: "yearly" as const,
    periodStartMonth: 1,
    periodEndMonth: 12,
    deadlineRule: { month: 2, day: 15 },
    appliesToEntity: ["as"],
    legalReference: "Skattebetalingsloven § 10-20",
    legalUrl: "https://lovdata.no/lov/2005-06-17-67/§10-20",
  },
  {
    obligation: "forskuddsskatt_selskap_t2",
    title: "Forskuddsskatt 2. termin",
    description: "Forskuddsskatt for aksjeselskaper, 2. termin",
    frequency: "yearly" as const,
    periodStartMonth: 1,
    periodEndMonth: 12,
    deadlineRule: { month: 4, day: 15 },
    appliesToEntity: ["as"],
    legalReference: "Skattebetalingsloven § 10-20",
    legalUrl: "https://lovdata.no/lov/2005-06-17-67/§10-20",
  },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  console.log("Seeding knowledge base...\n");

  console.log("→ Knowledge articles...");
  for (const a of articles) {
    await db.insert(knowledgeArticles).values(a).onConflictDoNothing();
  }
  console.log(`  ✓ ${articles.length} articles`);

  console.log("→ Knowledge snippets...");
  for (const s of snippets) {
    await db.insert(knowledgeSnippets).values(s);
  }
  console.log(`  ✓ ${snippets.length} snippets`);

  console.log("→ Product guides...");
  for (const g of guides) {
    await db.insert(productGuides).values(g).onConflictDoNothing();
  }
  console.log(`  ✓ ${guides.length} guides`);

  console.log("→ FAQ entries...");
  for (const f of faqs) {
    await db.insert(knowledgeFaq).values(f);
  }
  console.log(`  ✓ ${faqs.length} FAQ entries`);

  console.log("→ Regulatory deadlines...");
  for (const d of deadlines) {
    await db.insert(regulatoryDeadlines).values(d);
  }
  console.log(`  ✓ ${deadlines.length} deadlines`);

  // Generate embeddings if OPENAI_API_KEY is set
  if (process.env.OPENAI_API_KEY) {
    console.log("\n→ Generating embeddings (this may take a moment)...");
    try {
      const { generateEmbeddings } = await import("../src/lib/ai/embeddings");

      const allArticles = await db
        .select({ id: knowledgeArticles.id, title: knowledgeArticles.title, content: knowledgeArticles.content })
        .from(knowledgeArticles);

      if (allArticles.length > 0) {
        const texts = allArticles.map((a) => `${a.title}\n${a.content}`);
        const embeddings = await generateEmbeddings(texts);
        const { sql } = await import("drizzle-orm");
        for (let i = 0; i < allArticles.length; i++) {
          const embStr = `[${embeddings[i].join(",")}]`;
          await db.execute(
            sql`UPDATE knowledge_articles SET embedding = ${embStr}::vector WHERE id = ${allArticles[i].id}`
          );
        }
        console.log(`  ✓ ${allArticles.length} article embeddings`);
      }

      const allFaqs = await db
        .select({ id: knowledgeFaq.id, question: knowledgeFaq.question })
        .from(knowledgeFaq);

      if (allFaqs.length > 0) {
        const faqTexts = allFaqs.map((f) => f.question);
        const faqEmbs = await generateEmbeddings(faqTexts);
        const { sql } = await import("drizzle-orm");
        for (let i = 0; i < allFaqs.length; i++) {
          const embStr = `[${faqEmbs[i].join(",")}]`;
          await db.execute(
            sql`UPDATE knowledge_faq SET embedding = ${embStr}::vector WHERE id = ${allFaqs[i].id}`
          );
        }
        console.log(`  ✓ ${allFaqs.length} FAQ embeddings`);
      }

      const allGuides = await db
        .select({ id: productGuides.id, title: productGuides.title, description: productGuides.description })
        .from(productGuides);

      if (allGuides.length > 0) {
        const guideTexts = allGuides.map((g) => `${g.title}\n${g.description ?? ""}`);
        const guideEmbs = await generateEmbeddings(guideTexts);
        const { sql } = await import("drizzle-orm");
        for (let i = 0; i < allGuides.length; i++) {
          const embStr = `[${guideEmbs[i].join(",")}]`;
          await db.execute(
            sql`UPDATE product_guides SET embedding = ${embStr}::vector WHERE id = ${allGuides[i].id}`
          );
        }
        console.log(`  ✓ ${allGuides.length} guide embeddings`);
      }
    } catch (err) {
      console.warn("  ⚠ Embedding generation failed (OPENAI_API_KEY may be invalid):", err);
    }
  } else {
    console.log("\n⚠ OPENAI_API_KEY not set — skipping embedding generation.");
    console.log("  Run again with OPENAI_API_KEY to generate embeddings.");
  }

  console.log("\n✓ Knowledge base seeded successfully!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    client.end();
  });
