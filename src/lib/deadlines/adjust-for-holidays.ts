/**
 * Adjusts a date to the nearest preceding business day if it falls on
 * a weekend or Norwegian public holiday.
 */

import { isBusinessDay } from "./norwegian-holidays";

/**
 * If the given date falls on a Saturday, Sunday, or Norwegian holiday,
 * moves it backward to the nearest preceding business day.
 * Keeps shifting backward until it lands on a valid business day.
 */
export function adjustForHolidays(date: Date): Date {
  const result = new Date(date);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() - 1);
  }

  return result;
}
