import type { Money } from "@/types";

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** £1,234.56 (UK formatting for every currency). */
export function formatMoney(money: Money, options: { whole?: boolean } = {}): string {
  const key = `${money.currency}:${options.whole ? 0 : 2}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: money.currency,
      minimumFractionDigits: options.whole ? 0 : 2,
      maximumFractionDigits: options.whole ? 0 : 2,
    });
    moneyFormatters.set(key, f);
  }
  return f.format(money.amount / 100);
}

/** £180 to £320 */
export function formatMoneyRange(low: Money, high: Money): string {
  return `${formatMoney(low, { whole: true })} to ${formatMoney(high, { whole: true })}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
}

/** 17 Sept 2026 */
export function formatDate(value: string | Date): string {
  return dateFormat.format(toDate(value));
}

/** 17 Sept */
export function formatShortDate(value: string | Date): string {
  return shortDateFormat.format(toDate(value));
}

/** 17 Sept 2026, 09:30 */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(toDate(value));
}

const DAY_MS = 86_400_000;

function startOfDayUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Whole calendar days from today to the date (negative when past). */
export function daysFromToday(value: string | Date): number {
  return Math.round((startOfDayUtc(toDate(value)) - startOfDayUtc(new Date())) / DAY_MS);
}

/** "today", "tomorrow", "in 5 days", "3 days ago", then a date beyond a fortnight. */
export function formatRelativeDay(value: string | Date): string {
  const days = daysFromToday(value);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1 && days <= 14) return `in ${days} days`;
  if (days < -1 && days >= -14) return `${-days} days ago`;
  return formatShortDate(value);
}

/** "2 h ago", "yesterday", "12 Sept" for message and activity times. */
export function formatSince(value: string | Date): string {
  const ms = Date.now() - toDate(value).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < 24 * 3_600_000 && daysFromToday(value) === 0) return `${Math.floor(ms / 3_600_000)} h ago`;
  return formatRelativeDay(value);
}

export function pence(pounds: number): number {
  return Math.round(pounds * 100);
}

export function gbp(amountPence: number): Money {
  return { amount: Math.round(amountPence), currency: "GBP" };
}

export function sumMoney(values: Money[], currency: Money["currency"] = "GBP"): Money {
  return { amount: values.reduce((sum, m) => sum + m.amount, 0), currency: values[0]?.currency ?? currency };
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
