export const CURRENCIES = [
  "RSD", "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "SEK", "NOK", "DKK",
  "PLN", "CZK", "HUF", "BAM", "MKD", "RON", "BGN", "AED", "JPY",
];

const LOCALES = { sr: "sr-Latn-RS", en: "en-US" };

export function formatAmount(value, locale = "en") {
  return new Intl.NumberFormat(LOCALES[locale] ?? LOCALES.en, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatMoney(value, currency, locale = "en") {
  return `${formatAmount(value, locale)} ${currency}`;
}

// Unit prices keep up to four decimals (hourly rates such as 11.375).
export function formatUnitPrice(value, locale = "en") {
  return new Intl.NumberFormat(LOCALES[locale] ?? LOCALES.en, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value));
}

export function formatQuantity(value, locale = "en") {
  return new Intl.NumberFormat(LOCALES[locale] ?? LOCALES.en, {
    maximumFractionDigits: 3,
  }).format(Number(value));
}

// --- exact decimal helpers (no floating point) -----------------------------

// "12.5" with scale 3 -> 12500n. Returns null for anything that is not a
// plain non-negative decimal with at most `scale` fraction digits.
export function toScaled(value, scale) {
  const text = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > scale) return null;
  return BigInt(whole + fraction.padEnd(scale, "0"));
}

function centsToString(cents) {
  const whole = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, "0");
  return `${whole}.${rest}`;
}

// quantity (3 decimals) x unit price (4 decimals), rounded half-up to cents.
// Matches round(quantity * unit_price, 2) in Postgres for non-negative values.
export function lineAmountCents(quantity, unitPrice) {
  const q = toScaled(quantity, 3);
  const p = toScaled(unitPrice, 4);
  if (q === null || p === null) return null;
  return (q * p + 50000n) / 100000n;
}

// Totals per currency for a list of items, the same way the database view
// computes them. Used for live previews before an invoice exists.
export function computeTotals(items, vatRate = 0) {
  const rate = toScaled(vatRate, 2) ?? 0n; // percent x 100
  const byCurrency = new Map();
  for (const item of items) {
    const cents = lineAmountCents(item.quantity, item.unit_price);
    if (cents === null || !item.currency) continue;
    byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0n) + cents);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, subtotal]) => {
      const vat = (subtotal * rate + 5000n) / 10000n;
      return {
        currency,
        subtotal: centsToString(subtotal),
        vat: centsToString(vat),
        total: centsToString(subtotal + vat),
      };
    });
}
