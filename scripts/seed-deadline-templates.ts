/**
 * Seed script: lovpålagte (legally mandated) Norwegian deadline templates.
 * Run: npm run seed:deadline-templates
 */
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });

import { db } from "../src/lib/db";
import { deadlineTemplates } from "../src/lib/db/schema";
import type { DueDateRule } from "../src/lib/deadlines/types";

import type { DeadlineCategory, DeadlinePeriodicity } from "../src/lib/db/schema";

const templates: Array<{
  name: string;
  slug: string;
  category: DeadlineCategory;
  periodicity: DeadlinePeriodicity;
  description: string;
  dueDateRule: DueDateRule;
}> = [
  {
    name: "MVA-melding",
    slug: "mva-termin",
    category: "tax",
    periodicity: "bimonthly",
    description: "Merverdiavgift — innlevering av mva-melding",
    dueDateRule: {
      type: "offset_after_period",
      offset_months: 1,
      day: 10,
    } satisfies DueDateRule,
  },
  {
    name: "A-melding",
    slug: "a-melding",
    category: "payroll",
    periodicity: "monthly",
    description: "Arbeidsgiveravgift og forskuddstrekk — månedlig rapportering",
    dueDateRule: {
      type: "offset_after_period",
      offset_months: 1,
      day: 5,
    } satisfies DueDateRule,
  },
  {
    name: "Forskuddsskatt AS T1",
    slug: "forskuddsskatt-as-t1",
    category: "tax",
    periodicity: "annual",
    description: "Forskuddsskatt for aksjeselskaper — 1. termin",
    dueDateRule: {
      type: "fixed_annual",
      month: 2,
      day: 15,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
  {
    name: "Forskuddsskatt AS T2",
    slug: "forskuddsskatt-as-t2",
    category: "tax",
    periodicity: "annual",
    description: "Forskuddsskatt for aksjeselskaper — 2. termin",
    dueDateRule: {
      type: "fixed_annual",
      month: 4,
      day: 15,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
  {
    name: "Forskuddsskatt AS T3",
    slug: "forskuddsskatt-as-t3",
    category: "tax",
    periodicity: "annual",
    description: "Forskuddsskatt for aksjeselskaper — 3. termin",
    dueDateRule: {
      type: "fixed_annual",
      month: 9,
      day: 15,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
  {
    name: "Forskuddsskatt AS T4",
    slug: "forskuddsskatt-as-t4",
    category: "tax",
    periodicity: "annual",
    description: "Forskuddsskatt for aksjeselskaper — 4. termin",
    dueDateRule: {
      type: "fixed_annual",
      month: 11,
      day: 15,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
  {
    name: "Skattemelding AS",
    slug: "skattemelding-as",
    category: "tax",
    periodicity: "annual",
    description: "Skattemelding for aksjeselskaper",
    dueDateRule: {
      type: "fixed_annual",
      month: 5,
      day: 31,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
  {
    name: "Skattemelding ENK",
    slug: "skattemelding-enk",
    category: "tax",
    periodicity: "annual",
    description: "Skattemelding for enkeltpersonforetak",
    dueDateRule: {
      type: "fixed_annual",
      month: 4,
      day: 30,
      applies_to: ["ENK"],
    } satisfies DueDateRule,
  },
  {
    name: "Årsregnskap",
    slug: "arsregnskap",
    category: "reporting",
    periodicity: "annual",
    description: "Årsregnskap — 6 måneder etter regnskapsårets slutt",
    dueDateRule: {
      type: "offset_after_period",
      offset_months: 6,
      day: null,
    } satisfies DueDateRule,
  },
  {
    name: "Aksjonærregisteroppgave",
    slug: "aksjonaerregisteroppgave",
    category: "reporting",
    periodicity: "annual",
    description: "Aksjonærregisteroppgave for aksjeselskaper",
    dueDateRule: {
      type: "fixed_annual",
      month: 1,
      day: 31,
      applies_to: ["AS", "ASA"],
    } satisfies DueDateRule,
  },
];

async function seed() {
  const result = await db
    .insert(deadlineTemplates)
    .values(
      templates.map((t) => ({
        name: t.name,
        slug: t.slug,
        category: t.category,
        periodicity: t.periodicity,
        description: t.description,
        dueDateRule: t.dueDateRule,
        isSystem: true,
      }))
    )
    .onConflictDoNothing({ target: deadlineTemplates.slug })
    .returning({ id: deadlineTemplates.id });

  const inserted = result.length;
  console.log(`Inserted ${inserted} deadline template(s).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
