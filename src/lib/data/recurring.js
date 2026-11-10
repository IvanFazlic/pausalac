import { sql, isUniqueViolation } from "@/lib/db";
import { addDays, occurrenceDate, todayISO } from "@/lib/dates";
import { createInvoice } from "@/lib/data/invoices";
import { getSettings } from "@/lib/data/company";

export async function listSchedules() {
  return sql`
    SELECT
      r.id, r.client_id, r.name, r.frequency,
      r.next_run_date::text AS next_run_date,
      r.end_date::text AS end_date,
      r.runs_count, r.items, r.active, r.last_run_at,
      c.name AS client_name,
      c.archived_at IS NOT NULL AS client_archived
    FROM recurring_invoices r
    JOIN clients c ON c.id = r.client_id
    ORDER BY r.active DESC, r.next_run_date NULLS LAST, r.created_at
  `;
}

export async function listUpcoming(limit = 5) {
  return sql`
    SELECT r.id, r.name, r.frequency, r.next_run_date::text AS next_run_date, r.items, c.name AS client_name
    FROM recurring_invoices r
    JOIN clients c ON c.id = r.client_id
    WHERE r.active AND r.next_run_date IS NOT NULL AND c.archived_at IS NULL
    ORDER BY r.next_run_date, r.created_at
    LIMIT ${limit}::int
  `;
}

export async function getSchedule(id) {
  const rows = await sql`
    SELECT
      r.id, r.client_id, r.name, r.frequency,
      r.anchor_date::text AS anchor_date,
      r.next_run_date::text AS next_run_date,
      r.end_date::text AS end_date,
      r.runs_count, r.payment_terms_days, r.payment_purpose, r.note, r.items,
      r.active, r.last_run_at, r.created_at,
      c.name AS client_name
    FROM recurring_invoices r
    JOIN clients c ON c.id = r.client_id
    WHERE r.id = ${id}::uuid
  `;
  return rows[0] ?? null;
}

export async function createSchedule(data) {
  const rows = await sql`
    INSERT INTO recurring_invoices
      (client_id, name, frequency, anchor_date, next_run_date, end_date,
       payment_terms_days, payment_purpose, note, items)
    VALUES
      (${data.clientId}::uuid, ${data.name}, ${data.frequency}, ${data.nextDate}::date,
       ${data.nextDate}::date, ${data.endDate}::date, ${data.paymentTermsDays}::int,
       ${data.paymentPurpose}, ${data.note}, ${JSON.stringify(data.items)}::jsonb)
    RETURNING id
  `;
  return rows[0].id;
}

// The occurrence pattern is only re-anchored when the next date or frequency
// actually changes; otherwise the original anchor is kept so month-end
// schedules keep landing on the right day.
export async function updateSchedule(id, data) {
  const rows = await sql`
    UPDATE recurring_invoices r SET
      client_id = ${data.clientId}::uuid,
      name = ${data.name},
      end_date = ${data.endDate}::date,
      payment_terms_days = ${data.paymentTermsDays}::int,
      payment_purpose = ${data.paymentPurpose},
      note = ${data.note},
      items = ${JSON.stringify(data.items)}::jsonb,
      anchor_date = CASE WHEN changed.pattern THEN ${data.nextDate}::date ELSE r.anchor_date END,
      runs_count = CASE WHEN changed.pattern THEN 0 ELSE r.runs_count END,
      next_run_date = ${data.nextDate}::date,
      frequency = ${data.frequency},
      active = CASE WHEN r.next_run_date IS NULL THEN true ELSE r.active END,
      updated_at = now()
    FROM (
      SELECT (next_run_date IS DISTINCT FROM ${data.nextDate}::date OR frequency <> ${data.frequency}) AS pattern
      FROM recurring_invoices WHERE id = ${id}::uuid
    ) changed
    WHERE r.id = ${id}::uuid
    RETURNING r.id
  `;
  return rows.length > 0;
}

export async function setScheduleActive(id, active) {
  await sql`
    UPDATE recurring_invoices
    SET active = ${active}::boolean, updated_at = now()
    WHERE id = ${id}::uuid AND (NOT ${active}::boolean OR next_run_date IS NOT NULL)
  `;
}

// Invoices already issued by the schedule are kept; only the link is removed.
export async function deleteSchedule(id) {
  await sql`DELETE FROM recurring_invoices WHERE id = ${id}::uuid`;
}

const MAX_CATCH_UP = 24;

// Issues every invoice that is due. Called daily by the cron job and by the
// "Run now" button. Safe to call concurrently or repeatedly: each occurrence
// is claimed atomically together with the invoice it produces.
export async function runDueSchedules({ today = todayISO() } = {}) {
  const [settings, due] = await Promise.all([
    getSettings(),
    sql`
      SELECT
        r.id, r.client_id, r.frequency,
        r.anchor_date::text AS anchor_date,
        r.next_run_date::text AS next_run_date,
        r.end_date::text AS end_date,
        r.runs_count, r.payment_terms_days, r.payment_purpose, r.note, r.items,
        c.invoice_language AS language
      FROM recurring_invoices r
      JOIN clients c ON c.id = r.client_id
      WHERE r.active AND r.next_run_date <= ${today}::date AND c.archived_at IS NULL
      ORDER BY r.next_run_date, r.created_at
    `,
  ]);

  const created = [];
  const errors = [];

  for (const schedule of due) {
    const english = schedule.language === "en";
    let runDate = schedule.next_run_date;
    let runs = schedule.runs_count;

    for (let i = 0; runDate && runDate <= today && i < MAX_CATCH_UP; i += 1) {
      let next = occurrenceDate(schedule.anchor_date, schedule.frequency, runs + 1);
      if (schedule.end_date && next > schedule.end_date) next = null;

      try {
        const invoice = await createInvoice({
          clientId: schedule.client_id,
          issueDate: today,
          serviceDate: today,
          dueDate: addDays(today, schedule.payment_terms_days),
          placeOfIssue: settings.place_of_issue,
          paymentMethod: english ? settings.payment_method_en : settings.payment_method,
          paymentPurpose: schedule.payment_purpose || settings.payment_purpose,
          note: schedule.note ?? (english ? settings.default_note_en : settings.default_note),
          vatRate: settings.vat_rate,
          items: schedule.items,
          recurring: { id: schedule.id, scheduledFor: runDate, nextRunDate: next },
        });
        created.push({ id: invoice.id, number: invoice.number, scheduleId: schedule.id, scheduledFor: runDate });
      } catch (error) {
        if (isUniqueViolation(error, "invoices_recurring_run_key")) {
          // This occurrence already has an invoice (another run got there
          // first). The transaction rolled back, so just move the schedule on.
          await sql`
            UPDATE recurring_invoices SET
              runs_count = runs_count + 1,
              next_run_date = ${next}::date,
              active = active AND ${next}::date IS NOT NULL,
              updated_at = now()
            WHERE id = ${schedule.id}::uuid AND next_run_date = ${runDate}::date
          `;
        } else {
          console.error(`Recurring invoice ${schedule.id} failed for ${runDate}:`, error);
          errors.push({ scheduleId: schedule.id, scheduledFor: runDate, message: error.message });
          break;
        }
      }

      runDate = next;
      runs += 1;
    }
  }

  return { today, created, errors };
}
