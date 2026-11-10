import { sql } from "@/lib/db";

export const COMPANY_FIELDS = [
  "name", "address", "pib", "mb", "phone", "email", "website",
  "bank_name", "bank_account", "iban", "swift",
  "bank_address", "foreign_holder", "foreign_holder_address", "correspondent_banks", "payment_note",
];

// The latest version is the one future invoices will use.
export async function getCompany() {
  const rows = await sql`
    SELECT id, version, name, address, pib, mb, phone, email, website,
           bank_name, bank_account, iban, swift,
           bank_address, foreign_holder, foreign_holder_address, correspondent_banks, payment_note,
           created_at
    FROM company_profiles
    ORDER BY version DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getCompanyVersions() {
  return sql`
    SELECT cp.id, cp.version, cp.name, cp.created_at,
           (SELECT count(*)::int FROM invoices i WHERE i.company_profile_id = cp.id) AS invoice_count
    FROM company_profiles cp
    ORDER BY cp.version DESC
    LIMIT 20
  `;
}

// Company data is never edited in place: a change becomes a new version, and
// invoices already issued keep the snapshot they were issued with.
export async function saveCompany(data) {
  const current = await getCompany();
  if (current && COMPANY_FIELDS.every((field) => current[field] === data[field])) {
    return { changed: false };
  }
  await sql`
    INSERT INTO company_profiles
      (name, address, pib, mb, phone, email, website, bank_name, bank_account, iban, swift,
       bank_address, foreign_holder, foreign_holder_address, correspondent_banks, payment_note)
    VALUES
      (${data.name}, ${data.address}, ${data.pib}, ${data.mb}, ${data.phone}, ${data.email},
       ${data.website}, ${data.bank_name}, ${data.bank_account}, ${data.iban}, ${data.swift},
       ${data.bank_address}, ${data.foreign_holder}, ${data.foreign_holder_address},
       ${data.correspondent_banks}, ${data.payment_note})
  `;
  return { changed: true };
}

export async function getSettings() {
  const rows = await sql`
    SELECT default_currency, payment_terms_days, invoice_number_format, place_of_issue,
           payment_method, payment_purpose, default_note, default_note_en, payment_method_en,
           vat_rate::text AS vat_rate
    FROM settings
  `;
  return rows[0];
}

export async function saveSettings(data) {
  await sql`
    UPDATE settings SET
      default_currency = ${data.default_currency},
      payment_terms_days = ${data.payment_terms_days},
      invoice_number_format = ${data.invoice_number_format},
      place_of_issue = ${data.place_of_issue},
      payment_method = ${data.payment_method},
      payment_purpose = ${data.payment_purpose},
      default_note = ${data.default_note},
      default_note_en = ${data.default_note_en},
      payment_method_en = ${data.payment_method_en},
      vat_rate = ${data.vat_rate}::numeric,
      updated_at = now()
  `;
}

// State of the general number series (used by clients without their own
// format) for the year of `today`.
export async function getNumbering(today) {
  const year = Number(today.slice(0, 4));
  const rows = await sql`
    SELECT
      s.invoice_number_format AS format,
      coalesce((SELECT last_number FROM invoice_counters WHERE year = ${year}::int), 0) + 1 AS next_number,
      format_invoice_number(
        s.invoice_number_format,
        coalesce((SELECT last_number FROM invoice_counters WHERE year = ${year}::int), 0) + 1,
        ${today}::date
      ) AS preview
    FROM settings s
  `;
  return { year, ...rows[0] };
}

// Lets the owner continue an existing numbering sequence. Refuses a running
// number whose invoice number is already taken.
export async function setNextNumber(today, nextNumber) {
  const year = Number(today.slice(0, 4));
  const rows = await sql`
    INSERT INTO invoice_counters (year, last_number)
    SELECT ${year}::int, ${nextNumber}::int - 1
    FROM settings s
    WHERE NOT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.number = format_invoice_number(s.invoice_number_format, ${nextNumber}::int, ${today}::date)
    )
    ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number
    RETURNING last_number
  `;
  return rows.length > 0;
}
