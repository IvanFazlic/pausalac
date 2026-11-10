import { notFound } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { RecurringForm } from "@/components/recurring-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { deleteScheduleAction, setScheduleActiveAction } from "@/lib/actions/recurring";
import { requireOwner } from "@/lib/auth/session";
import { listClientOptions } from "@/lib/data/clients";
import { getSettings } from "@/lib/data/company";
import { getSchedule } from "@/lib/data/recurring";
import { formatDateTime, todayISO } from "@/lib/dates";
import { isUuid } from "@/lib/db";

export const metadata = { title: "Edit schedule" };

export default async function SchedulePage({ params }) {
  await requireOwner();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [schedule, settings, clients] = await Promise.all([getSchedule(id), getSettings(), listClientOptions()]);
  if (!schedule) notFound();

  // Keep the schedule's client selectable even if it has since been archived.
  const options = clients.some((client) => client.id === schedule.client_id)
    ? clients
    : [
        {
          id: schedule.client_id,
          name: `${schedule.client_name} (archived)`,
          default_currency: settings.default_currency,
          invoice_language: "sr",
          payment_terms_days: null,
        },
        ...clients,
      ];
  const ended = !schedule.next_run_date;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {schedule.name || schedule.client_name}
            {ended ? <Badge>Ended</Badge> : schedule.active ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Paused</Badge>}
          </span>
        }
        description={
          schedule.runs_count > 0
            ? `${schedule.runs_count} issued so far${schedule.last_run_at ? `, last on ${formatDateTime(schedule.last_run_at)}` : ""}.`
            : "No invoices issued yet."
        }
        back={{ href: "/recurring", label: "Recurring invoices" }}
        actions={
          ended ? null : (
            <ActionButton action={setScheduleActiveAction.bind(null, schedule.id, !schedule.active)}>
              {schedule.active ? "Pause" : "Resume"}
            </ActionButton>
          )
        }
      />

      <RecurringForm
        clients={options}
        defaults={settings}
        today={todayISO()}
        schedule={{
          id: schedule.id,
          client_id: schedule.client_id,
          name: schedule.name,
          frequency: schedule.frequency,
          anchor_date: schedule.anchor_date,
          next_run_date: schedule.next_run_date,
          end_date: schedule.end_date,
          runs_count: schedule.runs_count,
          payment_terms_days: schedule.payment_terms_days,
          payment_purpose: schedule.payment_purpose,
          note: schedule.note,
          items: schedule.items,
        }}
      />

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Delete schedule</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Stops future invoices. Invoices this schedule already issued are kept.
          </p>
        </div>
        <ActionButton
          variant="danger"
          confirm="Delete this schedule?"
          confirmLabel="Delete"
          action={deleteScheduleAction.bind(null, schedule.id)}
        >
          Delete schedule
        </ActionButton>
      </Card>
    </>
  );
}
