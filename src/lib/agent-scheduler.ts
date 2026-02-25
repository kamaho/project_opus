import type { SchedulePreset } from "./db/schema";

// ---------------------------------------------------------------------------
// Schedule calculation
// ---------------------------------------------------------------------------

const DAY_MAP: Record<string, number> = {
  weekly_mon: 1,
  weekly_tue: 2,
  weekly_wed: 3,
  weekly_thu: 4,
  weekly_fri: 5,
  weekly_sat: 6,
  weekly_sun: 0,
};

function parseTime(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { h: h || 3, m: m || 0 };
}

function setTimeOnDate(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setUTCHours(h, m, 0, 0);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/**
 * Calculate the next run time after `after` for a given schedule preset.
 */
export function calculateNextRun(
  schedule: string,
  preferredTime: string,
  after: Date
): Date {
  const { h, m } = parseTime(preferredTime);
  const todayAtTime = setTimeOnDate(after, h, m);

  if (schedule === "daily") {
    return todayAtTime > after ? todayAtTime : addDays(todayAtTime, 1);
  }

  if (schedule.startsWith("weekly_")) {
    const targetDay = DAY_MAP[schedule];
    if (targetDay === undefined) return addDays(todayAtTime, 1);

    const currentDay = after.getUTCDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0 && todayAtTime <= after) daysUntil = 7;
    if (daysUntil === 0) return todayAtTime;
    return setTimeOnDate(addDays(after, daysUntil), h, m);
  }

  if (schedule === "biweekly") {
    const epoch = new Date("2024-01-01T00:00:00Z");
    const daysSinceEpoch = Math.floor(
      (after.getTime() - epoch.getTime()) / 86_400_000
    );
    const weekNum = Math.floor(daysSinceEpoch / 7);
    const isTargetWeek = weekNum % 2 === 0;
    const daysUntilMon = (1 - after.getUTCDay() + 7) % 7;

    if (isTargetWeek && daysUntilMon === 0 && todayAtTime > after) {
      return todayAtTime;
    }
    const nextMon = addDays(after, daysUntilMon || 7);
    const weekNumNext = Math.floor(
      (nextMon.getTime() - epoch.getTime()) / 86_400_000 / 7
    );
    if (weekNumNext % 2 !== 0) return setTimeOnDate(addDays(nextMon, 7), h, m);
    return setTimeOnDate(nextMon, h, m);
  }

  if (schedule.startsWith("monthly_")) {
    const targetDate = parseInt(schedule.replace("monthly_", ""), 10);
    if (isNaN(targetDate) || targetDate < 1 || targetDate > 28) {
      return addDays(todayAtTime, 1);
    }
    const thisMonth = new Date(
      Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), targetDate, h, m)
    );
    if (thisMonth > after) return thisMonth;
    return new Date(
      Date.UTC(after.getUTCFullYear(), after.getUTCMonth() + 1, targetDate, h, m)
    );
  }

  return addDays(todayAtTime, 1);
}

/**
 * Find the next specific date from a list that is after `after`.
 */
export function getNextSpecificDate(
  dates: string[],
  preferredTime: string,
  after: Date
): Date | null {
  const { h, m } = parseTime(preferredTime);
  const future = dates
    .map((iso) => {
      const d = new Date(iso + "T00:00:00Z");
      return setTimeOnDate(d, h, m);
    })
    .filter((d) => d > after)
    .sort((a, b) => a.getTime() - b.getTime());

  return future[0] ?? null;
}

/**
 * Calculate the effective next run considering both schedule and specific dates.
 */
export function effectiveNextRun(
  schedule: string | null,
  specificDates: string[],
  preferredTime: string,
  after: Date
): Date | null {
  const fromSchedule = schedule
    ? calculateNextRun(schedule, preferredTime, after)
    : null;
  const fromSpecific =
    specificDates.length > 0
      ? getNextSpecificDate(specificDates, preferredTime, after)
      : null;

  if (fromSchedule && fromSpecific) {
    return fromSchedule < fromSpecific ? fromSchedule : fromSpecific;
  }
  return fromSchedule ?? fromSpecific;
}

// ---------------------------------------------------------------------------
// Due check
// ---------------------------------------------------------------------------

export interface DueCheck {
  matchDue: boolean;
  reportDue: boolean;
}

export function isDue(config: {
  enabled: boolean;
  smartMatchEnabled: boolean;
  nextMatchRun: Date | null;
  nextReportRun: Date | null;
}): DueCheck {
  const now = new Date();
  return {
    matchDue:
      config.enabled &&
      config.smartMatchEnabled &&
      config.nextMatchRun !== null &&
      config.nextMatchRun <= now,
    reportDue:
      config.enabled &&
      config.nextReportRun !== null &&
      config.nextReportRun <= now,
  };
}

// ---------------------------------------------------------------------------
// Human-readable schedule labels (Norwegian)
// ---------------------------------------------------------------------------

const LABEL_MAP: Record<string, string> = {
  daily: "Daglig",
  weekly_mon: "Ukentlig (mandag)",
  weekly_tue: "Ukentlig (tirsdag)",
  weekly_wed: "Ukentlig (onsdag)",
  weekly_thu: "Ukentlig (torsdag)",
  weekly_fri: "Ukentlig (fredag)",
  weekly_sat: "Ukentlig (lørdag)",
  weekly_sun: "Ukentlig (søndag)",
  biweekly: "Annenhver uke (mandag)",
  monthly_1: "Månedlig (1.)",
  monthly_15: "Månedlig (15.)",
};

export function scheduleLabel(preset: string | null): string {
  if (!preset) return "Ikke satt";
  return LABEL_MAP[preset] ?? preset;
}
