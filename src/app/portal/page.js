import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { buttonClass } from "@/components/classes";
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
import { requireClient } from "@/lib/auth/session";
import { listInvoices } from "@/lib/data/invoices";
import { formatDate } from "@/lib/dates";

export default async function PortalPage() {
  const user = await requireClient();
  // Always scoped to the signed-in login's own client.
  const invoices = await listInvoices({ clientId: user.client_id });

  // Summed in whole cents so the total is exact.
  const unpaidCents = new Map();
  for (const invoice of invoices) {
    if (invoice.status !== "issued") continue;
    for (const total of invoice.totals) {
      const cents = Math.round(Number(total.total) * 100);
      unpaidCents.set(total.currency, (unpaidCents.get(total.currency) ?? 0) + cents);
    }
  }
  const unpaidTotals = [...unpaidCents.entries()].map(([currency, cents]) => ({
    currency,
    total: cents / 100,
  }));

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
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
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
        )}
      </Card>
    </>
  );
}
