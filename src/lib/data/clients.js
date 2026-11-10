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

// Minimal list for pickers in the invoice and schedule forms.
export async function listClientOptions() {
  return sql`
    SELECT id, name, default_currency, invoice_language, payment_terms_days
    FROM clients
    WHERE archived_at IS NULL
    ORDER BY lower(name)
  `;
}

export async function getClient(id) {
  const rows = await sql`
    SELECT id, name, address, pib, mb, email, contact_name, phone, default_currency,
           invoice_language, payment_terms_days, internal_notes, archived_at, created_at,
           (SELECT count(*)::int FROM invoices i WHERE i.client_id = clients.id) AS invoice_count
    FROM clients
    WHERE id = ${id}
  `;
  return rows[0] ?? null;
}

export async function createClient(data) {
  const rows = await sql`
    INSERT INTO clients
      (name, address, pib, mb, email, contact_name, phone, default_currency,
       invoice_language, payment_terms_days, internal_notes)
    VALUES
      (${data.name}, ${data.address}, ${data.pib}, ${data.mb}, ${data.email}, ${data.contact_name},
       ${data.phone}, ${data.default_currency}, ${data.invoice_language},
       ${data.payment_terms_days}, ${data.internal_notes})
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
      pib = ${data.pib},
      mb = ${data.mb},
      email = ${data.email},
      contact_name = ${data.contact_name},
      phone = ${data.phone},
      default_currency = ${data.default_currency},
      invoice_language = ${data.invoice_language},
      payment_terms_days = ${data.payment_terms_days},
      internal_notes = ${data.internal_notes},
      updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;
  return rows.length > 0;
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
