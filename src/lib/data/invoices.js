import { randomUUID } from "node:crypto";
import { sql, transaction } from "@/lib/db";
import { todayISO } from "@/lib/dates";

// An error whose message is safe and useful to show to the owner.
export class InvoiceError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvoiceError";
  }
}

// Issues an invoice. Everything happens in one transaction:
//   1. take the next number for the year (row lock makes numbering gap-free),
//   2. insert the invoice with a snapshot of the *current* company data and
//      the client's details,
//   3. insert the items.
// After this the database refuses any change to the invoice except its status.
//
// `recurring` is set when a schedule issues the invoice; the schedule is
// advanced in the same transaction so an occurrence is never issued twice.
export async function createInvoice(input) {
  const check = await sql`
    SELECT
      (SELECT count(*)::int FROM company_profiles) AS companies,
      (SELECT archived_at IS NULL FROM clients WHERE id = ${input.clientId}) AS client_active
  `;
  if (check[0].companies === 0) {
    throw new InvoiceError("Add your company details in Settings before issuing invoices.");
  }
  if (check[0].client_active === null) throw new InvoiceError("This client no longer exists.");
  if (check[0].client_active === false) {
    throw new InvoiceError("This client is archived. Restore the client to issue invoices.");
  }

  const id = randomUUID();
  const year = Number(input.issueDate.slice(0, 4));
  const recurring = input.recurring ?? null;
  const items = JSON.stringify(
    input.items.map((item, index) => ({
      position: index + 1,
      description: item.description,
      unit: item.unit ?? "",
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
      currency: item.currency,
    }))
  );

  const results = await transaction((db) => {
    const queries = [];
    if (recurring) {
      queries.push(db`
        UPDATE recurring_invoices SET
          runs_count = runs_count + 1,
          next_run_date = ${recurring.nextRunDate}::date,
          active = active AND ${recurring.nextRunDate}::date IS NOT NULL,
          last_run_at = now(),
          updated_at = now()
        WHERE id = ${recurring.id}::uuid AND next_run_date = ${recurring.scheduledFor}::date
      `);
    }
    queries.push(db`
      INSERT INTO invoice_counters (year, last_number)
      VALUES (${year}::int, 1)
      ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
    `);
    queries.push(db`
      INSERT INTO invoices
        (id, year, seq, number, client_id, company_profile_id, issuer, client_snapshot, language,
         issue_date, service_date, due_date, place_of_issue, payment_method, payment_purpose,
         note, vat_rate, recurring_invoice_id, scheduled_for)
      SELECT
        ${id}::uuid,
        ${year}::int,
        n.last_number,
        format_invoice_number(s.invoice_number_format, n.last_number, ${year}::int),
        c.id,
        cp.id,
        to_jsonb(cp) - 'id' - 'version' - 'created_at',
        jsonb_build_object(
          'name', c.name, 'address', c.address, 'pib', c.pib, 'mb', c.mb,
          'email', c.email, 'contact_name', c.contact_name
        ),
        c.invoice_language,
        ${input.issueDate}::date,
        ${input.serviceDate}::date,
        ${input.dueDate}::date,
        ${input.placeOfIssue ?? ""}::text,
        ${input.paymentMethod ?? ""}::text,
        ${input.paymentPurpose ?? ""}::text,
        ${input.note ?? ""}::text,
        ${String(input.vatRate ?? "0")}::numeric,
        ${recurring?.id ?? null}::uuid,
        ${recurring?.scheduledFor ?? null}::date
      FROM invoice_counters n,
           settings s,
           clients c,
           (SELECT * FROM company_profiles ORDER BY version DESC LIMIT 1) cp
      WHERE n.year = ${year}::int AND c.id = ${input.clientId}::uuid AND c.archived_at IS NULL
    `);
    queries.push(db`
      INSERT INTO invoice_items
        (invoice_id, position, description, unit, quantity, unit_price, currency, amount)
      SELECT ${id}::uuid, t.position, t.description, t.unit, t.quantity, t.unit_price, t.currency,
             round(t.quantity * t.unit_price, 2)
      FROM jsonb_to_recordset(${items}::jsonb)
        AS t(position int, description text, unit text, quantity numeric, unit_price numeric, currency text)
    `);
    queries.push(db`SELECT id, number FROM invoices WHERE id = ${id}::uuid`);
    return queries;
  });

  return results.at(-1)[0];
}

// `clientId` restricts the list to one client. The client portal always passes
// the signed-in user's own client id.
export async function listInvoices({ status = null, clientId = null, limit = 300 } = {}) {
  const today = todayISO();
  const statusFilter = ["issued", "paid", "cancelled"].includes(status) ? status : null;
  const overdueOnly = status === "overdue";
  return sql`
    SELECT
      i.id, i.number, i.status, i.client_id,
      i.issue_date::text AS issue_date,
      i.due_date::text AS due_date,
      i.client_snapshot->>'name' AS client_name,
      (i.status = 'issued' AND i.due_date < ${today}::date) AS overdue,
      (i.scheduled_for IS NOT NULL) AS scheduled,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('currency', t.currency, 'total', t.total::text) ORDER BY t.currency), '[]'::jsonb)
        FROM invoice_totals t WHERE t.invoice_id = i.id
      ) AS totals
    FROM invoices i
    WHERE (${statusFilter}::text IS NULL OR i.status = ${statusFilter}::text)
      AND (NOT ${overdueOnly}::boolean OR (i.status = 'issued' AND i.due_date < ${today}::date))
      AND (${clientId}::uuid IS NULL OR i.client_id = ${clientId}::uuid)
    ORDER BY i.issue_date DESC, i.year DESC, i.seq DESC
    LIMIT ${limit}::int
  `;
}

// Full invoice with its frozen items and derived totals. When `clientId` is
// given the invoice is only returned if it belongs to that client.
export async function getInvoice(id, { clientId = null } = {}) {
  const today = todayISO();
  const rows = await sql`
    SELECT
      i.id, i.number, i.year, i.seq, i.client_id, i.issuer, i.client_snapshot, i.language,
      i.issue_date::text AS issue_date,
      i.service_date::text AS service_date,
      i.due_date::text AS due_date,
      i.place_of_issue, i.payment_method, i.payment_purpose, i.note,
      i.vat_rate::text AS vat_rate,
      i.status, i.paid_at, i.cancelled_at, i.created_at,
      i.recurring_invoice_id, i.scheduled_for::text AS scheduled_for,
      (i.status = 'issued' AND i.due_date < ${today}::date) AS overdue,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'position', it.position, 'description', it.description, 'unit', it.unit,
          'quantity', it.quantity::text, 'unit_price', it.unit_price::text,
          'currency', it.currency, 'amount', it.amount::text
        ) ORDER BY it.position), '[]'::jsonb)
        FROM invoice_items it WHERE it.invoice_id = i.id
      ) AS items,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'currency', t.currency, 'subtotal', t.subtotal::text, 'vat', t.vat::text, 'total', t.total::text
        ) ORDER BY t.currency), '[]'::jsonb)
        FROM invoice_totals t WHERE t.invoice_id = i.id
      ) AS totals
    FROM invoices i
    WHERE i.id = ${id}::uuid
      AND (${clientId}::uuid IS NULL OR i.client_id = ${clientId}::uuid)
  `;
  return rows[0] ?? null;
}

// Status is the only part of an issued invoice that can change.
export async function markInvoicePaid(id) {
  const rows = await sql`
    UPDATE invoices SET status = 'paid', paid_at = now()
    WHERE id = ${id}::uuid AND status = 'issued'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function markInvoiceUnpaid(id) {
  const rows = await sql`
    UPDATE invoices SET status = 'issued', paid_at = NULL
    WHERE id = ${id}::uuid AND status = 'paid'
    RETURNING id
  `;
  return rows.length > 0;
}

// Cancelling keeps the invoice and its number on record (storno).
export async function cancelInvoice(id) {
  const rows = await sql`
    UPDATE invoices SET status = 'cancelled', cancelled_at = now()
    WHERE id = ${id}::uuid AND status = 'issued'
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getDashboardStats() {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const [byCurrency, counts] = await Promise.all([
    sql`
      SELECT
        t.currency,
        coalesce(sum(t.total) FILTER (WHERE i.status = 'issued'), 0)::text AS outstanding,
        coalesce(sum(t.total) FILTER (WHERE i.status = 'issued' AND i.due_date < ${today}::date), 0)::text AS overdue,
        coalesce(sum(t.total) FILTER (WHERE i.status = 'paid' AND i.year = ${year}::int), 0)::text AS paid_this_year,
        coalesce(sum(t.total) FILTER (WHERE i.status <> 'cancelled' AND i.year = ${year}::int), 0)::text AS invoiced_this_year
      FROM invoices i
      JOIN invoice_totals t ON t.invoice_id = i.id
      GROUP BY t.currency
      ORDER BY t.currency
    `,
    sql`
      SELECT
        (SELECT count(*)::int FROM invoices WHERE status = 'issued') AS unpaid_count,
        (SELECT count(*)::int FROM invoices WHERE status = 'issued' AND due_date < ${today}::date) AS overdue_count,
        (SELECT count(*)::int FROM invoices WHERE status <> 'cancelled' AND year = ${year}::int) AS issued_this_year,
        (SELECT count(*)::int FROM clients WHERE archived_at IS NULL) AS client_count,
        (SELECT count(*)::int FROM recurring_invoices WHERE active) AS active_schedules
    `,
  ]);
  return { year, byCurrency, ...counts[0] };
}
