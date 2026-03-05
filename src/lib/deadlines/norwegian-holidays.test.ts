import { describe, it, expect } from "vitest";
import { getNorwegianHolidays, isNorwegianHoliday, isBusinessDay } from "./norwegian-holidays";

function d(y: number, m: number, day: number) {
  return new Date(y, m - 1, day);
}

describe("getNorwegianHolidays", () => {
  it("returns 12 holidays per year", () => {
    expect(getNorwegianHolidays(2025)).toHaveLength(12);
    expect(getNorwegianHolidays(2026)).toHaveLength(12);
  });

  it("includes fixed holidays", () => {
    const h2026 = getNorwegianHolidays(2026);
    const keys = h2026.map((h) => `${h.getMonth() + 1}-${h.getDate()}`);
    expect(keys).toContain("1-1");
    expect(keys).toContain("5-1");
    expect(keys).toContain("5-17");
    expect(keys).toContain("12-25");
    expect(keys).toContain("12-26");
  });

  it("computes Easter 2025 correctly (April 20)", () => {
    const h = getNorwegianHolidays(2025);
    const easterSunday = h.find(
      (d) => d.getMonth() === 3 && d.getDate() === 20
    );
    expect(easterSunday).toBeDefined();
  });

  it("computes Easter 2026 correctly (April 5)", () => {
    const h = getNorwegianHolidays(2026);
    const easterSunday = h.find(
      (d) => d.getMonth() === 3 && d.getDate() === 5
    );
    expect(easterSunday).toBeDefined();
  });

  it("includes Skjærtorsdag 2026 (April 2)", () => {
    expect(isNorwegianHoliday(d(2026, 4, 2))).toBe(true);
  });

  it("includes Langfredag 2026 (April 3)", () => {
    expect(isNorwegianHoliday(d(2026, 4, 3))).toBe(true);
  });

  it("includes 2. påskedag 2026 (April 6)", () => {
    expect(isNorwegianHoliday(d(2026, 4, 6))).toBe(true);
  });

  it("includes Kristi himmelfartsdag 2026 (May 14)", () => {
    expect(isNorwegianHoliday(d(2026, 5, 14))).toBe(true);
  });

  it("includes 2. pinsedag 2026 (May 25)", () => {
    expect(isNorwegianHoliday(d(2026, 5, 25))).toBe(true);
  });

  it("returns cached results on second call", () => {
    const a = getNorwegianHolidays(2025);
    const b = getNorwegianHolidays(2025);
    expect(a).toBe(b);
  });
});

describe("isBusinessDay", () => {
  it("weekday that is not a holiday is a business day", () => {
    expect(isBusinessDay(d(2026, 3, 9))).toBe(true); // Monday March 9
  });

  it("Saturday is not a business day", () => {
    expect(isBusinessDay(d(2026, 3, 7))).toBe(false);
  });

  it("Sunday is not a business day", () => {
    expect(isBusinessDay(d(2026, 3, 8))).toBe(false);
  });

  it("Norwegian holiday on a weekday is not a business day", () => {
    expect(isBusinessDay(d(2026, 5, 1))).toBe(false); // May 1 2026 = Friday
  });
});
