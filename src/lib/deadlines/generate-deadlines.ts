import { db } from "@/lib/db";
import { deadlineTemplates, deadlines, companies } from "@/lib/db/schema";
import { computeDueDate } from "./compute-due-date";
import type { DueDateRule, Period } from "./types";
import { eq, and, inArray } from "drizzle-orm";

const MONTH_NAMES_NB = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"] as const;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDueDateRule(rule: unknown): DueDateRule | null {
  if (!rule || typeof rule !== "object") return null;
  const r = rule as Record<string, unknown>;
  if (r.type === "fixed_annual" && typeof r.month === "number" && typeof r.day === "number") {
    return {
      type: "fixed_annual",
      month: r.month,
      day: r.day,
      applies_to: Array.isArray(r.applies_to) ? (r.applies_to as string[]) : undefined,
      adjust_for_holidays: typeof r.adjust_for_holidays === "boolean" ? r.adjust_for_holidays : undefined,
    };
  }
  if (
    r.type === "offset_after_period" &&
    typeof r.offset_months === "number" &&
    (typeof r.day === "number" || r.day === null)
  ) {
    return {
      type: "offset_after_period",
      offset_months: r.offset_months,
      day: r.day as number | null,
      adjust_for_holidays: typeof r.adjust_for_holidays === "boolean" ? r.adjust_for_holidays : undefined,
    };
  }
  return null;
}

function getMonthsForPeriodicity(periodicity: string): number[] {
  switch (periodicity) {
    case "monthly":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case "bimonthly":
      return [2, 4, 6, 8, 10, 12];
    case "quarterly":
      return [3, 6, 9, 12];
    case "annual":
      return [12];
    default:
      return [2, 4, 6, 8, 10, 12];
  }
}

function getPeriodLabel(
  periodicity: string,
  year: number,
  month?: number
): string {
  if (periodicity === "annual") return String(year);
  if (periodicity === "monthly" && month) {
    return `${MONTH_NAMES_NB[month - 1]} ${year}`;
  }
  if (periodicity === "bimonthly" && month) {
    const term = [2, 4, 6, 8, 10, 12].indexOf(month) + 1;
    return `T${term} ${year}`;
  }
  if (periodicity === "quarterly" && month) {
    const quarter = [3, 6, 9, 12].indexOf(month) + 1;
    return `Q${quarter} ${year}`;
  }
  return String(year);
}

export async function generateDeadlines(params: {
  tenantId: string;
  companyId?: string;
  templateIds?: string[];
  from: string;
  to: string;
}): Promise<{ created: number; skipped: number }> {
  const { tenantId, companyId, templateIds, from, to } = params;

  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  const templates = templateIds?.length
    ? await db.select().from(deadlineTemplates).where(inArray(deadlineTemplates.id, templateIds))
    : await db.select().from(deadlineTemplates);

  const companiesList = companyId
    ? await db
        .select()
        .from(companies)
        .where(and(eq(companies.tenantId, tenantId), eq(companies.id, companyId)))
    : await db.select().from(companies).where(eq(companies.tenantId, tenantId));

  let created = 0;
  let skipped = 0;

  for (const company of companiesList) {
    const mvaTermType = (company.mvaTermType ?? "bimonthly") as "bimonthly" | "monthly" | "annual" | "exempt";
    const fiscalYearEnd = company.fiscalYearEnd ?? "12-31";
    const companyContext = {
      mvaTermType,
      fiscalYearEnd,
      orgForm: undefined as string | undefined,
    };

    for (const template of templates) {
      const rule = parseDueDateRule(template.dueDateRule);
      if (!rule) {
        skipped++;
        continue;
      }

      const periodicity = template.periodicity ?? "bimonthly";
      const periods: Array<{ period: Period; periodLabel: string }> = [];

      if (rule.type === "fixed_annual") {
        for (let y = fromYear; y <= toYear; y++) {
          periods.push({ period: { year: y }, periodLabel: String(y) });
        }
      } else {
        const months = getMonthsForPeriodicity(periodicity);
        for (let y = fromYear; y <= toYear; y++) {
          for (const m of months) {
            if (y === fromYear && m < fromMonth) continue;
            if (y === toYear && m > toMonth) continue;
            const periodLabel = getPeriodLabel(periodicity, y, m);
            periods.push({
              period: { year: y, month: m },
              periodLabel,
            });
          }
        }
      }

      for (const { period, periodLabel } of periods) {
        const dueDate = computeDueDate(rule, period, companyContext);
        if (dueDate === null) {
          skipped++;
          continue;
        }

        const dueStr = formatDate(dueDate);
        if (dueDate < fromDate || dueDate > toDate) {
          skipped++;
          continue;
        }

        const result = await db
          .insert(deadlines)
          .values({
            tenantId,
            templateId: template.id,
            companyId: company.id,
            dueDate: dueStr,
            periodLabel,
          })
          .onConflictDoNothing({
            target: [deadlines.tenantId, deadlines.companyId, deadlines.templateId, deadlines.periodLabel],
          })
          .returning({ id: deadlines.id });

        if (result.length > 0) created++;
        else skipped++;
      }
    }
  }

  return { created, skipped };
}
