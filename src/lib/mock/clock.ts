/**
 * The mock clock. All mock dates are offsets from "today" (decision 3), so the
 * data always looks current. Seed generation and AI rules take `today`
 * explicitly so they stay deterministic for a given day.
 */

const DAY_MS = 86_400_000;

/** Today at 00:00 UTC. */
export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

/** YYYY-MM-DD */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Full ISO timestamp at a given local-ish working hour, e.g. 09:30. */
export function isoDateTime(date: Date, hour = 9, minute = 0): string {
  const d = new Date(date.getTime());
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** YYYY-MM */
export function isoMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Skip Saturdays and Sundays forward. */
export function nextWorkingDay(date: Date): Date {
  let d = date;
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d = addDays(d, 1);
  return d;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * Moves every ISO date and timestamp in a value forward by `days`. Used when
 * persisted demo data was seeded on an earlier day, so it stays current.
 */
export function shiftDates<T>(value: T, days: number): T {
  if (days === 0) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (ISO_DATE.test(v)) return isoDate(addDays(toDate(v), days));
      if (ISO_DATE_TIME.test(v)) return new Date(new Date(v).getTime() + days * DAY_MS).toISOString();
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}
