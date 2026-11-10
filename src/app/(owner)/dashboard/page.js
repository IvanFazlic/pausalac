import Link from "next/link";
import { Building2, CalendarClock, FileText, Plus, Users } from "lucide-react";
import {
  Callout,
  Card,
  CardHeader,
  EmptyState,
  InvoiceStatusBadge,
  LinkButton,
  MoneyList,
  PageHeader,
  Table,
  Td,
  Th,
  rowClass,
} from "@/components/ui";
import { requireOwner } from "@/lib/auth/session";
import { getCompany } from "@/lib/data/company";
import { getDashboardStats, listInvoices } from "@/lib/data/invoices";
import { listUpcoming } from "@/lib/data/recurring";
import { formatDate } from "@/lib/dates";
import { computeTotals } from "@/lib/money";

export const metadata = { title: "Dashboard" };

function Stat({ label, totals, field, detail, tone }) {
  const rows = totals.filter((row) => Number(row[field]) !== 0);
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <div className={`num mt-2 text-xl font-semibold tracking-tight ${tone ?? "text-ink"}`}>
        {rows.length > 0 ? (
          <MoneyList totals={rows} field={field} className="gap-0.5" />
        ) : (
          <span className="text-faint">0.00</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{detail}</p>
    </Card>
  );
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export default async function DashboardPage() {
  await requireOwner();
  const [company, stats, recent, upcoming] = await Promise.all([
    getCompany(),
    getDashboardStats(),
    listInvoices({ limit: 6 }),
    listUpcoming(5),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={company ? company.name : "Welcome. Two steps and you can issue your first invoice."}
        actions={
          <LinkButton href="/invoices/new">
            <Plus aria-hidden="true" />
            New invoice
          </LinkButton>
        }
      />

      <div className="space-y-6">
        {!company ? (
          <Callout
            tone="accent"
            icon={Building2}
            title="Add your company details"
            action={
              <LinkButton href="/settings" size="sm">
                Open settings
              </LinkButton>
            }
          >
            Your name, address, PIB and bank account are printed on every invoice.
          </Callout>
        ) : null}
        {company && stats.client_count === 0 ? (
          <Callout
            tone="accent"
            icon={Users}
            title="Add your first client"
            action={
              <LinkButton href="/clients/new" size="sm">
                New client
              </LinkButton>
            }
          >
            Invoices are issued to clients, and each client can get a login to see their own invoices.
          </Callout>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Unpaid"
            totals={stats.byCurrency}
            field="outstanding"
            detail={plural(stats.unpaid_count, "invoice")}
          />
          <Stat
            label="Overdue"
            totals={stats.byCurrency}
            field="overdue"
            detail={plural(stats.overdue_count, "invoice")}
            tone={stats.overdue_count > 0 ? "text-danger" : undefined}
          />
          <Stat
            label={`Paid in ${stats.year}`}
            totals={stats.byCurrency}
            field="paid_this_year"
            detail="Invoices marked as paid"
          />
          <Stat
            label={`Invoiced in ${stats.year}`}
            totals={stats.byCurrency}
            field="invoiced_this_year"
            detail={`${plural(stats.issued_this_year, "invoice")}, cancelled excluded`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
          <Card>
            <CardHeader
              title="Recent invoices"
              actions={
                <Link href="/invoices" className="text-[13px] font-medium text-accent hover:underline">
                  View all
                </Link>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                description="Invoices you issue appear here with their status."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Number</Th>
                    <Th>Client</Th>
                    <Th>Due</Th>
                    <Th align="right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((invoice) => (
                    <tr key={invoice.id} className={rowClass}>
                      <Td>
                        <Link href={`/invoices/${invoice.id}`} className="num font-mono font-medium text-ink hover:text-accent">
                          {invoice.number}
                        </Link>
                      </Td>
                      <Td className="max-w-56 truncate text-muted">{invoice.client_name}</Td>
                      <Td className="num whitespace-nowrap text-muted">{formatDate(invoice.due_date)}</Td>
                      <Td align="right" className="whitespace-nowrap">
                        <MoneyList totals={invoice.totals} className="items-end" />
                      </Td>
                      <Td>
                        <InvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Scheduled next"
              actions={
                <Link href="/recurring" className="text-[13px] font-medium text-accent hover:underline">
                  Manage
                </Link>
              }
            />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nothing scheduled"
                description="Set up a weekly or monthly invoice and it is issued for you."
              />
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((schedule) => (
                  <li key={schedule.id} className="px-5 py-3">
                    <Link href={`/recurring/${schedule.id}`} className="group block">
                      <p className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-ink group-hover:text-accent">
                          {schedule.name || schedule.client_name}
                        </span>
                        <span className="num shrink-0 text-muted">{formatDate(schedule.next_run_date)}</span>
                      </p>
                      <p className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted">
                        <span className="truncate">{schedule.client_name}</span>
                        <MoneyList totals={computeTotals(schedule.items)} className="shrink-0 items-end" />
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
