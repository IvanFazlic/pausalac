import { sql, isForeignKeyViolation } from "@/lib/db";

export async function listClients({ includeArchived = false } = {}) {
  return sql`
    SELECT
      c.id, c.name, c.email, c.pib, c.default_currency, c.archived_at,
      (SELECT count(*)::int FROM invoices i WHERE i.client_id = c.id AND i.status <> 'cancelled') AS invoice_count,
      (SELECT count(*)::int FROM users u WHERE u.client_id = c.id AND u.disabled_at IS NULL) AS account_count,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('currency', x.currency, 'total', x.total::text) ORDER BY x.currency), '[]'::jsonb)
        FROM (
          SELECT t.currency, sum(t.total) AS total
          FROM invoices i
          JOIN invoice_totals t ON t.invoice_id = i.id
          WHERE i.client_id = c.id AND i.status = 'issued'
          GROUP BY t.currency
        ) x
      ) AS outstanding
    FROM clients c
    WHERE ${includeArchived}::boolean OR c.archived_at IS NULL
    ORDER BY (c.archived_at IS NOT NULL), lower(c.name)
  `;
}

// Minimal list for pickers in the invoice and schedule forms. `next_seq` is
// the next running number in the client's own series for `year` (only
// meaningful when the client has its own number format).
export async function listClientOptions(year) {
  return sql`
    SELECT
      c.id, c.name, c.default_currency, c.invoice_language, c.payment_terms_days, c.number_format,
      coalesce((SELECT k.last_number FROM client_invoice_counters k WHERE k.client_id = c.id AND k.year = ${year ?? 0}::int), 0) + 1 AS next_seq
    FROM clients c
    WHERE c.archived_at IS NULL
    ORDER BY lower(c.name)
  `;
}

export async function getClient(id, year = 0) {
  const rows = await sql`
    SELECT id, name, address, country, pib, mb, email, contact_name, phone, default_currency,
           invoice_language, payment_terms_days, number_format, internal_notes, archived_at, created_at,
           (SELECT count(*)::int FROM invoices i WHERE i.client_id = clients.id) AS invoice_count,
           coalesce((SELECT k.last_number FROM client_invoice_counters k WHERE k.client_id = clients.id AND k.year = ${year}::int), 0) + 1 AS next_seq
    FROM clients
    WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function createClient(data) {
  const rows = await sql`
    INSERT INTO clients
      (name, address, country, pib, mb, email, contact_name, phone, default_currency,
       invoice_language, payment_terms_days, number_format, internal_notes)
    VALUES
      (${data.name}, ${data.address}, ${data.country ?? ""}, ${data.pib}, ${data.mb}, ${data.email},
       ${data.contact_name}, ${data.phone}, ${data.default_currency}, ${data.invoice_language},
       ${data.payment_terms_days}, ${data.number_format || null}, ${data.internal_notes})
    RETURNING id
  `;
  return rows[0].id;
}

// Editing a client only affects future invoices: issued invoices carry their
// own snapshot of the client's details.
export async function updateClient(id, data) {
  const rows = await sql`
    UPDATE clients SET
      name = ${data.name},
      address = ${data.address},
      country = ${data.country ?? ""},
      pib = ${data.pib},
      mb = ${data.mb},
      email = ${data.email},
      contact_name = ${data.contact_name},
      phone = ${data.phone},
      default_currency = ${data.default_currency},
      invoice_language = ${data.invoice_language},
      payment_terms_days = ${data.payment_terms_days},
      number_format = ${data.number_format || null},
      internal_notes = ${data.internal_notes},
      updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
}

// Next running number in a client's own series for one year.
export async function setClientNextNumber(clientId, year, nextNumber) {
  await sql`
    INSERT INTO client_invoice_counters (client_id, year, last_number)
    VALUES (${clientId}::uuid, ${year}::int, ${nextNumber}::int - 1)
    ON CONFLICT (client_id, year) DO UPDATE SET last_number = EXCLUDED.last_number
  `;
}

export async function setClientArchived(id, archived) {
  await sql`
    UPDATE clients
    SET archived_at = CASE WHEN ${archived}::boolean THEN coalesce(archived_at, now()) ELSE NULL END,
        updated_at = now()
    WHERE id = ${id}
  `;
}

// Only possible for a client with no invoices; otherwise archive instead.
export async function deleteClient(id) {
  try {
    await sql`DELETE FROM clients WHERE id = ${id}`;
    return true;
  } catch (error) {
    if (isForeignKeyViolation(error)) return false;
    throw error;
  }
}
