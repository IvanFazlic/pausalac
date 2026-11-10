// All invoice dates are calendar dates ("YYYY-MM-DD" strings), never instants,
// so they are handled as strings and UTC-based arithmetic to avoid timezone drift.

export const APP_TIMEZONE = "Europe/Belgrade";

export function todayISO(timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parse(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

export function isISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parse(value);
  return !Number.isNaN(date.getTime()) && toISO(date) === value;
}

export function addDays(iso, days) {
  const date = parse(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date);
}

// Adds whole months, clamping to the last day of the target month
// (31 Jan + 1 month = 28/29 Feb).
export function addMonthsClamped(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toISO(new Date(Date.UTC(year, month, Math.min(d, lastDay))));
}

// Date of the n-th occurrence (n = 0 is the anchor itself). Always computed
// from the anchor, so monthly schedules anchored on the 31st do not drift.
export function occurrenceDate(anchor, frequency, n) {
  return frequency === "weekly" ? addDays(anchor, 7 * n) : addMonthsClamped(anchor, n);
}

export function formatDate(iso, locale = "en") {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (locale === "sr") return `${d}.${m}.${y}.`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parse(iso));
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(new Date(value));
}
