import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import { ActionButton } from "@/components/action-button";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  MoneyList,
  PageHeader,
  Table,
  Td,
  Th,
  rowClass,
} from "@/components/ui";
import { runDueNowAction, setScheduleActiveAction } from "@/lib/actions/recurring";
import { requireOwner } from "@/lib/auth/session";
import { listSchedules } from "@/lib/data/recurring";
import { formatDate, todayISO } from "@/lib/dates";
import { computeTotals } from "@/lib/money";

export const metadata = { title: "Recurring invoices" };

function ScheduleStatus({ schedule, today }) {
  if (!schedule.next_run_date) return <Badge>Ended</Badge>;
  if (schedule.client_archived) return <Badge tone="warning">Client archived</Badge>;
  if (!schedule.active) return <Badge tone="warning">Paused</Badge>;
  if (schedule.next_run_date <= today) return <Badge tone="info">Due now</Badge>;
  return <Badge tone="success">Active</Badge>;
}

export default async function RecurringPage() {
  await requireOwner();
  const schedules = await listSchedules();
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Recurring invoices"
        description="Invoices that issue themselves every week or month. Due invoices are issued automatically each morning."
        actions={
          <>
            {schedules.length > 0 ? <ActionButton action={runDueNowAction}>Issue due invoices now</ActionButton> : null}
            <LinkButton href="/recurring/new">
              <Plus aria-hidden="true" />
              New schedule
            </LinkButton>
          </>
        }
      />

      <Card>
        {schedules.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No recurring invoices"
            description="For a retainer or any fixed fee: choose the client, the items and how often. Each invoice is issued on its date with the next number."
            action={
              <LinkButton href="/recurring/new">
                <Plus aria-hidden="true" />
                New schedule
              </LinkButton>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Schedule</Th>
                <Th>Repeats</Th>
                <Th>Next invoice</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule) => (
                <tr key={schedule.id} className={rowClass}>
                  <Td>
                    <Link href={`/recurring/${schedule.id}`} className="font-medium text-ink hover:text-accent">
                      {schedule.name || schedule.client_name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {schedule.client_name}
                      {schedule.runs_count > 0 ? ` · ${schedule.runs_count} issued` : ""}
                    </p>
                  </Td>
                  <Td className="text-muted">{schedule.frequency === "weekly" ? "Weekly" : "Monthly"}</Td>
                  <Td className="num whitespace-nowrap text-muted">
                    {schedule.next_run_date ? formatDate(schedule.next_run_date) : "—"}
                    {schedule.end_date ? (
                      <p className="mt-0.5 text-xs text-faint">until {formatDate(schedule.end_date)}</p>
                    ) : null}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">
                    <MoneyList totals={computeTotals(schedule.items)} className="items-end" />
                  </Td>
                  <Td>
                    <ScheduleStatus schedule={schedule} today={today} />
                  </Td>
                  <Td align="right">
                    {schedule.next_run_date ? (
                      <ActionButton
                        size="sm"
                        variant="ghost"
                        action={setScheduleActiveAction.bind(null, schedule.id, !schedule.active)}
                      >
                        {schedule.active ? "Pause" : "Resume"}
                      </ActionButton>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
