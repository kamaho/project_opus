import { describe, it, expect } from "vitest";
import { computeDueDate } from "./compute-due-date";
import type { DueDateRule, Period, CompanyContext } from "./types";

function fmt(d: Date | null): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const defaultCompany: CompanyContext = {
  mvaTermType: "bimonthly",
  fiscalYearEnd: "12-31",
  orgForm: "AS",
};

describe("computeDueDate — fixed_annual", () => {
  it("Skattemelding AS: May 31 2026 (Sunday) -> Friday May 29", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 5, day: 31, applies_to: ["AS", "ASA"] };
    const result = computeDueDate(rule, { year: 2026 }, defaultCompany);
    expect(fmt(result)).toBe("2026-05-29");
  });

  it("Skattemelding ENK: April 30 2026 (Thursday) -> April 30", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 4, day: 30, applies_to: ["ENK"] };
    const result = computeDueDate(rule, { year: 2026 }, { ...defaultCompany, orgForm: "ENK" });
    expect(fmt(result)).toBe("2026-04-30");
  });

  it("returns null if orgForm does not match applies_to", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 5, day: 31, applies_to: ["ENK"] };
    const result = computeDueDate(rule, { year: 2026 }, defaultCompany);
    expect(result).toBeNull();
  });

  it("Aksjonærregisteroppgave: Jan 31 2026 (Saturday) -> Friday Jan 30", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 1, day: 31, applies_to: ["AS", "ASA"] };
    const result = computeDueDate(rule, { year: 2026 }, defaultCompany);
    expect(fmt(result)).toBe("2026-01-30");
  });

  it("Forskuddsskatt T1: Feb 15 2026 (Sunday) -> Friday Feb 13", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 2, day: 15, applies_to: ["AS", "ASA"] };
    const result = computeDueDate(rule, { year: 2026 }, defaultCompany);
    expect(fmt(result)).toBe("2026-02-13");
  });

  it("no holiday adjustment if adjust_for_holidays is false", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 1, day: 31, adjust_for_holidays: false };
    const result = computeDueDate(rule, { year: 2026 });
    expect(fmt(result)).toBe("2026-01-31");
  });

  it("applies if applies_to is undefined (all orgs)", () => {
    const rule: DueDateRule = { type: "fixed_annual", month: 3, day: 15 };
    const result = computeDueDate(rule, { year: 2026 }, defaultCompany);
    expect(result).not.toBeNull();
  });
});

describe("computeDueDate — offset_after_period", () => {
  it("MVA: period month=2 (Feb), offset 1 month, day 10 -> March 10", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 1, day: 10 };
    const result = computeDueDate(rule, { year: 2026, month: 2 }, defaultCompany);
    expect(fmt(result)).toBe("2026-03-10");
  });

  it("MVA: Jan 10 2026 (Saturday) -> Friday Jan 9", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 1, day: 10 };
    const result = computeDueDate(rule, { year: 2025, month: 12 }, defaultCompany);
    expect(fmt(result)).toBe("2026-01-09");
  });

  it("A-melding: April 5 2026 (Easter Sunday) -> Wednesday April 1", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 1, day: 5 };
    const result = computeDueDate(rule, { year: 2026, month: 3 }, defaultCompany);
    expect(fmt(result)).toBe("2026-04-01");
  });

  it("Årsregnskap: fiscal year end 12-31, offset 6 months, day null -> June 30", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 6, day: null };
    const result = computeDueDate(rule, { year: 2025, month: 12 }, { ...defaultCompany, fiscalYearEnd: "12-31" });
    expect(fmt(result)).toBe("2026-06-30");
  });

  it("Årsregnskap with non-standard fiscal year (June 30) -> Dec 31", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 6, day: null };
    const result = computeDueDate(rule, { year: 2025, month: 6 }, { ...defaultCompany, fiscalYearEnd: "06-30" });
    expect(fmt(result)).toBe("2025-12-31");
  });

  it("wraps year correctly for December + offset", () => {
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 2, day: 15 };
    const result = computeDueDate(rule, { year: 2025, month: 11 }, defaultCompany);
    expect(fmt(result)).toBe("2026-01-15");
  });

  it("holiday on Monday: shifts to preceding Friday", () => {
    // May 1 2028 is Monday (Arbeidernes dag)
    const rule: DueDateRule = { type: "offset_after_period", offset_months: 1, day: 1 };
    const result = computeDueDate(rule, { year: 2028, month: 3 }, defaultCompany);
    // April 1 -> month 4, but offset means May 1 - which is a holiday on Monday
    // Actually let's check: month=3, offset=1 -> month 4 = April, day 1 => April 1
    // That doesn't hit May 1. Let me fix: month=4, offset=1 -> May, day 1
    const result2 = computeDueDate(rule, { year: 2028, month: 4 }, defaultCompany);
    expect(fmt(result2)).toBe("2028-04-28"); // Friday before May 1 (Monday holiday)
  });
});
