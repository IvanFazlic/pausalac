// Invoice number formats. The database function format_invoice_number() is
// what actually assigns numbers; this mirror is only used to show a preview.
//
// Placeholders:
//   {seq}    running number of the series, restarting each year
//   {seq:4}  the same, padded with zeros to 4 digits
//   {year}   year of the issue date        {yy}  its last two digits
//   {mm}     month of the issue date, two digits

export const SEQ_RE = /\{seq(:\d{1,2})?\}/;
const YEAR_RE = /\{year\}|\{yy\}/;
const ALLOWED_RE = /^[A-Za-z0-9\-_/.{}: ]+$/;

export function usesRunningNumber(format) {
  return SEQ_RE.test(format ?? "");
}

// Returns an error message, or null when the format is usable.
export function numberFormatProblem(format, { requireSeq = false } = {}) {
  if (!ALLOWED_RE.test(format)) return "Use letters, digits, - _ / . and the placeholders {seq} {mm} {year}";
  if (!YEAR_RE.test(format)) return "Include {year} or {yy}, because numbering restarts each year";
  if (requireSeq && !SEQ_RE.test(format)) return "Include {seq} so every invoice gets its own number";
  if (!SEQ_RE.test(format) && !format.includes("{mm}")) return "Include {seq} (running number) or {mm} (month)";
  return null;
}

export function formatInvoiceNumber(format, seq, isoDate) {
  const [year, month] = isoDate.split("-");
  const digits = seq == null ? "" : String(seq);
  return format
    .replace(/\{seq:(\d{1,2})\}/g, (_, width) => digits.padStart(Number(width), "0"))
    .replaceAll("{seq}", digits)
    .replaceAll("{year}", year)
    .replaceAll("{yy}", year.slice(2))
    .replaceAll("{mm}", month);
}
