/**
 * Norwegian public holidays and business day utilities.
 * Uses the Computus/Gauss algorithm for Western (Gregorian) Easter.
 */

const holidayCache = new Map<number, Date[]>();

/**
 * Computes Easter Sunday for a given year using the Gauss/Computus algorithm.
 * @see https://en.wikipedia.org/wiki/Date_of_Easter#Anonymous_Gregorian_algorithm
 */
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Returns a date normalized to midnight UTC for comparison (year, month, day only).
 */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return `${y}-${m}-${d}`;
}

/**
 * Returns all Norwegian public holidays for a given year.
 * Results are cached per year.
 */
export function getNorwegianHolidays(year: number): Date[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const holidays: Date[] = [];

  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // Nyttårsdag (Jan 1)
  holidays.push(new Date(year, 4, 1));   // Arbeidernes dag (May 1)
  holidays.push(new Date(year, 4, 17));  // Grunnlovsdag (May 17)
  holidays.push(new Date(year, 11, 25)); // 1. juledag (Dec 25)
  holidays.push(new Date(year, 11, 26)); // 2. juledag (Dec 26)

  // Moveable holidays (based on Easter)
  const easter = getEasterSunday(year);
  const addDays = (d: Date, days: number): Date => {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
  };

  holidays.push(addDays(easter, -3));   // Skjærtorsdag (Maundy Thursday)
  holidays.push(addDays(easter, -2));   // Langfredag (Good Friday)
  holidays.push(new Date(easter));      // 1. påskedag (Easter Sunday)
  holidays.push(addDays(easter, 1));   // 2. påskedag (Easter Monday)
  holidays.push(addDays(easter, 39));   // Kristi himmelfartsdag (Ascension)
  holidays.push(addDays(easter, 49));  // 1. pinsedag (Whit Sunday)
  holidays.push(addDays(easter, 50));  // 2. pinsedag (Whit Monday)

  holidayCache.set(year, holidays);
  return holidays;
}

/**
 * Returns true if the given date is a Norwegian public holiday.
 */
export function isNorwegianHoliday(date: Date): boolean {
  const key = toDateKey(date);
  const year = date.getFullYear();
  const holidays = getNorwegianHolidays(year);
  return holidays.some((h) => toDateKey(h) === key);
}

/**
 * Returns true if the given date is a weekend (Saturday or Sunday).
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Returns true if the given date is a business day (not weekend and not holiday).
 */
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isNorwegianHoliday(date);
}
