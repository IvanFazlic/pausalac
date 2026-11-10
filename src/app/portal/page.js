import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { buttonClass, cn } from "@/components/classes";
import {
  Card,
  EmptyState,
  InvoiceStatusBadge,
  MoneyList,
  PageHeader,
  Table,
  Td,
  Th,
  rowClass,
} from "@/components/ui";
import { invoiceScope, requirePortalUser } from "@/lib/auth/session";
import { listInvoiceYears, listInvoices } from "@/lib/data/invoices";
import { formatDate } from "@/lib/dates";

// Per-currency sum of invoice totals, in whole cents so it is exact.
function sumTotals(invoices) {
  const cents = new Map();
  for (const invoice of invoices) {
    for (const total of invoice.totals) {
      cents.set(total.currency, (cents.get(total.currency) ?? 0) + Math.round(Number(total.total) * 100));
    }
  }
  return [...cents.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => ({ currency, total: value / 100 }));
}

function InvoiceTable({ invoices, showClient }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Number</Th>
          {showClient ? <Th>Client</Th> : null}
          <Th>Issued</Th>
          <Th>Due</Th>
          <Th align="right">Amount</Th>
          <Th>Status</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id} className={rowClass}>
            <Td>
              <Link
                href={`/portal/invoices/${invoice.id}`}
                className="num font-mono font-medium text-ink hover:text-accent"
              >
                {invoice.number}
              </Link>
            </Td>
            {showClient ? <Td className="max-w-64 truncate text-muted">{invoice.client_name}</Td> : null}
            <Td className="num whitespace-nowrap text-muted">{formatDate(invoice.issue_date)}</Td>
            <Td className="num whitespace-nowrap text-muted">{formatDate(invoice.due_date)}</Td>
            <Td align="right" className="whitespace-nowrap">
              <MoneyList totals={invoice.totals} className="items-end" />
            </Td>
            <Td>
              <InvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
            </Td>
            <Td align="right">
              <a
                href={`/api/invoices/${invoice.id}/pdf`}
                download
                className={buttonClass({ variant: "ghost", size: "sm" })}
                aria-label={`Download invoice ${invoice.number} as PDF`}
              >
                <Download aria-hidden="true" />
                PDF
              </a>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

// What a read-only auditor login sees: every invoice, one year at a time.
async function AuditorView({ user, query }) {
  const years = await listInvoiceYears();
  const requested = Number(query.year);
  const year = years.includes(requested) ? requested : years[0] ?? null;
  const invoices = year ? await listInvoices({ ...invoiceScope(user), year, limit: 5000 }) : [];
  const counted = invoices.filter((invoice) => invoice.status !== "cancelled");
  const totals = sumTotals(counted);

  return (
    <>
      <PageHeader
        title="All invoices"
        description="Read-only. Every invoice issued, with its PDF."
      >
        {years.length > 0 ? (
          <nav aria-label="Year" className="flex flex-wrap gap-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/portal?year=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={cn(
                  "num rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  y === year ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-ink"
                )}
              >
                {y}
              </Link>
            ))}
          </nav>
        ) : null}
      </PageHeader>

      {year ? (
        <Card className="mb-6 flex flex-wrap items-baseline gap-x-8 gap-y-2 p-5">
          <p className="text-[13px] font-medium text-muted">
            Invoiced in {year}
            <span className="font-normal">
              {" "}
              · {counted.length} {counted.length === 1 ? "invoice" : "invoices"}
              {counted.length !== invoices.length ? `, ${invoices.length - counted.length} cancelled not counted` : ""}
            </span>
          </p>
          <MoneyList totals={totals} className="text-base font-semibold text-ink sm:flex-row sm:gap-x-6" />
        </Card>
      ) : null}

      <Card>
        {invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices yet" description="Issued invoices will appear here." />
        ) : (
          <InvoiceTable invoices={invoices} showClient />
        )}
      </Card>
    </>
  );
}

// What a client login sees: only the invoices issued to its own client.
async function ClientView({ user }) {
  const invoices = await listInvoices(invoiceScope(user));
  const unpaidTotals = sumTotals(invoices.filter((invoice) => invoice.status === "issued"));

  return (
    <>
      <PageHeader
        title="Your invoices"
        description={
          unpaidTotals.length > 0 ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              To pay:
              <MoneyList totals={unpaidTotals} className="font-medium text-ink sm:flex-row sm:gap-x-3" />
            </span>
          ) : invoices.length > 0 ? (
            "Nothing to pay right now."
          ) : null
        }
      />

      <Card>
        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Invoices issued to you will appear here, ready to view and download."
          />
        ) : (
          <InvoiceTable invoices={invoices} showClient={false} />
        )}
      </Card>
    </>
  );
}

export default async function PortalPage({ searchParams }) {
  const user = await requirePortalUser();
  if (user.role === "auditor") return <AuditorView user={user} query={await searchParams} />;
  return <ClientView user={user} />;
}
